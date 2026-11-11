import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { hourRangeLabel } from "@/lib/my-reservations";

/** Tipos gravados em `reservation_events.event_type`. */
export type HistoryEventType = "created" | "updated" | "cancelled" | "anonymized";

/** Um evento do histórico já junto com os dados da reserva (para a recepção). */
export type HistoryItem = {
  id: string;
  type: HistoryEventType;
  /** guest | reception | system (como gravado na auditoria). */
  actor: string | null;
  changedFields: string[];
  /** Instante do evento (ISO 8601). */
  occurredAt: string;
  facility: "pool" | "gym" | null;
  /** yyyy-MM-dd da reserva. */
  reservationDate: string | null;
  slotStart: string | null;
  apartment: string | null;
  guestName: string | null;
  /**
   * A reserva já teve horário/data trocados: a auditoria não guarda os valores antigos, então
   * dia e horário mostrados são os ATUAIS da reserva, não os do momento do evento.
   */
  slotMayDiffer?: boolean;
};

export const HISTORY_TITLES: Record<HistoryEventType, string> = {
  created: "Reserva incluída",
  updated: "Reserva alterada",
  cancelled: "Reserva excluída",
  anonymized: "Dados apagados (LGPD)",
};

const FIELD_LABELS: Record<string, string> = {
  slot_start: "horário",
  reservation_date: "data",
  guest_name: "nome",
  guest_whatsapp: "WhatsApp",
  notes: "observações",
  confirmation_sent: "confirmação enviada",
  warning_sent: "aviso enviado",
};

export function historyTitle(type: string): string {
  return HISTORY_TITLES[type as HistoryEventType] ?? "Evento";
}

/** Quem fez: "Hóspede", "Recepção" ou "Sistema". */
export function actorLabel(actor: string | null): string {
  if (actor === "guest") return "Hóspede";
  if (actor === "reception") return "Recepção";
  if (actor === "system") return "Sistema";
  return "Não informado";
}

/** "horário e data" / "nome, WhatsApp e observações" (vazio se não houver campos). */
export function changedFieldsLabel(fields: readonly string[]): string {
  const names = fields.map((f) => FIELD_LABELS[f] ?? f);
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

/** "11/11/2026, 10:24" no fuso do hotel (America/Sao_Paulo). */
export function formatEventDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const p = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  return `${p("day")}/${p("month")}/${p("year")}, ${p("hour")}:${p("minute")}`;
}

/** "Piscina · Apto 101 · quarta-feira 11/11 · 19h às 20h" (partes ausentes são omitidas). */
export function reservationLine(item: HistoryItem): string {
  const out: string[] = [];
  if (item.facility) out.push(item.facility === "pool" ? "Piscina" : "Academia");
  if (item.apartment) out.push(`Apto ${item.apartment}`);
  if (item.reservationDate) {
    const [y, m, d] = item.reservationDate.split("-").map(Number);
    out.push(format(new Date(y, m - 1, d), "EEEE dd/MM", { locale: ptBR }));
  }
  if (item.slotStart) out.push(hourRangeLabel(item.slotStart));
  const line = out.join(" · ");
  return item.slotMayDiffer && line ? `${line} (atual)` : line;
}
