import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

loadEnvConfig(process.cwd());

/**
 * Retenção: só o WhatsApp é apagado, 365 dias depois do check-out.
 * Roda SOMENTE em Supabase/Postgres local (nunca na produção). Requer a migration
 * 20261112100000_retention_whatsapp_365.sql aplicada no banco de teste.
 * Atenção: a rotina vale para o banco todo; em um banco local com outras reservas antigas ela
 * também apaga o WhatsApp delas (use um banco de teste descartável, como o do `db:reset`).
 */
const FIXTURE_DATE = "2999-03-01";

function assertLocalOnly(): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  const local = (url.includes("127.0.0.1") || url.includes("localhost")) && url.includes("54321");
  if (!url || !key || !local) {
    throw new Error(
      "Integração exige Supabase LOCAL (http://127.0.0.1:54321). Não use credenciais de produção."
    );
  }
}

function client(): SupabaseClient {
  assertLocalOnly();
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(), process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function wipe(db: SupabaseClient): Promise<void> {
  const { error } = await db.from("reservations").delete().eq("reservation_date", FIXTURE_DATE);
  if (error) throw error;
}

const base = {
  facility: "pool",
  reservation_date: FIXTURE_DATE,
  guest_whatsapp: "+5511999990001",
  created_by: "guest",
};

async function seed(db: SupabaseClient) {
  const rows = [
    // A: ativa, check-out = dia da reserva
    { ...base, slot_start: "15:00:00", apartment_number: "101", guest_name: "ANA SOUZA", notes: "ESPUMANTE", guest_checkout_date: FIXTURE_DATE },
    // B: cancelada (o histórico fica; o WhatsApp também vence)
    { ...base, slot_start: "16:00:00", apartment_number: "102", guest_name: "CARLOS LIMA", notes: "SEM GLÚTEN", guest_checkout_date: FIXTURE_DATE, status: "cancelled", cancelled_at: "2999-03-01T10:00:00Z", cancelled_by: "reception" },
    // C: check-out 9 dias depois: o marco é o check-out
    { ...base, slot_start: "17:00:00", apartment_number: "103", guest_name: "BEATRIZ", notes: null, guest_checkout_date: "2999-03-10" },
    // D: já anonimizada pelo job antigo: não é tocada
    { ...base, slot_start: "18:00:00", apartment_number: "104", guest_name: null, notes: null, guest_whatsapp: null, anonymized: true, guest_checkout_date: FIXTURE_DATE },
  ];
  const { error } = await db.from("reservations").insert(rows);
  if (error) throw error;
}

async function byApt(db: SupabaseClient, apt: string) {
  const { data, error } = await db
    .from("reservations")
    .select("*")
    .eq("reservation_date", FIXTURE_DATE)
    .eq("apartment_number", apt)
    .single();
  if (error) throw error;
  return data as Record<string, unknown>;
}

describe("retenção do WhatsApp (Postgres local)", () => {
  let db: SupabaseClient;

  beforeAll(async () => {
    db = client();
    await wipe(db);
  });
  beforeEach(async () => {
    await wipe(db);
    await seed(db);
  });
  afterAll(async () => {
    if (db) await wipe(db);
  });

  const run = async (today: string): Promise<number> => {
    const { data, error } = await db.rpc("anonymize_old_whatsapp", { p_today: today });
    if (error) throw error;
    return data as number;
  };

  it("dia 365 após o check-out ainda mantém o WhatsApp; dia 366 apaga", async () => {
    await run("3000-03-01"); // 365 dias após 2999-03-01
    expect((await byApt(db, "101")).guest_whatsapp).toBe("+5511999990001");
    expect((await byApt(db, "102")).guest_whatsapp).toBe("+5511999990001");
    expect(await run("3000-03-02")).toBeGreaterThanOrEqual(2); // 366 dias: A e B (o banco pode ter outras linhas)
    expect((await byApt(db, "101")).guest_whatsapp).toBeNull();
    expect((await byApt(db, "102")).guest_whatsapp).toBeNull();
  });

  it("usa o check-out como marco (não a data da reserva)", async () => {
    await run("3000-03-02");
    expect((await byApt(db, "103")).guest_whatsapp).toBe("+5511999990001"); // marco 2999-03-10
    await run("3000-03-10"); // dia 365 do check-out: ainda mantido
    expect((await byApt(db, "103")).guest_whatsapp).toBe("+5511999990001");
    expect(await run("3000-03-11")).toBeGreaterThanOrEqual(1); // dia 366
    expect((await byApt(db, "103")).guest_whatsapp).toBeNull();
  });

  it("nome, apartamento, observações, status e datas NÃO mudam; nenhuma linha some", async () => {
    const antes = await Promise.all(["101", "102", "103", "104"].map((a) => byApt(db, a)));
    await run("3999-01-01");
    const depois = await Promise.all(["101", "102", "103", "104"].map((a) => byApt(db, a)));
    expect(depois).toHaveLength(4);
    for (let i = 0; i < 4; i++) {
      for (const col of ["apartment_number", "guest_name", "notes", "status", "cancelled_by", "reservation_date", "slot_start", "facility", "created_by", "guest_checkout_date", "anonymized"]) {
        expect(depois[i][col], `${col} da linha ${i}`).toEqual(antes[i][col]);
      }
    }
    expect(depois[1].status).toBe("cancelled"); // cancelada continua no histórico
  });

  it("marca quando o WhatsApp foi apagado e é idempotente", async () => {
    expect(await run("3000-03-02")).toBeGreaterThanOrEqual(2);
    expect((await byApt(db, "101")).whatsapp_anonymized_at).not.toBeNull();
    expect((await byApt(db, "103")).whatsapp_anonymized_at).toBeNull();
    expect(await run("3000-03-02")).toBe(0);
  });

  it("não toca em reservas já anonimizadas pelo job antigo", async () => {
    await run("3999-01-01");
    const d = await byApt(db, "104");
    expect(d).toMatchObject({ anonymized: true, guest_name: null, guest_whatsapp: null, whatsapp_anonymized_at: null });
  });

  it("a remoção fica na auditoria como evento do sistema (só o campo WhatsApp)", async () => {
    await run("3000-03-02");
    const a = await byApt(db, "101");
    const { data, error } = await db
      .from("reservation_events")
      .select("event_type, actor, changed_fields")
      .eq("reservation_id", a.id as string)
      .eq("actor", "system");
    if (error) throw error;
    expect(data).toEqual([{ event_type: "updated", actor: "system", changed_fields: ["guest_whatsapp"] }]);
  });

  it("só o service_role pode executar a rotina", async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
    const anon = createClient(url, process.env.SUPABASE_ANON_KEY?.trim() || "anon-sem-permissao", {
      auth: { persistSession: false },
    });
    const { error } = await anon.rpc("anonymize_old_whatsapp", { p_today: "3999-01-01" });
    expect(error).not.toBeNull();
  });
});
