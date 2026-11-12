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

import { createGuestReservation, createReceptionReservation } from "./reservations";

const STAY_ID = "44444444-4444-4444-8444-444444444444";
const NEW_ID = "55555555-5555-4555-8555-555555555555";

/** Cliente falso: leitura de conflitos devolve vazio; insert devolve o id novo. */
function fakeDb() {
  const readQ: Record<string, unknown> = {};
  let eqCalls = 0;
  readQ.eq = () => (++eqCalls >= 3 ? Promise.resolve({ data: [], error: null }) : readQ);
  const single = vi.fn().mockResolvedValue({ data: { id: NEW_ID }, error: null });
  const insert = vi.fn().mockReturnValue({ select: () => ({ single }) });
  mocks.getAdminClient.mockReturnValue({ from: () => ({ select: () => readQ, insert }) });
  return { insert };
}

describe("vínculo reserva ↔ estadia (stay_id)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    blocksAware(mocks.getAdminClient);
    mocks.readReceptionAuthed.mockResolvedValue(true);
    mocks.getValidatedGuestStay.mockResolvedValue({
      id: STAY_ID,
      apartmentNumber: "101",
      checkoutDate: "2099-01-02",
    });
  });

  it("reserva do hóspede grava o id da estadia do link", async () => {
    const db = fakeDb();
    const r = await createGuestReservation({
      facility: "pool",
      reservationDate: "2099-01-01",
      slotStart: "14:00:00",
      guestWhatsapp: "11988887777",
    });
    expect(r).toMatchObject({ ok: true });
    expect(db.insert.mock.calls[0][0]).toMatchObject({
      stay_id: STAY_ID,
      created_by: "guest",
      apartment_number: "101",
    });
  });

  it("reserva de balcão não tem estadia (stay_id ausente)", async () => {
    const db = fakeDb();
    const r = await createReceptionReservation({
      facility: "pool",
      apartmentNumber: "101",
      reservationDate: "2099-01-01",
      slotStart: "14:00:00",
    });
    expect(r).toMatchObject({ ok: true });
    const row = db.insert.mock.calls[0][0];
    expect(row.created_by).toBe("reception");
    expect(row.stay_id).toBeUndefined();
  });
});
