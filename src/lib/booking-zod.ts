import { z } from "zod";
import { normalizePhone, PHONE_ERROR } from "@/lib/phone";

import { isAllowedApartmentNumber } from "@/lib/apartment-codes";

/** Data civil `yyyy-MM-dd` (sem validar calendário). */
export const isoYmdDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

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
  .optional()
  .transform((s) => {
    if (s === undefined) return null;
    const t = s.trim();
    return t.length ? t : null;
  });

export const createGuestSchema = z.object({
  facility: facilitySchema,
  reservationDate: isoYmdDateSchema,
  slotStart: z.string(),
  guestWhatsapp: guestWhatsappRequiredSchema,
  guestName: guestNameOptionalSchema,
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
  notes: z.string().max(500).optional(),
  guestWhatsapp: guestWhatsappOptionalSchema,
  guestName: guestNameOptionalSchema,
});
