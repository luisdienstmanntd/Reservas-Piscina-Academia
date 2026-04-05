-- Rastreio de mensagens WhatsApp semi-automáticas (wa.me) enviadas pela recepção
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS confirmation_sent boolean NOT NULL DEFAULT false;

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS warning_sent boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.reservations.confirmation_sent IS 'Recepção marcou envio da mensagem de confirmação (wa.me).';
COMMENT ON COLUMN public.reservations.warning_sent IS 'Recepção marcou envio do aviso ~10 min antes do fim do slot.';
