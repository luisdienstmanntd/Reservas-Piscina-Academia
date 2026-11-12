-- Permanência do nome e do WhatsApp do hóspede durante a estadia.
--
-- O hóspede abre o link (token da estadia) em vários dias e aparelhos; nome e WhatsApp ficam gravados NA ESTADIA
-- (active_stays) e valem até o check-out, para ele não digitar de novo. Antes só ficavam no navegador do aparelho:
-- trocar de aparelho/navegador (ex.: abrir o link do WhatsApp no Safari) pedia tudo outra vez.
--
-- Depois do check-out os dois campos são esvaziados todo dia (job abaixo). O histórico de reservas não muda: nome e
-- WhatsApp continuam nas reservas, sob a política de retenção própria (WhatsApp só apagado 365 dias após o check-out).
-- A view analytics.vw_estadias lista colunas explicitamente e NÃO expõe estes campos.
--
-- ORDEM DE PUBLICAÇÃO: aplique esta migration ANTES de publicar o código novo.

ALTER TABLE public.active_stays
  ADD COLUMN guest_name text,
  ADD COLUMN guest_whatsapp text,
  ADD COLUMN contact_saved_at timestamptz;

COMMENT ON COLUMN public.active_stays.guest_name IS
  'Nome informado pelo hóspede no link; esvaziado depois do check-out.';
COMMENT ON COLUMN public.active_stays.guest_whatsapp IS
  'WhatsApp informado pelo hóspede no link; esvaziado depois do check-out.';

DO $$
DECLARE
  jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'clear_stay_guest_contact' LIMIT 1;
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

-- 03:40 UTC = 00:40 em Brasília: o dia do check-out já terminou no hotel.
SELECT cron.schedule(
  'clear_stay_guest_contact',
  '40 3 * * *',
  $$
  UPDATE public.active_stays
     SET guest_name = NULL, guest_whatsapp = NULL
   WHERE checkout_date < CURRENT_DATE
     AND (guest_name IS NOT NULL OR guest_whatsapp IS NOT NULL);
  $$
);
