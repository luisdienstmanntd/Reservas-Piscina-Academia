import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";

import { deleteExperienceBooking, editCinemaSession, loadExperience, saveExperienceBooking, setupExperience } from "./experiences";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), admin: vi.fn(), fetch: vi.fn() }));
vi.mock("@/lib/reception-auth", () => ({ readReceptionAuthed: mocks.auth }));
vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: mocks.admin }));

const day = "2026-11-15";
const cinema = { experience: "cinema", day };
const wine = { experience: "wine", day };
const pizza = { experience: "pizza", day };
const revision = "1e3fec94-6f66-4336-b568-d0a54f83ff17";
const guest = { customer: "guest", apartment: "101", name: "Ana", revision: null };
const external = { customer: "external", name: "Maria", revision: null };

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue(true);
  mocks.admin.mockReturnValue(createClient("http://localhost:3348", "test-key", {
    auth: { persistSession: false },
    global: { fetch: mocks.fetch },
  }));
});

describe("ações das experiências", () => {
  it("recusa todas as operações sem sessão e sem tocar no banco", async () => {
    mocks.auth.mockResolvedValue(false);
    const results = await Promise.all([
      loadExperience(cinema),
      setupExperience(cinema, { title: "Filme", start_time: "21:00" }),
      saveExperienceBooking({ ...cinema, line: 1 }, guest),
      deleteExperienceBooking({ ...cinema, line: 1 }, revision),
      editCinemaSession(cinema, { title: "Filme", start_time: "21:00" }, { title: "Anterior", start_time: "19:30" }),
    ]);
    expect(results.every((result) => !result.ok)).toBe(true);
    expect(mocks.admin).not.toHaveBeenCalled();
  });

  it("valida data, horários, tipo de cliente, campos e limites antes de consultar", async () => {
    const results = await Promise.all([
      loadExperience({ ...cinema, day: "2026-02-30" }),
      setupExperience(cinema, { title: "Filme", start_time: "24:01" }),
      setupExperience(pizza, { title: "Pizza", start_time: "20:00" }),
      saveExperienceBooking({ ...cinema, line: 6 }, guest),
      saveExperienceBooking({ ...pizza, line: 9 }, { ...guest, adults: 1, children: 0 }),
      saveExperienceBooking({ ...cinema, line: 1 }, external),
      saveExperienceBooking({ ...cinema, line: 1 }, { ...guest, apartment: "999" }),
      saveExperienceBooking({ ...wine, line: 8 }, { ...guest, pax: 0 }),
      saveExperienceBooking({ ...pizza, line: 8 }, { ...external, adults: 0, children: 0 }),
      deleteExperienceBooking({ ...pizza, line: 2 }, "inválido"),
    ]);
    expect(results.every((result) => !result.ok)).toBe(true);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("ignora uma segunda configuração e retorna a sessão já gravada", async () => {
    const session = { title: "Primeiro filme", start_time: "19:00:00" };
    mocks.fetch.mockImplementation(async (url: string, options: RequestInit) =>
      response(options.method === "GET" && url.includes("experience_sessions") ? [session] : [])
    );
    expect(await setupExperience(cinema, { title: "Outro filme", start_time: "20:30" }))
      .toEqual({ ok: true, session, bookings: [] });
    const [url, options] = mocks.fetch.mock.calls[0];
    expect(new URL(url).searchParams.get("on_conflict")).toBe("experience,day");
    expect(new Headers(options.headers).get("Prefer")).toContain("resolution=ignore-duplicates");
  });

  it("edita somente a sessão de cinema que corresponde aos valores originais", async () => {
    const previous = { title: "Anterior", start_time: "19:30" };
    const next = { title: "Novo", start_time: "20:00" };
    const saved = { ...next, start_time: "20:00:00" };
    expect(await editCinemaSession(wine, next, previous)).toMatchObject({ ok: false });
    expect(mocks.fetch).not.toHaveBeenCalled();

    mocks.fetch.mockResolvedValueOnce(response([saved])).mockResolvedValueOnce(response([]));
    expect(await editCinemaSession(cinema, next, previous)).toEqual({ ok: true, session: saved });
    const [url, options] = mocks.fetch.mock.calls[0];
    expect(new URL(url).searchParams.get("title")).toBe("eq.Anterior");
    expect(new URL(url).searchParams.get("start_time")).toBe("eq.19:30");
    expect(options.method).toBe("PATCH");
    expect(await editCinemaSession(cinema, next, previous)).toMatchObject({ ok: false, conflict: true });
  });

  it("exige configuração para cinema e vinho e propaga falhas de leitura", async () => {
    mocks.fetch.mockResolvedValueOnce(response([]));
    expect(await saveExperienceBooking({ ...wine, line: 2 }, { ...guest, pax: 2 }))
      .toMatchObject({ ok: false, error: expect.stringContaining("Defina a experiência") });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    mocks.fetch.mockResolvedValueOnce(response({ message: "indisponível" }, 503));
    expect(await loadExperience(pizza)).toMatchObject({ ok: false });
  });

  it("evita sobrescrever uma linha criada ou editada por outro atendente", async () => {
    mocks.fetch.mockResolvedValueOnce(response({ code: "23505" }, 409))
      .mockResolvedValueOnce(response([]));
    const line = { ...pizza, line: 3 };
    const fields = { ...external, apartment: "101", adults: 1, children: 0 };
    expect(await saveExperienceBooking(line, fields)).toMatchObject({ ok: false, error: expect.stringContaining("outra sessão") });
    expect(await saveExperienceBooking(line, { ...fields, revision })).toMatchObject({ ok: false, error: expect.stringContaining("outra sessão") });
    const [url, options] = mocks.fetch.mock.calls[1];
    expect(new URL(url).searchParams.get("revision")).toBe(`eq.${revision}`);
    expect(JSON.parse(options.body)).toMatchObject({ apartment: null, adults: 1, children: 0, pax: null });
  });

  it("valida o celular e salva os detalhes da pizza em formato normalizado", async () => {
    const line = { ...pizza, line: 1 };
    const fields = { ...external, adults: 1, children: 0, price: "R$ 189,50", numbers: "007", complimentary: true };
    expect(await saveExperienceBooking(line, { ...fields, phone: "+1 123" })).toMatchObject({ ok: false });
    expect(mocks.fetch).not.toHaveBeenCalled();

    for (const [phone, expected] of [["(54) 99999-9999", "+5554999999999"], ["+44 7911 123456", "+447911123456"]]) {
      mocks.fetch.mockResolvedValueOnce(response([{ line: 1 }]));
      expect(await saveExperienceBooking(line, { ...fields, phone })).toMatchObject({ ok: true });
      const [, options] = mocks.fetch.mock.calls.at(-1)!;
      expect(JSON.parse(options.body)).toMatchObject({
        price_cents: 18950, numbers: "007", phone: expected, complimentary: true,
      });
    }
  });

  it("exclui apenas a revisão confirmada e informa quando ela já mudou", async () => {
    mocks.fetch.mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response([{ line: 3 }]));
    const line = { ...pizza, line: 3 };
    expect(await deleteExperienceBooking(line, revision)).toMatchObject({ ok: false });
    expect(await deleteExperienceBooking(line, revision)).toEqual({ ok: true });
    const [url, options] = mocks.fetch.mock.calls[1];
    expect(new URL(url).searchParams.get("revision")).toBe(`eq.${revision}`);
    expect(options.method).toBe("DELETE");
  });
});
