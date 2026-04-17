import { hotelCalendarDate } from "@/lib/hotel-time";
import {
  normalizeSlotStart,
  slotStartsFor,
  type Facility,
} from "@/lib/reservations";

/**
 * Regras de data e slot para criar reserva (hóspede ou recepção).
 * `todayYmd` é injetável para testes; em produção usa o calendário do hotel.
 */
export function validateStayAndSlot(
  facility: Facility,
  reservationDate: string,
  guestCheckoutDate: string,
  slotStart: string,
  todayYmd: string = hotelCalendarDate()
): string | null {
  if (reservationDate < todayYmd) {
    return "Não é possível reservar datas passadas.";
  }
  if (reservationDate > guestCheckoutDate) {
    return "A data da reserva deve ser até o seu check-out.";
  }
  const norm = normalizeSlotStart(slotStart);
  const allowed = new Set(slotStartsFor(facility));
  if (!allowed.has(norm)) {
    return "Horário inválido.";
  }
  return null;
}
