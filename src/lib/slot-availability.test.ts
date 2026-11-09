import { describe, expect, it } from "vitest";

import { isSlotEnded, slotBlockReason } from "./slot-availability";

// 2026-11-09 18:30 no fuso do hotel (UTC-3) = 21:30 UTC
const NOW = Date.parse("2026-11-09T21:30:00Z");
const TODAY = "2026-11-09";

describe("isSlotEnded", () => {
  it("horário que terminou hoje está encerrado; o que está em andamento, não", () => {
    expect(isSlotEnded("pool", TODAY, "17:00:00", TODAY, NOW)).toBe(true);
    expect(isSlotEnded("pool", TODAY, "18:00:00", TODAY, NOW)).toBe(false); // 18h–19h em andamento
    expect(isSlotEnded("pool", TODAY, "19:00:00", TODAY, NOW)).toBe(false);
  });

  it("no limite exato do fim do horário ele passa a estar encerrado", () => {
    const fim = Date.parse("2026-11-09T22:00:00Z"); // 19:00 no hotel
    expect(isSlotEnded("pool", TODAY, "18:00:00", TODAY, fim)).toBe(true);
    expect(isSlotEnded("pool", TODAY, "18:00:00", TODAY, fim - 1)).toBe(false);
  });

  it("dias futuros nunca estão encerrados", () => {
    expect(isSlotEnded("pool", "2026-11-10", "13:00:00", TODAY, NOW)).toBe(false);
  });

  it("bloco 00h–01h da piscina não é tratado como encerrado (regra a definir)", () => {
    expect(isSlotEnded("pool", TODAY, "00:00:00", TODAY, NOW)).toBe(false);
  });

  it("na academia o horário 00h–01h de hoje já passou", () => {
    expect(isSlotEnded("gym", TODAY, "00:00:00", TODAY, NOW)).toBe(true);
    expect(isSlotEnded("gym", TODAY, "20:00:00", TODAY, NOW)).toBe(false);
  });
});

describe("slotBlockReason", () => {
  const base = {
    facility: "pool" as const,
    reservationDateYmd: TODAY,
    occupied: new Set(["15:00:00", "20:00:00"]),
    apartmentBooked: false,
    todayYmd: TODAY,
    nowMs: NOW,
  };

  it("ocupado tem prioridade, mesmo se já passou", () => {
    expect(slotBlockReason({ ...base, slotStart: "15:00:00" })).toBe("occupied");
  });
  it("já passou", () => {
    expect(slotBlockReason({ ...base, slotStart: "14:00:00" })).toBe("past");
  });
  it("limite do apartamento bloqueia os horários livres", () => {
    expect(
      slotBlockReason({ ...base, slotStart: "21:00:00", apartmentBooked: true })
    ).toBe("apartment_limit");
  });
  it("horário livre e futuro não tem bloqueio", () => {
    expect(slotBlockReason({ ...base, slotStart: "21:00:00" })).toBeNull();
  });
  it("aceita formatos de horário sem segundos", () => {
    expect(slotBlockReason({ ...base, slotStart: "20:00" })).toBe("occupied");
  });

  it("fronteira exata: no instante em que o horário termina, ele passa a estar bloqueado", () => {
    const base2 = { ...base, occupied: new Set<string>() };
    const fim17 = Date.parse("2026-11-09T21:00:00Z"); // 18:00:00.000 no hotel = fim do horário 17h–18h
    expect(slotBlockReason({ ...base2, slotStart: "17:00:00", nowMs: fim17 - 1 })).toBeNull();
    expect(slotBlockReason({ ...base2, slotStart: "17:00:00", nowMs: fim17 })).toBe("past");
    // o horário seguinte (18h–19h) está em andamento nesse instante e continua livre
    expect(slotBlockReason({ ...base2, slotStart: "18:00:00", nowMs: fim17 })).toBeNull();
  });

  it("academia 00h–01h de hoje: ainda aceita às 00:30 e bloqueia a partir de 01:00", () => {
    const base2 = { ...base, facility: "gym" as const, occupied: new Set<string>(), slotStart: "00:00:00" };
    const meiaNoiteEMeia = Date.parse("2026-11-09T03:30:00Z"); // 00:30 no hotel
    const uma = Date.parse("2026-11-09T04:00:00Z"); // 01:00 no hotel
    expect(slotBlockReason({ ...base2, nowMs: meiaNoiteEMeia })).toBeNull();
    expect(slotBlockReason({ ...base2, nowMs: uma })).toBe("past");
  });
});
