import { reservationSlotEndMs } from "@/lib/wa-me";
import { normalizeSlotStart, type Facility } from "@/lib/reservations";

/** Por que um horário está indisponível (ordem de prioridade na exibição). */
export type SlotBlockReason = "occupied" | "past" | "apartment_limit";

/** Textos curtos e completos, iguais em todas as telas. */
export const SLOT_BLOCK_LABEL: Record<SlotBlockReason, string> = {
  occupied: "Ocupado",
  past: "Já passou",
  apartment_limit: "Limite do dia",
};

/** Frase para avisos (toast, dica abaixo do seletor). */
export const SLOT_BLOCK_MESSAGE: Record<SlotBlockReason, string> = {
  occupied: "Este horário já está reservado. Escolha outro.",
  past: "Este horário já passou. Escolha outro.",
  apartment_limit:
    "Limite diário atingido. Para reservar mais de 1 horário nesta data, consulte a recepção.",
};

/**
 * O horário já terminou? Só vale para o dia de hoje (no fuso do hotel).
 * O bloco 00h–01h da piscina fica de fora: a regra do hotel para esse bloco
 * (meia-noite do próprio dia ou da noite seguinte) ainda não está definida.
 */
export function isSlotEnded(
  facility: Facility,
  reservationDateYmd: string,
  slotStart: string,
  todayYmd: string,
  nowMs: number
): boolean {
  if (reservationDateYmd !== todayYmd) return false;
  const norm = normalizeSlotStart(slotStart);
  if (facility === "pool" && norm === "00:00:00") return false;
  return reservationSlotEndMs(reservationDateYmd, norm) <= nowMs;
}

export function slotBlockReason(input: {
  facility: Facility;
  reservationDateYmd: string;
  slotStart: string;
  occupied: ReadonlySet<string>;
  apartmentBooked: boolean;
  todayYmd: string;
  nowMs: number;
}): SlotBlockReason | null {
  const norm = normalizeSlotStart(input.slotStart);
  if (input.occupied.has(norm)) return "occupied";
  if (
    isSlotEnded(
      input.facility,
      input.reservationDateYmd,
      norm,
      input.todayYmd,
      input.nowMs
    )
  )
    return "past";
  if (input.apartmentBooked) return "apartment_limit";
  return null;
}
