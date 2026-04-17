import { describe, expect, it } from "vitest";

import { validateStayAndSlot } from "@/lib/reservation-slot-validation";

describe("validateStayAndSlot", () => {
  const today = "2026-04-16";

  it("rejeita data de reserva antes de hoje", () => {
    expect(
      validateStayAndSlot("pool", "2026-04-15", "2026-04-20", "14:00:00", today)
    ).toBe("Não é possível reservar datas passadas.");
  });

  it("rejeita reserva depois do check-out do hóspede", () => {
    expect(
      validateStayAndSlot("pool", "2026-04-18", "2026-04-17", "14:00:00", today)
    ).toBe("A data da reserva deve ser até o seu check-out.");
  });

  it("rejeita slot inválido para a instalação", () => {
    expect(
      validateStayAndSlot("pool", "2026-04-18", "2026-04-20", "08:00:00", today)
    ).toBe("Horário inválido.");
    expect(
      validateStayAndSlot("gym", "2026-04-18", "2026-04-20", "99:00:00", today)
    ).toBe("Horário inválido.");
  });

  it("aceita combinação válida (piscina + slot 13h)", () => {
    expect(
      validateStayAndSlot("pool", "2026-04-18", "2026-04-20", "13:00", today)
    ).toBeNull();
  });

  it("aceita academia 24h", () => {
    expect(
      validateStayAndSlot("gym", "2026-04-18", "2026-04-20", "3:0:0", today)
    ).toBeNull();
  });
});
