import { describe, expect, it } from "vitest";

import {
  hotelTodayYmd,
  isCheckoutStillValid,
  parseGuestTokenInput,
} from "@/lib/guest-stay";

describe("isCheckoutStillValid", () => {
  it("checkout igual a hoje é válido", () => {
    expect(isCheckoutStillValid("2026-04-16", "2026-04-16")).toBe(true);
  });

  it("checkout no futuro é válido", () => {
    expect(isCheckoutStillValid("2026-04-20", "2026-04-16")).toBe(true);
  });

  it("checkout antes de hoje é inválido", () => {
    expect(isCheckoutStillValid("2026-04-15", "2026-04-16")).toBe(false);
  });
});

describe("parseGuestTokenInput", () => {
  it("aceita token com espaços laterais", () => {
    expect(parseGuestTokenInput("  abc-123  ")).toBe("abc-123");
  });

  it("null, undefined ou vazio viram null", () => {
    expect(parseGuestTokenInput(null)).toBeNull();
    expect(parseGuestTokenInput(undefined)).toBeNull();
    expect(parseGuestTokenInput("")).toBeNull();
    expect(parseGuestTokenInput("   ")).toBeNull();
  });
});

describe("hotelTodayYmd", () => {
  it("usa o instante passado e o fuso America/Sao_Paulo", () => {
    const at = new Date("2026-01-15T12:00:00.000Z");
    expect(hotelTodayYmd(at)).toBe("2026-01-15");
  });
});
