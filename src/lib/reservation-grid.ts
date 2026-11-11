import { normalizeSlotStart } from "@/lib/reservations";

/**
 * Ordem das linhas da planilha da recepção: o dia corre de 01h até 00h, então o horário
 * 00h00 (meia-noite) fica por ÚLTIMO. Na piscina ele já é o último; na academia (24 h) passa
 * de primeiro para último. Os demais mantêm a ordem.
 */
export function receptionSlotOrder(slots: readonly string[]): string[] {
  const isMidnight = (s: string) => normalizeSlotStart(s) === "00:00:00";
  return [...slots.filter((s) => !isMidnight(s)), ...slots.filter(isMidnight)];
}

/** Rótulo da linha da planilha: só o início da hora, ex.: "21h00". */
export function slotStartLabel(slotStart: string): string {
  const [hh, mm] = normalizeSlotStart(slotStart).split(":");
  return `${hh}h${mm}`;
}
