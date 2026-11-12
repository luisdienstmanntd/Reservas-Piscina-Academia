import { beforeEach, describe, expect, it, vi } from "vitest";
import { blocksAware } from "./test-blocks";

import { addDaysYmd, hotelCalendarDate } from "@/lib/hotel-time";

const mocks = vi.hoisted(() => ({
  getAdminClient: vi.fn(),
  readReceptionAuthed: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("@/lib/reception-auth", () => ({
  readReceptionAuthed: mocks.readReceptionAuthed,
  RECEPTION_COOKIE: "test",
  RECEPTION_COOKIE_VALUE: "test",
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
  updateReservationGuestName,
  updateReservationNotes,
} from "./reservations";

const id = "11111111-1111-4111-8111-111111111111";
const today = hotelCalendarDate();
const yesterday = addDaysYmd(today, -1);
const tomorrow = addDaysYmd(today, 1);

type Call = { eqs: Array<[string, unknown]> };

/**
 * Banco falso para `getReservationsForDate`: cada consulta devolve as linhas cujo `status`
 * (e instalação) combinam com os filtros `.eq(...)` recebidos.
 */
function fakeDayDb(all: Array<Record<string, unknown>>) {
  const calls: Call[] = [];
  mocks.getAdminClient.mockReturnValue({
    from: () => ({
      select: () => {
        const call: Call = { eqs: [] };
        calls.push(call);
        const q: Record<string, unknown> = {};
        q.eq = (c: string, v: unknown) => (call.eqs.push([c, v]), q);
        q.order = () => {
          const rows = all.filter((r) => call.eqs.every(([c, v]) => r[c] === v));
          return Promise.resolve({ data: rows, error: null });
        };
        return q;
      },
    }),
  });
  return calls;
}

const res = (over: Record<string, unknown>) => ({
  id: "x",
  facility: "pool",
  reservation_date: yesterday,
  slot_start: "15:00:00",
  apartment_number: "101",
  guest_name: "ANA",
  notes: "ESPUMANTE",
  status: "active",
  created_by: "guest",
  ...over,
});

describe("histórico: consulta de dias anteriores", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    blocksAware(mocks.getAdminClient);
    mocks.readReceptionAuthed.mockResolvedValue(true);
  });

  it("uma reserva de ontem continua registrada e consultável", async () => {
    fakeDayDb([res({ id: "a" })]);
    const r = await getReservationsForDate(yesterday, "pool");
    expect(r).toMatchObject({ ok: true });
    if (r.ok) {
      expect(r.rows.map((x) => x.id)).toEqual(["a"]);
      expect(r.rows[0]).toMatchObject({ guest_name: "ANA", notes: "ESPUMANTE" });
    }
  });

  it("uma reserva cancelada permanece no histórico do dia passado", async () => {
    fakeDayDb([
      res({ id: "a" }),
      res({ id: "c", slot_start: "16:00:00", status: "cancelled", cancelled_by: "reception", cancelled_at: "2026-11-10T20:00:00Z" }),
    ]);
    const r = await getReservationsForDate(yesterday, "pool");
    expect(r).toMatchObject({ ok: true });
    if (r.ok) {
      expect(r.rows.map((x) => x.id)).toEqual(["a"]);
      expect(r.cancelled.map((x) => x.id)).toEqual(["c"]);
      expect(r.cancelled[0]).toMatchObject({ status: "cancelled", cancelled_by: "reception" });
    }
  });

  it("hoje e dias futuros não trazem canceladas (e nem fazem a 2ª consulta)", async () => {
    const calls = fakeDayDb([res({ id: "c", reservation_date: today, status: "cancelled" })]);
    const hoje = await getReservationsForDate(today, "pool");
    expect(hoje).toMatchObject({ ok: true, rows: [], cancelled: [] });
    const amanha = await getReservationsForDate(tomorrow, "pool");
    expect(amanha).toMatchObject({ ok: true, cancelled: [] });
    expect(calls).toHaveLength(2); // uma consulta por chamada
  });

  it("a consulta por data devolve só aquele dia", async () => {
    fakeDayDb([
      res({ id: "ontem" }),
      res({ id: "anteontem", reservation_date: addDaysYmd(today, -2) }),
    ]);
    const r = await getReservationsForDate(yesterday, "pool");
    if (r.ok) expect(r.rows.map((x) => x.id)).toEqual(["ontem"]);
  });

  it("piscina e academia são separadas (ativas e canceladas)", async () => {
    fakeDayDb([
      res({ id: "p" }),
      res({ id: "g", facility: "gym" }),
      res({ id: "pc", status: "cancelled", cancelled_at: "2026-11-10T20:00:00Z" }),
      res({ id: "gc", facility: "gym", status: "cancelled", cancelled_at: "2026-11-10T20:00:00Z" }),
    ]);
    const pool = await getReservationsForDate(yesterday, "pool");
    const gym = await getReservationsForDate(yesterday, "gym");
    if (pool.ok && gym.ok) {
      expect(pool.rows.map((x) => x.id)).toEqual(["p"]);
      expect(pool.cancelled.map((x) => x.id)).toEqual(["pc"]);
      expect(gym.rows.map((x) => x.id)).toEqual(["g"]);
      expect(gym.cancelled.map((x) => x.id)).toEqual(["gc"]);
    }
  });

  it("sem sessão da recepção não devolve nada nem toca no banco", async () => {
    mocks.readReceptionAuthed.mockResolvedValue(false);
    const r = await getReservationsForDate(yesterday, "pool");
    expect(r).toMatchObject({ ok: false, unauthorized: true });
    expect(mocks.getAdminClient).not.toHaveBeenCalled();
  });
});

describe("reservas passadas: a recepção pode alterar e excluir; criar continua bloqueado", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    blocksAware(mocks.getAdminClient);
    mocks.readReceptionAuthed.mockResolvedValue(true);
  });

  function dbForUpdate() {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id }, error: null });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const eqNotes = vi.fn().mockReturnValue({ select });
    const eqName = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockImplementation((patch: Record<string, unknown>) => ({
      eq: "notes" in patch ? eqNotes : eqName,
    }));
    mocks.getAdminClient.mockReturnValue({ from: vi.fn().mockReturnValue({ update }) });
    return { update, eqNotes, eqName };
  }

  it("altera nome e observações sem depender da data (filtra só pelo id)", async () => {
    const db = dbForUpdate();
    expect(await updateReservationGuestName(id, "ana souza")).toEqual({ ok: true });
    expect(await updateReservationNotes(id, "corrigido")).toEqual({ ok: true });
    expect(db.eqName).toHaveBeenCalledWith("id", id);
    expect(db.eqNotes).toHaveBeenCalledWith("id", id);
  });

  it("exclui (cancela) sem olhar a data e nunca faz DELETE", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id }, error: null });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const eqStatus = vi.fn().mockReturnValue({ select });
    const eqId = vi.fn().mockReturnValue({ eq: eqStatus });
    const update = vi.fn().mockReturnValue({ eq: eqId });
    const del = vi.fn();
    mocks.getAdminClient.mockReturnValue({ from: vi.fn().mockReturnValue({ update, delete: del }) });
    expect(await cancelReservation(id)).toEqual({ ok: true });
    expect(update.mock.calls[0][0]).toMatchObject({ status: "cancelled" });
    expect(del).not.toHaveBeenCalled();
  });

  it("criar reserva em data passada continua recusado", async () => {
    mocks.getAdminClient.mockReturnValue({ from: vi.fn() });
    const r = await createReceptionReservation({
      facility: "pool",
      apartmentNumber: "101",
      reservationDate: yesterday,
      slotStart: "15:00:00",
    });
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/datas passadas/i) });
  });
});
