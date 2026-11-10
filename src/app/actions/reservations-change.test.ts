import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminClient: vi.fn(),
  getValidatedGuestStay: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("@/lib/reception-auth", () => ({ readReceptionAuthed: vi.fn() }));
vi.mock("@/app/actions/stays", () => ({ getValidatedGuestStay: mocks.getValidatedGuestStay }));
vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: mocks.getAdminClient,
  supabaseConfigErrorMessage: () => "sem banco",
}));

import { changeGuestReservation } from "./reservations";

const STAY = { id: "s1", apartmentNumber: "211", checkoutDate: "2099-01-05" };
const DATE = "2099-01-03";

type Current = { id: string; slot_start: string; stay_id: string | null } | null;

/** Banco falso: 1ª chamada = busca da reserva atual; 2ª = UPDATE (devolve `updateResult`). */
function fakeDb(opts: {
  current: Current;
  updateResult?: { data: unknown; error: unknown };
}) {
  const seen: { update?: Record<string, unknown>; eq: Array<[string, unknown]> } = { eq: [] };
  const find: Record<string, unknown> = {};
  find.eq = (c: string, v: unknown) => (seen.eq.push([c, v]), find);
  find.maybeSingle = () => Promise.resolve({ data: opts.current, error: null });
  const upd: Record<string, unknown> = {};
  upd.eq = (c: string, v: unknown) => (seen.eq.push([c, v]), upd);
  upd.select = () => Promise.resolve(opts.updateResult ?? { data: [{ id: "r1" }], error: null });
  mocks.getAdminClient.mockReturnValue({
    from: () => ({
      select: () => find,
      update: (v: Record<string, unknown>) => ((seen.update = v), upd),
    }),
  });
  return seen;
}

describe("changeGuestReservation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getValidatedGuestStay.mockResolvedValue(STAY);
  });

  it("troca o horário com um único UPDATE, zera os avisos e marca a troca", async () => {
    const seen = fakeDb({ current: { id: "r1", slot_start: "14:00:00", stay_id: "s1" } });
    const r = await changeGuestReservation({ facility: "pool", reservationDate: DATE, slotStart: "22:00" });
    expect(r).toEqual({ ok: true, data: { id: "r1" } });
    expect(seen.update).toMatchObject({
      slot_start: "22:00:00",
      confirmation_sent: false,
      warning_sent: false,
    });
    expect(typeof seen.update?.guest_rescheduled_at).toBe("string");
    // só mexe na reserva ativa que ainda está no horário lido (sem sobrescrever uma alteração alheia)
    expect(seen.eq).toContainEqual(["status", "active"]);
    expect(seen.eq).toContainEqual(["slot_start", "14:00:00"]);
  });

  it("aceita reserva feita pela recepção (sem estadia) do próprio apartamento", async () => {
    fakeDb({ current: { id: "r1", slot_start: "14:00:00", stay_id: null } });
    expect(await changeGuestReservation({ facility: "pool", reservationDate: DATE, slotStart: "22:00:00" })).toMatchObject({ ok: true });
  });

  it("sem reserva no dia: não cria outra", async () => {
    fakeDb({ current: null });
    expect(await changeGuestReservation({ facility: "pool", reservationDate: DATE, slotStart: "22:00:00" })).toMatchObject({ ok: false, code: "validation" });
  });

  it("reserva de outra estadia do mesmo apartamento não pode ser trocada", async () => {
    fakeDb({ current: { id: "r1", slot_start: "14:00:00", stay_id: "outra" } });
    expect(await changeGuestReservation({ facility: "pool", reservationDate: DATE, slotStart: "22:00:00" })).toMatchObject({ ok: false, code: "validation" });
  });

  it("recusa trocar para o mesmo horário", async () => {
    fakeDb({ current: { id: "r1", slot_start: "22:00:00", stay_id: "s1" } });
    const r = await changeGuestReservation({ facility: "pool", reservationDate: DATE, slotStart: "22:00:00" });
    expect(r).toMatchObject({ ok: false, code: "validation" });
  });

  it("horário novo ocupado por outro hóspede: conflito, nada muda", async () => {
    fakeDb({
      current: { id: "r1", slot_start: "14:00:00", stay_id: "s1" },
      updateResult: {
        data: null,
        error: { code: "23505", message: "duplicate key", details: "", constraint: "reservations_facility_date_slot_unique" },
      },
    });
    const r = await changeGuestReservation({ facility: "pool", reservationDate: DATE, slotStart: "22:00:00" });
    expect(r).toMatchObject({ ok: false, code: "conflict" });
  });

  it("a reserva mudou entre a leitura e a troca: pede para atualizar", async () => {
    fakeDb({ current: { id: "r1", slot_start: "14:00:00", stay_id: "s1" }, updateResult: { data: [], error: null } });
    expect(await changeGuestReservation({ facility: "pool", reservationDate: DATE, slotStart: "22:00:00" })).toMatchObject({ ok: false, code: "conflict" });
  });

  it("horário novo fora da grade ou depois do check-out é recusado antes de tocar no banco", async () => {
    fakeDb({ current: { id: "r1", slot_start: "14:00:00", stay_id: "s1" } });
    expect(await changeGuestReservation({ facility: "pool", reservationDate: DATE, slotStart: "10:00:00" })).toMatchObject({ ok: false, code: "validation" });
    expect(await changeGuestReservation({ facility: "pool", reservationDate: "2099-01-09", slotStart: "22:00:00" })).toMatchObject({ ok: false, code: "validation" });
    expect(mocks.getAdminClient).not.toHaveBeenCalled();
  });

  it("sem estadia válida: recusa; banco fora do ar: mensagem de indisponível", async () => {
    mocks.getValidatedGuestStay.mockResolvedValueOnce(null);
    expect(await changeGuestReservation({ facility: "pool", reservationDate: DATE, slotStart: "22:00:00" })).toMatchObject({ ok: false, code: "validation" });
    mocks.getValidatedGuestStay.mockRejectedValueOnce(new Error("db"));
    expect(await changeGuestReservation({ facility: "pool", reservationDate: DATE, slotStart: "22:00:00" })).toMatchObject({ ok: false, code: "network" });
  });
});
