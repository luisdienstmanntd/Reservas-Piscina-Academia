import { beforeEach, describe, expect, it, vi } from "vitest";
import { blocksAware } from "./test-blocks";

const mocks = vi.hoisted(() => ({
  getAdminClient: vi.fn(),
  readReceptionAuthed: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("@/lib/reception-auth", () => ({ readReceptionAuthed: mocks.readReceptionAuthed }));
vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: mocks.getAdminClient,
  supabaseConfigErrorMessage: () => "sem banco",
}));

import { addDaysYmd, hotelCalendarDate } from "@/lib/hotel-time";
import {
  createReceptionReservation,
  updateReservationGuestName,
  updateReservationNotes,
} from "./reservations";
import { generateStayToken } from "./stays";

const ID = "11111111-1111-4111-8111-111111111111";

describe("endurecimento: entradas inválidas viram erro claro, nunca 500", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    blocksAware(mocks.getAdminClient);
    mocks.readReceptionAuthed.mockResolvedValue(true);
  });

  it("data que não existe no calendário é recusada antes de tocar no banco", async () => {
    for (const d of ["2026-13-45", "2027-02-30", "2026-12-32", "2026-00-10"]) {
      const r = await createReceptionReservation({ facility: "pool", apartmentNumber: "101", reservationDate: d, slotStart: "15:00:00" });
      expect(r).toMatchObject({ ok: false, code: "validation" });
    }
    expect(mocks.getAdminClient).not.toHaveBeenCalled();
  });

  it("erro do banco ao verificar o horário vira mensagem amigável (antes era erro 500)", async () => {
    const q: Record<string, unknown> = {};
    let n = 0;
    q.eq = () => (++n >= 3 ? Promise.resolve({ data: null, error: { message: "boom" } }) : q);
    mocks.getAdminClient.mockReturnValue({ from: () => ({ select: () => q }) });
    const r = await createReceptionReservation({ facility: "pool", apartmentNumber: "101", reservationDate: "2999-01-01", slotStart: "15:00:00" });
    expect(r).toMatchObject({ ok: false, code: "network" });
  });

  it("nome e observações recusam caracteres de controle, byte nulo e inversão de texto", async () => {
    for (const bad of ["Ana\u0000", "Ana‮odnum", "a\u0007b"]) {
      expect(await updateReservationGuestName(ID, bad)).toMatchObject({ ok: false, code: "validation" });
      expect(await updateReservationNotes(ID, bad)).toMatchObject({ ok: false, code: "validation" });
      const r = await createReceptionReservation({ facility: "pool", apartmentNumber: "101", reservationDate: "2999-01-01", slotStart: "15:00:00", notes: bad });
      expect(r).toMatchObject({ ok: false, code: "validation" });
    }
    expect(mocks.getAdminClient).not.toHaveBeenCalled();
  });

  it("nome e observações aceitam acentos, emoji e quebras de linha normais", async () => {
    mocks.getAdminClient.mockReturnValue({
      from: () => ({
        update: () => ({
          eq: () => ({ select: () => ({ maybeSingle: () => Promise.resolve({ data: { id: ID }, error: null }) }) }),
        }),
      }),
    });
    const r = await updateReservationNotes(ID, "Aniversário 🎂\nsem glúten");
    expect(r).toMatchObject({ ok: true });
  });

  it("edição com valor que não é texto (requisição forjada) é recusada", async () => {
    expect(await updateReservationGuestName(ID, { x: 1 } as unknown as string)).toMatchObject({ ok: false });
    expect(await updateReservationNotes(ID, ["a"] as unknown as string)).toMatchObject({ ok: false });
    expect(mocks.getAdminClient).not.toHaveBeenCalled();
  });

  it("link de estadia: check-out distante demais (token quase eterno) é recusado", async () => {
    const hoje = hotelCalendarDate();
    const longe = await generateStayToken({ apartmentNumber: "101", checkoutDate: addDaysYmd(hoje, 91) });
    expect(longe).toMatchObject({ ok: false });
    expect((longe as { error: string }).error).toMatch(/90 dias/);
    expect(await generateStayToken({ apartmentNumber: "101", checkoutDate: "9999-12-31" })).toMatchObject({ ok: false });
    expect(mocks.getAdminClient).not.toHaveBeenCalled();
  });
});
