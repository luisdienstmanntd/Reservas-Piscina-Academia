import { facilityDisplayName, reservationSlotEndMs } from "@/lib/wa-me";

/** Quantos minutos antes do fim do horário a recepção é avisada (som + mensagem). */
export const ENDING_ALERT_MINUTES = 10;

export type EndingSoonItem = {
  id: string;
  facility: string;
  reservation_date: string;
  slot_start: string;
  apartment_number: string;
  guest_name: string | null;
  minutes_left: number;
};

/** Minutos que faltam para o fim do horário (negativo se já terminou). */
export function minutesLeft(
  reservationDateYmd: string,
  slotStart: string,
  nowMs: number
): number {
  return (reservationSlotEndMs(reservationDateYmd, slotStart) - nowMs) / 60_000;
}

/** Faltam 10 minutos ou menos, e o horário ainda não terminou. */
export function isEndingSoon(
  reservationDateYmd: string,
  slotStart: string,
  nowMs: number
): boolean {
  const left = minutesLeft(reservationDateYmd, slotStart, nowMs);
  return left > 0 && left <= ENDING_ALERT_MINUTES;
}

/** Texto curto da mensagem na tela (ex.: "Apto 212 · Piscina · faltam 8 min"). */
export function endingSoonLabel(item: EndingSoonItem): string {
  const left = Math.max(1, Math.ceil(item.minutes_left));
  const who = item.guest_name ? ` (${item.guest_name})` : "";
  return `Apto ${item.apartment_number}${who} · ${facilityDisplayName(item.facility)} · faltam ${left} min`;
}
