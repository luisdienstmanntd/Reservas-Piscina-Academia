-- Retenção de dados — preservar o histórico; o único dado apagado automaticamente é o WhatsApp.
--
-- Política (decisão do responsável, 11/11/2026):
--   * Reservas, apartamento, nome, observações, cancelamentos e eventos: PRESERVADOS (sem prazo).
--   * WhatsApp (guest_whatsapp): apagado (NULL) 365 dias depois do check-out.
--   * Marco do prazo: COALESCE(guest_checkout_date, reservation_date).
--   * Dia 365 após o marco: ainda mantido. A partir do dia 366: apagado na rodada diária seguinte.
--
-- O que muda em relação ao job anterior (20261110100000):
--   ANTES: no dia seguinte ao check-out o job apagava nome, WhatsApp e observações e marcava
--          anonymized = true.
--   AGORA: o job só apaga o WhatsApp antigo. Nome e observações deixam de ser apagados.
--
-- Aditiva: não apaga nem altera nenhum dado existente ao ser aplicada. Linhas que o job anterior
-- JÁ anonimizou (anonymized = true) NÃO são tocadas nem recuperadas.
-- Reversão: docs/RETENCAO_DADOS.md.
-- PENDENTE de aprovação de LGPD antes de aplicar em produção.

ALTER TABLE public.reservations
  ADD COLUMN whatsapp_anonymized_at timestamptz;

COMMENT ON COLUMN public.reservations.whatsapp_anonymized_at IS
  'Quando o WhatsApp foi apagado pela rotina de retenção (365 dias após o check-out). Nulo = ainda não apagado.';

-- Auditoria: a remoção do WhatsApp pela rotina é atribuída ao sistema (e não à recepção).
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
  IF NEW.whatsapp_anonymized_at IS DISTINCT FROM OLD.whatsapp_anonymized_at THEN
    who := 'system';
  END IF;

  IF array_length(changed, 1) > 0 THEN
    INSERT INTO public.reservation_events (reservation_id, event_type, actor, changed_fields)
    VALUES (NEW.id, 'updated', who, changed);
  END IF;
  RETURN NEW;
END;
$$;

-- Apaga SÓ o WhatsApp vencido. `p_today` existe para testar o prazo com datas exatas.
CREATE OR REPLACE FUNCTION public.anonymize_old_whatsapp(
  p_today date DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date
) RETURNS integer
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  n integer;
BEGIN
  UPDATE public.reservations
  SET guest_whatsapp = NULL,
      whatsapp_anonymized_at = now()
  WHERE guest_whatsapp IS NOT NULL
    AND btrim(guest_whatsapp) <> ''
    AND COALESCE(guest_checkout_date, reservation_date) < p_today - 365;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.anonymize_old_whatsapp(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anonymize_old_whatsapp(date) TO service_role;

-- Reagenda o job diário (03:00 UTC) com a nova regra (mesmo nome do job anterior).
DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT jobid INTO jid
  FROM cron.job
  WHERE jobname = 'lgpd_anonymize_reservations'
  LIMIT 1;
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

SELECT cron.schedule(
  'lgpd_anonymize_reservations',
  '0 3 * * *',
  $$SELECT public.anonymize_old_whatsapp();$$
);
