import { format, parseISO, isAfter, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

/** Instalação: piscina (regras 13h–01h) ou academia (24h). */
export type Facility = "pool" | "gym";

/** Slots reserváveis da piscina (exclusivo 13h–01h). 00:00 = 00h–01h. */
export const POOL_SLOT_STARTS = [
  "13:00:00",
  "14:00:00",
  "15:00:00",
  "16:00:00",
  "17:00:00",
  "18:00:00",
  "19:00:00",
  "20:00:00",
  "21:00:00",
  "22:00:00",
  "23:00:00",
  "00:00:00",
] as const;

/** Academia: 24h, de 00h–01h até 23h–00h (slots de 1h). */
export const GYM_SLOT_STARTS: readonly string[] = Array.from(
  { length: 24 },
  (_, h) => `${String(h).padStart(2, "0")}:00:00`
);

/** @deprecated use POOL_SLOT_STARTS */
export const SLOT_STARTS = POOL_SLOT_STARTS;

export function slotStartsFor(facility: Facility): readonly string[] {
  return facility === "pool" ? POOL_SLOT_STARTS : GYM_SLOT_STARTS;
}

export type SlotStart = (typeof POOL_SLOT_STARTS)[number];

export function normalizeSlotStart(t: string): string {
  const parts = t.split(":");
  const h = parts[0]?.padStart(2, "0") ?? "00";
  const m = (parts[1] ?? "00").padStart(2, "0");
  const s = (parts[2] ?? "00").padStart(2, "0");
  return `${h}:${m}:${s}`;
}

/** Rótulo amigável: "13h00 – 14h00" … */
export function slotLabel(slotStart: string): string {
  const n = normalizeSlotStart(slotStart);
  const [hh, mm] = n.split(":").map(Number);
  const startM = hh * 60 + mm;
  let endM = startM + 60;
  if (endM >= 24 * 60) endM -= 24 * 60;
  const eh = Math.floor(endM / 60);
  const em = endM % 60;
  const fmt = (h: number, m: number) =>
    `${h.toString().padStart(2, "0")}h${m.toString().padStart(2, "0")}`;
  return `${fmt(hh, mm)} – ${fmt(eh, em)}`;
}

export function formatDateBR(d: Date): string {
  return format(d, "dd/MM/yyyy", { locale: ptBR });
}

export function parseDateOnly(isoDate: string): Date {
  return parseISO(isoDate);
}

export function isDateInStay(
  date: Date,
  checkout: Date,
  today: Date = new Date()
): boolean {
  const d0 = startOfDay(today);
  const d = startOfDay(date);
  const co = startOfDay(checkout);
  return !isBefore(d, d0) && !isAfter(d, co);
}

export type ReservationRow = {
  id: string;
  facility: string;
  reservation_date: string;
  slot_start: string;
  apartment_number: string;
  guest_name: string | null;
  guest_checkout_date: string | null;
  guest_whatsapp: string | null;
  confirmation_sent: boolean;
  warning_sent: boolean;
  created_at: string;
  created_by: string;
  notes: string | null;
};
