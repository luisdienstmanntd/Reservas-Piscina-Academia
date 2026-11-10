-- LGPD — a rotina de anonimização passa a apagar também as observações (notes).
-- As observações são texto livre digitado pela recepção e podem conter dados pessoais
-- (telefone de familiar, alergias, pedidos). Depois do fim da estadia elas não são mais necessárias.
--
-- 1) Apaga as observações das reservas JÁ anonimizadas, sem gerar eventos de auditoria falsos.
-- 2) Reagenda o job diário (03:00 UTC) incluindo notes.

ALTER TABLE public.reservations DISABLE TRIGGER USER;

UPDATE public.reservations
SET notes = NULL
WHERE anonymized = true AND notes IS NOT NULL;

ALTER TABLE public.reservations ENABLE TRIGGER USER;

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
    notes = NULL,
    anonymized = true
  WHERE anonymized = false
    AND COALESCE(guest_checkout_date, reservation_date) < CURRENT_DATE;
  $$
);
