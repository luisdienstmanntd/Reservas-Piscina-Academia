# Roadmap de Correções — Reservas Piscina/Academia

> **Criado em:** 13/07/2026
> **Base:** análise completa registrada em [REVISAO_TECNICA.md](REVISAO_TECNICA.md) — consulte lá o detalhe técnico de cada falha (arquivos, linhas e SQL sugerido).
> **Como usar:** executar as etapas na ordem. Cada etapa = 1 commit/PR pequeno, com teste. Marcar `[x]` ao concluir e preencher a data.

---

## 1. Registro das falhas encontradas

### Críticas 🔴

| # | Falha | Onde | Impacto |
|---|-------|------|---------|
| F1 | Cookie da recepção forjável (`reception_auth=1`, sem assinatura) | `src/lib/reception-auth.ts`, `loginReception` em `src/app/actions/reservations.ts` | Qualquer pessoa obtém acesso total à recepção sem senha (dados de hóspedes, criar/apagar reservas, gerar links) |
| F2 | Cancelamento apaga a reserva do banco (DELETE físico) | `deleteReservation` em `src/app/actions/reservations.ts` | Histórico destruído; taxa de cancelamento e demanda real impossíveis de medir no Power BI |
| F3 | Reserva de balcão grava `guest_checkout_date` falso (= data da reserva) | `createReceptionReservation` em `src/app/actions/reservations.ts:382` | Dado inventado no banco; análises de estadia/antecedência distorcidas |

### Importantes 🟠

| # | Falha | Onde | Impacto |
|---|-------|------|---------|
| F4 | Login sem limite de tentativas | `loginReception` | Senha vulnerável a força bruta |
| F5 | Nenhum vínculo reserva ↔ estadia (`stay_id` inexistente) | `reservations` × `active_stays` | Impossível medir conversão do link e reservas por estadia |
| F6 | Sem `updated_at` nem auditoria de edições (nome/WhatsApp/flags) | tabela `reservations` + actions de update | Alterações invisíveis; sem trilha de auditoria |
| F7 | Possível reservar horário que já passou (no dia atual) | `validateStayAndSlot` em `src/lib/reservation-slot-validation.ts` | Reservas "fantasma"; ruído nos dados |
| F8 | Fuso do navegador usado no fluxo do hóspede | `guest-booking.tsx` (`format(selectedDate, "yyyy-MM-dd")`) | Turista com celular em fuso estrangeiro vê/envia dia errado |
| F9 | Banco sem camada analítica (views sem PII, role de leitura) | `supabase/` | Power BI teria que ler tabela crua com PII e credencial administrativa |

### Melhorias 🟡

| # | Falha | Onde |
|---|-------|------|
| F10 | Sessão da recepção não expira no servidor | `reception-auth.ts` (resolve junto com F1) |
| F11 | Middleware sem timeout na chamada ao Supabase | `src/middleware.ts` |
| F12 | Tokens de estadia nunca são limpos (`active_stays` cresce para sempre; retenção LGPD) | migration `active_stays` |
| F13 | Anonimização LGPD grava `''` em vez de `NULL` | migration `lgpd_..._cron.sql` |
| F14 | Hóspede consulta ocupação de qualquer data e vê lista de aptos ocupados | `getReservationDaySummary` |
| F15 | Cliente Supabase recriado a cada chamada (sem singleton) | `src/lib/supabase/admin.ts` |
| F16 | Middleware consulta o banco em toda navegação `/hospede/*` | `src/middleware.ts` |
| F17 | Polling de 30s continua com aba oculta | `reception-dashboard.tsx` |
| F18 | Sem monitoramento de erros (só `console.error`) | actions/client |
| F19 | Sem backup externo (retenção curta do plano free) | operação |
| F20 | Sem validação de variáveis de ambiente no startup | `.env` / boot |

### Cosméticas 🔵

| # | Falha | Onde |
|---|-------|------|
| F21 | Cabeçalhos duplicados "WhatsApp"/"whatsapp" na grade | `reception-dashboard.tsx` |
| F22 | Export deprecated `SLOT_STARTS` | `src/lib/reservations.ts` |
| F23 | Flag `confirmation_sent`/`warning_sent` = "envio iniciado", não "entregue" (documentar) | `wa-me` / actions |
| F24 | Índice redundante `active_stays_token_idx` (UNIQUE já indexa) | migration `active_stays` |
| F25 | Lista de apartamentos hardcoded (candidata a tabela-dimensão) | `src/lib/apartment-codes.ts` |

---

## 2. Roadmap de execução

Regra de ouro da ordem: **segurança primeiro → estancar perda de dados → camada BI → funcional → operação**. As Fases 1 e 2 vêm antes de tudo porque cada dia de uso acumula dano irreversível (acesso indevido possível; histórico sendo apagado).

