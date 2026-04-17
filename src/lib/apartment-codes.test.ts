import { describe, expect, it } from "vitest";

import {
  ALLOWED_APARTMENT_NUMBERS,
  isAllowedApartmentNumber,
} from "@/lib/apartment-codes";

describe("isAllowedApartmentNumber", () => {
  it("aceita números da lista (com trim)", () => {
    expect(isAllowedApartmentNumber("101")).toBe(true);
    expect(isAllowedApartmentNumber("  407  ")).toBe(true);
  });

  it("rejeita números fora da lista", () => {
    expect(isAllowedApartmentNumber("999")).toBe(false);
    expect(isAllowedApartmentNumber("01")).toBe(false);
  });

  it("lista tem apartamentos esperados", () => {
    expect(ALLOWED_APARTMENT_NUMBERS).toContain("101");
    expect(ALLOWED_APARTMENT_NUMBERS).toContain("407");
    expect(ALLOWED_APARTMENT_NUMBERS.length).toBeGreaterThan(30);
  });
});
