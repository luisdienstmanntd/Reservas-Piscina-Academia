import { hotelCalendarDate } from "@/lib/hotel-time";
import { SLOT_BLOCK_MESSAGE, isSlotEnded } from "@/lib/slot-availability";
import {
  normalizeSlotStart,
  slotStartsFor,
  type Facility,
} from "@/lib/reservations";

/**
 * Regras de data e slot para criar reserva (hóspede ou recepção).
 * `guestCheckoutDate` nulo (reserva de balcão) pula a checagem de check-out.
 * `todayYmd` e `nowMs` são injetáveis para testes; em produção usam o relógio do hotel.
 * Horário que já terminou hoje é recusado (o em andamento continua permitido).
 */
export function validateStayAndSlot(
  facility: Facility,
  reservationDate: string,
  guestCheckoutDate: string | null,
  slotStart: string,
  todayYmd: string = hotelCalendarDate(),
  nowMs: number = Date.now()
): string | null {
  if (reservationDate < todayYmd) {
    return "Não é possível reservar datas passadas.";
  }
  if (guestCheckoutDate !== null && reservationDate > guestCheckoutDate) {
    return "A data da reserva deve ser até o seu check-out.";
  }
  const norm = normalizeSlotStart(slotStart);
  const allowed = new Set(slotStartsFor(facility));
  if (!allowed.has(norm)) {
    return "Horário inválido.";
  }
  if (isSlotEnded(facility, reservationDate, norm, todayYmd, nowMs)) {
    return SLOT_BLOCK_MESSAGE.past;
  }
  return null;
}
