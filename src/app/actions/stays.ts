"use server";

import { cookies } from "next/headers";

import { isoYmdDateSchema, stayApartmentSchema } from "@/lib/booking-zod";
import { isAllowedApartmentNumber } from "@/lib/apartment-codes";
import {
  GUEST_TOKEN_COOKIE,
  hotelTodayYmd,
  isCheckoutStillValid,
  parseGuestTokenInput,
} from "@/lib/guest-stay";
import { readReceptionAuthed } from "@/lib/reception-auth";
import { addDaysYmd } from "@/lib/hotel-time";
import {
  getAdminClient,
  supabaseConfigErrorMessage,
} from "@/lib/supabase/admin";

/** Limite do check-out de um link de estadia (evita link praticamente eterno). */
const MAX_STAY_DAYS = 90;

export type ValidatedGuestStay = {
  /** Id da estadia (active_stays.id), gravado em reservations.stay_id. */
  id: string;
  apartmentNumber: string;
  checkoutDate: string;
};

/**
 * Lê o cookie `guest_token`, valida na BD e devolve apto + checkout (servidor).
 * Devolve `null` quando não há estadia válida. LANÇA erro quando o banco não responde
 * (quem chama deve mostrar "sistema indisponível", sem tratar como link inválido).
 */
export async function getValidatedGuestStay(): Promise<
  ValidatedGuestStay | null
> {
  const jar = await cookies();
  const token = parseGuestTokenInput(jar.get(GUEST_TOKEN_COOKIE)?.value);
  if (!token) return null;

  const supabase = getAdminClient();
  // Falha de configuração ou do banco NÃO é "estadia inexistente": avisa quem chamou para mostrar "indisponível".
  if (!supabase) throw new Error("banco não configurado");

  const { data, error } = await supabase
    .from("active_stays")
    .select("id, apartment_number, checkout_date")
    .eq("token", token)
    .maybeSingle();

  if (error) throw new Error(`falha ao consultar a estadia: ${error.message}`);
  if (!data) return null;

  const checkoutDate = String(data.checkout_date).slice(0, 10);
  const apartmentNumber = String(data.apartment_number).trim();
  if (!isAllowedApartmentNumber(apartmentNumber)) return null;

  const today = hotelTodayYmd();
  if (!isCheckoutStillValid(checkoutDate, today)) return null;

  return { id: String(data.id), apartmentNumber, checkoutDate };
}

/**
 * Gera token de estadia (apenas recepção autenticada).
 */
export async function generateStayToken(input: {
  apartmentNumber: string;
  checkoutDate: string;
}): Promise<
  | { ok: true; token: string }
  | { ok: false; error: string }
> {
  if (!(await readReceptionAuthed())) {
    return { ok: false, error: "Sessão da recepção expirada." };
  }

  const apt = stayApartmentSchema.safeParse(input.apartmentNumber);
  const co = isoYmdDateSchema.safeParse(input.checkoutDate);
  if (!apt.success) {
    return { ok: false, error: apt.error.issues[0]?.message ?? "Apto inválido." };
  }
  if (!co.success) {
    return { ok: false, error: "Data de check-out inválida." };
  }

  const today = hotelTodayYmd();
  if (co.data < today) {
    return { ok: false, error: "Check-out não pode ser anterior a hoje." };
  }
  if (co.data > addDaysYmd(today, MAX_STAY_DAYS)) {
    return {
      ok: false,
      error: `Check-out muito distante (máximo ${MAX_STAY_DAYS} dias).`,
    };
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return { ok: false, error: supabaseConfigErrorMessage() };
  }

  const token = crypto.randomUUID();

  try {
    const { error } = await supabase.from("active_stays").insert({
      token,
      apartment_number: apt.data.trim(),
      checkout_date: co.data,
    });
    if (error) throw error;
    return { ok: true, token };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      error: "Não foi possível gerar o acesso. Tente novamente.",
    };
  }
}
