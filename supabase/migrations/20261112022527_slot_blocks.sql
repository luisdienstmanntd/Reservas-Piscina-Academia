-- Bloqueio de horário pela recepção.
-- Um horário bloqueado não aceita reserva (nem do hóspede, nem da recepção) e aparece como indisponível
-- na consulta do hóspede. Nada é apagado: desbloquear só preenche `released_at` (histórico preservado).
--
-- ORDEM DE PUBLICAÇÃO: aplique esta migration ANTES de publicar o código novo.

CREATE TABLE public.slot_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility text NOT NULL CHECK (facility IN ('pool', 'gym')),
  block_date date NOT NULL,
  slot_start time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  CONSTRAINT slot_blocks_slot_hour CHECK (
    EXTRACT(MINUTE FROM slot_start) = 0 AND EXTRACT(SECOND FROM slot_start) = 0
  )
);

-- Só um bloqueio VIGENTE por horário.
CREATE UNIQUE INDEX slot_blocks_active_unique
  ON public.slot_blocks (facility, block_date, slot_start)
  WHERE released_at IS NULL;

ALTER TABLE public.slot_blocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.slot_blocks FROM anon, authenticated;
GRANT ALL ON public.slot_blocks TO service_role;

-- Rede de segurança no banco: mesmo numa corrida, nenhuma reserva ATIVA entra (ou muda para) um horário bloqueado.
CREATE OR REPLACE FUNCTION public.reservations_block_check()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'active' AND EXISTS (
    SELECT 1 FROM public.slot_blocks b
    WHERE b.facility = NEW.facility
      AND b.block_date = NEW.reservation_date
      AND b.slot_start = NEW.slot_start
      AND b.released_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Horário bloqueado pela recepção.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER reservations_block_check
  BEFORE INSERT OR UPDATE OF facility, reservation_date, slot_start, status
  ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.reservations_block_check();

COMMENT ON TABLE public.slot_blocks IS
  'Horários bloqueados pela recepção. released_at preenchido = desbloqueado (histórico preservado).';
