/** Data civil no fuso do hotel (Brasil). Formato yyyy-MM-dd para comparar com inputs type="date". */
export function hotelCalendarDate(d: Date = new Date()): string {
  return d.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}
