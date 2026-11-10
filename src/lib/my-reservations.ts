import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { isSlotEnded } from "@/lib/slot-availability";
import { normalizeSlotStart, type Facility } from "@/lib/reservations";

/** Reserva do próprio hóspede, só com o que ele precisa ver (sem nome, WhatsApp ou observações). */
export type MyReservation = {
  id: string;
  facility: Facility;
  dateYmd: string;
  slotStart: string;
};

/** "19h às 20h" (com minutos só quando não forem zero). */
export function hourRangeLabel(slotStart: string): string {
  const [hh, mm] = normalizeSlotStart(slotStart).split(":").map(Number);
  const endTotal = (hh * 60 + mm + 60) % (24 * 60);
  const fmt = (h: number, m: number) =>
    m === 0 ? `${h}h` : `${h}h${m.toString().padStart(2, "0")}`;
  return `${fmt(hh, mm)} às ${fmt(Math.floor(endTotal / 60), endTotal % 60)}`;
}

/** "terça-feira 10/11 - 19h às 20h - piscina" */
export function myReservationLabel(r: MyReservation): string {
  const [y, m, d] = r.dateYmd.split("-").map(Number);
  const day = format(new Date(y, m - 1, d), "EEEE dd/MM", { locale: ptBR });
  const place = r.facility === "pool" ? "piscina" : "academia";
  return `${day} - ${hourRangeLabel(r.slotStart)} - ${place}`;
}

/** Tira o que já terminou e ordena por data e horário. */
export function upcomingReservations(
  rows: readonly MyReservation[],
  todayYmd: string,
  nowMs: number
): MyReservation[] {
  return rows
    .filter(
      (r) =>
        r.dateYmd >= todayYmd &&
        !isSlotEnded(r.facility, r.dateYmd, r.slotStart, todayYmd, nowMs)
    )
    .sort((a, b) =>
      a.dateYmd !== b.dateYmd
        ? a.dateYmd.localeCompare(b.dateYmd)
        : normalizeSlotStart(a.slotStart).localeCompare(
            normalizeSlotStart(b.slotStart)
          )
    );
}
