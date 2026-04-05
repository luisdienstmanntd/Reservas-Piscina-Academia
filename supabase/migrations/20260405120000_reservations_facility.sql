-- Piscina + Academia: coluna facility e unicidade por instalação
-- Execute no SQL Editor do Supabase após a migração inicial.

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS facility text NOT NULL DEFAULT 'pool';

UPDATE public.reservations SET facility = 'pool' WHERE facility IS NULL OR facility = '';

ALTER TABLE public.reservations
  DROP CONSTRAINT IF EXISTS reservations_date_slot_unique;

ALTER TABLE public.reservations
  DROP CONSTRAINT IF EXISTS reservations_date_apartment_unique;

ALTER TABLE public.reservations
  DROP CONSTRAINT IF EXISTS reservations_slot_start_valid;

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_facility_check
  CHECK (facility IN ('pool', 'gym'));

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_facility_date_slot_unique
  UNIQUE (facility, reservation_date, slot_start);

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_facility_date_apartment_unique
  UNIQUE (facility, reservation_date, apartment_number);

-- Piscina: slots 13h–23h e 00h (00h–01h). Academia: 00h–23h (24 slots), hora cheia.
ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_slot_valid CHECK (
    (
      facility = 'pool'
      AND (
        (
          slot_start >= time '13:00'
          AND slot_start <= time '23:00'
          AND (EXTRACT(MINUTE FROM slot_start) = 0)
          AND (EXTRACT(SECOND FROM slot_start) = 0)
        )
        OR slot_start = time '00:00'
      )
    )
    OR (
      facility = 'gym'
      AND (EXTRACT(MINUTE FROM slot_start) = 0)
      AND (EXTRACT(SECOND FROM slot_start) = 0)
      AND slot_start >= time '00:00'
      AND slot_start <= time '23:00'
    )
  );

COMMENT ON COLUMN public.reservations.facility IS 'pool = piscina (13h–01h reservável); gym = academia (24h, slots de 1h).';

CREATE INDEX IF NOT EXISTS reservations_facility_date_idx
  ON public.reservations (facility, reservation_date);
