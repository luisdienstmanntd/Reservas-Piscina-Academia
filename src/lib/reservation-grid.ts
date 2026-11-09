import { slotLabel } from "@/lib/reservations";

export type GridItem<T> =
  | { kind: "booked"; slot: string; row: T }
  | { kind: "free"; slots: string[] };

/**
 * Monta os itens da grade do dia: cada reserva vira um item e horários livres
 * consecutivos são agrupados em um só item (a grade fica curta e cabe na tela).
 */
export function buildGridItems<T>(
  slots: readonly string[],
  rowFor: (slot: string) => T | undefined
): GridItem<T>[] {
  const items: GridItem<T>[] = [];
  for (const slot of slots) {
    const row = rowFor(slot);
    if (row !== undefined) {
      items.push({ kind: "booked", slot, row });
      continue;
    }
    const last = items[items.length - 1];
    if (last && last.kind === "free") last.slots.push(slot);
    else items.push({ kind: "free", slots: [slot] });
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
