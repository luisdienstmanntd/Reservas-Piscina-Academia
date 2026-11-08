import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminClient: vi.fn(),
  readReceptionAuthed: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("@/lib/reception-auth", () => ({
  readReceptionAuthed: mocks.readReceptionAuthed,
}));
vi.mock("@/app/actions/stays", () => ({ getValidatedGuestStay: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: mocks.getAdminClient,
  supabaseConfigErrorMessage: () => "sem banco",
}));

import {
  cancelReservation,
  createReceptionReservation,
  getReservationsForDate,
} from "./reservations";

const id = "11111111-1111-4111-8111-111111111111";

describe("cancelReservation (soft delete)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.readReceptionAuthed.mockResolvedValue(true);
  });

  function dbForCancel(found: boolean) {
    const maybeSingle = vi.fn().mockResolvedValue({ data: found ? { id } : null, error: null });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const eqStatus = vi.fn().mockReturnValue({ select });
    const eqId = vi.fn().mockReturnValue({ eq: eqStatus });
    const update = vi.fn().mockReturnValue({ eq: eqId });
    const del = vi.fn();
    mocks.getAdminClient.mockReturnValue({ from: vi.fn().mockReturnValue({ update, delete: del }) });
    return { update, eqId, eqStatus, del };
  }

  it("recusa sem sessão da recepção, sem tocar no banco", async () => {
    mocks.readReceptionAuthed.mockResolvedValue(false);
    expect(await cancelReservation(id)).toMatchObject({ ok: false });
    expect(mocks.getAdminClient).not.toHaveBeenCalled();
  });

  it("recusa id inválido", async () => {
    expect(await cancelReservation("x")).toMatchObject({ ok: false });
    expect(mocks.getAdminClient).not.toHaveBeenCalled();
  });

  it("faz UPDATE para cancelled (nunca DELETE) apenas em reservas ativas", async () => {
    const db = dbForCancel(true);
    expect(await cancelReservation(id)).toEqual({ ok: true });
    const patch = db.update.mock.calls[0][0];
    expect(patch).toMatchObject({ status: "cancelled", cancelled_by: "reception" });
    expect(typeof patch.cancelled_at).toBe("string");
    expect(db.eqId).toHaveBeenCalledWith("id", id);
    expect(db.eqStatus).toHaveBeenCalledWith("status", "active");
    expect(db.del).not.toHaveBeenCalled();
  });

  it("informa quando a reserva não existe ou já foi cancelada", async () => {
    dbForCancel(false);
    expect(await cancelReservation(id)).toMatchObject({
      ok: false,
      error: expect.stringMatching(/já cancelada/),
    });
  });
});

describe("leituras só consideram reservas ativas", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.readReceptionAuthed.mockResolvedValue(true);
  });

  it("getReservationsForDate filtra status=active", async () => {
    const eqs: Array<[string, unknown]> = [];
    const q: Record<string, unknown> = {};
    q.eq = (c: string, v: unknown) => (eqs.push([c, v]), q);
    q.order = () => Promise.resolve({ data: [], error: null });
    mocks.getAdminClient.mockReturnValue({ from: () => ({ select: () => q }) });
    expect(await getReservationsForDate("2999-01-01", "pool")).toMatchObject({ ok: true });
    expect(eqs).toContainEqual(["status", "active"]);
  });
});

describe("reserva de balcão", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.readReceptionAuthed.mockResolvedValue(true);
  });

  it("grava guest_checkout_date NULL e checa conflitos só entre ativas", async () => {
    const eqs: Array<[string, unknown]> = [];
    const selQ: Record<string, unknown> = {};
    selQ.eq = (c: string, v: unknown) => {
      eqs.push([c, v]);
      return eqs.length >= 3 ? Promise.resolve({ data: [], error: null }) : selQ;
    };
    const single = vi.fn().mockResolvedValue({ data: { id }, error: null });
    const insert = vi.fn().mockReturnValue({ select: () => ({ single }) });
    mocks.getAdminClient.mockReturnValue({ from: () => ({ select: () => selQ, insert }) });

    const r = await createReceptionReservation({
      facility: "pool",
      apartmentNumber: "101",
      reservationDate: "2999-01-01",
      slotStart: "15:00:00",
    });
    expect(r).toMatchObject({ ok: true });
    expect(insert.mock.calls[0][0]).toMatchObject({ guest_checkout_date: null, created_by: "reception" });
    expect(eqs).toContainEqual(["status", "active"]);
  });
});
