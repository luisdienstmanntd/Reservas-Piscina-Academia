import { describe, expect, it } from "vitest";

import { addDaysYmd, hotelCalendarDate } from "@/lib/hotel-time";

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

describe("addDaysYmd", () => {
  it("soma dias atravessando fim de mês, de ano e ano bissexto", () => {
    expect(addDaysYmd("2026-11-10", 1)).toBe("2026-11-11");
    expect(addDaysYmd("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDaysYmd("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysYmd("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysYmd("2026-11-10", 90)).toBe("2027-02-08");
    expect(addDaysYmd("2026-11-10", -10)).toBe("2026-10-31");
  });
});

