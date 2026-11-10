import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminClient: vi.fn(),
  readReceptionAuthed: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("@/lib/reception-auth", () => ({ readReceptionAuthed: mocks.readReceptionAuthed }));
vi.mock("@/app/actions/stays", () => ({ getValidatedGuestStay: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: mocks.getAdminClient,
  supabaseConfigErrorMessage: () => "sem banco",
}));

import { listNewReservations } from "./reservations";

function fakeDb() {
  const calls: { select?: string; eq: Array<[string, unknown]>; gte?: [string, string]; limit?: number } = { eq: [] };
  const q: Record<string, unknown> = {};
  q.eq = (c: string, v: unknown) => (calls.eq.push([c, v]), q);
  q.gte = (c: string, v: string) => ((calls.gte = [c, v]), q);
  q.order = () => q;
  // A 1ª consulta é das reservas novas (created_at); a 2ª, das trocas de horário (guest_rescheduled_at).
  q.limit = (n: number) => (
    (calls.limit = n),
    Promise.resolve({ data: calls.gte?.[0] === "created_at" ? [{ id: "n1" }] : [], error: null })
  );
  mocks.getAdminClient.mockReturnValue({ from: () => ({ select: (cols: string) => ((calls.select = cols), q) }) });
  return calls;
}

describe("listNewReservations", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.readReceptionAuthed.mockResolvedValue(true);
  });

  it("só a recepção pode chamar (sem tocar no banco)", async () => {
    mocks.readReceptionAuthed.mockResolvedValue(false);
    expect(await listNewReservations(new Date().toISOString())).toMatchObject({ ok: false, unauthorized: true });
    expect(mocks.getAdminClient).not.toHaveBeenCalled();
  });

  it("primeira chamada só inicializa o marcador, sem consultar o banco", async () => {
    const r = await listNewReservations(null);
    expect(r).toMatchObject({ ok: true, items: [] });
    expect(r.ok && Number.isFinite(Date.parse(r.cursor))).toBe(true);
    expect(mocks.getAdminClient).not.toHaveBeenCalled();
  });

  it("marcador inválido é recusado", async () => {
    expect(await listNewReservations("ontem")).toMatchObject({ ok: false });
  });

  it("consulta só reservas ativas, sem nome nem WhatsApp, com sobreposição e limite", async () => {
    const calls = fakeDb();
    const since = new Date(Date.now() - 60_000).toISOString();
    const r = await listNewReservations(since);
    expect(r).toMatchObject({ ok: true, items: [{ id: "n1" }] });
    expect(calls.eq).toContainEqual(["status", "active"]);
    expect(calls.select).not.toMatch(/guest_name|guest_whatsapp|notes/);
    expect(calls.limit).toBe(50);
    // sobreposição de 10 s antes do marcador
    expect(Date.parse(calls.gte![1])).toBe(Date.parse(since) - 10_000);
  });

  it("limita a busca às últimas 24 horas mesmo com marcador muito antigo", async () => {
    const calls = fakeDb();
    const antes = Date.now();
    await listNewReservations(new Date(antes - 30 * 24 * 3600_000).toISOString());
    const from = Date.parse(calls.gte![1]);
    expect(from).toBeGreaterThanOrEqual(antes - 24 * 3600_000 - 1000);
    expect(from).toBeLessThanOrEqual(Date.now() - 24 * 3600_000 + 1000);
  });
});
