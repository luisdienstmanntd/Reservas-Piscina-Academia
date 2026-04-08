-- =============================================================================
-- Hotel Valle D'incanto — schema completo (piscina + academia)
--
-- Para testar no Supabase Cloud: crie um projeto novo (ou esvazie a tabela
-- reservations se souber o que faz), depois no Dashboard → SQL → colar este
-- ficheiro → Run.
--
-- NÃO execute numa base que já tenha a tabela reservations com outro formato;
-- nesse caso use as migrações em supabase/migrations/ pela ordem dos nomes.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  reservation_date date NOT NULL,

  slot_start time NOT NULL,

  apartment_number text NOT NULL,

  guest_checkout_date date,

  created_at timestamptz NOT NULL DEFAULT now(),

  created_by text NOT NULL DEFAULT 'guest'
    CHECK (created_by IN ('guest', 'reception')),

  notes text,

  guest_whatsapp text,

  guest_name text,

  confirmation_sent boolean NOT NULL DEFAULT false,
  warning_sent boolean NOT NULL DEFAULT false,

  facility text NOT NULL DEFAULT 'pool',

  CONSTRAINT reservations_facility_check
    CHECK (facility IN ('pool', 'gym')),

  CONSTRAINT reservations_facility_date_slot_unique
    UNIQUE (facility, reservation_date, slot_start),

  CONSTRAINT reservations_facility_date_apartment_unique
    UNIQUE (facility, reservation_date, apartment_number),

  CONSTRAINT reservations_slot_valid CHECK (
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
  )
);

COMMENT ON TABLE public.reservations IS 'Reservas piscina (13h–01h) e academia (24h, slots de 1h).';
COMMENT ON COLUMN public.reservations.facility IS 'pool = piscina; gym = academia.';
COMMENT ON COLUMN public.reservations.slot_start IS 'Hora de início do slot (1h). 00:00 = 00h–01h.';
COMMENT ON COLUMN public.reservations.guest_name IS 'Nome do hóspede que realizou a reserva.';

CREATE INDEX reservations_reservation_date_idx ON public.reservations (reservation_date);
CREATE INDEX reservations_apartment_number_idx ON public.reservations (apartment_number);
CREATE INDEX reservations_facility_date_idx ON public.reservations (facility, reservation_date);

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.reservations FROM anon, authenticated;
GRANT ALL ON public.reservations TO service_role;

-- -----------------------------------------------------------------------------
-- Estadias ativas (token de acesso /hospede/*)
-- -----------------------------------------------------------------------------

CREATE TABLE public.active_stays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  apartment_number text NOT NULL,
  checkout_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.active_stays IS
  'Ligação mágica check-in: token único por estadia até checkout (fuso hotel em app).';

CREATE INDEX active_stays_token_idx ON public.active_stays (token);

ALTER TABLE public.active_stays ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.active_stays FROM anon, authenticated;
GRANT ALL ON public.active_stays TO service_role;
