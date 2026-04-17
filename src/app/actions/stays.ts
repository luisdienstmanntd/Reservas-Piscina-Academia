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
import {
  getAdminClient,
  supabaseConfigErrorMessage,
} from "@/lib/supabase/admin";

export type ValidatedGuestStay = {
  apartmentNumber: string;
  checkoutDate: string;
};

/**
 * Lê o cookie `guest_token`, valida na BD e devolve apto + checkout (servidor).
 */
export async function getValidatedGuestStay(): Promise<
  ValidatedGuestStay | null
> {
  const jar = await cookies();
  const token = parseGuestTokenInput(jar.get(GUEST_TOKEN_COOKIE)?.value);
  if (!token) return null;

  const supabase = getAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("active_stays")
    .select("apartment_number, checkout_date")
    .eq("token", token)
    .maybeSingle();

  if (error || !data) return null;

  const checkoutDate = String(data.checkout_date).slice(0, 10);
  const apartmentNumber = String(data.apartment_number).trim();
  if (!isAllowedApartmentNumber(apartmentNumber)) return null;

  const today = hotelTodayYmd();
  if (!isCheckoutStillValid(checkoutDate, today)) return null;

  return { apartmentNumber, checkoutDate };
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
