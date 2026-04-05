# Navegação e contexto para IA (Cursor / agentes)

Este ficheiro orienta **assistentes de código** sobre o domínio, invariantes e **onde procurar** ao alterar ou depurar o projeto. Leia-o antes de mudanças amplas.

---

## 1. Contexto do produto

- **Cliente:** Hotel Valle D’incanto.
- **Objetivo:** Reservas de **uso exclusivo** (slots de **1 hora**) na **piscina** e na **academia**, com limite **1 reserva por apartamento por dia** **por instalação** (`pool` vs `gym`), e **1 reserva por horário** por instalação/dia.
- **Público:**
  - **Hóspede:** sem login; apartamento (lista fechada) + **check-out** + **WhatsApp obrigatório** + escolha de dia dentro da estadia + grid de horários.
  - **Recepção:** senha (`RECEPTION_PASSWORD`) + cookie HTTP-only `reception_auth`; **grade** ligada ao seletor “Dia (grade)” (abre em **hoje** ao login; criar reserva noutra data **não** altera esse dia). Formulário **balcão** (apto, data da reserva, horário, WhatsApp opcional, observações).

---

## 2. Stack e limites arquiteturais

| Tema | Detalhe |
|------|---------|
| Framework | Next.js **15.5.x** App Router; páginas em `src/app/` |
| Dados | Supabase Postgres; **apenas** `getAdminClient()` em **Server Actions** (`"use server"`) |
| Chave | `SUPABASE_SERVICE_ROLE_KEY` — **nunca** em componentes `"use client"`, nem expor ao browser |
| Validação | Zod em `src/app/actions/reservations.ts`; regras críticas **sempre** no servidor (`assertSlotAndApartmentFree` + constraints BD) |

**Não** introduzir leitura/escrita Supabase com **anon key** no cliente para `reservations` sem revisão de segurança e políticas RLS adequadas.

---

## 3. Regras de negócio (código + BD)

### 3.1 Instalação (`facility`)

- Valores: `"pool"` | `"gym"`.
- Tipo: `Facility` em `src/lib/reservations.ts`.
- Queries de ocupação, listagens e inserts filtram sempre por `facility`.

### 3.2 Slots (fonte de verdade na app)

- **Piscina:** `POOL_SLOT_STARTS` — 13h … 23h e `00:00:00` (bloco 00h–01h no mesmo `reservation_date`). `slotStartsFor("pool")`.
- **Academia:** `GYM_SLOT_STARTS` — 24 horas cheias. `slotStartsFor("gym")`.
- **Normalização:** `normalizeSlotStart()` antes de comparar, gravar ou consultar sets.
- **UI:** `slotLabel()`.

### 3.3 Apartamentos

- Lista fechada: `src/lib/apartment-codes.ts` (`ALLOWED_APARTMENT_NUMBERS`, `isAllowedApartmentNumber`).
- Alterar lista → atualizar esse ficheiro; `apartmentStr` nas actions usa a mesma função.

### 3.4 Datas e estadia

- **Hoje:** `hotelCalendarDate()` em `src/lib/hotel-time.ts` (timezone **America/Sao_Paulo**).
- **`validateStayAndSlot`:** data da reserva ≥ hoje; data da reserva ≤ `guestCheckoutDate`; slot ∈ lista permitida da instalação.
- **Balcão:** o formulário não pede check-out; a action define `guest_checkout_date = reservationDate` só para satisfazer a validação acima.

### 3.5 Impossibilidade de conflito (horário + apto)

- **BD:** `UNIQUE (facility, reservation_date, slot_start)` e `UNIQUE (facility, reservation_date, apartment_number)`; CHECK `reservations_slot_valid`.
- **Servidor:** `assertSlotAndApartmentFree()` em `reservations.ts` — lê reservas do dia/instalação **antes** do insert; devolve erro explícito se slot ou apartamento já ocupados (complementa a BD em corridas).
- **Cliente:** `getReservationDaySummary(date, facility)` → `occupiedSlots` + `apartmentsBooked`; usado em `guest-booking.tsx` (grid desativado se apto já tem reserva no dia; slots ocupados desativados) e em `reception-dashboard.tsx` (opções de horário desativadas, botão bloqueado se conflito).
- **`getOccupiedSlotsForDate`:** mantido por compatibilidade; implementação delega em `getReservationDaySummary` e devolve só os slots.

### 3.6 WhatsApp (`guest_whatsapp`)

- Coluna `text` nullable na BD.
- **Hóspede:** obrigatório — `guestWhatsappRequiredSchema` em `createGuestSchema` / `createGuestReservation`; valor gravado só com **dígitos**, **10–13** caracteres.
- **Recepção:** opcional — `guestWhatsappOptionalSchema`; vazio → `null`; se preenchido, mesma regra de dígitos.

