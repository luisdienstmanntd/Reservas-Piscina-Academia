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

-- ---- Fase 3.1: vínculo reserva ↔ estadia ----
-- Fase 3.1 — Vínculo reserva ↔ estadia.
-- Permite medir a conversão do link de estadia em reserva (quantas estadias geraram reserva).
-- Reservas de balcão (recepção) ficam com stay_id NULL: não vieram de um link.
--
-- ON DELETE SET NULL: apagar uma estadia (LGPD) não bloqueia nem apaga a reserva.

ALTER TABLE public.reservations
  ADD COLUMN stay_id uuid REFERENCES public.active_stays (id) ON DELETE SET NULL;

CREATE INDEX reservations_stay_id_idx ON public.reservations (stay_id);

COMMENT ON COLUMN public.reservations.stay_id IS
  'Estadia (link de hóspede) que originou a reserva. NULL em reservas de balcão e nas anteriores a este campo.';

-- ---- Fase 3.2/3.3: camada analítica e role do Power BI (o job de limpeza de estadias, com pg_cron, fica em 20261108160000_cleanup_orphan_stays_cron.sql) ----
-- Fase 3.2 e 3.3 — Camada analítica para o Power BI (sem dados pessoais) e role somente-leitura.
--
-- O Power BI NUNCA lê as tabelas de public: só as views do schema analytics, sem nome,
-- WhatsApp, observações nem token de estadia.
--
-- A role powerbi_reader é criada SEM senha (não consegue entrar). Defina a senha pelo SQL Editor,
-- fora do repositório:  ALTER ROLE powerbi_reader WITH PASSWORD '<senha-forte>';

CREATE SCHEMA IF NOT EXISTS analytics;

-- ---------------------------------------------------------------------------
-- Reservas (uma linha por reserva, ativas e canceladas)
-- ---------------------------------------------------------------------------
CREATE VIEW analytics.vw_reservas AS
SELECT
  r.id,
  r.stay_id                                         AS estadia_id,
  r.facility,
  CASE r.facility WHEN 'pool' THEN 'Piscina' ELSE 'Academia' END AS instalacao,
  r.reservation_date                                AS data_reserva,
  r.slot_start                                      AS horario_inicio,
  EXTRACT(HOUR FROM r.slot_start)::int              AS hora_slot,
  EXTRACT(ISODOW FROM r.reservation_date)::int      AS dia_semana_iso,
  r.apartment_number                                AS apartamento,
  LEFT(r.apartment_number, 1)                       AS andar,
  CASE r.created_by WHEN 'guest' THEN 'Hóspede' ELSE 'Recepção' END AS origem,
  r.status,
  (r.status = 'cancelled')                          AS cancelada,
  r.created_at,
  r.cancelled_at,
  (r.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS data_criacao_local,
  r.reservation_date
    - (r.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS antecedencia_dias,
  r.confirmation_sent                               AS confirmacao_enviada,
  r.warning_sent                                    AS aviso_enviado,
  r.anonymized                                      AS anonimizada
FROM public.reservations r;

COMMENT ON VIEW analytics.vw_reservas IS
  'Uma linha por reserva (ativa ou cancelada). Sem nome, WhatsApp ou observações.';

-- ---------------------------------------------------------------------------
-- Estadias (links de hóspede gerados pela recepção). Sem o token (é uma credencial).
-- ---------------------------------------------------------------------------
CREATE VIEW analytics.vw_estadias AS
SELECT
  s.id,
  s.apartment_number                                AS apartamento,
  LEFT(s.apartment_number, 1)                       AS andar,
  s.created_at,
  (s.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS data_criacao_local,
  s.checkout_date                                   AS data_checkout,
  s.checkout_date
    - (s.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS dias_ate_checkout,
  COALESCE(c.total, 0)                              AS qtd_reservas,
  COALESCE(c.ativas, 0)                             AS qtd_reservas_ativas,
  COALESCE(c.total, 0) > 0                          AS teve_reserva
FROM public.active_stays s
LEFT JOIN (
  SELECT stay_id,
         COUNT(*)                                   AS total,
         COUNT(*) FILTER (WHERE status = 'active')  AS ativas
  FROM public.reservations
  WHERE stay_id IS NOT NULL
  GROUP BY stay_id
) c ON c.stay_id = s.id;

COMMENT ON VIEW analytics.vw_estadias IS
  'Uma linha por link de estadia, com contagem de reservas geradas (conversão do link).';

-- ---------------------------------------------------------------------------
-- Eventos de auditoria (criada, editada, cancelada, anonimizada)
-- ---------------------------------------------------------------------------
CREATE VIEW analytics.vw_eventos AS
SELECT
  e.id,
  e.reservation_id                                  AS reserva_id,
  e.event_type                                      AS tipo_evento,
  e.actor                                           AS ator,
  e.changed_fields                                  AS campos_alterados,
  e.occurred_at                                     AS ocorrido_em
FROM public.reservation_events e;

COMMENT ON VIEW analytics.vw_eventos IS
  'Trilha de auditoria das reservas. Só nomes de campos alterados, nunca valores.';

-- ---------------------------------------------------------------------------
-- Role de leitura exclusiva do Power BI
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'powerbi_reader') THEN
    CREATE ROLE powerbi_reader LOGIN NOINHERIT NOBYPASSRLS NOCREATEDB NOCREATEROLE CONNECTION LIMIT 5;
  END IF;
END $$;

ALTER ROLE powerbi_reader SET statement_timeout = '30s';

-- O schema analytics não é exposto pela API do Supabase e fica fechado para todos, exceto a role.
REVOKE ALL ON SCHEMA analytics FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA analytics FROM PUBLIC, anon, authenticated;

GRANT USAGE ON SCHEMA analytics TO powerbi_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO powerbi_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA analytics GRANT SELECT ON TABLES TO powerbi_reader;

-- A role não tem acesso a nada em public (as tabelas já têm RLS sem políticas).
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM powerbi_reader;
