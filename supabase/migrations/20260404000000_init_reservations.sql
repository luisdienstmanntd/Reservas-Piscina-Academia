-- =============================================================================
-- Hotel Valle D'incanto — Piscina: schema inicial
-- Execute no SQL Editor do Supabase ou via CLI: supabase db push
-- =============================================================================

-- Extensão para gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- Tabela de reservas
-- Período exclusivo: slots de 1h entre 13h e 01h (13→14 … 23→24, 00→01)
-- -----------------------------------------------------------------------------

CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Dia da reserva (calendário do hotel; o slot 00h–01h pertence ao MESMO dia
  -- civil em que começa à meia-noite, ex.: 4/abr 00h–01h = reservation_date 4/abr)
  reservation_date date NOT NULL,

  -- Início do slot (sempre em hora cheia). Último slot do dia: 00:00 = 00h–01h.
  slot_start time NOT NULL,

  apartment_number text NOT NULL,

  -- Referência para auditoria / regras no app (checkout informado na identificação)
  guest_checkout_date date,

  created_at timestamptz NOT NULL DEFAULT now(),

  -- 'guest' | 'reception'
  created_by text NOT NULL DEFAULT 'guest'
    CHECK (created_by IN ('guest', 'reception')),

  notes text,

  -- Impede dois apartamentos no mesmo horário (concorrência / race conditions)
  CONSTRAINT reservations_date_slot_unique UNIQUE (reservation_date, slot_start),

  -- Impede o mesmo apartamento de ter mais de uma reserva no mesmo dia
  CONSTRAINT reservations_date_apartment_unique UNIQUE (reservation_date, apartment_number),

  -- Apenas slots válidos: 13h … 23h e 00h (hora cheia)
  CONSTRAINT reservations_slot_start_valid CHECK (
    (
      slot_start >= time '13:00'
      AND slot_start <= time '23:00'
      AND (EXTRACT(MINUTE FROM slot_start) = 0)
      AND (EXTRACT(SECOND FROM slot_start) = 0)
    )
    OR slot_start = time '00:00'
  )
);

COMMENT ON TABLE public.reservations IS 'Reservas de uso exclusivo da piscina (13h–01h).';
COMMENT ON COLUMN public.reservations.slot_start IS 'Hora de início do slot (1h). 00:00 = meia-noite a 01h.';

CREATE INDEX reservations_reservation_date_idx ON public.reservations (reservation_date);
CREATE INDEX reservations_apartment_number_idx ON public.reservations (apartment_number);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- Operações via Next.js Server Actions com SUPABASE_SERVICE_ROLE_KEY (servidor).
-- Chave anon não deve conseguir ler/escrever — reduz risco se vazar no cliente.
-- -----------------------------------------------------------------------------

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Nenhuma política para roles públicas: anon e authenticated não têm acesso.
-- O client com service role ignora RLS.

-- Opcional: permitir leitura pública (NÃO recomendado para produção sem filtro).
-- Descomente apenas se precisar de Realtime com anon (não é o caso deste app).

-- REVOKE padrão já restringe; garantimos explícito:
REVOKE ALL ON public.reservations FROM anon, authenticated;
GRANT ALL ON public.reservations TO service_role;
