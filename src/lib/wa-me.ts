import { normalizeSlotStart } from "@/lib/reservations";

/** Fuso fixo do hotel (sem horário de verão desde 2019). */
const SAO_PAULO_OFFSET = "-03:00";

/**
 * Dígitos para wa.me: só números; se tiver 10 ou 11 dígitos, prefixo 55 (Brasil).
 * Se já começar por 55 com comprimento adequado, mantém.
 */
export function whatsappDigitsForWaMe(input: string | null | undefined): string | null {
  if (input == null || !String(input).trim()) return null;
  const d = String(input).replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("55") && d.length >= 12 && d.length <= 15) return d;
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if (d.length >= 12 && d.length <= 15) return d;
  return null;
}

/** Link direto ao WhatsApp Web (evita redirecionamento wa.me). */
export function buildWhatsappWaMeUrl(
  phoneRaw: string | null | undefined,
  message: string
): string | null {
  const num = whatsappDigitsForWaMe(phoneRaw);
  if (!num) return null;
  const text = encodeURIComponent(message);
  return `https://web.whatsapp.com/send?phone=${num}&text=${text}`;
}

export function facilityDisplayName(facility: string): "Piscina" | "Academia" {
  return facility === "gym" ? "Academia" : "Piscina";
}

/** Início do slot no fuso America/Sao_Paulo (UTC-3). */
export function reservationSlotStartMs(
  reservationDateYmd: string,
  slotStart: string
): number {
  const n = normalizeSlotStart(slotStart);
  const [h, m, s] = n.split(":").map((x) => Number(x));
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  const ss = String(s ?? 0).padStart(2, "0");
  const iso = `${reservationDateYmd}T${hh}:${mm}:${ss}${SAO_PAULO_OFFSET}`;
  return Date.parse(iso);
}

/** Fim do slot = início + 1 h (regra do hotel). */
export function reservationSlotEndMs(
  reservationDateYmd: string,
  slotStart: string
): number {
  return reservationSlotStartMs(reservationDateYmd, slotStart) + 60 * 60 * 1000;
}

/**
 * Janela de alerta para o aviso de ~10 min: faltam entre 0 e 15 min para o fim do slot.
 */
export function isWarningAlertWindow(
  reservationDateYmd: string,
  slotStart: string,
  nowMs: number
): boolean {
  const end = reservationSlotEndMs(reservationDateYmd, slotStart);
  const minutesLeft = (end - nowMs) / 60_000;
  return minutesLeft > 0 && minutesLeft <= 15;
}

function formatSlotStartForMessage(slotStart: string): string {
  const n = normalizeSlotStart(slotStart);
  const [hh, mm] = n.split(":").map(Number);
  return `${String(hh).padStart(2, "0")}h${String(mm).padStart(2, "0")}`;
}

function formatReservationDateForMessage(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

export function buildConfirmationMessage(
  facility: string,
  reservationDateYmd: string,
  slotStart: string,
  todayYmd: string
): string {
  const place = facilityDisplayName(facility);
  const timeStr = formatSlotStartForMessage(slotStart);
  const when =
    reservationDateYmd === todayYmd
      ? `hoje às ${timeStr}`
      : `dia ${formatReservationDateForMessage(reservationDateYmd)} às ${timeStr}`;
  return `Olá! Sua reserva para a ${place} no Valle D'incanto está confirmada para ${when}. Desejamos um momento de muito relaxamento!`;
}

export function buildWarningMessage(facility: string): string {
  const place = facilityDisplayName(facility);
  return `Olá! Passando para lembrar que sua reserva na ${place} termina em 10 minutos. Precisamos preparar o ambiente para o próximo hóspede. Agradecemos a compreensão!`;
}
