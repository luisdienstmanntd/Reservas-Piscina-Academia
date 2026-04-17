import { describe, expect, it } from "vitest";

import { hotelCalendarDate } from "@/lib/hotel-time";

describe("hotelCalendarDate", () => {
  it("usa America/Sao_Paulo (antes da meia-noite civil em SP ainda é o dia anterior)", () => {
    expect(hotelCalendarDate(new Date("2026-07-01T02:59:00.000Z"))).toBe(
      "2026-06-30"
    );
  });

  it("cruza para o novo dia civil em SP às 03:00 UTC", () => {
    expect(hotelCalendarDate(new Date("2026-07-01T03:00:00.000Z"))).toBe(
      "2026-07-01"
    );
  });

  it("retorna yyyy-MM-dd (locale sv-SE)", () => {
    const ymd = hotelCalendarDate(new Date("2026-04-16T12:00:00.000Z"));
    expect(ymd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(ymd).toBe("2026-04-16");
  });
});
