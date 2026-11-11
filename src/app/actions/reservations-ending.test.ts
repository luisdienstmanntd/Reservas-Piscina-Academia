import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminClient: vi.fn(),
  readReceptionAuthed: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("@/lib/reception-auth", () => ({ readReceptionAuthed: mocks.readReceptionAuthed }));
vi.mock("@/app/actions/stays", () => ({ getValidatedGuestStay: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: mocks.getAdminClient,
  supabaseConfigErrorMessage: () => "sem banco",
}));

import { listEndingSoonReservations } from "./reservations";

const row = (id: string, slot: string, date = "2026-11-10", facility = "pool") => ({
  id, facility, reservation_date: date, slot_start: slot, apartment_number: "212", guest_name: "FELIPE",
});

function fakeDb(rows: unknown[]) {
  const calls: { eq: Array<[string, unknown]>; in?: [string, unknown[]] } = { eq: [] };
  const q: Record<string, unknown> = {};
  q.eq = (c: string, v: unknown) => (calls.eq.push([c, v]), q);
  q.in = (c: string, v: unknown[]) => ((calls.in = [c, v]), q);
  q.limit = () => Promise.resolve({ data: rows, error: null });
  mocks.getAdminClient.mockReturnValue({ from: () => ({ select: () => q }) });
  return calls;
}

describe("listEndingSoonReservations", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    mocks.readReceptionAuthed.mockResolvedValue(true);
  });
  afterEach(() => vi.useRealTimers());

  it("só a recepção pode chamar", async () => {
    mocks.readReceptionAuthed.mockResolvedValue(false);
    expect(await listEndingSoonReservations()).toMatchObject({ ok: false, unauthorized: true });
    expect(mocks.getAdminClient).not.toHaveBeenCalled();
  });

  it("devolve só os horários que terminam em até 10 minutos (qualquer instalação)", async () => {
    vi.setSystemTime(new Date("2026-11-10T20:52:00-03:00")); // 8 min para as 21h
    const calls = fakeDb([
      row("fim", "20:00:00"), // termina 21h00 -> 8 min
      row("cedo", "21:00:00"), // termina 22h00 -> 68 min
      row("passou", "19:00:00"), // terminou 20h00
      row("academia", "20:00:00", "2026-11-10", "gym"),
    ]);
    const r = await listEndingSoonReservations();
    expect(r.ok && r.items.map((i) => i.id)).toEqual(["fim", "academia"]);
    expect(r.ok && Math.round(r.items[0].minutes_left)).toBe(8);
    expect(calls.eq).toContainEqual(["status", "active"]);
    expect(calls.in?.[1]).toEqual(["2026-11-09", "2026-11-10"]);
  });

  it("nada a avisar quando faltam mais de 10 minutos", async () => {
    vi.setSystemTime(new Date("2026-11-10T20:49:00-03:00"));
    fakeDb([row("a", "20:00:00")]);
    expect(await listEndingSoonReservations()).toEqual({ ok: true, items: [] });
  });
});
