import { describe, expect, it } from "vitest";

import {
  hourRangeLabel,
  myReservationLabel,
  upcomingReservations,
  type MyReservation,
} from "./my-reservations";

const r = (
  id: string,
  facility: "pool" | "gym",
  dateYmd: string,
  slotStart: string
): MyReservation => ({ id, facility, dateYmd, slotStart });

describe("my-reservations", () => {
  it("formata a faixa de horas", () => {
    expect(hourRangeLabel("19:00:00")).toBe("19h às 20h");
    expect(hourRangeLabel("23:00")).toBe("23h às 0h");
    expect(hourRangeLabel("13:30:00")).toBe("13h30 às 14h30");
  });

  it("monta o texto do exemplo do pedido", () => {
    expect(myReservationLabel(r("1", "pool", "2026-11-10", "19:00:00"))).toBe(
      "Terça-feira 10/11 - 19h às 20h - Piscina"
    );
    expect(myReservationLabel(r("2", "gym", "2026-11-11", "07:00:00"))).toBe(
      "Quarta-feira 11/11 - 7h às 8h - Academia"
    );
  });

  it("some o que já terminou e ordena por data e horário", () => {
    const now = new Date("2026-11-10T15:31:00-03:00").getTime(); // 15h31
    const out = upcomingReservations(
      [
        r("c", "gym", "2026-11-11", "08:00:00"),
        r("ended", "pool", "2026-11-10", "14:00:00"),
        r("a", "pool", "2026-11-10", "19:00:00"),
        r("b", "gym", "2026-11-10", "15:00:00"), // termina 16h: ainda vale
        r("old", "gym", "2026-11-09", "10:00:00"),
      ],
      "2026-11-10",
      now
    );
    expect(out.map((x) => x.id)).toEqual(["b", "a", "c"]);
  });
});
