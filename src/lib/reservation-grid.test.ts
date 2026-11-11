import { describe, expect, it } from "vitest";

import { receptionSlotOrder, slotStartLabel } from "./reservation-grid";
import { GYM_SLOT_STARTS, POOL_SLOT_STARTS } from "./reservations";

describe("planilha da recepção", () => {
  it("rótulo é só o início da hora", () => {
    expect(slotStartLabel("21:00:00")).toBe("21h00");
    expect(slotStartLabel("09:00")).toBe("09h00");
    expect(slotStartLabel("00:00:00")).toBe("00h00");
  });

  it("academia (24 h): linhas de 01h até 00h, uma por hora, sem faltar nenhuma", () => {
    const ordem = receptionSlotOrder(GYM_SLOT_STARTS).map(slotStartLabel);
    expect(ordem).toHaveLength(24);
    expect(ordem[0]).toBe("01h00");
    expect(ordem[22]).toBe("23h00");
    expect(ordem[23]).toBe("00h00");
    expect(new Set(ordem).size).toBe(24);
  });

  it("piscina: 13h00 até 00h00, uma linha por hora", () => {
    const ordem = receptionSlotOrder(POOL_SLOT_STARTS).map(slotStartLabel);
    expect(ordem[0]).toBe("13h00");
    expect(ordem[ordem.length - 1]).toBe("00h00");
    expect(ordem).toHaveLength(POOL_SLOT_STARTS.length);
  });

  it("não altera a lista original", () => {
    const antes = [...GYM_SLOT_STARTS];
    receptionSlotOrder(GYM_SLOT_STARTS);
    expect([...GYM_SLOT_STARTS]).toEqual(antes);
  });
});
