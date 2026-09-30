import { parsePhoneNumberFromString } from "libphonenumber-js/max";

export const PHONE_HINT =
  "Brasil: (54) 99999-9999. Exterior: + código do país e número.";
export const PHONE_ERROR =
  "WhatsApp inválido. Informe um número brasileiro com DDD ou um número internacional com + e código do país.";

/** Validate the whole input, never extract a number from arbitrary text. */
export function normalizePhone(input: string): string | null {
  const value = input.trim();
  if (!/^\+?[0-9() .-]+$/.test(value)) return null;
  const digits = value.replace(/\D/g, "");
  if (!value.startsWith("+") && !/^\d{10,11}$/.test(digits)) return null;
  const phone = parsePhoneNumberFromString(value, {
    defaultCountry: "BR",
    extract: false,
  });
  if (!phone?.isValid() || phone.ext) return null;
  // National input must include DDD, without trunk/carrier prefixes.
  if (!value.startsWith("+") && phone.nationalNumber !== digits) return null;
  return phone.number;
}

/** Older reservations stored digits without +; new ones store explicit E.164. */
export function normalizeStoredPhone(input: string | null | undefined): string | null {
  if (!input?.trim()) return null;
  const value = input.trim();
  if (/^\d{12,15}$/.test(value)) return normalizePhone(`+${value}`);
  return normalizePhone(value);
}

export function formatPhoneDisplay(input: string | null | undefined): string {
  const normalized = normalizeStoredPhone(input);
  if (!normalized) return input?.trim() || "—";
  const phone = parsePhoneNumberFromString(normalized)!;
  return phone.country === "BR" ? phone.formatNational() : phone.formatInternational();
}
