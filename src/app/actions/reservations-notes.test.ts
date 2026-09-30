import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getAdminClient: vi.fn(), readReceptionAuthed: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/reception-auth", () => ({ readReceptionAuthed: mocks.readReceptionAuthed, RECEPTION_COOKIE: "test", RECEPTION_COOKIE_VALUE: "test" }));
vi.mock("@/app/actions/stays", () => ({ getValidatedGuestStay: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: mocks.getAdminClient, supabaseConfigErrorMessage: () => "test" }));
import { updateReservationNotes } from "./reservations";
const id = "11111111-1111-4111-8111-111111111111";
describe("editing reservation notes", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.readReceptionAuthed.mockResolvedValue(true); });
  it("rejects unauthorized edits before accessing database", async () => {
    mocks.readReceptionAuthed.mockResolvedValue(false);
    expect(await updateReservationNotes(id, "teste")).toMatchObject({ ok: false });
    expect(mocks.getAdminClient).not.toHaveBeenCalled();
  });
  it("rejects invalid ids and oversized notes", async () => {
    expect(await updateReservationNotes("invalid", "teste")).toMatchObject({ ok: false });
    expect(await updateReservationNotes(id, "a".repeat(2001))).toMatchObject({ ok: false });
    expect(mocks.getAdminClient).not.toHaveBeenCalled();
  });
  it("saves trimmed notes, clears empty text and detects a missing reservation", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id }, error: null });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    mocks.getAdminClient.mockReturnValue({ from: vi.fn().mockReturnValue({ update }) });
    expect(await updateReservationNotes(id, "  espumante\nsem álcool  ")).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({ notes: "espumante\nsem álcool" });
    expect(eq).toHaveBeenCalledWith("id", id);
    expect(await updateReservationNotes(id, " ")).toEqual({ ok: true });
    expect(update).toHaveBeenLastCalledWith({ notes: null });
    maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await updateReservationNotes(id, "teste")).toMatchObject({ ok: false, error: "Reserva não encontrada." });
  });
});
