import { beforeEach, describe, expect, it, vi } from "vitest";
import { blocksAware } from "./test-blocks";

const mocks = vi.hoisted(() => ({
  getAdminClient: vi.fn(),
  readReceptionAuthed: vi.fn(),
  getValidatedGuestStay: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("@/lib/reception-auth", () => ({ readReceptionAuthed: mocks.readReceptionAuthed }));
vi.mock("@/app/actions/stays", () => ({ getValidatedGuestStay: mocks.getValidatedGuestStay }));
vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: mocks.getAdminClient,
  supabaseConfigErrorMessage: () => "sem banco",
}));

import {
  createGuestReservation,
  createReceptionReservation,
  getReservationDaySummary,
  setSlotBlocked,
} from "./reservations";

const BLOCK = { facility: "pool" as const, reservationDate: "2999-01-01", slotStart: "14:00:00" };

/** Banco falso de `setSlotBlocked`: guarda o que foi inserido/atualizado e devolve `taken` na checagem de reserva. */
function fakeDb(taken: unknown = null, insertError: unknown = null) {
  const seen = { inserted: null as unknown, updated: null as unknown, updateEqs: [] as Array<[string, unknown]> };
  const sel: Record<string, unknown> = {};
  sel.eq = () => sel;
  sel.maybeSingle = () => Promise.resolve({ data: taken, error: null });
  const upd: Record<string, unknown> = {};
  upd.eq = (c: string, v: unknown) => (seen.updateEqs.push([c, v]), upd);
  upd.is = () => Promise.resolve({ error: null });
  mocks.getAdminClient.mockReturnValue({
    from: (t: string) =>
      t === "slot_blocks"
        ? {
            insert: (v: unknown) => ((seen.inserted = v), Promise.resolve({ error: insertError })),
            update: (v: unknown) => ((seen.updated = v), upd),
          }
        : { select: () => sel },
  });
  return seen;
}

describe("setSlotBlocked", () => {
  beforeEach(() => vi.resetAllMocks());

  it("só a recepção pode bloquear", async () => {
    mocks.readReceptionAuthed.mockResolvedValue(false);
    const seen = fakeDb();
    expect(await setSlotBlocked({ ...BLOCK, blocked: true })).toMatchObject({ ok: false });
    expect(seen.inserted).toBeNull();
  });

  it("bloqueia um horário livre", async () => {
    mocks.readReceptionAuthed.mockResolvedValue(true);
    const seen = fakeDb();
    expect(await setSlotBlocked({ ...BLOCK, blocked: true })).toEqual({ ok: true });
    expect(seen.inserted).toEqual({ facility: "pool", block_date: "2999-01-01", slot_start: "14:00:00" });
  });

  it("recusa bloquear horário que tem reserva ativa", async () => {
    mocks.readReceptionAuthed.mockResolvedValue(true);
    const seen = fakeDb({ id: "r1" });
    const r = await setSlotBlocked({ ...BLOCK, blocked: true });
    expect(r).toMatchObject({ ok: false, code: "conflict" });
    expect(seen.inserted).toBeNull();
  });

  it("bloquear de novo (já bloqueado) é aceito sem erro", async () => {
    mocks.readReceptionAuthed.mockResolvedValue(true);
    fakeDb(null, { code: "23505" });
    expect(await setSlotBlocked({ ...BLOCK, blocked: true })).toEqual({ ok: true });
  });

  it("liberar não apaga: só preenche released_at do bloqueio vigente", async () => {
    mocks.readReceptionAuthed.mockResolvedValue(true);
    const seen = fakeDb();
    expect(await setSlotBlocked({ ...BLOCK, blocked: false })).toEqual({ ok: true });
    expect(seen.updated).toHaveProperty("released_at");
    expect(seen.updateEqs).toContainEqual(["slot_start", "14:00:00"]);
  });

  it("horário inexistente na instalação é recusado (09h não existe na academia? existe; 25h não)", async () => {
    mocks.readReceptionAuthed.mockResolvedValue(true);
    fakeDb();
    expect(await setSlotBlocked({ ...BLOCK, slotStart: "08:00:00", blocked: true })).toMatchObject({ ok: false });
    expect(await setSlotBlocked({ ...BLOCK, facility: "x" as never, blocked: true })).toMatchObject({ ok: false });
  });
});

describe("horário bloqueado não aceita reserva", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getValidatedGuestStay.mockResolvedValue({ id: "s1", apartmentNumber: "211", checkoutDate: "2099-01-05" });
  });

  function readOnlyDb() {
    const insert = vi.fn();
    const q: Record<string, unknown> = {};
    q.eq = () => q;
    q.then = (res: (v: unknown) => unknown) => res({ data: [], error: null });
    q.maybeSingle = () => Promise.resolve({ data: null, error: null });
    mocks.getAdminClient.mockReturnValue({ from: () => ({ select: () => q, insert }) });
    return insert;
  }

  it("hóspede: recusa e não insere", async () => {
    blocksAware(mocks.getAdminClient, () => ["14:00:00"]);
    const insert = readOnlyDb();
    const r = await createGuestReservation({ facility: "pool", reservationDate: "2099-01-03", slotStart: "14:00:00", guestWhatsapp: "(54) 99999-9999" });
    expect(r).toMatchObject({ ok: false, code: "conflict" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("recepção: recusa e não insere", async () => {
    mocks.readReceptionAuthed.mockResolvedValue(true);
    blocksAware(mocks.getAdminClient, () => ["14:00:00"]);
    const insert = readOnlyDb();
    const r = await createReceptionReservation({
      facility: "pool", apartmentNumber: "101", reservationDate: "2999-01-01", slotStart: "14:00:00",
    });
    expect(r).toMatchObject({ ok: false, code: "conflict" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("o resumo do dia marca o horário bloqueado como ocupado (hóspede vê indisponível) e informa blockedSlots", async () => {
    mocks.readReceptionAuthed.mockResolvedValue(false);
    blocksAware(mocks.getAdminClient, () => ["15:00:00"]);
    const q: Record<string, unknown> = {};
    let n = 0;
    q.eq = () => (++n >= 3 ? Promise.resolve({ data: [{ slot_start: "14:00:00", apartment_number: "101", stay_id: null }], error: null }) : q);
    mocks.getAdminClient.mockReturnValue({ from: () => ({ select: () => q }) });
    const r = await getReservationDaySummary("2999-01-01", "pool");
    expect(r).toMatchObject({ ok: true, blockedSlots: ["15:00:00"] });
    if (r.ok) expect(r.occupiedSlots.sort()).toEqual(["14:00:00", "15:00:00"]);
  });
});
