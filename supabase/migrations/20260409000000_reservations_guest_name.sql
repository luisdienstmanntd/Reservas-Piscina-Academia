-- Nome do hóspede (preenchido pelo hóspede na reserva ou pela recepção)
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS guest_name text;

COMMENT ON COLUMN public.reservations.guest_name IS 'Nome do hóspede que realizou a reserva.';
