import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ALLOWED_APARTMENT_NUMBERS } from "@/lib/apartment-codes";

loadEnvConfig(process.cwd());

const FIXTURE_DATE = "2999-01-01";

function isLocalSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!url || !key) return false;
  const hostOk = url.includes("127.0.0.1") || url.includes("localhost");
  const portOk = url.includes("54321");
  return hostOk && portOk;
}

function assertLocalOnly(): void {
  if (!isLocalSupabaseConfigured()) {
    throw new Error(
      "Integração exige Supabase LOCAL: defina NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 " +
        "e SUPABASE_SERVICE_ROLE_KEY (saída de `npx supabase status`) em .env.local. " +
        "Não use credenciais de produção. Execute `npm run db:start` antes dos testes."
    );
  }
}

function createLocalAdminClient(): SupabaseClient {
  assertLocalOnly();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "23505" ||
    String(error.message ?? "").includes("23505") ||
    String(error.message ?? "").includes("duplicate key")
  );
}

async function deleteFixtureDateRows(client: SupabaseClient): Promise<void> {
  const { error } = await client
    .from("reservations")
    .delete()
    .eq("reservation_date", FIXTURE_DATE);
  if (error) throw error;
}

describe("reservas — concorrência (Supabase local)", () => {
  let supabase: SupabaseClient | undefined;

  beforeAll(async () => {
    assertLocalOnly();
    supabase = createLocalAdminClient();
    await deleteFixtureDateRows(supabase);
    const probe = await supabase.from("reservations").select("id").limit(1);
    if (probe.error) {
      throw new Error(
        `Não foi possível contactar o Supabase local: ${probe.error.message}. ` +
          "Confirme `npm run db:start` e as variáveis em .env.local."
      );
    }
  });

  beforeEach(async () => {
    if (!supabase) return;
    await deleteFixtureDateRows(supabase);
  });

  afterAll(async () => {
    if (!supabase) return;
    await deleteFixtureDateRows(supabase);
  });

  it("TESTE 1: um único vencedor no mesmo slot (pool + data + hora) — 20 apartamentos", async () => {
    if (!supabase) throw new Error("Cliente Supabase não inicializado.");
    const slot = "15:00:00";
    const apartments = ALLOWED_APARTMENT_NUMBERS.slice(0, 20);

    expect(apartments.length).toBe(20);

    const attempts = apartments.map((apartment_number) =>
      supabase!
        .from("reservations")
        .insert({
          facility: "pool",
          reservation_date: FIXTURE_DATE,
          slot_start: slot,
          apartment_number,
          guest_checkout_date: FIXTURE_DATE,
          guest_whatsapp: "11988887777",
          created_by: "reception",
        })
        .select("id")
        .maybeSingle()
    );

    const results = await Promise.all(attempts);

    const winners = results.filter((r) => !r.error && r.data?.id);
    const losers = results.filter((r) => r.error);

    expect(winners.length, "exatamente uma reserva no mesmo slot/instalação/data").toBe(
      1
    );
    expect(losers.length).toBe(19);

    const uniqueViolations = losers.filter((r) => isUniqueViolation(r.error!));
    expect(
      uniqueViolations.length,
      "falhas esperadas por violação de unicidade (slot)"
    ).toBe(19);

    for (const r of losers) {
      const msg = `${r.error?.message ?? ""} ${(r.error as { details?: string })?.details ?? ""}`;
      expect(
        msg.includes("reservations_facility_date_slot_unique") ||
          msg.includes("23505"),
        `mensagem ou código de unicidade: ${msg}`
      ).toBe(true);
    }
  });

  it("TESTE 2: um único vencedor por apartamento no mesmo dia (pool) — 5 horários", async () => {
    if (!supabase) throw new Error("Cliente Supabase não inicializado.");
    const apartment_number = "101";
    const slots = [
      "13:00:00",
      "14:00:00",
      "15:00:00",
      "16:00:00",
      "17:00:00",
    ];

    const attempts = slots.map((slot_start) =>
      supabase!
        .from("reservations")
        .insert({
          facility: "pool",
          reservation_date: FIXTURE_DATE,
          slot_start,
          apartment_number,
          guest_checkout_date: FIXTURE_DATE,
          guest_whatsapp: "11988887777",
          created_by: "reception",
        })
        .select("id")
        .maybeSingle()
    );

    const results = await Promise.all(attempts);

    const winners = results.filter((r) => !r.error && r.data?.id);
    const losers = results.filter((r) => r.error);

    expect(
      winners.length,
      "exatamente uma reserva por apartamento/dia/instalação"
    ).toBe(1);
    expect(losers.length).toBe(4);

    const uniqueViolations = losers.filter((r) => isUniqueViolation(r.error!));
    expect(
      uniqueViolations.length,
      "falhas esperadas por violação de unicidade (apartamento)"
    ).toBe(4);

    for (const r of losers) {
      const msg = `${r.error?.message ?? ""} ${(r.error as { details?: string })?.details ?? ""}`;
      expect(
        msg.includes("reservations_facility_date_apartment_unique") ||
          msg.includes("23505"),
        `mensagem ou código de unicidade: ${msg}`
      ).toBe(true);
    }
  });
});
