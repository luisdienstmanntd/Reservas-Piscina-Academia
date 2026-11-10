import { describe, expect, it } from "vitest";

import {
  alertLabel,
  isAlertable,
  mergeNewItems,
  type NewReservationItem,
} from "./new-reservations";

const item = (over: Partial<NewReservationItem> = {}): NewReservationItem => ({
  id: "a1",
  facility: "pool",
  reservation_date: "2026-11-10",
  slot_start: "20:00:00",
  apartment_number: "211",
  created_by: "guest",
  created_at: "2026-11-10T20:00:00Z",
  ...over,
});

describe("aviso de novas reservas", () => {
  it("só reserva feita pelo hóspede merece aviso", () => {
    expect(isAlertable(item())).toBe(true);
    expect(isAlertable(item({ created_by: "reception" }))).toBe(false);
  });

  it("texto do aviso: hoje, amanhã e data completa, piscina e academia", () => {
    expect(alertLabel(item(), "2026-11-10")).toBe("Piscina · hoje · 20h00 – 21h00 · Apto 211");
    expect(alertLabel(item({ reservation_date: "2026-11-11", facility: "gym" }), "2026-11-10")).toBe(
      "Academia · amanhã · 20h00 – 21h00 · Apto 211"
    );
    expect(alertLabel(item({ reservation_date: "2026-12-31" }), "2026-11-10")).toContain("31/12/2026");
    // virada de mês: "amanhã" do dia 30/11 é 01/12
    expect(alertLabel(item({ reservation_date: "2026-12-01" }), "2026-11-30")).toContain("amanhã");
  });

  it("não repete a mesma reserva (a busca tem sobreposição de propósito)", () => {
    const seen = new Set<string>();
    const a = mergeNewItems([], [item({ id: "x1" })], seen);
    expect(a.fresh.map((i) => i.id)).toEqual(["x1"]);
    const b = mergeNewItems(a.unread, [item({ id: "x1" }), item({ id: "x2" })], seen);
    expect(b.fresh.map((i) => i.id)).toEqual(["x2"]);
    expect(b.unread.map((i) => i.id)).toEqual(["x1", "x2"]);
  });

  it("reserva da própria recepção é registrada como vista, mas não gera aviso", () => {
    const seen = new Set<string>();
    const r = mergeNewItems([], [item({ id: "r1", created_by: "reception" })], seen);
    expect(r.fresh).toEqual([]);
    expect(r.unread).toEqual([]);
    expect(seen.has("r1")).toBe(true);
  });
});

describe("troca de horário pelo hóspede", () => {
  const changed = {
    id: "r1~2099-01-01T10:00:00Z",
    facility: "pool",
    reservation_date: "2099-01-01",
    slot_start: "22:00:00",
    apartment_number: "211",
    created_by: "reception",
    created_at: "2098-12-30T10:00:00Z",
    kind: "changed" as const,
  };
  it("avisa a recepção mesmo que a reserva original tenha sido criada por ela", () => {
    expect(isAlertable(changed)).toBe(true);
    expect(alertLabel(changed, "2099-01-01")).toMatch(/^Horário alterado: Piscina · hoje · 22h00 – 23h00 · Apto 211$/);
  });
  it("cada troca avisa uma vez (id inclui o instante)", () => {
    const seen = new Set<string>();
    expect(mergeNewItems([], [changed], seen).fresh).toHaveLength(1);
    expect(mergeNewItems([], [changed], seen).fresh).toHaveLength(0);
    const outra = { ...changed, id: "r1~2099-01-01T11:00:00Z" };
    expect(mergeNewItems([], [outra], seen).fresh).toHaveLength(1);
  });
});
