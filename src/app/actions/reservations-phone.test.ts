import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminClient: vi.fn(),
  readReceptionAuthed: vi.fn(),
  getValidatedGuestStay: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/reception-auth", () => ({
  readReceptionAuthed: mocks.readReceptionAuthed,
  readStaffUser: async () => ({ id: "11111111-1111-4111-8111-111111111111", name: "Recepção", username: "recepcao", session_version: 1 }),
  RECEPTION_COOKIE: "test", RECEPTION_COOKIE_VALUE: "test",
}));
vi.mock("@/app/actions/stays", () => ({ getValidatedGuestStay: mocks.getValidatedGuestStay }));
vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: mocks.getAdminClient,
  supabaseConfigErrorMessage: () => "test",
}));

import { createGuestReservation, createReceptionReservation, updateReservationGuestWhatsapp } from "./reservations";

describe("server phone validation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.readReceptionAuthed.mockResolvedValue(true);
    mocks.getValidatedGuestStay.mockResolvedValue({ apartmentNumber: "101", checkoutDate: "2099-01-02" });
  });

  it.each(["00000000000", "abc11912345678", "+9991234567890"])("rejects %s before obtaining a database client", async (phone) => {
    const input = { facility: "pool" as const, apartmentNumber: "101", reservationDate: "2099-01-01", slotStart: "14:00:00", guestWhatsapp: phone };
    const guest = await createGuestReservation(input);
    const reception = await createReceptionReservation(input);
    const edit = await updateReservationGuestWhatsapp("11111111-1111-4111-8111-111111111111", phone);
    for (const result of [guest, reception, edit]) {
      expect(result).toMatchObject({ ok: false, code: "validation" });
    }
    expect(mocks.getAdminClient).not.toHaveBeenCalled();
  });

  it("stores international country codes on edit and allows clearing optional phone", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    mocks.getAdminClient.mockReturnValue({ from: vi.fn().mockReturnValue({ update }) });
    const id = "11111111-1111-4111-8111-111111111111";
    expect(await updateReservationGuestWhatsapp(id, "+1 213 373 4253")).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({ guest_whatsapp: "+12133734253" });
    expect(await updateReservationGuestWhatsapp(id, " ")).toEqual({ ok: true });
    expect(update).toHaveBeenLastCalledWith({ guest_whatsapp: null });
  });
});
