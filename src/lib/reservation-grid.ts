import { slotLabel } from "@/lib/reservations";

export type GridItem<T> =
  | { kind: "booked"; slot: string; row: T }
  /** Horários sem reserva em sequência. `past`: já terminaram (não dá mais para reservar). */
  | { kind: "free"; slots: string[]; past: boolean };

/**
 * Monta os itens da grade do dia: cada reserva vira um item e horários livres
 * consecutivos são agrupados em um só item (a grade fica curta e cabe na tela).
 * Horários livres que já passaram ficam em grupos separados dos que ainda estão disponíveis.
 */
export function buildGridItems<T>(
  slots: readonly string[],
  rowFor: (slot: string) => T | undefined,
  isPast: (slot: string) => boolean = () => false
): GridItem<T>[] {
  const items: GridItem<T>[] = [];
  for (const slot of slots) {
    const row = rowFor(slot);
    if (row !== undefined) {
      items.push({ kind: "booked", slot, row });
      continue;
    }
    const past = isPast(slot);
    const last = items[items.length - 1];
    if (last && last.kind === "free" && last.past === past) last.slots.push(slot);
    else items.push({ kind: "free", slots: [slot], past });
  }
  return items;
}

/** "14h00 – 16h00" para o grupo de horários livres (início do primeiro, fim do último). */
export function freeRangeLabel(slots: readonly string[]): string {
  const first = slotLabel(slots[0]).split(" – ")[0];
  const last = slotLabel(slots[slots.length - 1]).split(" – ")[1];
  // 24 horários seguidos (academia vazia): início e fim coincidem.
  if (first === last) return "Dia todo";
  return `${first} – ${last}`;
}
