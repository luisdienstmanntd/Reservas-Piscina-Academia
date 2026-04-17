# Roadmap de testes — Sistema de Reservas (Next.js 15 + Supabase)

## Regra de ouro

**Nenhum teste automatizado pode usar credenciais, URLs ou chaves do banco de dados de produção.**  
Toda execução deve ocorrer contra:

- **Supabase local** (Docker via CLI, já previsto nos scripts `db:start` / `db:reset` do `package.json`), **ou**
- **Mocks** (clientes Supabase falsos, injeção de dependência, stubs de `fetch`), **ou**
- **Banco de teste dedicado** (projeto Supabase separado, nunca o mesmo `.env` de produção).

Checklist obrigatório antes de rodar qualquer suíte:

- Variáveis como `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e similares apontam **apenas** para instância local ou de teste.
- Não há cópia de `.env.production` ou secrets de produção carregados em CI ou máquinas de desenvolvimento para testes.
- Em CI, secrets de teste vêm de **secrets do repositório** específicos de ambiente de teste.

---

## FASE 1: Configuração do ambiente seguro e dependências

### Objetivo

Garantir um alvo de dados **100% isolado da produção** e instalar a base de ferramentas: **Vitest** (unitário + integração em Node) e **Playwright** (E2E no browser).

### O que será feito

1. **Supabase local (preferencial para integração/E2E “de verdade”)**
   - Documentar e validar o fluxo: `npx supabase start` (já encapsulado em `npm run db:start`), `npm run db:reset` para estado limpo entre execuções pesadas.
   - Garantir que o app em modo teste use **URL e keys emitidas pelo `supabase status`** (local), nunca as de produção.
   - Opcional: arquivo `.env.test` ou `.env.test.local` (gitignored) com apenas variáveis locais; scripts de teste carregam explicitamente esse arquivo.

2. **Alternativa ou complemento: mocks**
   - Para testes que não precisam de Postgres: mockar `@/lib/supabase/admin` ou camada fina que chama o admin client, retornando dados fixos ou filas de respostas.
   - Útil para Vitest rápido em CI quando Docker não estiver disponível (com trade-off de fidelidade).

3. **Vitest**
   - Adicionar `vitest`, `@vitejs/plugin-react` (se necessário para componentes), e configuração mínima (`vitest.config.ts`) com `environment: "node"` por padrão; `jsdom` apenas se houver testes de componente que precisem de DOM.
   - Scripts no `package.json`, por exemplo: `test:unit`, `test:integration` (fases posteriores podem separar por padrão de arquivo ou projeto Vitest).

4. **Playwright**
   - Instalar `@playwright/test`, `playwright.config.ts` com `baseURL` apontando para `http://localhost:3000` (ou porta configurada).
   - Documentar: subir app com **env local** (`next dev` ou `next start` build de preview) **antes** dos E2E; opcionalmente usar `webServer` no config para subir o servidor automaticamente com env de teste.

5. **Documentação operacional**
   - Sequência recomendada: `db:start` → aplicar/migrar schema local → `test:…` → `db:stop` (opcional).
   - Onde colocar fixtures SQL ou seeds só para teste (pasta dedicada, nunca rodar seeds em produção).

### Critérios de conclusão da Fase 1

- **Implementado:** `vitest.config.ts` (unitários só em `src/**`), `playwright.config.ts`, scripts `test`, `test:unit`, `test:watch`, `test:integration`, `test:e2e`, `test:e2e:ui`.
- Comando para stack local: `npm run db:start` → `npx supabase status` → copiar URL/chave para `.env.local` (nunca produção).
- `npm run test:unit` — suíte em `src/**/*.test.ts` (inclui smoke da toolchain + regras de negócio da Fase 2).
- Playwright: `npx playwright install chromium` quando necessário.

---

## FASE 2: Testes unitários de regras de negócio

### Objetivo

Cobrir lógica pura e validações **sem I/O de banco**, com execução rápida e determinística.

