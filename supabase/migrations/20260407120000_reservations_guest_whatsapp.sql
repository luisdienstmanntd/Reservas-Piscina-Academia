-- WhatsApp do hóspede (reservas balcão / notificações futuras)
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS guest_whatsapp text;

COMMENT ON COLUMN public.reservations.guest_whatsapp IS 'Telefone/WhatsApp (principalmente balcão); dígitos para integrações.';
