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

import { getReservationDaySummary } from "./reservations";

const ROWS = [
  { slot_start: "14:00:00", apartment_number: "101", stay_id: null },
  { slot_start: "16:00:00", apartment_number: "211", stay_id: "s1" },
];

function fakeDb(eqs: Array<[string, unknown]> = []) {
  const q: Record<string, unknown> = {};
  let n = 0;
  q.eq = (c: string, v: unknown) => {
    eqs.push([c, v]);
    return ++n >= 3 ? Promise.resolve({ data: ROWS, error: null }) : q;
  };
  mocks.getAdminClient.mockReturnValue({ from: () => ({ select: () => q }) });
}

describe("getReservationDaySummary: privacidade e hora do servidor", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    blocksAware(mocks.getAdminClient);
  });

  it("hóspede não recebe a lista de apartamentos, só se o PRÓPRIO apartamento já reservou", async () => {
    mocks.readReceptionAuthed.mockResolvedValue(false);
    mocks.getValidatedGuestStay.mockResolvedValue({ id: "s1", apartmentNumber: "211", checkoutDate: "2099-01-02" });
    const eqs: Array<[string, unknown]> = [];
    fakeDb(eqs);
    const r = await getReservationDaySummary("2099-01-01", "pool");
    expect(r).toMatchObject({ ok: true, apartmentsBooked: [], ownApartmentBooked: true });
    expect(eqs).toContainEqual(["status", "active"]);
    if (r.ok) expect(r.occupiedSlots).toEqual(["14:00:00", "16:00:00"]);
  });

  it("devolve só o horário da PRÓPRIA reserva (ownSlot) para a troca; nunca o de outros", async () => {
    mocks.readReceptionAuthed.mockResolvedValue(false);
    mocks.getValidatedGuestStay.mockResolvedValue({ id: "s1", apartmentNumber: "211", checkoutDate: "2099-01-02" });
    fakeDb();
    const r = await getReservationDaySummary("2099-01-01", "pool");
    expect(r).toMatchObject({ ok: true, ownSlot: "16:00:00" });
  });

  it("reserva do mesmo apartamento feita em OUTRA estadia não pode ser trocada (ownSlot nulo)", async () => {
    mocks.readReceptionAuthed.mockResolvedValue(false);
    mocks.getValidatedGuestStay.mockResolvedValue({ id: "s2", apartmentNumber: "211", checkoutDate: "2099-01-02" });
    fakeDb();
    expect(await getReservationDaySummary("2099-01-01", "pool")).toMatchObject({
      ok: true,
      ownApartmentBooked: true,
      ownSlot: null,
    });
  });

  it("recepção nunca recebe ownSlot", async () => {
    mocks.readReceptionAuthed.mockResolvedValue(true);
    fakeDb();
    expect(await getReservationDaySummary("2099-01-01", "pool")).toMatchObject({ ok: true, ownSlot: null });
  });

  it("hóspede cujo apartamento ainda não reservou recebe ownApartmentBooked=false", async () => {
    mocks.readReceptionAuthed.mockResolvedValue(false);
    mocks.getValidatedGuestStay.mockResolvedValue({ id: "s1", apartmentNumber: "305", checkoutDate: "2099-01-02" });
    fakeDb();
    expect(await getReservationDaySummary("2099-01-01", "pool")).toMatchObject({
      ok: true,
      apartmentsBooked: [],
      ownApartmentBooked: false,
    });
  });

  it("recepção continua recebendo a lista completa (o formulário precisa dela)", async () => {
    mocks.readReceptionAuthed.mockResolvedValue(true);
    fakeDb();
    const r = await getReservationDaySummary("2099-01-01", "pool");
    expect(r).toMatchObject({ ok: true, ownApartmentBooked: false });
    if (r.ok) expect(r.apartmentsBooked.sort()).toEqual(["101", "211"]);
    expect(mocks.getValidatedGuestStay).not.toHaveBeenCalled();
  });

  it("devolve a hora do servidor para a tela decidir o que já passou", async () => {
    mocks.readReceptionAuthed.mockResolvedValue(true);
    fakeDb();
    const antes = Date.now();
    const r = await getReservationDaySummary("2099-01-01", "pool");
    expect(r.ok && r.serverNowMs >= antes).toBe(true);
  });

  it("sem sessão e sem estadia válida: recusa", async () => {
    mocks.readReceptionAuthed.mockResolvedValue(false);
    mocks.getValidatedGuestStay.mockResolvedValue(null);
    expect(await getReservationDaySummary("2099-01-01", "pool")).toMatchObject({ ok: false });
    expect(mocks.getAdminClient).not.toHaveBeenCalled();
  });
});

describe("getReservationDaySummary: asGuest (mesmo navegador com a sessão da recepção)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    blocksAware(mocks.getAdminClient);
  });

  it("com asGuest, a sessão da recepção é ignorada: o hóspede recebe a visão de hóspede, com a reserva própria", async () => {
    mocks.readReceptionAuthed.mockResolvedValue(true); // o mesmo navegador também está logado na recepção
    mocks.getValidatedGuestStay.mockResolvedValue({ id: "s1", apartmentNumber: "211", checkoutDate: "2099-01-02" });
    fakeDb();
    const r = await getReservationDaySummary("2099-01-01", "pool", { asGuest: true });
    expect(r).toMatchObject({ ok: true, apartmentsBooked: [], ownApartmentBooked: true, ownSlot: "16:00:00" });
  });

  it("com asGuest e sem estadia válida: recusa (não vira recepção)", async () => {
    mocks.readReceptionAuthed.mockResolvedValue(true);
    mocks.getValidatedGuestStay.mockResolvedValue(null);
    fakeDb();
    expect(await getReservationDaySummary("2099-01-01", "pool", { asGuest: true })).toMatchObject({ ok: false });
  });

  it("sem asGuest, a recepção continua recebendo a lista completa", async () => {
    mocks.readReceptionAuthed.mockResolvedValue(true);
    fakeDb();
    const r = await getReservationDaySummary("2099-01-01", "pool");
    expect(r.ok && r.apartmentsBooked.length).toBe(2);
  });
});
