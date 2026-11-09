import { describe, expect, it } from "vitest";

import { buildGridItems, freeRangeLabel } from "./reservation-grid";
import { GYM_SLOT_STARTS, POOL_SLOT_STARTS } from "./reservations";

describe("grade do dia", () => {
  it("agrupa horários livres consecutivos e mantém cada reserva como item próprio", () => {
    const booked = new Set(["13:00:00", "16:00:00", "20:00:00", "00:00:00"]);
    const items = buildGridItems(POOL_SLOT_STARTS, (s) => (booked.has(s) ? s : undefined));
    expect(items.map((i) => i.kind)).toEqual([
      "booked", "free", "booked", "free", "booked", "free", "booked",
    ]);
    const free = items.filter((i) => i.kind === "free") as { kind: "free"; slots: string[]; past: boolean }[];
    expect(free.map((f) => freeRangeLabel(f.slots))).toEqual([
      "14h00 – 16h00",
      "17h00 – 20h00",
      "21h00 – 00h00",
    ]);
  });

  it("dia inteiro livre vira um único item; dia lotado não tem grupos livres", () => {
    const livre = buildGridItems(GYM_SLOT_STARTS, () => undefined);
    expect(livre).toHaveLength(1);
    expect(freeRangeLabel((livre[0] as { slots: string[] }).slots)).toBe("Dia todo");

    const lotado = buildGridItems(POOL_SLOT_STARTS, (s) => s);
    expect(lotado.every((i) => i.kind === "booked")).toBe(true);
    expect(lotado).toHaveLength(POOL_SLOT_STARTS.length);
  });

  it("um único horário livre mantém o rótulo do próprio horário", () => {
    expect(freeRangeLabel(["14:00:00"])).toBe("14h00 – 15h00");
  });

  it("separa os livres que já passaram dos que ainda estão disponíveis", () => {
    const booked = new Set(["16:00:00"]);
    const passou = (slot: string) => slot < "17:00:00" && slot >= "13:00:00";
    const items = buildGridItems(POOL_SLOT_STARTS, (s) => (booked.has(s) ? s : undefined), passou);
    const resumo = items.map((i) =>
      i.kind === "booked" ? "reserva" : i.past ? `passou(${i.slots.length})` : `livre(${i.slots.length})`
    );
    // 13–16 passou (3), 16 reserva, 17–23 e 00 livres (8)
    expect(resumo).toEqual(["passou(3)", "reserva", "livre(8)"]);
  });
});
