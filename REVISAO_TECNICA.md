# Revisão Técnica — Reservas Piscina/Academia (Valle D'incanto)

> **Data da revisão:** 12/07/2026
> **Escopo:** todo o código-fonte (`src/`), migrations SQL (`supabase/`), testes e configuração.
> **Foco:** (1) bugs e correções; (2) preparação para crescimento; (3) banco de dados pronto para análise em Power BI.
>
> Cada item tem prioridade (🔴 crítico / 🟠 importante / 🟡 melhoria / 🔵 opcional) e aponta os arquivos exatos. No final há um **plano passo a passo** para aplicar as correções em ordem segura.

---

## Sumário executivo

O projeto está bem acima da média para o estágio em que está: validação dupla (Zod no servidor + constraints no banco), RLS negando acesso público, tratamento correto de corrida via `UNIQUE` + código `23505`, fuso horário do hotel centralizado, e testes unitários/integração/e2e reais. A base é sólida.

Os problemas encontrados se concentram em três pontos:

1. **Segurança:** o cookie da recepção é forjável (qualquer pessoa consegue acesso total sem senha) — correção urgente.
2. **Perda de dados históricos:** cancelamento apaga a linha do banco (DELETE físico) e reservas de balcão gravam `guest_checkout_date` falso. Esses dois pontos **inviabilizam análises confiáveis no Power BI** e precisam ser corrigidos *antes* de acumular mais dados — dado apagado não volta.
3. **Falta de infraestrutura analítica:** sem coluna de status, sem `updated_at`, sem views para BI, sem usuário de leitura para o Power BI.

---

## 1. Segurança

### 1.1 🔴 Cookie da recepção é forjável — acesso total sem senha

**Arquivos:** [reception-auth.ts](src/lib/reception-auth.ts), [reservations.ts:44-63](src/app/actions/reservations.ts)

O login da recepção grava o cookie `reception_auth` com o valor literal `"1"`:

```ts
export const RECEPTION_COOKIE_VALUE = "1";
// ...
jar.set(RECEPTION_COOKIE, RECEPTION_COOKIE_VALUE, { ... });
```

E toda a autorização do sistema é `cookie === "1"`. Qualquer pessoa que abra o DevTools do navegador (ou use `curl`) e defina manualmente `reception_auth=1` ganha **acesso completo à recepção**: ver todas as reservas com nome e WhatsApp dos hóspedes, criar/apagar reservas e gerar tokens de estadia. O `httpOnly` protege contra roubo do cookie via XSS, mas não impede ninguém de *criar* o cookie do lado de fora — o servidor não tem como distinguir.

**Correção:** o valor do cookie precisa ser algo que só o servidor consegue produzir. Duas opções, em ordem de simplicidade:

- **Opção A (mínima, sem dependências):** gravar um HMAC assinado com um segredo do servidor, por exemplo `HMAC_SHA256(SESSION_SECRET, "reception:" + expiraEm) + "." + expiraEm`, e validar assinatura + expiração em `readReceptionAuthed()`. Adicionar `SESSION_SECRET` ao `.env`.
- **Opção B (mais robusta):** tabela `reception_sessions (token uuid, created_at, expires_at)` no Supabase — mesmo padrão já usado em `active_stays`. Permite revogar sessões e auditar logins.

### 1.2 🟠 Login sem limite de tentativas (força bruta)

**Arquivo:** [reservations.ts:44](src/app/actions/reservations.ts)

`loginReception` compara a senha e responde imediatamente, sem limite de tentativas, sem atraso e sem registro. Um script pode testar milhares de senhas por minuto. Combinado com 1.1 corrigido, este passa a ser o caminho de ataque restante.

**Correção:** rate limiting no server action. Em Vercel (serverless) memória local não persiste entre invocações; opções:
- Tabela `login_attempts` no Supabase (ip/hash, janela de 15 min, máx. 5 tentativas) — sem dependência nova;
- ou Upstash Redis (`@upstash/ratelimit`) se preferir algo pronto.
Também vale registrar tentativas falhadas (vira dado de auditoria).

### 1.3 🟡 Sessão da recepção não expira de fato no servidor

