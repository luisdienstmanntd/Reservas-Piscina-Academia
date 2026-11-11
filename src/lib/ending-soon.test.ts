import { describe, expect, it } from "vitest";
import { endingSoonLabel, isEndingSoon, minutesLeft } from "./ending-soon";

const D = "2026-11-10";
// Horário 20h–21h (fuso do hotel, UTC-3) termina às 21h00 = 00:00 UTC do dia seguinte.
const at = (hhmm: string) => Date.parse(`2026-11-10T${hhmm}:00-03:00`);

describe("alarme dos 10 minutos finais", () => {
  it("não dispara antes de faltarem 10 minutos", () => {
    expect(isEndingSoon(D, "20:00:00", at("20:49"))).toBe(false);
  });
  it("dispara quando faltam exatamente 10 minutos e até o fim", () => {
    expect(isEndingSoon(D, "20:00:00", at("20:50"))).toBe(true);
    expect(isEndingSoon(D, "20:00:00", at("20:59"))).toBe(true);
  });
  it("não dispara depois que o horário terminou", () => {
    expect(isEndingSoon(D, "20:00:00", at("21:00"))).toBe(false);
    expect(isEndingSoon(D, "20:00:00", at("21:30"))).toBe(false);
  });
  it("minutos que faltam", () => {
    expect(minutesLeft(D, "20:00:00", at("20:45"))).toBeCloseTo(15);
  });
  it("texto da mensagem", () => {
    const label = endingSoonLabel({
      id: "x", facility: "pool", reservation_date: D, slot_start: "20:00:00",
      apartment_number: "212", guest_name: "FELIPE", minutes_left: 7.2,
    });
    expect(label).toBe("Apto 212 (FELIPE) · Piscina · faltam 8 min");
  });
});