### Fase 1 — Segurança 🔒 *(urgente)*

- [x] **1.1 — Cookie da recepção assinado** *(resolve F1 + F10)*
  - Criar `SESSION_SECRET` no `.env` (e na Vercel).
  - Valor do cookie: HMAC-SHA256 com expiração embutida; validar assinatura + expiração em `readReceptionAuthed()`.
  - ✅ Pronto quando: cookie manual `reception_auth=1` é rejeitado; sessão expira após 12h; login normal continua funcionando.
  - Concluído em: 08/11/2026

- [x] **1.2 — Rate limit no login** *(resolve F4)*
  - Tabela `login_attempts` no Supabase; máx. 5 falhas / 15 min; registrar tentativas.
  - ✅ Pronto quando: 6ª tentativa errada em 15 min é bloqueada com mensagem clara; teste cobre o bloqueio.
  - Concluído em: 08/11/2026

- [x] **1.3 — Timeout no middleware** *(resolve F11)*
  - `AbortSignal.timeout(5000)` no `fetchStayFromSupabase`; falha = tratar como não validado.
  - Concluído em: 08/11/2026

### Fase 2 — Estancar perda de dados 🗄️ *(antes de acumular mais histórico)*

- [x] **2.1 — Migration soft delete** *(resolve F2, parte 1)*
  - Colunas `status` ('active'/'cancelled'), `cancelled_at`, `cancelled_by`.
  - Trocar as 2 UNIQUE constraints por **índices únicos parciais** (`WHERE status = 'active'`).
  - Os índices parciais mantêm os nomes das constraints antigas, então `uniqueViolationKind()` não precisou mudar.
  - Concluído em: 08/11/2026

- [x] **2.2 — Actions com soft delete** *(resolve F2, parte 2)*
  - `deleteReservation` → `cancelReservation` (UPDATE, não DELETE).
  - Filtrar `status = 'active'` em `getReservationDaySummary`, `assertSlotAndApartmentFree`, `getReservationsForDate`.
  - ✅ Pronto quando: cancelar → slot volta a ficar livre → recriar no mesmo slot funciona → linha cancelada permanece no banco. Teste de integração cobrindo esse ciclo.
  - Concluído em: 08/11/2026

- [x] **2.3 — Checkout honesto no balcão** *(resolve F3)*
  - `guest_checkout_date = NULL` em reservas da recepção; `validateStayAndSlot` pula a checagem quando NULL.
  - Concluído em: 08/11/2026

- [x] **2.4 — `updated_at` + auditoria** *(resolve F6)*
  - Trigger `BEFORE UPDATE` para `updated_at`; avaliar tabela `reservation_events` (criação/edição/cancelamento) — vira tabela-fato para o BI.
  - Concluído em: 08/11/2026

- [x] **2.5 — Anonimização com NULL** *(resolve F13)*
  - Cron LGPD passa a gravar `NULL`; considerar flag `anonymized boolean`.
  - Concluído em: 08/11/2026

### Fase 3 — Camada Power BI 📊

- [ ] **3.1 — Vínculo reserva ↔ estadia** *(migrations `20261108140000` e `20261108160000` aplicadas em produção; falta o merge do código que grava `stay_id`)* *(resolve F5 + F12)*
  - `stay_id uuid REFERENCES active_stays(id)` preenchido no fluxo do hóspede.
  - Limpeza de `active_stays` órfãs com +30 dias (não apagar estadias com reservas vinculadas).
  - Concluído em: ____

- [ ] **3.2 — Schema `analytics` + view `vw_reservas`** *(`20261108150000_analytics_layer.sql` aplicada em produção, com `vw_reservas`, `vw_estadias` e `vw_eventos`)* *(resolve F9, parte 1)*
  - View sem PII (sem nome/WhatsApp/notes), com colunas derivadas: dia da semana, hora, antecedência, origem, status. SQL pronto na REVISAO_TECNICA §3.1.
  - Concluído em: ____

- [ ] **3.3 — Role `powerbi_reader` + conexão** *(role criada em produção, sem senha, falta defini-la; guia em [docs/POWERBI.md](docs/POWERBI.md))* *(resolve F9, parte 2)*
  - Role somente-leitura restrita ao schema `analytics`; conectar Power BI via **Session Pooler** do Supabase, modo **Import** com atualização agendada.
  - ✅ Pronto quando: Power BI carrega `vw_reservas` com a role dedicada e a role não consegue ler `public.reservations`.
  - Concluído em: ____

- [ ] **3.4 — Primeiro relatório** *(roteiro e medidas DAX em [docs/POWERBI.md](docs/POWERBI.md); falta montar no Power BI)*
  - Ocupação por dia da semana × hora; taxa de cancelamento; origem (hóspede × recepção); antecedência média.
  - Concluído em: ____