O `maxAge: 12h` do cookie é aplicado pelo *navegador*; o servidor aceita o valor para sempre. Com a correção 1.1 (expiração embutida no HMAC ou na tabela de sessões), isso se resolve junto — só não esquecer de validar a expiração no servidor.

### 1.4 🟡 Middleware sem timeout na chamada ao Supabase

**Arquivo:** [middleware.ts:25-32](src/middleware.ts)

`fetchStayFromSupabase` usa `fetch` sem timeout. Se o Supabase estiver lento, toda navegação `/hospede/*` fica pendurada até o timeout padrão da plataforma. Adicionar `signal: AbortSignal.timeout(5000)` e tratar como "não validado".

### 1.5 🔵 Tokens de estadia nunca são limpos

**Arquivo:** [20260410120000_active_stays.sql](supabase/migrations/20260410120000_active_stays.sql)

Linhas de `active_stays` ficam para sempre: o token para de funcionar após o checkout (validação no app), mas apartamento + data de checkout permanecem no banco indefinidamente — cresce sem limite e é retenção desnecessária sob a ótica LGPD. Adicionar job no mesmo pg_cron da anonimização: `DELETE FROM active_stays WHERE checkout_date < CURRENT_DATE - INTERVAL '30 days'`.

Detalhe menor no mesmo arquivo: `active_stays_token_idx` é redundante — a constraint `UNIQUE (token)` já cria índice. Pode remover.

---

## 2. Perda de dados históricos (bloqueia o Power BI)

Esta é a seção mais importante para o seu objetivo declarado. **O projeto anterior (Gerenciador-de-Reservas) passou exatamente por isso** — as views do Power BI só ficaram corretas depois que o cancelamento passou a ser registrado em vez de apagado. Vale aplicar a lição aqui desde o início.

### 2.1 🔴 Cancelar reserva = DELETE físico — o histórico some

**Arquivos:** [reservations.ts:619-655](src/app/actions/reservations.ts) (`deleteReservation`), [reception-dashboard.tsx:377-394](src/app/recepcao/reception-dashboard.tsx)

Hoje, cancelar uma reserva remove a linha do banco. Consequências para análise:

- **Taxa de cancelamento** — métrica básica de qualquer BI de reservas — é impossível de calcular;
- Demanda real fica subestimada (uma reserva feita e cancelada é demanda que existiu);
- Não há como auditar "quem cancelou e quando";
- Padrões de comportamento (ex.: horários com mais desistência) são invisíveis.

**Correção (soft delete):**

```sql
ALTER TABLE public.reservations
  ADD COLUMN status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'cancelled')),
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN cancelled_by text CHECK (cancelled_by IN ('guest', 'reception'));
```

Pontos de atenção da migração (é a mais delicada do plano):

1. As constraints `UNIQUE (facility, reservation_date, slot_start)` e `UNIQUE (facility, reservation_date, apartment_number)` precisam virar **índices únicos parciais** — senão um horário cancelado continuaria bloqueando o slot:
   ```sql
   ALTER TABLE public.reservations DROP CONSTRAINT reservations_facility_date_slot_unique;
   ALTER TABLE public.reservations DROP CONSTRAINT reservations_facility_date_apartment_unique;
   CREATE UNIQUE INDEX reservations_active_slot_unique
     ON public.reservations (facility, reservation_date, slot_start) WHERE status = 'active';
   CREATE UNIQUE INDEX reservations_active_apartment_unique
     ON public.reservations (facility, reservation_date, apartment_number) WHERE status = 'active';
   ```
2. `uniqueViolationKind()` em [reservations.ts:34-42](src/app/actions/reservations.ts) identifica o conflito pelo **nome da constraint** no texto do erro — precisa passar a reconhecer os nomes dos novos índices parciais.
3. Todas as consultas de disponibilidade precisam filtrar `status = 'active'`: `getReservationDaySummary`, `assertSlotAndApartmentFree`, `getReservationsForDate` (esta última pode *mostrar* canceladas com visual diferente, ou filtrar — decisão de produto).
4. `deleteReservation` vira `cancelReservation`: `UPDATE ... SET status='cancelled', cancelled_at=now(), cancelled_by='reception'`.
5. O cron de anonimização LGPD ([20260416120000...](supabase/migrations/20260416120000_lgpd_reservations_anonymize_cron.sql)) continua válido — canceladas também devem ser anonimizadas.