### O que será feito

1. **Fuso horário e data civil do hotel (`src/lib/hotel-time.ts`)**
   - Testes com datas fixas em UTC e verificação de que `hotelCalendarDate` retorna `yyyy-MM-dd` coerente com `America/Sao_Paulo` (incluir caso que cruze meia-noite UTC vs SP).
   - Alinhar com `hotelTodayYmd` em `src/lib/guest-stay.ts` se a suíte unificar “data do hotel” em um único módulo de teste.

2. **Limites de estadia e janela de checkout (`src/lib/guest-stay.ts`)**
   - `isCheckoutStillValid`: igualdade na data de checkout, checkout no passado, no futuro; strings malformadas só se a API pública permitir — documentar contrato esperado.

3. **Validação de tokens / cookies (camada testável sem Supabase real)**
   - Extrair ou testar funções puras: parsing de token da query, normalização, regras de expiração se existirem em módulos dedicados.
   - Onde a lógica estiver acoplada a `cookies()` do Next.js, testar com **wrappers** ou mover regra pura para `*.ts` importável em Vitest (sem alterar comportamento de produção além do necessário).

4. **Regras em `src/lib/reservations.ts`**
   - `normalizeSlotStart`, `slotStartsFor`, validações de instalação (`Facility`), formatos de slot — tudo que for determinístico sem rede.

5. **Schemas Zod**
   - **Implementado:** schemas partilhados em `src/lib/booking-zod.ts`, validação de slot/data em `src/lib/reservation-slot-validation.ts`, testes em `src/lib/booking-zod.test.ts` (as actions importam estes módulos).

### Critérios de conclusão da Fase 2

- **Implementado:** testes em `src/lib/*.test.ts` (hotel-time, guest-stay, apartment-codes, `reservations.ts`, booking-zod, reservation-slot-validation) — executar com `npm run test:unit`.
- Nenhum teste da Fase 2 requer `SUPABASE_SERVICE_ROLE_KEY` de produção ou rede externa.

---

## FASE 3: Testes de integração e concorrência (banco local)

### Objetivo

Validar políticas de banco **contra Postgres local**, incluindo cenários de corrida próximos de overbooking / violação de unicidade. (Chamadas diretas às Server Actions com `cookies()` podem ser acrescentadas depois; hoje a suíte valida o **comportamento do Postgres** com o mesmo schema das migrations.)

### O que foi feito (implementado)

