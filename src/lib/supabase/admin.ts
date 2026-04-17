import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const CONFIG_MSG =
  "Base de dados não configurada. Crie .env.local na raiz com NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.";

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(url?.trim() && key?.trim());
}

export function supabaseConfigErrorMessage(): string {
  return CONFIG_MSG;
}

/**
 * Cliente Supabase com service role — usar APENAS em Server Actions / Route Handlers.
 * Retorna `null` se faltar configuração (não lança exceção).
 */
export function getAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
