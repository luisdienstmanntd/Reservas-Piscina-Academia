import { describe, expect, it } from "vitest";
import { normalizePhone, normalizeStoredPhone, formatPhoneDisplay } from "@/lib/phone";
import { guestWhatsappRequiredSchema, guestWhatsappOptionalSchema } from "@/lib/booking-zod";
import { whatsappDigitsForWaMe, buildWhatsappWaMeUrl } from "@/lib/wa-me";

describe("phone validation across booking and reception", () => {
  it.each([
    ["(54) 99999-9999", "+5554999999999"],
    ["11 3123-4567", "+551131234567"],
    ["+55 (11) 91234-5678", "+5511912345678"],
    ["+44 7911 123456", "+447911123456"],
    ["+1 213 373 4253", "+12133734253"],
    ["+598 94 231 234", "+59894231234"],
  ])("accepts %s and stores unambiguous international format", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
    expect(guestWhatsappRequiredSchema.parse(input)).toBe(expected);
    expect(guestWhatsappOptionalSchema.parse(input)).toBe(expected);
    expect(whatsappDigitsForWaMe(expected)).toBe(expected.slice(1));
    expect(normalizePhone(formatPhoneDisplay(expected))).toBe(expected);
  });

  it.each([
    "123", "99999-9999", "(00) 99999-9999", "(20) 99999-9999",
    "(11) 81234-5678", "00000000000", "1111111111",
    "+999 1234567890", "+44 123", "447911123456",
    "abc11912345678", "11912345678abc", "11/91234/5678",
    "++5511912345678", "+55 11 91234-5678 ramal 2", "011912345678",
    "+551191234567812345", "tel:+5511912345678",
  ])("rejects %s rather than stripping invalid content", (input) => {
    expect(normalizePhone(input)).toBeNull();
    expect(guestWhatsappRequiredSchema.safeParse(input).success).toBe(false);
    expect(guestWhatsappOptionalSchema.safeParse(input).success).toBe(false);
  });

  it("keeps phone optional only at reception", () => {
    for (const input of ["", "  ", null, undefined]) {
      expect(guestWhatsappOptionalSchema.parse(input)).toBeNull();
      expect(guestWhatsappRequiredSchema.safeParse(input).success).toBe(false);
    }
  });

  it("supports old BR digits and old explicit country-code digits", () => {
    expect(normalizeStoredPhone("11912345678")).toBe("+5511912345678");
    expect(normalizeStoredPhone("5511912345678")).toBe("+5511912345678");
    expect(normalizeStoredPhone("447911123456")).toBe("+447911123456");
    expect(whatsappDigitsForWaMe("00000000000")).toBeNull();
    expect(buildWhatsappWaMeUrl("+12133734253", "Olá")).toContain("phone=12133734253&");
    expect(buildWhatsappWaMeUrl("abc11912345678", "Olá")).toBeNull();
  });
});
