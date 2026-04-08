# Conectar o Supabase ao projeto (passo a passo)

## 1. Criar o projeto no Supabase

1. Acesse [https://supabase.com](https://supabase.com) e faça login.
2. **New project** → escolha organização, nome (ex.: `valle-dincanto-piscina`), senha do banco e região próxima ao hotel.
3. Aguarde o provisionamento (alguns minutos).

## 2. Aplicar o SQL do schema

**Recomendado (base alinhada com o código atual):** executar **`supabase/setup_supabase_cloud.sql`** no SQL Editor (projeto novo), **ou** aplicar **todas** as migrações em `supabase/migrations/` **por ordem do nome do ficheiro** (projetos que já evoluem por migrações).

Ordem de referência: `init` → `facility` → `guest_whatsapp` → `whatsapp_flags` → `guest_name` → `active_stays`, etc.

A tabela **`reservations`** inclui (entre outras): unicidades por `facility` + data, `guest_whatsapp`, `guest_name`, `confirmation_sent` / `warning_sent`. A tabela **`active_stays`** guarda os tokens do link hóspede (`/?token=`).

## 3. Obter as chaves da API

1. **Project Settings** (ícone de engrenagem) → **API**.
2. Anote:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY` (pode ficar no cliente se usar Supabase no browser; neste projeto o fluxo principal é Server Actions + service role)
   - **service_role** (reveal) → `SUPABASE_SERVICE_ROLE_KEY` — **nunca** commitar nem expor no cliente.

## 4. Variáveis de ambiente local

Na raiz do projeto, copie `.env.example` para `.env.local` e preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
RECEPTION_PASSWORD=sua-senha-recepcao
```

Reinicie o servidor de desenvolvimento (`npm run dev`) após alterar `.env.local`.

- **Hóspede:** aplique também a migração `20260410120000_active_stays.sql` (ou use `setup_supabase_cloud.sql` completo) para a tabela `active_stays` usada pelos tokens de acesso.

## 5. Deploy na Vercel

1. Conecte o repositório na Vercel.
2. Em **Settings → Environment Variables**, adicione as mesmas variáveis (incluindo `SUPABASE_SERVICE_ROLE_KEY` como **Secret** e `RECEPTION_PASSWORD`).
3. Faça um novo deploy.

O middleware na Vercel usa `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` para validar tokens na REST API: pedidos a **`/?token=…`** (definição do cookie e redirect para a home) e a **`/hospede/*`** (cookie obrigatório).

## 6. Conferir constraints (opcional)

No SQL Editor:

```sql
-- Deve falhar (mesmo slot, dois apartamentos)
INSERT INTO public.reservations (reservation_date, slot_start, apartment_number)
VALUES ('2026-04-10', '15:00', '101');
INSERT INTO public.reservations (reservation_date, slot_start, apartment_number)
VALUES ('2026-04-10', '15:00', '102');

-- Deve falhar (mesmo apartamento, dois slots no mesmo dia)
INSERT INTO public.reservations (reservation_date, slot_start, apartment_number)
VALUES ('2026-04-10', '16:00', '101');
```

O primeiro segundo `INSERT` viola `reservations_date_slot_unique`; o segundo par viola `reservations_date_apartment_unique`.

## Segurança

- Use **service role** apenas em **Server Actions** / **Route Handlers** do Next.js (código que roda no servidor).
- Não importe `SUPABASE_SERVICE_ROLE_KEY` em componentes com `"use client"`.

Quando o schema estiver aplicado e o `.env.local` preenchido, o código da aplicação pode usar o cliente admin do Supabase nas server actions para criar/listar/cancelar reservas.