1. **Pré-requisitos**
   - Supabase local: `npm run db:start`; variáveis em `.env.local` vindas de `npx supabase status` (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
   - O ficheiro `tests/integration/reservations-concurrency.test.ts` carrega env com `loadEnvConfig` de `@next/env` e **recusa correr** se a URL não for claramente local: host `127.0.0.1` ou `localhost` **e** porta **`54321`** (API padrão do CLI). Assim evita-se apontar por engano para a nuvem.

2. **Configuração Vitest**
   - **`vitest.integration.config.ts`:** só inclui `tests/integration/**`; timeout 30s.
   - **`npm run test:integration`** usa essa config (separada de `vitest.config.ts`, que cobre apenas `src/**`, para `npm run test:unit` não exigir Docker).

3. **Ficheiro `tests/integration/reservations-concurrency.test.ts`**
   - **Limpeza:** `beforeAll`, `beforeEach` e `afterAll` apagam linhas em `public.reservations` com `reservation_date = '2999-01-01'` (data fictícia distante).
   - **TESTE 1 — mesmo horário, vários apartamentos:** 20 `insert` em paralelo (`Promise.all`), instalação `pool`, data `2999-01-01`, slot `15:00:00`, 20 apartamentos distintos da lista do hotel. **Asserção:** exatamente **1** sucesso e **19** falhas por violação de unicidade do slot.
   - **TESTE 2 — mesmo apartamento, vários horários:** 5 `insert` em paralelo, `pool`, mesma data, apartamento `101`, cinco slots distintos. **Asserção:** exatamente **1** sucesso e **4** falhas por violação de unicidade por apartamento/dia/instalação.

4. **Nomes reais das constraints (migração `20260405120000_reservations_facility.sql`)**

   Após a coluna `facility`, as unicidades **não** são mais `reservations_date_slot_unique` / `reservations_date_apartment_unique` (removidas nessa migração). O schema atual usa:

   | Constraint | Significado |
   |------------|-------------|
   | `reservations_facility_date_slot_unique` | UNIQUE (`facility`, `reservation_date`, `slot_start`) — no máximo **uma** reserva por slot (ex.: uma só piscina às 15h naquele dia). |
   | `reservations_facility_date_apartment_unique` | UNIQUE (`facility`, `reservation_date`, `apartment_number`) — no máximo **uma** reserva por apartamento naquela instalação naquele dia. |

   Os testes asserem mensagens/códigos Postgres (`23505` / `duplicate key`) e os nomes acima quando presentes na resposta de erro.

5. **Segurança**
   - Nunca commitar keys; apenas `.env.local` local ou secrets de CI de ambiente de teste.

### Critérios de conclusão da Fase 3

- **Atendido:** integração com escrita no Postgres local + dois cenários de concorrência (`Promise.all`) alinhados às constraints `reservations_facility_date_*_unique`.
- **Opcional (evolução):** repetir cenários chamando `createGuestReservation` / `createReceptionReservation` com mocks de `cookies()` ou extrair função `(supabase, row) => insert` partilhada com as actions.

---

## FASE 4: Testes E2E com Playwright

### Objetivo

Simular o fluxo completo na UI, ainda assim **somente** contra app + Supabase **locais** (ou mock de API se for estratégia híbrida documentada).

### O que será feito

1. **Dados de teste**
   - Seed local: apartamento válido, senha de recepção de teste (`RECEPTION_PASSWORD` no env local), token de hóspede válido ou fluxo que gera cookie de convidado conforme o app real (`middleware` + `guest_token`).

2. **Cenário principal (happy path)**
   - **Recepção:** login em `/recepcao` (ou rota real), ação que gera/expõe link ou token para o hóspede (conforme implementação em `reception-dashboard` / `reception-wa-actions`).
   - **Hóspede:** abrir URL com token (ou fluxo equivalente), acessar área de reserva (piscina/academia conforme rotas em `src/app/hospede/...`).
   - **Reserva:** preencher formulário em `guest-booking` (ou fluxo equivalente), submeter, aguardar feedback de sucesso.
   - **Recepção de novo:** verificar que o **grid/dashboard** (`reception-dashboard`) reflete a nova reserva (texto, linha ou contagem — asserções estáveis com `data-testid` se necessário).

3. **Estabilidade**
   - Timeouts adequados; esperar rede/respostas; evitar flakiness por animações (Playwright `expect` com auto-retry).
   - Opcional: gravação de trace em CI para depuração.

4. **Isolamento**
   - Rodar E2E em pipeline com job que sobe Docker (Supabase) + Next; destruir ao fim.

### Critérios de conclusão da Fase 4

- Um spec Playwright executável de ponta a ponta no ambiente local descrito na Fase 1.
- Documentação de variáveis de ambiente mínimas para o fluxo E2E.

---

## Estado do roadmap

| Fase | Estado |
|------|--------|
| 1 — Ambiente + Vitest + Playwright | Concluída |
| 2 — Unitários (regras / Zod / slots) | Concluída (`npm run test:unit`) |
| 3 — Integração + concorrência (BD local) | Concluída (`npm run test:integration` com Docker + `.env.local` local) |
| 4 — E2E fluxo completo | Pendente |

## Próximo passo

Para avançar a **Fase 4** (Playwright: recepção → token → hóspede → reserva → grid), envie: **`Execute a Fase 4`**.
