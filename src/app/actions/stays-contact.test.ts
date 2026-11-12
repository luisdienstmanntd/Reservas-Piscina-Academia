import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminClient: vi.fn(),
  cookieGet: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mocks.cookieGet }),
  headers: vi.fn(),
}));
vi.mock("@/lib/reception-auth", () => ({ readReceptionAuthed: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: mocks.getAdminClient,
  supabaseConfigErrorMessage: () => "sem banco",
}));

import { getValidatedGuestStay, saveStayGuestContact } from "./stays";

const FUTURE = "2999-01-01";

/** Banco falso: `stay` é o que a consulta por token devolve; `updated` guarda o que foi gravado. */
function fakeDb(stay: Record<string, unknown> | null) {
  const seen = {
    tokenFilter: null as unknown,
    updated: null as Record<string, unknown> | null,
    updateEqs: [] as Array<[string, unknown]>,
  };
  const sel: Record<string, unknown> = {};
  sel.eq = (_c: string, v: unknown) => ((seen.tokenFilter = v), sel);
  sel.maybeSingle = () => Promise.resolve({ data: stay, error: null });
  const upd: Record<string, unknown> = {};
  upd.eq = (c: string, v: unknown) => (seen.updateEqs.push([c, v]), Promise.resolve({ error: null }));
  mocks.getAdminClient.mockReturnValue({
    from: () => ({
      select: () => sel,
      update: (v: Record<string, unknown>) => ((seen.updated = v), upd),
    }),
  });
  return seen;
}

const STAY = {
  id: "stay-1",
  apartment_number: "101",
  checkout_date: FUTURE,
  guest_name: null,
  guest_whatsapp: null,
};

describe("permanência do nome e do WhatsApp na estadia", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.cookieGet.mockReturnValue({ value: "tok-1" });
  });

  it("a estadia devolve o contato já gravado (qualquer aparelho com o link)", async () => {
    fakeDb({ ...STAY, guest_name: "MARIA", guest_whatsapp: "5554999991234" });
    expect(await getValidatedGuestStay()).toMatchObject({
      id: "stay-1",
      guestName: "MARIA",
      guestWhatsapp: "5554999991234",
    });
  });

  it("estadia sem contato: guestName e guestWhatsapp nulos (a tela pede uma vez)", async () => {
    fakeDb(STAY);
    expect(await getValidatedGuestStay()).toMatchObject({ guestName: null, guestWhatsapp: null });
  });

  it("grava nome (em maiúsculas) e WhatsApp normalizado SÓ na estadia do próprio link", async () => {
    const seen = fakeDb(STAY);
    const r = await saveStayGuestContact({ guestName: " maria ", guestWhatsapp: "(54) 99999-1234" });
    expect(r).toEqual({ ok: true });
    expect(seen.updated).toMatchObject({ guest_name: "MARIA", guest_whatsapp: expect.stringMatching(/^\+?\d{10,}$/) });
    expect(seen.updated).toHaveProperty("contact_saved_at");
    expect(seen.updateEqs).toEqual([["id", "stay-1"]]);
  });

  it("nome em branco grava nulo; WhatsApp é obrigatório e validado", async () => {
    const seen = fakeDb(STAY);
    expect(await saveStayGuestContact({ guestWhatsapp: "(54) 99999-1234" })).toEqual({ ok: true });
    expect(seen.updated).toMatchObject({ guest_name: null });
    const bad = fakeDb(STAY);
    expect(await saveStayGuestContact({ guestWhatsapp: "abc" })).toMatchObject({ ok: false });
    expect(bad.updated).toBeNull();
  });

  it("sem link válido (cookie ausente ou estadia vencida) não grava nada", async () => {
    mocks.cookieGet.mockReturnValue(undefined);
    const none = fakeDb(STAY);
    expect(await saveStayGuestContact({ guestWhatsapp: "(54) 99999-1234" })).toMatchObject({ ok: false });
    expect(none.updated).toBeNull();

    mocks.cookieGet.mockReturnValue({ value: "tok-1" });
    const expired = fakeDb({ ...STAY, checkout_date: "2000-01-01" });
    expect(await saveStayGuestContact({ guestWhatsapp: "(54) 99999-1234" })).toMatchObject({ ok: false });
    expect(expired.updated).toBeNull();
  });
});