### 2.2 🔴 Reserva de balcão grava `guest_checkout_date` falso

**Arquivo:** [reservations.ts:382](src/app/actions/reservations.ts)

```ts
const guestCheckoutDate = reservationDate; // ← inventa que o checkout é o dia da reserva
```

Toda reserva criada pela recepção grava o checkout igual à data da reserva. Isso "passa" na validação, mas **grava dado falso no banco**: no Power BI, qualquer análise de duração de estadia, antecedência ou comportamento por estadia sai distorcida para ~metade das linhas (as de balcão), sem nenhuma forma de distinguir dado real de dado inventado.

**Correção:** permitir `guest_checkout_date` **NULL** para reservas de balcão (a coluna já aceita NULL) e ajustar `validateStayAndSlot` para pular a comparação com checkout quando for `null`. NULL honesto é muito melhor para análise do que valor inventado. Opcionalmente, a recepção pode informar o checkout real no formulário (campo opcional).

### 2.3 🟠 Nenhum vínculo entre reserva e estadia

**Arquivos:** [stays.ts](src/app/actions/stays.ts), [reservations.ts:236-349](src/app/actions/reservations.ts)

`active_stays` (a estadia) e `reservations` não se relacionam. Perguntas naturais de BI ficam sem resposta: *quantas reservas um hóspede faz por estadia? Quantos links gerados nunca viram reserva (taxa de conversão do link)? Piscina e academia na mesma estadia?*

**Correção:** adicionar `stay_id uuid REFERENCES active_stays(id)` em `reservations`, preenchido em `createGuestReservation` (o `getValidatedGuestStay` já busca a linha da estadia — basta retornar também o `id`). Para balcão fica NULL. Isso exige parar de deletar `active_stays` antigas com menos de X tempo (ver 1.5 — reter 30+ dias e/ou anonimizar em vez de deletar as que têm reservas vinculadas).

### 2.4 🟠 Sem `updated_at` nem trilha de auditoria de edições

**Arquivos:** [reservations.ts:461-617](src/app/actions/reservations.ts) (updates de nome, WhatsApp e flags)

A recepção pode editar nome e WhatsApp de qualquer reserva e nada registra que houve mudança, quando, nem o valor anterior. O projeto anterior já tem log de auditoria com diff de campos — mesma lição.

**Correção mínima:** coluna `updated_at timestamptz` com trigger `BEFORE UPDATE`.
**Correção completa (recomendada para BI):** tabela `reservation_events (id, reservation_id, event_type, actor, payload jsonb, created_at)` gravada pelas actions em cada criação/edição/cancelamento. Vira uma tabela-fato de eventos excelente para o Power BI (funil: criada → confirmada → avisada → cancelada).

### 2.5 🟡 Anonimização grava `''` em vez de `NULL`

**Arquivo:** [20260416120000_lgpd_reservations_anonymize_cron.sql:35](supabase/migrations/20260416120000_lgpd_reservations_anonymize_cron.sql)

O cron define `guest_whatsapp = ''` (string vazia) enquanto o app usa `NULL` para "sem WhatsApp". Duas representações do mesmo estado complicam filtros no BI (`IS NULL` vs `= ''`). Padronizar: `guest_whatsapp = NULL` e `guest_name = NULL` (ou manter `'Anonimizado'` no nome se quiser distinguir "anonimizado" de "nunca informado" — nesse caso, considerar uma flag booleana `anonymized` em vez de valor mágico).

---

## 3. Preparação do banco para Power BI

Com a seção 2 corrigida, o modelo fica confiável. Falta a camada de consumo:

### 3.1 🟠 Criar views analíticas (sem PII)

O Power BI não deve ler a tabela crua (contém nome e WhatsApp — PII sob LGPD, e colunas em formato de app, não de análise). Criar um schema `analytics` com views:

