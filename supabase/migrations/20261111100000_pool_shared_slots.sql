-- Piscina: a recepção pode registrar reserva manual nos horários de USO COMPARTILHADO (09h às 12h, 09h–13h).
-- O hóspede continua sem poder reservá-los (a regra está no app). Antes o banco só aceitava piscina de 13h a 23h e 00h.
-- Só amplia o que é aceito: toda reserva existente continua válida.

ALTER TABLE public.reservations
  DROP CONSTRAINT reservations_slot_valid;

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_slot_valid CHECK (
    (
      facility = 'pool'
      AND (
        (
          slot_start >= time '09:00'
          AND slot_start <= time '23:00'
          AND (EXTRACT(MINUTE FROM slot_start) = 0)
          AND (EXTRACT(SECOND FROM slot_start) = 0)
        )
        OR slot_start = time '00:00'
      )
    )
    OR (
      facility = 'gym'
      AND (EXTRACT(MINUTE FROM slot_start) = 0)
      AND (EXTRACT(SECOND FROM slot_start) = 0)
      AND slot_start >= time '00:00'
      AND slot_start <= time '23:00'
    )
  );

COMMENT ON COLUMN public.reservations.facility IS
  'pool = piscina (13h–01h reservável pelo hóspede; 09h–13h uso compartilhado, só a recepção reserva); gym = academia (24h, slots de 1h).';