### Fase 4 — Correções funcionais 🧭

- [x] **4.1 — Bloquear slot já passado no dia atual** *(resolve F7; feito em 09/11/2026 para hóspede e balcão; o bloco 00h–01h da piscina ficou de fora até o produto definir a semântica)* — Concluído em: 09/11/2026
- [ ] **4.2 — Datas por string no guest-booking** *(resolve F8)* — eliminar `format()` no fuso do navegador. — Concluído em: ____
- [ ] **4.3 — Restringir consulta do hóspede** *(resolve F14; parte feita em 09/11/2026: o hóspede não recebe mais a lista de apartamentos, só `ownApartmentBooked`; falta restringir às datas da estadia)* — datas dentro da estadia; booleano em vez de lista de aptos. — Concluído em: ____

### Fase 5 — Crescimento e operação ⚙️

- [ ] **5.1 — Singleton do client Supabase** *(F15)* — Concluído em: ____
- [ ] **5.2 — Sentry (actions + client)** *(F18)* — Concluído em: ____
- [ ] **5.3 — Backup externo semanal** *(F19)* — `pg_dump` via GitHub Action ou plano pago. — Concluído em: ____
- [ ] **5.4 — Cookie de estadia assinado no middleware** *(F16)* — elimina consulta ao banco por request. — Concluído em: ____
- [ ] **5.5 — Polimento** *(F17, F20, F21, F22, F23, F24)* — polling pausado com aba oculta (feito em 09/11/2026); `env.ts` com Zod; renomear coluna; remover deprecated/índice redundante; comentar semântica das flags. — Concluído em: ____
- [ ] **5.6 — Tabela `apartments` como dimensão** *(F25)* — Concluído em: ____

### Fase 6 — Histórico de reservas e retenção 🗂️

Objetivo: nenhum registro de reserva é apagado automaticamente; o único dado apagado é o **WhatsApp, 365 dias depois do check-out**. A recepção consulta, pelo calendário, qualquer dia passado (reservas ativas e canceladas) e pode alterar ou excluir (cancelar) reservas passadas pela grade; **criar** reserva em data passada continua bloqueado.

- [x] **6.1 — Consulta de dias passados** — a grade mostra as reservas **canceladas** (esmaecidas, com quem cancelou e quando) em dias anteriores a hoje, o marcador de horário alterado pelo hóspede e a origem (hóspede/recepção). Hoje e dias futuros não mostram canceladas. Nada muda no banco. — Concluído em: 11/11/2026
- [x] **6.2 — Testes do histórico** — `reservations-history.test.ts` (dia passado consultável, cancelada preservada, filtro por data, piscina × academia, autenticação, edição de reserva passada, criação bloqueada). — Concluído em: 11/11/2026
- [ ] **6.3 — Retenção: WhatsApp após 365 dias** — migration `20261112100000_retention_whatsapp_365.sql` e `docs/RETENCAO_DADOS.md` **preparadas (PR em rascunho), NÃO aplicadas**: o job deixa de apagar nome e observações e passa a apagar só o WhatsApp 365 dias após o check-out. Falta a aprovação de LGPD e a autorização para aplicar. — Concluído em: ____
- [x] **6.4 — Testes de retenção** — `retention.test.ts` (unitário) e `tests/integration/retention.test.ts` (7 testes, banco local) + verificação de que a migration não perde dados. — Concluído em: 11/11/2026

---

## 3. Acompanhamento

| Fase | Etapas | Concluídas | Status |
|------|--------|------------|--------|
| 1 — Segurança | 3 | 3 | ✅ Concluída (mergeada; falta confirmar o login em produção) |
| 2 — Dados | 5 | 5 | ✅ Concluída (migrations aplicadas; aguarda deploy) |
| 3 — Power BI | 4 | 0 | 🟡 Migrations aplicadas em produção (09/11/2026); faltam a senha da role, o merge do código e o relatório |
| 4 — Funcional | 3 | 0 | ⏳ Não iniciada |
| 5 — Operação | 6 | 0 | ⏳ Não iniciada |
| 6 — Histórico e retenção | 4 | 3 | 🟡 Histórico e testes prontos; retenção preparada e **não aplicada** (aguarda LGPD e autorização) |

**Convenções ao executar:**
- 1 etapa = 1 commit (ou PR) pequeno e reversível, com teste acompanhando.
- Migrations sempre em arquivo novo em `supabase/migrations/` (nunca editar migration já aplicada).
- Após cada etapa das Fases 1–2, rodar `npm test` e `npm run test:integration`.
- Atualizar a tabela acima e os checkboxes ao concluir cada item.
