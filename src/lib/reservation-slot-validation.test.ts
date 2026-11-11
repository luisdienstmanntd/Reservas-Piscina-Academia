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

  it("sem check-out (balcão) pula a checagem de check-out, mas mantém as demais", () => {
    expect(
      validateStayAndSlot("pool", "2026-12-31", null, "14:00:00", today)
    ).toBeNull();
    expect(
      validateStayAndSlot("pool", "2026-04-15", null, "14:00:00", today)
    ).toBe("Não é possível reservar datas passadas.");
    expect(
      validateStayAndSlot("pool", "2026-04-18", null, "08:00:00", today)
    ).toBe("Horário inválido.");
  });

  describe("horário que já passou (hoje)", () => {
    const hoje = "2026-11-09";
    const agora = Date.parse("2026-11-09T21:30:00Z"); // 18:30 no hotel

    it("recusa horário que já terminou", () => {
      expect(
        validateStayAndSlot("pool", hoje, "2026-11-12", "17:00:00", hoje, agora)
      ).toBe("Este horário já passou. Escolha outro.");
    });
    it("aceita o horário em andamento e os futuros", () => {
      expect(validateStayAndSlot("pool", hoje, "2026-11-12", "18:00:00", hoje, agora)).toBeNull();
      expect(validateStayAndSlot("pool", hoje, "2026-11-12", "21:00:00", hoje, agora)).toBeNull();
    });
    it("aceita o mesmo horário em um dia futuro", () => {
      expect(validateStayAndSlot("pool", "2026-11-10", "2026-11-12", "14:00:00", hoje, agora)).toBeNull();
    });
    it("vale também para a reserva de balcão (sem check-out)", () => {
      expect(validateStayAndSlot("gym", hoje, null, "08:00:00", hoje, agora)).toBe(
        "Este horário já passou. Escolha outro."
      );
    });
  });
});

describe("piscina em uso compartilhado (09h): só a recepção reserva", () => {
  const today = "2026-04-15";
  const now = new Date("2026-04-15T08:00:00-03:00").getTime();
  it("hóspede NÃO pode reservar 09h–12h", () => {
    for (const h of ["09:00:00", "10:00:00", "11:00:00", "12:00:00"]) {
      expect(validateStayAndSlot("pool", "2026-04-16", "2026-04-20", h, today, now)).toBe("Horário inválido.");
    }
  });
  it("recepção pode reservar 09h (e continua podendo os horários normais)", () => {
    for (const h of ["09:00:00", "13:00:00", "00:00:00"]) {
      expect(validateStayAndSlot("pool", "2026-04-16", null, h, today, now, true)).toBeNull();
    }
  });
  it("10h, 11h e 12h não são horários da planilha: nem a recepção reserva", () => {
    for (const h of ["10:00:00", "11:00:00", "12:00:00"]) {
      expect(validateStayAndSlot("pool", "2026-04-16", null, h, today, now, true)).toBe("Horário inválido.");
    }
  });
  it("antes das 09h e horários quebrados continuam inválidos, mesmo para a recepção", () => {
    expect(validateStayAndSlot("pool", "2026-04-16", null, "08:00:00", today, now, true)).toBe("Horário inválido.");
    expect(validateStayAndSlot("pool", "2026-04-16", null, "10:30:00", today, now, true)).toBe("Horário inválido.");
  });
  it("academia não muda", () => {
    expect(validateStayAndSlot("gym", "2026-04-16", "2026-04-20", "03:00:00", today, now)).toBeNull();
  });
});
