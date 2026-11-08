-- Fase 3.1 — Vínculo reserva ↔ estadia.
-- Permite medir a conversão do link de estadia em reserva (quantas estadias geraram reserva).
-- Reservas de balcão (recepção) ficam com stay_id NULL: não vieram de um link.
--
-- ON DELETE SET NULL: apagar uma estadia (LGPD) não bloqueia nem apaga a reserva.

ALTER TABLE public.reservations
  ADD COLUMN stay_id uuid REFERENCES public.active_stays (id) ON DELETE SET NULL;

CREATE INDEX reservations_stay_id_idx ON public.reservations (stay_id);

COMMENT ON COLUMN public.reservations.stay_id IS
  'Estadia (link de hóspede) que originou a reserva. NULL em reservas de balcão e nas anteriores a este campo.';
