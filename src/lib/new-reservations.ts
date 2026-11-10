import { slotLabel } from "@/lib/reservations";

/** Reserva nova, sem dados pessoais (só o necessário para avisar a recepção). */
export type NewReservationItem = {
  id: string;
  facility: string;
  reservation_date: string;
  slot_start: string;
  apartment_number: string;
  created_by: string;
  created_at: string;
  /** "changed" = o hóspede trocou o horário de uma reserva existente (o `id` inclui o instante da troca). */
  kind?: "new" | "changed";
};

/** Só reservas feitas pelo hóspede disparam aviso (a recepção já sabe das que ela mesma cria). */
export function isAlertable(item: NewReservationItem): boolean {
  return item.kind === "changed" || item.created_by === "guest";
}

function dayWord(reservationDate: string, todayYmd: string): string {
  if (reservationDate === todayYmd) return "hoje";
  const [y, m, d] = todayYmd.split("-").map(Number);
  const next = new Date(Date.UTC(y, (m ?? 1) - 1, (d ?? 1) + 1)).toISOString().slice(0, 10);
  if (reservationDate === next) return "amanhã";
  const [yy, mm, dd] = reservationDate.split("-");
  return `${dd}/${mm}/${yy}`;
}

/** Ex.: "Piscina · hoje · 20h00 – 21h00 · Apto 211". */
export function alertLabel(item: NewReservationItem, todayYmd: string): string {
  const place = item.facility === "gym" ? "Academia" : "Piscina";
  const base = `${place} · ${dayWord(item.reservation_date, todayYmd)} · ${slotLabel(item.slot_start)} · Apto ${item.apartment_number}`;
  return item.kind === "changed" ? `Horário alterado: ${base}` : base;
}

/**
 * Junta o que chegou do servidor ao que já está na lista de não vistos, sem repetir
 * (o servidor devolve uma pequena sobreposição de tempo de propósito) e só com o que merece aviso.
 */
export function mergeNewItems(
  unread: NewReservationItem[],
  incoming: NewReservationItem[],
  seenIds: Set<string>
): { unread: NewReservationItem[]; fresh: NewReservationItem[] } {
  const fresh: NewReservationItem[] = [];
  for (const item of incoming) {
    if (seenIds.has(item.id)) continue;
    seenIds.add(item.id);
    if (isAlertable(item)) fresh.push(item);
  }
  return { unread: [...unread, ...fresh], fresh };
}

/** Quanto tempo atrás a recepção abriu a tela é limitado: depois disso, só as últimas 24 h. */
export const MAX_LOOKBACK_MS = 24 * 60 * 60 * 1000;
/** Sobreposição de segurança na busca (reserva confirmada logo depois do corte). */
export const OVERLAP_MS = 10_000;
