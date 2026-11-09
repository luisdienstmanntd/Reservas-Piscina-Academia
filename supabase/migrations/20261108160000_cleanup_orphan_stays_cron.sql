-- Fase 3.1 — Limpeza diária de estadias antigas SEM reservas (tokens vencidos há mais de 30 dias).
-- Estadias com reservas vinculadas nunca são apagadas aqui: preservam a conversão do link no BI.
-- Requer pg_cron (já usado pelo job LGPD). Horário: 03:30 UTC.

DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'cleanup_orphan_stays' LIMIT 1;
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

SELECT cron.schedule(
  'cleanup_orphan_stays',
  '30 3 * * *',
  $$
  DELETE FROM public.active_stays s
  WHERE s.checkout_date < CURRENT_DATE - 30
    AND NOT EXISTS (SELECT 1 FROM public.reservations r WHERE r.stay_id = s.id);
  $$
);