### 3.7 Copy vs lógica (marketing)

- **`src/app/page.tsx`:** textos de horário amplo da piscina (ex. 09h–01h) são informativos.
- **Reserva de exclusivo** da piscina: **13h–01h** em `reservations.ts` e SQL — não derivar slots a partir só da copy da home.

### 3.8 Autenticação recepção

- `loginReception` / `logoutReception`; cookie `reception_auth`, httpOnly, `secure` em produção.
- `getReservationsForDate`, `createReceptionReservation`, `deleteReservation` exigem `receptionAuthed()`.

---

## 4. Mapa de navegação (o que mexer para cada tarefa)

| Objetivo | Ficheiros prioritários |
|----------|-------------------------|
| Slots, labels, tipo `ReservationRow` | `src/lib/reservations.ts` |
| Lista de apartamentos | `src/lib/apartment-codes.ts` + selects em `guest-booking.tsx`, `reception-dashboard.tsx` |
| Todas as regras de reserva, resumo do dia, conflitos, Zod | `src/app/actions/reservations.ts` |
| Fluxo hóspede (passos, calendário, grid, toasts) | `src/components/guest-booking.tsx` |
| Login recepção, grade, formulário balcão, coluna WhatsApp | `src/app/recepcao/reception-dashboard.tsx` |
| Segmento `/recepcao` (shell) | `src/app/recepcao/layout.tsx`, `page.tsx` |
| Home, links | `src/app/page.tsx` |
| Metadata global, fonts, Toaster | `src/app/layout.tsx`, `globals.css` |
| Marca | `src/components/valle-wordmark.tsx` |
| Schema BD, migrações, projeto novo | `supabase/migrations/*`, `supabase/setup_supabase_cloud.sql` |
| Env / cliente Supabase admin | `.env.example`, `src/lib/supabase/admin.ts` |

---

## 5. Como a IA deve proceder

1. **Servidor primeiro:** alterar `assertSlotAndApartmentFree`, schemas Zod, inserts e `getReservationDaySummary` antes de só ajustar UI.
2. **Mudança de slots:** alinhar `POOL_SLOT_STARTS` / `GYM_SLOT_STARTS` **e** o CHECK `reservations_slot_valid` no SQL.
3. **Nova coluna BD:** migração + `setup_supabase_cloud.sql` + tipo `ReservationRow` + qualquer `insert`/`select` afetado.
4. **Textos só:** `page.tsx`, `copy` em `guest-booking.tsx`, strings em `reception-dashboard.tsx`, `metadata` em `layout.tsx`.
5. **Invariantes de teste mental:** mesmo apto, mesmo dia, `pool` e `gym` → **duas reservas OK**; mesmo apto, mesmo dia, **mesma** facility → **bloqueado**; dois aptos no mesmo slot mesma facility → **bloqueado**.
6. Validar com `npm run build` (e `npm run lint` se mexer em TS/React).

---

## 6. Armadilhas frequentes

- **`.env.local` na raiz** do Next (junto a `package.json`), não em subpastas de `supabase/`.
- **`getAdminClient()`** pode ser `null` — tratar com `supabaseConfigErrorMessage()`.
- **`GuestBooking`:** `facility` vem da rota (`piscina` → `pool`, `academia` → `gym`).
- **Efeitos no dashboard recepção:** ao carregar resumo do formulário, não por `newSlot` nas dependências do `useEffect` (risco de loop); usar `setNewSlot(prev => …)` quando ajustar slot ocupado.
- **Grade vs data do balcão:** após `createReceptionReservation`, **não** fazer `setDateStr(newReservationDate)` — atualizar só com `load()` para o `dateStr` atual (a grade não “salta” para a data da reserva criada).
- **Dev:** 404 intermitente a `layout.css` no console não implica necessariamente app quebrada; confirmar com build de produção.

---

## 7. Ficheiros que raramente precisam de mudanças de domínio

- `src/components/ui/*`
- `src/lib/utils.ts` (`cn`)
- `next.config.ts` (mínimo)

---

## 8. Ordem útil das migrações (referência)

1. `20260404000000_init_reservations.sql` — tabela inicial (só piscina; constraints antigas se projeto legado).
2. `20260405120000_reservations_facility.sql` — `facility`, unicidades por instalação, CHECK de slots.
3. `20260407120000_reservations_guest_whatsapp.sql` — coluna `guest_whatsapp`.

Projetos **novos** podem usar só `setup_supabase_cloud.sql` se preferirem um único script.

---

*Atualizar este ficheiro quando a arquitetura ou as regras de negócio mudarem de forma relevante.*
