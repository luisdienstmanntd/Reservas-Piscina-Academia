-- Fase 2.5 — Anonimização grava NULL (não '' nem 'Anonimizado') e marca anonymized.

ALTER TABLE public.reservations
  ADD COLUMN anonymized boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.reservations.anonymized IS
  'true quando nome e WhatsApp foram removidos pela rotina LGPD.';

-- Converte o que a rotina antiga já anonimizou.
UPDATE public.reservations
SET guest_name = NULL,
    guest_whatsapp = NULL,
    anonymized = true
WHERE guest_name = 'Anonimizado';

-- Reagenda o job diário (03:00 UTC) com a nova regra.
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
  $$
  UPDATE public.reservations
  SET
    guest_name = NULL,
    guest_whatsapp = NULL,
    anonymized = true
  WHERE anonymized = false
    AND COALESCE(guest_checkout_date, reservation_date) < CURRENT_DATE;
  $$
);
