import { z } from "zod";
import { normalizePhone, PHONE_ERROR } from "@/lib/phone";
import { toUpperText } from "@/lib/text-case";

import { isAllowedApartmentNumber } from "@/lib/apartment-codes";

/** A data existe no calendário? (rejeita 2026-13-45, 2027-02-30...) */
export function isValidCalendarYmd(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
  );
}

/** Data civil `yyyy-MM-dd` que existe no calendário. */
export const isoYmdDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isValidCalendarYmd, "Data inválida.");

/**
 * Caracteres que não devem entrar em nomes e observações: controle (inclui o byte nulo, que o banco
 * recusa) e os de inversão de sentido de leitura (U+202A–202E, U+2066–2069), usados para disfarçar texto.
 */
export const FORBIDDEN_TEXT = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/;
export const FORBIDDEN_TEXT_MESSAGE = "O texto contém caracteres inválidos.";

export const reservationApartmentSchema = z
  .string()
  .trim()
  .min(1, "Informe o número do apartamento.")
  .refine((s) => isAllowedApartmentNumber(s), {
    message: "Apartamento inválido. Use um número da lista do hotel.",
  });

/** Mesma regra de apartamento que na recepção, mensagens do fluxo de token. */
export const stayApartmentSchema = z
  .string()
  .trim()
  .min(1, "Informe o apartamento.")
  .refine((s) => isAllowedApartmentNumber(s), {
    message: "Apartamento inválido.",
  });

export const facilitySchema = z.enum(["pool", "gym"]);

export const guestWhatsappRequiredSchema = z
  .string()
  .trim()
  .min(1, "Informe o seu WhatsApp.")
  .transform((s, ctx) => {
    const phone = normalizePhone(s);
    if (!phone) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: PHONE_ERROR });
      return z.NEVER;
    }
    return phone;
  });

const guestNameOptionalSchema = z
  .string()
  .max(200, "Nome muito longo (máx. 200 caracteres).")
  .refine((s) => !FORBIDDEN_TEXT.test(s), FORBIDDEN_TEXT_MESSAGE)
  .optional()
  .transform((s) => {
    if (s === undefined) return null;
    const t = toUpperText(s.trim());
    return t.length ? t : null;
  });

/** Nome e WhatsApp que o hóspede informa uma vez e que ficam gravados na estadia até o check-out. */
export const stayContactSchema = z.object({
  guestName: guestNameOptionalSchema,
  guestWhatsapp: guestWhatsappRequiredSchema,
});

export const createGuestSchema = z.object({
  facility: facilitySchema,
  reservationDate: isoYmdDateSchema,
  slotStart: z.string(),
  guestWhatsapp: guestWhatsappRequiredSchema,
  guestName: guestNameOptionalSchema,
});

/** Troca do horário de uma reserva já feita pelo hóspede (mesma instalação e dia). */
export const changeGuestSchema = z.object({
  facility: facilitySchema,
  reservationDate: isoYmdDateSchema,
  slotStart: z.string(),
});

export const guestWhatsappOptionalSchema = z
  .string()
  .nullish()
  .transform((s, ctx) => {
    if (!s?.trim()) return null;
    const phone = normalizePhone(s);
    if (!phone) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: PHONE_ERROR });
      return z.NEVER;
    }
    return phone;
  });

export const createReceptionSchema = z.object({
  facility: facilitySchema,
  apartmentNumber: reservationApartmentSchema,
  reservationDate: isoYmdDateSchema,
  slotStart: z.string(),
  notes: z
    .string()
    .max(2000, "Observações muito longas (máx. 2000 caracteres).")
    .refine((s) => !FORBIDDEN_TEXT.test(s), FORBIDDEN_TEXT_MESSAGE)
    .transform(toUpperText)
    .optional(),
  guestWhatsapp: guestWhatsappOptionalSchema,
  guestName: guestNameOptionalSchema,
});