```sql
CREATE SCHEMA IF NOT EXISTS analytics;

CREATE VIEW analytics.vw_reservas AS
SELECT
  r.id,
  r.facility,
  CASE r.facility WHEN 'pool' THEN 'Piscina' ELSE 'Academia' END AS instalacao,
  r.reservation_date,
  r.slot_start,
  EXTRACT(HOUR FROM r.slot_start)::int            AS hora_slot,
  EXTRACT(ISODOW FROM r.reservation_date)::int     AS dia_semana_iso,
  r.apartment_number,
  LEFT(r.apartment_number, 1)                      AS andar,
  r.created_by                                     AS origem,
  r.status,
  r.cancelled_at,
  r.created_at,
  (r.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS data_criacao_local,
  r.reservation_date
    - (r.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS antecedencia_dias,
  r.confirmation_sent,
  r.warning_sent,
  (r.guest_whatsapp IS NOT NULL AND btrim(r.guest_whatsapp) <> '') AS tem_whatsapp
FROM public.reservations r;
```

Sem `guest_name`, sem `guest_whatsapp`, sem `notes`. Colunas derivadas (dia da semana, hora, antecedência) prontas poupam DAX e garantem que todo consumidor calcula igual.

### 3.2 🟠 Usuário de leitura exclusivo para o Power BI

Nunca conectar o Power BI com o usuário `postgres`/service role. Criar role dedicada:

```sql
CREATE ROLE powerbi_reader LOGIN PASSWORD '<senha-forte>';
GRANT USAGE ON SCHEMA analytics TO powerbi_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO powerbi_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA analytics GRANT SELECT ON TABLES TO powerbi_reader;
-- garantir que NÃO tem acesso ao schema public:
REVOKE ALL ON SCHEMA public FROM powerbi_reader;
```

**Conexão:** Supabase é Postgres — no Power BI Desktop usar o conector "PostgreSQL database" com o host do **Session Pooler** do Supabase (aba Database → Connection string; o pooler tem IPv4, a conexão direta é só IPv6 no plano free). Modo *Import* com atualização agendada é o adequado para esse volume (não usar DirectQuery).

### 3.3 🟡 Tabelas de dimensão

`ALLOWED_APARTMENT_NUMBERS` hardcoded em [apartment-codes.ts](src/lib/apartment-codes.ts) funciona hoje, mas para BI (e para o hotel mudar a lista sem deploy) uma tabela `apartments (number pk, floor, category, active)` vira dimensão natural do modelo estrela no Power BI. O mesmo vale para uma `dim_calendario` — mas essa é melhor gerada dentro do próprio Power BI (DAX `CALENDAR()`), prática padrão.

### 3.4 🔵 Métricas que o modelo já suportará após as correções

Só para deixar registrado o que o dashboard poderá responder: ocupação por instalação/horário/dia da semana, taxa de cancelamento, antecedência média de reserva, origem (hóspede × recepção), conversão de link de estadia em reserva (com 2.3), funil confirmação/aviso, horários de pico por temporada.

---

## 4. Bugs funcionais e casos de borda

### 4.1 🟠 É possível reservar horário que já passou (no dia de hoje)

**Arquivo:** [reservation-slot-validation.ts:19](src/lib/reservation-slot-validation.ts)

`validateStayAndSlot` rejeita datas passadas, mas para **hoje** aceita qualquer slot — às 18h um hóspede consegue reservar o slot das 13h. Além da experiência estranha, isso vira ruído nos dados (reserva "fantasma" que nunca pôde ser usada). Corrigir comparando `slot_start` com a hora atual do hotel quando `reservationDate === todayYmd` (lembrar do caso especial do slot `00:00`, que pertence ao dia em que começa). Decidir se a regra vale também para a recepção (balcão pode ter motivo legítimo para registrar retroativo — se sim, aplicar só ao hóspede e registrar a exceção).

### 4.2 🟠 Data do navegador ≠ data do hotel no fluxo do hóspede

**Arquivo:** [guest-booking.tsx:131,183,204](src/components/guest-booking.tsx)

`format(selectedDate, "yyyy-MM-dd")` usa o fuso do **navegador do hóspede**. Turista com celular em fuso estrangeiro (ex.: Europa, +4h) perto da meia-noite seleciona um dia e envia outro — ou o calendário desabilita o dia errado (`minDate`/`maxDate` construídos como Date local misturados com strings do fuso do hotel). O servidor revalida (a reserva errada não entra), mas o hóspede vê erro confuso. Baixa frequência, mas em Gramado turista estrangeiro existe. Correção: tratar datas como string `yyyy-MM-dd` de ponta a ponta no componente (o calendário já trabalha com `Date` puro de `fromYmd`, que é seguro; o problema é só gerar o ymd com `format()` local — usar uma função que formata o próprio `Date` selecionado por partes, `getFullYear/getMonth/getDate`, que é o que `fromYmd` inverte).

