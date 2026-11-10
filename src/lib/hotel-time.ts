/** Data civil no fuso do hotel (Brasil). Formato yyyy-MM-dd para comparar com inputs type="date". */
export function hotelCalendarDate(d: Date = new Date()): string {
  return d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

/** Soma dias a uma data civil `yyyy-MM-dd` (sem depender do fuso do servidor). */
export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, (d ?? 1) + days)).toISOString().slice(0, 10);
}
