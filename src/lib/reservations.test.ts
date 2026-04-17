import { describe, expect, it } from "vitest";

import {
  GYM_SLOT_STARTS,
  POOL_SLOT_STARTS,
  formatDateBR,
  isDateInStay,
  normalizeSlotStart,
  parseDateOnly,
  slotLabel,
  slotStartsFor,
} from "@/lib/reservations";

describe("normalizeSlotStart", () => {
  it("preenche horas, minutos e segundos", () => {
    expect(normalizeSlotStart("9:5:2")).toBe("09:05:02");
    expect(normalizeSlotStart("13:00")).toBe("13:00:00");
  });
});

describe("slotStartsFor", () => {
  it("piscina: 13h–01h (12 slots de 1h)", () => {
    expect(slotStartsFor("pool")).toBe(POOL_SLOT_STARTS);
    expect(slotStartsFor("pool").length).toBe(12);
    expect(slotStartsFor("pool")[0]).toBe("13:00:00");
    expect(slotStartsFor("pool").at(-1)).toBe("00:00:00");
  });

  it("academia: 24 horas", () => {
    expect(slotStartsFor("gym")).toBe(GYM_SLOT_STARTS);
    expect(slotStartsFor("gym").length).toBe(24);
    expect(slotStartsFor("gym")[0]).toBe("00:00:00");
    expect(slotStartsFor("gym")[23]).toBe("23:00:00");
  });
});

describe("slotLabel", () => {
  it("formata intervalo de uma hora", () => {
    expect(slotLabel("13:00:00")).toBe("13h00 – 14h00");
  });

  it("slot 23h00–00h00 cruza meia-noite no rótulo", () => {
    expect(slotLabel("23:00:00")).toBe("23h00 – 00h00");
  });

  it("slot 00h00–01h00 (piscina madrugada)", () => {
    expect(slotLabel("00:00:00")).toBe("00h00 – 01h00");
  });
});

describe("isDateInStay", () => {
  /** Meia-noite no calendário local (evita deslocamentos de parseISO + UTC). */
  const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

  const today = d(2026, 4, 10);
  const checkout = d(2026, 4, 12);

  it("dia dentro da estadia [hoje, checkout]", () => {
    expect(isDateInStay(d(2026, 4, 11), checkout, today)).toBe(true);
  });

  it("rejeita dia antes de hoje", () => {
    expect(isDateInStay(d(2026, 4, 9), checkout, today)).toBe(false);
  });

  it("rejeita dia depois do checkout", () => {
    expect(isDateInStay(d(2026, 4, 13), checkout, today)).toBe(false);
  });

  it("inclui hoje e o dia do checkout", () => {
    expect(isDateInStay(d(2026, 4, 10), checkout, today)).toBe(true);
    expect(isDateInStay(d(2026, 4, 12), checkout, today)).toBe(true);
  });
});

describe("formatDateBR", () => {
  it("formata em pt-BR", () => {
    expect(formatDateBR(parseDateOnly("2026-04-16"))).toMatch(/16\/04\/2026/);
  });
});
