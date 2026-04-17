import { z } from "zod";

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

const guestWhatsappRequiredSchema = z
  .string()
  .trim()
  .min(1, "Informe o seu WhatsApp.")
  .transform((s) => s.replace(/\D/g, ""))
  .refine((d) => d.length >= 10 && d.length <= 13, {
    message: "WhatsApp inválido. Use DDD + número (10 a 13 dígitos).",
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

const guestWhatsappOptionalSchema = z
  .string()
  .optional()
  .transform((s) => {
    if (s === undefined) return null;
    const t = s.trim();
    if (!t) return null;
    return t.replace(/\D/g, "");
  })
  .refine((d) => d === null || (d.length >= 10 && d.length <= 13), {
    message:
      "WhatsApp inválido. Deixe em branco ou use DDD + número (10 a 13 dígitos).",
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
