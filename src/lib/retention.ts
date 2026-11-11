import { addDaysYmd } from "@/lib/hotel-time";

/**
 * Prazo de guarda do WhatsApp: 365 dias depois do check-out. É o ÚNICO dado apagado
 * automaticamente; reservas, nome, apartamento, observações, cancelamentos e eventos ficam.
 * A regra "de verdade" roda no banco (`public.anonymize_old_whatsapp`); este arquivo é o espelho
 * testado e documentado dela.
 */
export const WHATSAPP_RETENTION_DAYS = 365;

/** Marco do prazo: o check-out (ou, se não houver, o dia da reserva). Formato yyyy-MM-dd. */
export function retentionMarkerYmd(r: {
  guest_checkout_date: string | null;
  reservation_date: string;
}): string {
  return r.guest_checkout_date ?? r.reservation_date;
}

/**
 * O WhatsApp já venceu? No dia 365 após o marco ainda é mantido; a partir do dia 366 é apagado
 * (na rodada diária seguinte). Equivale a `marco < hoje − 365` no SQL.
 */
export function whatsappExpired(markerYmd: string, todayYmd: string): boolean {
  return markerYmd < addDaysYmd(todayYmd, -WHATSAPP_RETENTION_DAYS);
}

/** Primeiro dia em que o WhatsApp deixa de ser mantido (marco + 366 dias). */
export function whatsappFirstRemovalYmd(markerYmd: string): string {
  return addDaysYmd(markerYmd, WHATSAPP_RETENTION_DAYS + 1);
}
