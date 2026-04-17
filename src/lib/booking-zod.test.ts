import { describe, expect, it } from "vitest";

import {
  createGuestSchema,
  createReceptionSchema,
  facilitySchema,
  isoYmdDateSchema,
  reservationApartmentSchema,
  stayApartmentSchema,
} from "@/lib/booking-zod";

describe("isoYmdDateSchema", () => {
  it("aceita yyyy-MM-dd", () => {
    expect(isoYmdDateSchema.safeParse("2026-04-16").success).toBe(true);
  });

  it("rejeita formato inválido", () => {
    expect(isoYmdDateSchema.safeParse("16-04-2026").success).toBe(false);
    expect(isoYmdDateSchema.safeParse("2026-4-16").success).toBe(false);
    expect(isoYmdDateSchema.safeParse("").success).toBe(false);
  });
});

describe("facilitySchema", () => {
  it("aceita pool e gym", () => {
    expect(facilitySchema.safeParse("pool").success).toBe(true);
    expect(facilitySchema.safeParse("gym").success).toBe(true);
  });

  it("rejeita outro valor", () => {
    expect(facilitySchema.safeParse("spa").success).toBe(false);
  });
});

describe("reservationApartmentSchema", () => {
  it("mensagem longa para UI da recepção", () => {
    const r = reservationApartmentSchema.safeParse("999");
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toContain("lista do hotel");
    }
  });
});

describe("stayApartmentSchema", () => {
  it("mensagem curta no fluxo de token", () => {
    const r = stayApartmentSchema.safeParse("x");
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message).toBe("Apartamento inválido.");
    }
  });
});

describe("createGuestSchema", () => {
  it("normaliza WhatsApp para dígitos", () => {
    const r = createGuestSchema.safeParse({
      facility: "pool",
      reservationDate: "2026-04-16",
      slotStart: "14:00:00",
      guestWhatsapp: " (11) 91234-5678 ",
      guestName: "  João  ",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.guestWhatsapp).toBe("11912345678");
      expect(r.data.guestName).toBe("João");
    }
  });

  it("rejeita WhatsApp curto", () => {
    const r = createGuestSchema.safeParse({
      facility: "gym",
      reservationDate: "2026-04-16",
      slotStart: "10:00:00",
      guestWhatsapp: "123",
    });
    expect(r.success).toBe(false);
  });

  it("nome opcional vazio vira null", () => {
    const r = createGuestSchema.safeParse({
      facility: "pool",
      reservationDate: "2026-04-16",
      slotStart: "13:00:00",
      guestWhatsapp: "11999999999",
      guestName: "   ",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.guestName).toBeNull();
  });
});

describe("createReceptionSchema", () => {
  it("WhatsApp opcional em branco vira null", () => {
    const r = createReceptionSchema.safeParse({
      facility: "pool",
      apartmentNumber: "101",
      reservationDate: "2026-04-16",
      slotStart: "13:00:00",
      guestWhatsapp: "",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.guestWhatsapp).toBeNull();
  });

  it("notas respeitam tamanho máximo", () => {
    const r = createReceptionSchema.safeParse({
      facility: "gym",
      apartmentNumber: "202",
      reservationDate: "2026-04-16",
      slotStart: "08:00:00",
      notes: "x".repeat(501),
    });
    expect(r.success).toBe(false);
  });
});
