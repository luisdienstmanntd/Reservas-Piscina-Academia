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

-- ---- Fase 2.1: cancelamento sem apagar ----
-- Fase 2.1 — Cancelamento sem apagar: reservas canceladas permanecem no banco.
--
-- Unicidade passa a valer apenas para reservas ATIVAS (índices únicos parciais),
-- mantendo os mesmos nomes das constraints antigas para que o app continue
-- identificando o tipo de conflito (slot x apartamento) pela mensagem de erro.
--

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

-- ---- Fase 2.5: coluna anonymized (o job pg_cron LGPD fica em 20261108110000_lgpd_anonymize_null.sql) ----
ALTER TABLE public.reservations
  ADD COLUMN anonymized boolean NOT NULL DEFAULT false;

-- ---- Fase 2.4: updated_at e auditoria ----
-- Fase 2.4 — updated_at e trilha de auditoria (reservation_events).
--
-- reservation_events NÃO guarda valores de nome/WhatsApp/observações (LGPD):
-- só o tipo do evento e os NOMES dos campos alterados.

ALTER TABLE public.reservations
  ADD COLUMN updated_at timestamptz;

UPDATE public.reservations SET updated_at = created_at WHERE updated_at IS NULL;

ALTER TABLE public.reservations
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

COMMENT ON COLUMN public.reservations.updated_at IS 'Última alteração da linha (trigger).';

CREATE FUNCTION public.reservations_set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER reservations_set_updated_at
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.reservations_set_updated_at();

CREATE TABLE public.reservation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES public.reservations (id) ON DELETE CASCADE,
  event_type text NOT NULL
    CHECK (event_type IN ('created', 'updated', 'cancelled', 'anonymized')),
  actor text,
  changed_fields text[],
  occurred_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.reservation_events IS
  'Trilha de auditoria / tabela-fato para BI. Sem dados pessoais.';

CREATE INDEX reservation_events_reservation_idx
  ON public.reservation_events (reservation_id, occurred_at);
CREATE INDEX reservation_events_type_time_idx
  ON public.reservation_events (event_type, occurred_at);

ALTER TABLE public.reservation_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reservation_events FROM anon, authenticated;
GRANT ALL ON public.reservation_events TO service_role;

-- Histórico: um evento "created" por reserva já existente (e "cancelled" não se aplica: nada foi cancelado ainda).
INSERT INTO public.reservation_events (reservation_id, event_type, actor, occurred_at)
SELECT id, 'created', created_by, created_at FROM public.reservations;

CREATE FUNCTION public.reservations_log_event() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  changed text[] := ARRAY[]::text[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.reservation_events (reservation_id, event_type, actor)
    VALUES (NEW.id, 'created', NEW.created_by);
    RETURN NEW;
  END IF;

  IF OLD.status = 'active' AND NEW.status = 'cancelled' THEN
    INSERT INTO public.reservation_events (reservation_id, event_type, actor)
    VALUES (NEW.id, 'cancelled', NEW.cancelled_by);
    RETURN NEW;
  END IF;

  IF NEW.anonymized AND NOT OLD.anonymized THEN
    INSERT INTO public.reservation_events (reservation_id, event_type, actor)
    VALUES (NEW.id, 'anonymized', 'system');
    RETURN NEW;
  END IF;

  IF NEW.guest_name IS DISTINCT FROM OLD.guest_name THEN changed := array_append(changed, 'guest_name'::text); END IF;
  IF NEW.guest_whatsapp IS DISTINCT FROM OLD.guest_whatsapp THEN changed := array_append(changed, 'guest_whatsapp'::text); END IF;
  IF NEW.notes IS DISTINCT FROM OLD.notes THEN changed := array_append(changed, 'notes'::text); END IF;
  IF NEW.confirmation_sent IS DISTINCT FROM OLD.confirmation_sent THEN changed := array_append(changed, 'confirmation_sent'::text); END IF;
  IF NEW.warning_sent IS DISTINCT FROM OLD.warning_sent THEN changed := array_append(changed, 'warning_sent'::text); END IF;

  IF array_length(changed, 1) > 0 THEN
    -- Edições só ocorrem pela recepção (Server Actions protegidas por sessão).
    INSERT INTO public.reservation_events (reservation_id, event_type, actor, changed_fields)
    VALUES (NEW.id, 'updated', 'reception', changed);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER reservations_log_event
  AFTER INSERT OR UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.reservations_log_event();

-- Rate limit do login da recepção.
CREATE TABLE public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_key text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.login_attempts IS
  'Falhas de login da recepção. client_key = HMAC do IP. Linhas antigas são removidas pela aplicação.';

CREATE INDEX login_attempts_key_time_idx
  ON public.login_attempts (client_key, attempted_at DESC);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.login_attempts FROM anon, authenticated;
GRANT ALL ON public.login_attempts TO service_role;
