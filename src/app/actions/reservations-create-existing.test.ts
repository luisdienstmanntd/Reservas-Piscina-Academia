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

import { createGuestReservation } from "./reservations";

const STAY = { id: "s1", apartmentNumber: "211", checkoutDate: "2099-01-05" };
const INPUT = { facility: "pool" as const, reservationDate: "2099-01-03", slotStart: "15:00:00", guestWhatsapp: "(54) 99999-9999" };

/** `rows` = reservas ativas do dia (consulta de conflito); `own` = resposta da busca da reserva própria. */
function fakeDb(rows: unknown[], own: unknown) {
  const chain = (result: () => unknown) => {
    const q: Record<string, unknown> = {};
    q.eq = () => q;
    q.maybeSingle = () => Promise.resolve({ data: own, error: null });
    q.then = (res: (v: unknown) => unknown) => res(result());
    return q;
  };
  mocks.getAdminClient.mockReturnValue({
    from: () => ({
      select: (cols: string) =>
        cols.includes("stay_id") ? chain(() => ({ data: own, error: null })) : chain(() => ({ data: rows, error: null })),
      insert: () => { throw new Error("não deve inserir"); },
    }),
  });
}

describe("createGuestReservation quando o apartamento já tem reserva no dia", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getValidatedGuestStay.mockResolvedValue(STAY);
  });

  it("devolve o horário atual (existingSlot) para a tela oferecer a TROCA, sem criar outra reserva", async () => {
    fakeDb([{ slot_start: "14:00:00", apartment_number: "211" }], { slot_start: "14:00:00", stay_id: "s1" });
    const r = await createGuestReservation(INPUT);
    expect(r).toMatchObject({ ok: false, code: "conflict", existingSlot: "14:00:00" });
  });

  it("reserva da recepção (sem estadia) também pode ser trocada", async () => {
    fakeDb([{ slot_start: "14:00:00", apartment_number: "211" }], { slot_start: "14:00:00", stay_id: null });
    expect(await createGuestReservation(INPUT)).toMatchObject({ existingSlot: "14:00:00" });
  });

  it("reserva de OUTRA estadia do apartamento: só recusa (sem existingSlot)", async () => {
    fakeDb([{ slot_start: "14:00:00", apartment_number: "211" }], { slot_start: "14:00:00", stay_id: "outra" });
    const r = await createGuestReservation(INPUT);
    expect(r).toMatchObject({ ok: false, code: "conflict" });
    expect(r).not.toHaveProperty("existingSlot");
  });

  it("horário ocupado por outro apartamento: recusa normal, sem oferecer troca", async () => {
    fakeDb([{ slot_start: "15:00:00", apartment_number: "305" }], null);
    const r = await createGuestReservation(INPUT);
    expect(r).toMatchObject({ ok: false, code: "conflict" });
    expect(r).not.toHaveProperty("existingSlot");
  });
});
