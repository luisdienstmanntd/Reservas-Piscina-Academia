-- Fase 2.1 — Cancelamento sem apagar: reservas canceladas permanecem no banco.
--
-- Unicidade passa a valer apenas para reservas ATIVAS (índices únicos parciais),
-- mantendo os mesmos nomes das constraints antigas para que o app continue
-- identificando o tipo de conflito (slot x apartamento) pela mensagem de erro.
--
-- ORDEM DE PUBLICAÇÃO: aplique esta migration ANTES de publicar o código novo.

ALTER TABLE public.reservations
  ADD COLUMN status text NOT NULL DEFAULT 'active',
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN cancelled_by text;

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_status_check
    CHECK (status IN ('active', 'cancelled')),
  ADD CONSTRAINT reservations_cancelled_by_check
    CHECK (cancelled_by IS NULL OR cancelled_by IN ('guest', 'reception')),
  ADD CONSTRAINT reservations_cancel_consistent CHECK (
    (status = 'active' AND cancelled_at IS NULL AND cancelled_by IS NULL)
    OR (status = 'cancelled' AND cancelled_at IS NOT NULL)
  );

ALTER TABLE public.reservations
  DROP CONSTRAINT reservations_facility_date_slot_unique,
  DROP CONSTRAINT reservations_facility_date_apartment_unique;

CREATE UNIQUE INDEX reservations_facility_date_slot_unique
  ON public.reservations (facility, reservation_date, slot_start)
  WHERE status = 'active';

CREATE UNIQUE INDEX reservations_facility_date_apartment_unique
  ON public.reservations (facility, reservation_date, apartment_number)
  WHERE status = 'active';

COMMENT ON COLUMN public.reservations.status IS
  'active = vigente (ocupa horário/apartamento); cancelled = cancelada (histórico preservado).';
COMMENT ON COLUMN public.reservations.cancelled_at IS 'Momento do cancelamento.';
COMMENT ON COLUMN public.reservations.cancelled_by IS 'Quem cancelou: guest | reception.';