### 4.3 🟡 Hóspede consegue consultar ocupação de qualquer data e vê aptos ocupados

**Arquivo:** [reservations.ts:75-132](src/app/actions/reservations.ts)

`getReservationDaySummary` exige estadia válida, mas não limita a consulta ao período da estadia, e retorna `apartmentsBooked` — lista de apartamentos com reserva no dia — para o hóspede. Vazamento leve de privacidade (números de apto de terceiros) e superfície além do necessário. Correção: para hóspede, limitar `reservationDate` entre hoje e o checkout, e retornar dos apartamentos apenas um booleano `meuAptoJaReservou` em vez da lista completa.

### 4.4 🟡 Cliente Supabase recriado a cada chamada

**Arquivo:** [admin.ts:20-31](src/lib/supabase/admin.ts)

`getAdminClient()` cria um `createClient` novo por action. Funciona, mas descarta conexões/keep-alive e soma latência conforme o tráfego cresce. Memoizar em variável de módulo (singleton por instância serverless).

### 4.5 🟡 Middleware consulta o banco em toda navegação `/hospede/*`

**Arquivo:** [middleware.ts:66-117](src/middleware.ts)

Cada request a `/hospede/*` faz um round-trip ao Supabase REST. Com pouco tráfego é irrelevante; crescendo, é latência e carga desnecessárias — e as actions **já revalidam** o token no banco de qualquer forma (`getValidatedGuestStay`). Opções: (a) aceitar como está até doer; (b) cookie assinado com `{token, apartment, checkout, exp}` (HMAC, mesmo `SESSION_SECRET` de 1.1) validado sem banco no middleware, mantendo a validação forte nas actions. A opção (b) elimina 100% das consultas do middleware.

### 4.6 🟡 Polling de 30s da recepção não é condicional

**Arquivo:** [reception-dashboard.tsx:339-346](src/app/recepcao/reception-dashboard.tsx)

A grade recarrega a cada 30s por aba aberta, mesmo com a aba em segundo plano. Barato hoje; com o tempo, pausar quando `document.visibilityState !== 'visible'` (uma linha no callback) corta a maior parte das chamadas. Supabase Realtime é alternativa futura, não necessidade.

### 4.7 🔵 Miudezas

- [reception-dashboard.tsx:606-607](src/app/recepcao/reception-dashboard.tsx): colunas de cabeçalho "WhatsApp" e "whatsapp" — renomear a segunda para "Mensagens" ou "Ações WhatsApp".
- [reservations.ts:29-31](src/lib/reservations.ts) (lib): export `SLOT_STARTS` deprecated — remover quando nada mais usar.
- `markMessageAsSent` marca como enviada ao *abrir* o WhatsApp Web, sem saber se a mensagem foi de fato enviada — limitação conhecida do fluxo wa.me; ok, mas documentar no código para o "eu do futuro" não tratar a flag como verdade absoluta no BI (é "envio iniciado", não "entregue").
- `.env`: não há validação de variáveis no startup — um typo em `SUPABASE_SERVICE_ROLE_KEY` só aparece em runtime como "Base de dados não configurada". Um `env.ts` com Zod validando `process.env` no boot falha rápido e com mensagem clara.

---

## 5. Observabilidade e operação (crescimento)

- 🟠 **Monitoramento de erros:** hoje só `console.error` (some nos logs da Vercel). Integrar Sentry (free tier cobre) nas server actions e no client — quando o hotel depender do sistema, saber que quebrou antes da recepção ligar é o que separa amador de produção.
- 🟡 **Backup:** Supabase free faz backup diário com retenção curta. Antes de o BI depender do histórico, agendar `pg_dump` semanal externo (GitHub Action com cron) ou plano pago. **Dado analítico só tem valor se sobreviver.**
- 🟡 **Testes das actions:** a cobertura de `lib/` é boa, mas as server actions (autorização! conflito! soft delete novo) não têm testes diretos. Ao implementar as correções da seção 2, adicionar testes de integração para `cancelReservation` e para os índices parciais (cancelar → slot volta a ficar livre → recriar funciona).
- 🔵 **CI:** garantir que lint + testes rodam em PR (GitHub Actions) se ainda não rodam.

