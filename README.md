# Valle D’incanto — Piscina e Academia

Aplicação **Next.js 15** (App Router) para hóspedes agendarem **1 hora por dia por apartamento** na **piscina** ou na **academia**, e para a **recepção** consultar, criar e cancelar reservas. Interface em **português (pt-BR)**, estilos com **Tailwind CSS 4** e componentes no estilo **shadcn/ui**.

## Stack

- **Next.js** 15.5.x · **React** 19 · **TypeScript**
- **Supabase (PostgreSQL)** — acesso apenas no servidor via **service role** (`@supabase/supabase-js`)
- **Zod** — validação nas Server Actions
- **date-fns** — datas e rótulos de horários
- **Sonner** — toasts no cliente

## Requisitos

- Node.js 18+ (recomendado a versão LTS atual)
- Conta/projeto **Supabase** (nuvem) **ou** **Docker** + **Supabase CLI** para base local

## Configuração rápida

1. Clone o repositório e instale dependências:

   ```bash
   npm install
   ```

2. Copie `.env.example` para **`.env.local` na raiz do projeto** (mesmo nível que `package.json`).  
   **Não** coloque `.env.local` dentro de `supabase/migrations/` — o Next.js **não** carrega variáveis dali.

3. Preencha:

   | Variável | Uso |
   |----------|-----|
   | `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | Chave **service_role** (só servidor; nunca expor ao browser) |
   | `RECEPTION_PASSWORD` | Senha do painel `/recepcao` |

   `NEXT_PUBLIC_SUPABASE_ANON_KEY` pode existir no `.env` para uso futuro; **este projeto** usa a service role nas Server Actions.

4. Crie o schema na base:

   - **Projeto novo na nuvem:** no Dashboard → SQL, execute `supabase/setup_supabase_cloud.sql` (inclui `guest_whatsapp`).
   - **Base já existente:** aplique as migrações em `supabase/migrations/` **por ordem de nome**, ou execute manualmente o SQL que faltar (ex.: coluna `guest_whatsapp` em `20260407120000_reservations_guest_whatsapp.sql`).
   - **CLI local:** com Docker ativo, `npm run db:start` ou `npm run db:reset`.

5. Desenvolvimento:

   ```bash
   npm run dev
   ```

   Após mudar dependências ou `.env.local`, reinicie o servidor de dev.

## Scripts npm

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Servidor após build |
| `npm run lint` | ESLint |
| `npm run db:start` | Sobe Supabase local (`npx supabase start`) |
| `npm run db:stop` | Para stack local |
| `npm run db:status` | URL e chaves locais |
| `npm run db:reset` | Recria DB local e aplica migrações |

## Rotas principais

| Rota | Descrição |
|------|-----------|
| `/` | Entrada: links para piscina/academia e recepção |
| `/hospede` | Redireciona para `/hospede/piscina` |
| `/hospede/piscina` | Fluxo hóspede — `GuestBooking` com `facility: pool` |
| `/hospede/academia` | Fluxo hóspede — `GuestBooking` com `facility: gym` |
| `/recepcao` | Login por senha (cookie HTTP-only) + dashboard (grade do dia, nova reserva balcão, cancelar) |

`src/app/recepcao/layout.tsx` — layout mínimo do segmento (estabilidade de CSS em dev no App Router).

## Fluxos: hóspede vs balcão

| | Hóspede (`/hospede/...`) | Recepção (`/recepcao`) |
|--|--------------------------|-------------------------|
| Identificação | Apto (lista fechada) + **check-out** + **WhatsApp (obrigatório)** + calendário da estadia | Apto + **data da reserva** + horário no formulário |
| WhatsApp | **Obrigatório** (10–13 dígitos, normalizados na BD) | **Opcional** |
| Validação de estadia | Reserva entre hoje e check-out | Internamente `guest_checkout_date = reservation_date` (só para passar `validateStayAndSlot`) |
| Listagem | — | Grade por **dia** (calendário “Dia (grade)”): abre em **hoje** ao login; **não** muda ao criar reserva noutra data — alterar só manualmente para ver outro dia. |

## Regras de negócio (resumo)

- **Instalações:** `pool` (piscina) e `gym` (academia), coluna `facility` em `reservations`.
- **Piscina — slots reserváveis:** 13h–23h e 00h–01h (`00:00:00` = 00h–01h do mesmo dia civil), **1 h** por slot.
- **Academia:** 24 slots de 1 h (00h–23h).
- **Por instalação e dia:** no máximo **1 reserva por apartamento** e **1 reserva por horário** (unicidade na BD + verificação pré-insert `assertSlotAndApartmentFree` + UI que desativa/oculta conflitos).
- **Apartamentos:** apenas os códigos em `src/lib/apartment-codes.ts` (select + Zod nas actions).
- **Datas “hoje”:** fuso **America/São_Paulo** (`src/lib/hotel-time.ts`).
- **Segurança:** RLS ativa; `anon`/`authenticated` sem grants na tabela; a app usa **service role** só em Server Actions.

Textos na home (ex.: piscina 09h–01h) são **informativos**; slots **reserváveis** de exclusivo da piscina são **13h–01h** (`src/lib/reservations.ts` + constraints SQL).

## Modelo de dados (`reservations`)

Campos relevantes: `id`, `facility`, `reservation_date`, `slot_start`, `apartment_number`, `guest_checkout_date`, `guest_whatsapp` (opcional), `created_by` (`guest` | `reception`), `notes`, `created_at`.

## Estrutura de pastas (útil)

```
src/app/
  actions/reservations.ts    # Server Actions: auth, CRUD, getReservationDaySummary, etc.
  layout.tsx                 # Root + import globals.css
  page.tsx                   # Home
  hospede/                   # Fluxo hóspede + layout (viewport fixo)
  recepcao/
    layout.tsx               # Segmento recepção
    page.tsx                 # SSR: getReceptionAuthState → ReceptionDashboard
    reception-dashboard.tsx  # UI cliente: login, grade, formulário balcão
