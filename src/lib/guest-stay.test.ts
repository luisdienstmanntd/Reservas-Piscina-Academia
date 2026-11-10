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

import { classifyStayLookup } from "./guest-stay";

describe("classifyStayLookup", () => {
  const today = "2026-11-10";
  it("ok quando existe e vale", () => {
    const r = classifyStayLookup(200, [{ apartment_number: "101", checkout_date: "2026-11-12" }], today);
    expect(r.kind).toBe("ok");
  });
  it("invalid quando vazio ou vencido", () => {
    expect(classifyStayLookup(200, [], today).kind).toBe("invalid");
    expect(classifyStayLookup(200, [{ apartment_number: "1", checkout_date: "2026-11-01" }], today).kind).toBe("invalid");
  });
  it("error em 5xx, 401 ou corpo inesperado (nunca apaga sessão)", () => {
    expect(classifyStayLookup(503, null, today).kind).toBe("error");
    expect(classifyStayLookup(401, null, today).kind).toBe("error");
    expect(classifyStayLookup(200, { message: "x" }, today).kind).toBe("error");
  });
});