---

## 6. Plano de execução passo a passo

Ordem pensada para: segurança primeiro, depois estancar a perda de dados, depois a camada BI, depois polimento. Cada passo é um commit/PR independente e testável.

### Fase 1 — Segurança (fazer já)
- [ ] **1.1** Cookie da recepção assinado (HMAC + expiração; env `SESSION_SECRET`) — itens 1.1 e 1.3
- [ ] **1.2** Rate limit no `loginReception` (tabela `login_attempts` no Supabase) — item 1.2
- [ ] **1.3** Timeout de 5s no fetch do middleware — item 1.4

### Fase 2 — Estancar perda de dados (antes de acumular mais histórico)
- [ ] **2.1** Migration soft delete: `status` + `cancelled_at` + `cancelled_by` + índices únicos parciais — item 2.1
- [ ] **2.2** Atualizar actions: `cancelReservation`, filtros `status='active'`, novos nomes em `uniqueViolationKind` — item 2.1
- [ ] **2.3** `guest_checkout_date` NULL para balcão + ajuste em `validateStayAndSlot` — item 2.2
- [ ] **2.4** Trigger `updated_at`; avaliar tabela `reservation_events` — item 2.4
- [ ] **2.5** Corrigir anonimização para `NULL` — item 2.5
- [ ] **2.6** Testes de integração do soft delete (cancelar → liberar slot → recriar)

### Fase 3 — Camada Power BI
- [ ] **3.1** `stay_id` em `reservations` + retenção de `active_stays` (limpeza 30 dias, sem apagar estadias com reservas) — itens 2.3 e 1.5
- [ ] **3.2** Schema `analytics` + `vw_reservas` (sem PII) — item 3.1
- [ ] **3.3** Role `powerbi_reader` + conexão via Session Pooler no Power BI — item 3.2
- [ ] **3.4** Primeiro relatório: ocupação por dia da semana × hora, taxa de cancelamento, origem

### Fase 4 — Correções funcionais
- [ ] **4.1** Bloquear slot já passado no dia atual — item 4.1
- [ ] **4.2** Datas por string no guest-booking (fuso do navegador) — item 4.2
- [ ] **4.3** Restringir `getReservationDaySummary` para hóspede (período da estadia; sem lista de aptos) — item 4.3

### Fase 5 — Crescimento e operação
- [ ] **5.1** Singleton do client Supabase — item 4.4
- [ ] **5.2** Sentry nas actions + client — seção 5
- [ ] **5.3** Backup externo semanal — seção 5
- [ ] **5.4** Cookie de estadia assinado no middleware (elimina consulta por request) — item 4.5
- [ ] **5.5** Polling pausado com aba oculta; renomear coluna "whatsapp"; `env.ts` com validação — itens 4.6/4.7
- [ ] **5.6** Tabela `apartments` como dimensão — item 3.3

---

## 7. O que está bom e deve ser mantido como está

Para não "consertar o que funciona":

- **Validação em três camadas** (client → Zod no server → constraints no Postgres) com tratamento explícito de corrida (`23505`) — é o desenho correto; o teste de concorrência em [reservations-concurrency.test.ts](tests/integration/reservations-concurrency.test.ts) prova a camada mais importante.
- **RLS deny-all + service role só no servidor** — modelo certo para esta arquitetura sem login de usuário final.
- **Fuso do hotel centralizado** (`hotelCalendarDate` / `hotelTodayYmd` com `America/Sao_Paulo`) em vez de `new Date()` espalhado.
- **Migrations versionadas** por ordem de nome + script cloud consolidado com aviso — disciplina rara em projeto de aprendizado.
- **Anonimização LGPD agendada** — a existência dela já coloca o projeto à frente; só precisa dos ajustes do item 2.5.
- **Testes unitários das regras de negócio puras** (slots, datas, Zod, apartamentos) — continuar escrevendo teste junto com cada correção deste documento.
