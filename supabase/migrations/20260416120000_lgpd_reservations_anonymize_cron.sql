-- =============================================================================
-- LGPD — anonimização periódica de PII em public.reservations (Supabase + pg_cron)
--
-- Gatilho recomendado: fim da estadia = guest_checkout_date (ou reservation_date
-- se guest_checkout_date for NULL — linhas legadas).
-- reservation_date sozinho NÃO representa o check-out: um hóspede pode ter reserva
-- de piscina num dia anterior ao checkout.
--
-- Horário: expressão cron em UTC (servidor Supabase). Ajuste se precisar de 03:00
-- no fuso do hotel (ex.: America/Sao_Paulo ≈ UTC-3 → 03:00 local = 06:00 UTC).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Evita erro ao reexecutar o script (idempotência básica)
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
    guest_name = 'Anonimizado',
    guest_whatsapp = ''
  WHERE COALESCE(guest_checkout_date, reservation_date) < CURRENT_DATE
    AND (
      (guest_name IS NOT NULL AND guest_name <> 'Anonimizado')
      OR (guest_whatsapp IS NOT NULL AND btrim(guest_whatsapp) <> '')
    );
  $$
);

-- Alternativa (não recomendada): só reservation_date — anonimiza cedo se o hóspede
-- ainda estiver no hotel após o dia do slot.
-- WHERE reservation_date < CURRENT_DATE