src/components/
  guest-booking.tsx          # Wizard hóspede (4 passos)
  valle-wordmark.tsx         # Marca em tipografia
  site-footer.tsx
  ui/                        # Button, Card, Calendar, etc.
src/lib/
  reservations.ts            # Facility, slots, ReservationRow, labels
  apartment-codes.ts         # Lista fixa de apartamentos
  hotel-time.ts              # Data civil do hotel (SP)
  supabase/admin.ts          # getAdminClient() — null se faltar env
supabase/
  config.toml                # Supabase CLI (seed desligado por defeito)
  migrations/                # Ver ordem dos timestamps nos nomes
  setup_supabase_cloud.sql   # Schema completo para projeto novo (SQL Editor)
```

## API de servidor (resumo)

Definidas em `src/app/actions/reservations.ts` (todas `"use server"`):

- **Hóspede (sem cookie recepção):** `getReservationDaySummary`, `getOccupiedSlotsForDate` (compatível, delega no resumo), `createGuestReservation`.
- **Recepção:** `loginReception`, `logoutReception`, `getReceptionAuthState`, `getReservationsForDate`, `createReceptionReservation`, `deleteReservation`.

## Desenvolvimento: avisos comuns

- **404 a `layout.css` no console (modo dev):** pode aparecer após Fast Refresh em rotas como `/recepcao`; em geral é ruído do dev server. Se a página estiver estilizada e as actions funcionarem, pode ignorar; `npm run build` + `npm run start` valida produção.
- **“Base de dados não configurada”:** falta `.env.local` na **raiz** ou variáveis Supabase incompletas.

## Documentação para IA / agentes

Ficheiro **`ia.navegation.md`** — contexto detalhado, invariantes, mapa de ficheiros e boas práticas para assistentes.


## Licença

Projeto privado do hotel (ajuste conforme a política interna).

