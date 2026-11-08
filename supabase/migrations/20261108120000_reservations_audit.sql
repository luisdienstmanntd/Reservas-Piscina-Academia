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
