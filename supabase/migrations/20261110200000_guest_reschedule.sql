-- Hóspede pode trocar o horário de uma reserva já feita (mesma instalação e dia).
--
-- 1) reservations.guest_rescheduled_at: marca quando o HÓSPEDE trocou o horário. A recepção usa
--    esse campo para ser avisada da troca (a reserva não é nova, então `created_at` não serve).
-- 2) A trilha de auditoria passa a registrar mudança de horário/data (slot_start, reservation_date)
--    e a atribuir a troca ao hóspede (actor = 'guest'); as demais edições seguem como 'reception'.
-- Migration aditiva: só adiciona uma coluna anulável e troca o corpo de uma função.

ALTER TABLE public.reservations
  ADD COLUMN guest_rescheduled_at timestamptz;

COMMENT ON COLUMN public.reservations.guest_rescheduled_at IS
  'Quando o hóspede trocou o horário desta reserva (nulo = nunca trocou). Usado para avisar a recepção.';

CREATE INDEX reservations_guest_rescheduled_idx
  ON public.reservations (guest_rescheduled_at)
  WHERE guest_rescheduled_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.reservations_log_event() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  changed text[] := ARRAY[]::text[];
  who text := 'reception';
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

  IF NEW.slot_start IS DISTINCT FROM OLD.slot_start THEN changed := array_append(changed, 'slot_start'::text); END IF;
  IF NEW.reservation_date IS DISTINCT FROM OLD.reservation_date THEN changed := array_append(changed, 'reservation_date'::text); END IF;
  IF NEW.guest_name IS DISTINCT FROM OLD.guest_name THEN changed := array_append(changed, 'guest_name'::text); END IF;
  IF NEW.guest_whatsapp IS DISTINCT FROM OLD.guest_whatsapp THEN changed := array_append(changed, 'guest_whatsapp'::text); END IF;
  IF NEW.notes IS DISTINCT FROM OLD.notes THEN changed := array_append(changed, 'notes'::text); END IF;
  IF NEW.confirmation_sent IS DISTINCT FROM OLD.confirmation_sent THEN changed := array_append(changed, 'confirmation_sent'::text); END IF;
  IF NEW.warning_sent IS DISTINCT FROM OLD.warning_sent THEN changed := array_append(changed, 'warning_sent'::text); END IF;

  IF NEW.guest_rescheduled_at IS DISTINCT FROM OLD.guest_rescheduled_at THEN
    who := 'guest';
  END IF;

  IF array_length(changed, 1) > 0 THEN
    INSERT INTO public.reservation_events (reservation_id, event_type, actor, changed_fields)
    VALUES (NEW.id, 'updated', who, changed);
  END IF;
  RETURN NEW;
END;
$$;
