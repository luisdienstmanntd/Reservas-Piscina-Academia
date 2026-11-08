import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminClient: vi.fn(),
  startReceptionSession: vi.fn(),
}));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({ get: (n: string) => (n === "x-forwarded-for" ? "9.9.9.9" : null) })),
  cookies: vi.fn(),
}));
vi.mock("@/lib/reception-auth", () => ({
  readReceptionAuthed: vi.fn(),
  startReceptionSession: mocks.startReceptionSession,
  endReceptionSession: vi.fn(),
}));
vi.mock("@/app/actions/stays", () => ({ getValidatedGuestStay: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: mocks.getAdminClient,
  supabaseConfigErrorMessage: () => "sem banco",
}));

import { loginReception } from "./reservations";

function fakeDb(failures: number) {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const del = vi.fn(() => ({ lt: vi.fn().mockResolvedValue({}), eq: vi.fn().mockResolvedValue({}) }));
  const select = vi.fn(() => ({
    eq: () => ({ gte: () => Promise.resolve({ count: failures, error: null }) }),
  }));
  return { insert, del, client: { from: vi.fn(() => ({ select, insert, delete: del })) } };
}

describe("loginReception", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("RECEPTION_PASSWORD", "senha-certa");
    vi.stubEnv("SESSION_SECRET", "s".repeat(32));
    mocks.startReceptionSession.mockResolvedValue(true);
  });

  it("bloqueia após 5 falhas, mesmo com a senha certa", async () => {
    const db = fakeDb(5);
    mocks.getAdminClient.mockReturnValue(db.client);
    const r = await loginReception("senha-certa");
    expect(r).toMatchObject({ ok: false });
    expect((r as { error: string }).error).toMatch(/Muitas tentativas/);
    expect(mocks.startReceptionSession).not.toHaveBeenCalled();
  });

  it("registra a falha em senha errada", async () => {
    const db = fakeDb(2);
    mocks.getAdminClient.mockReturnValue(db.client);
    expect(await loginReception("errada")).toEqual({ ok: false, error: "Senha incorreta." });
    expect(db.insert).toHaveBeenCalledOnce();
    expect(mocks.startReceptionSession).not.toHaveBeenCalled();
  });

  it("senha certa abre a sessão e zera as falhas", async () => {
    const db = fakeDb(1);
    mocks.getAdminClient.mockReturnValue(db.client);
    expect(await loginReception("senha-certa")).toEqual({ ok: true });
    expect(mocks.startReceptionSession).toHaveBeenCalledOnce();
    expect(db.del).toHaveBeenCalled();
  });

  it("recusa sem SESSION_SECRET", async () => {
    vi.stubEnv("SESSION_SECRET", "");
    expect(await loginReception("senha-certa")).toMatchObject({ ok: false });
    expect(mocks.getAdminClient).not.toHaveBeenCalled();
  });
});
