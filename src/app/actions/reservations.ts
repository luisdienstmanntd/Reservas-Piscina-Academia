"use server";

import { headers } from "next/headers";
import { z } from "zod";

import {
  FORBIDDEN_TEXT,
  FORBIDDEN_TEXT_MESSAGE,
  guestWhatsappOptionalSchema,
  createGuestSchema,
  createReceptionSchema,
  facilitySchema,
  isoYmdDateSchema,
} from "@/lib/booking-zod";
import {
  getAdminClient,
  supabaseConfigErrorMessage,
} from "@/lib/supabase/admin";
import {
  normalizeSlotStart,
  type Facility,
  type ReservationRow,
} from "@/lib/reservations";
import { validateStayAndSlot } from "@/lib/reservation-slot-validation";
import {
  MAX_LOOKBACK_MS,
  OVERLAP_MS,
  type NewReservationItem,
} from "@/lib/new-reservations";
import {
  endReceptionSession,
  readReceptionAuthed,
  startReceptionSession,
} from "@/lib/reception-auth";
import { getSessionSecret, passwordsMatch } from "@/lib/reception-session";
import {
  clientIpFromHeaders,
  hashClientKey,
  isLoginBlocked,
  loginWindowStartIso,
  LOGIN_WINDOW_MINUTES,
} from "@/lib/login-rate-limit";
import { getValidatedGuestStay } from "@/app/actions/stays";
import {
  upcomingReservations,
  type MyReservation,
} from "@/lib/my-reservations";
import { hotelCalendarDate } from "@/lib/hotel-time";

function isPostgresUniqueViolation(err: unknown): boolean {
  const o = err as { code?: string; message?: string };
  return o?.code === "23505" || String(o?.message ?? "").includes("23505");
}

function uniqueViolationKind(err: unknown): "slot" | "apartment" | "unknown" {
  const text = `${(err as { message?: string })?.message ?? ""} ${(err as { details?: string })?.details ?? ""}`;
  if (text.includes("reservations_facility_date_slot_unique")) return "slot";
  if (text.includes("reservations_facility_date_apartment_unique"))
    return "apartment";
  if (text.includes("reservations_date_slot_unique")) return "slot";
  if (text.includes("reservations_date_apartment_unique")) return "apartment";
  return "unknown";
}

export async function loginReception(
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const expected = process.env.RECEPTION_PASSWORD;
  if (!expected) {
    return { ok: false, error: "Defina RECEPTION_PASSWORD no servidor." };
  }
  const secret = getSessionSecret();
  if (!secret) {
    return {
      ok: false,
      error: "Defina SESSION_SECRET (mínimo 32 caracteres) no servidor.",
    };
  }
  const supabase = getAdminClient();
  if (!supabase) {
    return { ok: false, error: supabaseConfigErrorMessage() };
  }

  const clientKey = hashClientKey(clientIpFromHeaders(await headers()), secret);

  // Falha fechada: sem conseguir consultar o limite, não autentica.
  const { count, error: countError } = await supabase
    .from("login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("client_key", clientKey)
    .gte("attempted_at", loginWindowStartIso());
  if (countError) {
    console.error("[loginReception] rate limit", countError.message);
    return { ok: false, error: "Não foi possível validar o login. Tente novamente." };
  }
  if (isLoginBlocked(count ?? 0)) {
    return {
      ok: false,
      error: `Muitas tentativas. Aguarde ${LOGIN_WINDOW_MINUTES} minutos e tente novamente.`,
    };
  }

  if (!passwordsMatch(password, expected)) {
    const { error: insertError } = await supabase
      .from("login_attempts")
      .insert({ client_key: clientKey });
    if (insertError) {
      console.error("[loginReception] registro de falha", insertError.message);
    }
    // Limpeza oportunista de registros com mais de 1 dia.
    await supabase
      .from("login_attempts")
      .delete()
      .lt("attempted_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    return { ok: false, error: "Senha incorreta." };
  }

  await supabase.from("login_attempts").delete().eq("client_key", clientKey);
  if (!(await startReceptionSession())) {
    return {
      ok: false,
      error: "Defina SESSION_SECRET (mínimo 32 caracteres) no servidor.",
    };
  }
  return { ok: true };
}

export async function logoutReception(): Promise<void> {
  await endReceptionSession();
}

export async function getReceptionAuthState(): Promise<boolean> {
  return readReceptionAuthed();
}

/** Slots já ocupados e apartamentos que já têm reserva nesse dia (por instalação). */
export async function getReservationDaySummary(
  reservationDate: string,
  facility: Facility
): Promise<
  | {
      ok: true;
      occupiedSlots: string[];
      /** Apartamentos com reserva no dia. Só a recepção recebe a lista; o hóspede recebe `[]`. */
      apartmentsBooked: string[];
      /** O apartamento do próprio hóspede (da estadia validada no servidor) já tem reserva neste dia? Sempre `false` para a recepção. */
      ownApartmentBooked: boolean;
      /** Hora do servidor: a tela usa para decidir o que já passou, sem depender do relógio do aparelho. */
      serverNowMs: number;
    }
  | { ok: false; error: string }
> {
  const parsed = isoYmdDateSchema.safeParse(reservationDate);
  if (!parsed.success) {
    return { ok: false, error: "Data inválida." };
  }
  const f = facilitySchema.safeParse(facility);
  if (!f.success) {
    return { ok: false, error: "Instalação inválida." };
  }

  const isReception = await readReceptionAuthed();
  let ownApartment: string | null = null;
  if (!isReception) {
    let stay: Awaited<ReturnType<typeof getValidatedGuestStay>>;
    try {
      stay = await getValidatedGuestStay();
    } catch (e) {
      console.error(e);
      return { ok: false, error: SYSTEM_UNAVAILABLE_MESSAGE };
    }
    if (!stay) {
      return {
        ok: false,
        error:
          "Acesso indisponível. Use o link enviado pela recepção ou peça um novo.",
      };
    }
    ownApartment = stay.apartmentNumber;
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return { ok: false, error: supabaseConfigErrorMessage() };
  }

  try {
    const { data, error } = await supabase
      .from("reservations")
      .select("slot_start, apartment_number")
      .eq("reservation_date", parsed.data)
      .eq("facility", f.data)
      .eq("status", "active");

    if (error) throw error;

    const rows = data ?? [];
    const occupiedSlots = rows.map((r) =>
      normalizeSlotStart(String(r.slot_start))
    );
    const apartmentsBooked = [
      ...new Set(rows.map((r) => String(r.apartment_number).trim())),
    ];
    return {
      ok: true,
      occupiedSlots,
      // Privacidade: o hóspede não vê quais outros apartamentos reservaram.
      apartmentsBooked: isReception ? apartmentsBooked : [],
      ownApartmentBooked:
        ownApartment !== null && apartmentsBooked.includes(ownApartment.trim()),
      serverNowMs: Date.now(),
    };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      error:
        "Não foi possível carregar os horários. Verifique a conexão e tente de novo.",
    };
  }
}

export async function getOccupiedSlotsForDate(
  reservationDate: string,
  facility: Facility
): Promise<
  { ok: true; slots: string[] } | { ok: false; error: string }
> {
  const r = await getReservationDaySummary(reservationDate, facility);
  if (!r.ok) return r;
  return { ok: true, slots: r.occupiedSlots };
}

export async function getReservationsForDate(
  reservationDate: string,
  facility: Facility
): Promise<
  | { ok: true; rows: ReservationRow[] }
  | { ok: false; error: string; unauthorized?: boolean }
> {
  if (!(await readReceptionAuthed())) {
    return {
      ok: false,
      error: "Sessão da recepção expirada.",
      unauthorized: true,
    };
  }

  const parsed = isoYmdDateSchema.safeParse(reservationDate);
  if (!parsed.success) {
    return { ok: false, error: "Data inválida." };
  }
  const f = facilitySchema.safeParse(facility);
  if (!f.success) {
    return { ok: false, error: "Instalação inválida." };
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return { ok: false, error: supabaseConfigErrorMessage() };
  }

  try {
    const { data, error } = await supabase
      .from("reservations")
      .select("*")
      .eq("reservation_date", parsed.data)
      .eq("facility", f.data)
      .eq("status", "active")
      .order("slot_start", { ascending: true });

    if (error) throw error;

    return { ok: true, rows: (data ?? []) as ReservationRow[] };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      error:
        "Não foi possível carregar as reservas. Verifique a conexão e tente de novo.",
    };
  }
}

/** Garante que horário e apartamento estão livres (antes do insert; a BD continua a validar em corrida). */
async function assertSlotAndApartmentFree(
  supabase: NonNullable<ReturnType<typeof getAdminClient>>,
  params: {
    facility: Facility;
    reservationDate: string;
    normSlot: string;
    apartmentNumber: string;
    apartmentConflictMessage?: string;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("reservations")
    .select("slot_start, apartment_number")
    .eq("facility", params.facility)
    .eq("reservation_date", params.reservationDate)
    .eq("status", "active");

  if (error) throw error;

  const apt = params.apartmentNumber.trim();
  for (const r of data ?? []) {
    if (normalizeSlotStart(String(r.slot_start)) === params.normSlot) {
      return {
        ok: false,
        error: "Este horário já está reservado. Escolha outro.",
      };
    }
    if (String(r.apartment_number).trim() === apt) {
      return {
        ok: false,
        error:
          params.apartmentConflictMessage ??
          "Este apartamento já tem reserva neste dia nesta instalação. Limite: 1 hora por dia.",
      };
    }
  }
  return { ok: true };
}

const SYSTEM_UNAVAILABLE_MESSAGE =
  "Sistema temporariamente indisponível. Seu acesso continua válido: tente de novo em instantes.";

const GUEST_DAILY_LIMIT_MESSAGE =
  "Limite diário atingido. Para reservar mais de 1 horário nesta data, consulte a recepção.";

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string; code?: "network" | "validation" | "conflict" };

export async function createGuestReservation(input: {
  facility: Facility;
  reservationDate: string;
  slotStart: string;
  guestWhatsapp: string;
  guestName?: string;
}): Promise<ActionResult<{ id: string }>> {
  let stay: Awaited<ReturnType<typeof getValidatedGuestStay>>;
  try {
    stay = await getValidatedGuestStay();
  } catch (e) {
    console.error(e);
    return { ok: false, error: SYSTEM_UNAVAILABLE_MESSAGE, code: "network" };
  }
  if (!stay) {
    return {
      ok: false,
      error:
        "Acesso indisponível ou estadia expirada. Peça um novo link na recepção.",
      code: "validation",
    };
  }

  const parsed = createGuestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
      code: "validation",
    };
  }

  const {
    facility,
    reservationDate,
    slotStart,
    guestWhatsapp,
    guestName,
  } = parsed.data;
  const apartmentNumber = stay.apartmentNumber;
  const guestCheckoutDate = stay.checkoutDate;
  const v = validateStayAndSlot(
    facility,
    reservationDate,
    guestCheckoutDate,
    slotStart
  );
  if (v) {
    return { ok: false, error: v, code: "validation" };
  }

  const normSlot = normalizeSlotStart(slotStart);

  const supabaseGuest = getAdminClient();
  if (!supabaseGuest) {
    return {
      ok: false,
      error: supabaseConfigErrorMessage(),
      code: "validation",
    };
  }

  let free: Awaited<ReturnType<typeof assertSlotAndApartmentFree>>;
  try {
    free = await assertSlotAndApartmentFree(supabaseGuest, {
      facility,
      reservationDate,
      normSlot,
      apartmentNumber,
      apartmentConflictMessage: GUEST_DAILY_LIMIT_MESSAGE,
    });
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      error: "Não foi possível verificar o horário. Tente novamente.",
      code: "network",
    };
  }
  if (!free.ok) {
    return { ok: false, error: free.error, code: "conflict" };
  }

  try {
    const { data, error } = await supabaseGuest
      .from("reservations")
      .insert({
        facility,
        reservation_date: reservationDate,
        slot_start: normSlot,
        apartment_number: apartmentNumber.trim(),
        guest_checkout_date: guestCheckoutDate,
        stay_id: stay.id,
        guest_whatsapp: guestWhatsapp,
        guest_name: guestName,
        created_by: "guest",
      })
      .select("id")
      .single();

    if (error) throw error;

    return { ok: true, data: { id: data.id as string } };
  } catch (e) {
    if (isPostgresUniqueViolation(e)) {
      const kind = uniqueViolationKind(e);
      if (kind === "slot") {
        return {
          ok: false,
          error:
            "Este horário acabou de ser reservado por outro hóspede. Escolha outro.",
          code: "conflict",
        };
      }
      if (kind === "apartment") {
        return {
          ok: false,
          error: GUEST_DAILY_LIMIT_MESSAGE,
          code: "conflict",
        };
      }
    }
    console.error(e);
    return {
      ok: false,
      error:
        "Não foi possível concluir a reserva (rede ou servidor). Os seus dados continuam no formulário — tente novamente.",
      code: "network",
    };
  }
}

export async function createReceptionReservation(input: {
  facility: Facility;
  apartmentNumber: string;
  reservationDate: string;
  slotStart: string;
  guestWhatsapp?: string;
  guestName?: string;
  notes?: string;
}): Promise<ActionResult<{ id: string }>> {
  if (!(await readReceptionAuthed())) {
    return { ok: false, error: "Não autorizado.", code: "validation" };
  }

  const parsed = createReceptionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados inválidos.",
      code: "validation",
    };
  }

  const {
    facility,
    apartmentNumber,
    reservationDate,
    slotStart,
    notes,
    guestWhatsapp,
    guestName,
  } = parsed.data;
  // Balcão não informa check-out: grava NULL em vez de inventar um valor.
  const v = validateStayAndSlot(facility, reservationDate, null, slotStart);
  if (v) {
    return { ok: false, error: v, code: "validation" };
  }

  const normSlot = normalizeSlotStart(slotStart);

  const supabaseRec = getAdminClient();
  if (!supabaseRec) {
    return {
      ok: false,
      error: supabaseConfigErrorMessage(),
      code: "validation",
    };
  }

  let freeRec: Awaited<ReturnType<typeof assertSlotAndApartmentFree>>;
  try {
    freeRec = await assertSlotAndApartmentFree(supabaseRec, {
      facility,
      reservationDate,
      normSlot,
      apartmentNumber,
    });
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      error: "Não foi possível verificar o horário. Tente novamente.",
      code: "network",
    };
  }
  if (!freeRec.ok) {
    return { ok: false, error: freeRec.error, code: "conflict" };
  }

  try {
    const { data, error } = await supabaseRec
      .from("reservations")
      .insert({
        facility,
        reservation_date: reservationDate,
        slot_start: normSlot,
        apartment_number: apartmentNumber.trim(),
        guest_checkout_date: null,
        guest_whatsapp: guestWhatsapp,
        guest_name: guestName,
        created_by: "reception",
        notes: notes?.trim() || null,
      })
      .select("id")
      .single();

    if (error) throw error;

    return { ok: true, data: { id: data.id as string } };
  } catch (e) {
    if (isPostgresUniqueViolation(e)) {
      const kind = uniqueViolationKind(e);
      if (kind === "slot") {
        return {
          ok: false,
          error: "Este horário já está ocupado.",
          code: "conflict",
        };
      }
      if (kind === "apartment") {
        return {
          ok: false,
          error: "Este apartamento já tem reserva neste dia nesta instalação.",
          code: "conflict",
        };
      }
    }
    console.error(e);
    return {
      ok: false,
      error: "Falha ao salvar. Verifique a conexão e tente novamente.",
      code: "network",
    };
  }
}

export async function updateReservationGuestName(
  id: string,
  guestName: string | null
): Promise<ActionResult> {
  if (!(await readReceptionAuthed())) {
    return { ok: false, error: "Não autorizado.", code: "validation" };
  }

  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) {
    return { ok: false, error: "Reserva inválida.", code: "validation" };
  }

  if (guestName !== null && guestName !== undefined && typeof guestName !== "string") {
    return { ok: false, error: "Nome inválido.", code: "validation" };
  }
  const t = guestName === null || guestName === undefined ? "" : String(guestName).trim();
  if (FORBIDDEN_TEXT.test(t)) {
    return { ok: false, error: FORBIDDEN_TEXT_MESSAGE, code: "validation" };
  }
  if (t.length > 200) {
    return {
      ok: false,
      error: "Nome muito longo (máx. 200 caracteres).",
      code: "validation",
    };
  }
  const normalized = t.length ? t : null;

  const supabaseGn = getAdminClient();
  if (!supabaseGn) {
    return {
      ok: false,
      error: supabaseConfigErrorMessage(),
      code: "validation",
    };
  }

  try {
    const { error } = await supabaseGn
      .from("reservations")
      .update({ guest_name: normalized })
      .eq("id", idParsed.data);

    if (error) throw error;

    return { ok: true };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      error: "Não foi possível atualizar o nome.",
      code: "network",
    };
  }
}

export async function updateReservationNotes(
  id: string,
  notes: string | null
): Promise<ActionResult> {
  if (!(await readReceptionAuthed())) {
    return { ok: false, error: "Não autorizado.", code: "validation" };
  }

  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) {
    return { ok: false, error: "Reserva inválida.", code: "validation" };
  }

  if (notes !== null && notes !== undefined && typeof notes !== "string") {
    return { ok: false, error: "Observações inválidas.", code: "validation" };
  }
  const t = notes === null || notes === undefined ? "" : String(notes).trim();
  if (FORBIDDEN_TEXT.test(t)) {
    return { ok: false, error: FORBIDDEN_TEXT_MESSAGE, code: "validation" };
  }
  if (t.length > 2000) {
    return {
      ok: false,
      error: "Observações muito longas (máx. 2000 caracteres).",
      code: "validation",
    };
  }
  const normalized = t.length ? t : null;

  const supabaseNotes = getAdminClient();
  if (!supabaseNotes) {
    return {
      ok: false,
      error: supabaseConfigErrorMessage(),
      code: "validation",
    };
  }

  try {
    const { data, error } = await supabaseNotes
      .from("reservations")
      .update({ notes: normalized })
      .eq("id", idParsed.data)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) return { ok: false, error: "Reserva não encontrada.", code: "validation" };

    return { ok: true };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      error: "Não foi possível atualizar as observações.",
      code: "network",
    };
  }
}

export async function updateReservationGuestWhatsapp(
  id: string,
  raw: string | null
): Promise<ActionResult> {
  if (!(await readReceptionAuthed())) {
    return { ok: false, error: "Não autorizado.", code: "validation" };
  }

  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) {
    return { ok: false, error: "Reserva inválida.", code: "validation" };
  }

  const phoneParsed = guestWhatsappOptionalSchema.safeParse(raw);
  if (!phoneParsed.success) {
    return {
      ok: false,
      error: phoneParsed.error.issues[0]?.message ?? "WhatsApp inválido.",
      code: "validation",
    };
  }
  const digits = phoneParsed.data;

  const supabaseWaEdit = getAdminClient();
  if (!supabaseWaEdit) {
    return {
      ok: false,
      error: supabaseConfigErrorMessage(),
      code: "validation",
    };
  }

  try {
    const { error } = await supabaseWaEdit
      .from("reservations")
      .update({ guest_whatsapp: digits })
      .eq("id", idParsed.data);

    if (error) throw error;

    return { ok: true };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      error: "Não foi possível atualizar o WhatsApp.",
      code: "network",
    };
  }
}

const waMessageTypeSchema = z.enum(["confirmation", "warning"]);

export async function markMessageAsSent(
  id: string,
  type: "confirmation" | "warning"
): Promise<ActionResult> {
  if (!(await readReceptionAuthed())) {
    return { ok: false, error: "Não autorizado.", code: "validation" };
  }

  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) {
    return { ok: false, error: "Reserva inválida.", code: "validation" };
  }

  const t = waMessageTypeSchema.safeParse(type);
  if (!t.success) {
    return { ok: false, error: "Tipo de mensagem inválido.", code: "validation" };
  }

  const supabaseWa = getAdminClient();
  if (!supabaseWa) {
    return {
      ok: false,
      error: supabaseConfigErrorMessage(),
      code: "validation",
    };
  }

  const patch =
    t.data === "confirmation"
      ? { confirmation_sent: true }
      : { warning_sent: true };

  try {
    const { error } = await supabaseWa
      .from("reservations")
      .update(patch)
      .eq("id", idParsed.data);

    if (error) throw error;

    return { ok: true };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      error: "Não foi possível atualizar o registo.",
      code: "network",
    };
  }
}

/** Cancela a reserva mantendo a linha no banco (soft delete) e liberando horário/apartamento. */
export async function cancelReservation(id: string): Promise<ActionResult> {
  if (!(await readReceptionAuthed())) {
    return { ok: false, error: "Não autorizado.", code: "validation" };
  }

  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) {
    return { ok: false, error: "Reserva inválida.", code: "validation" };
  }

  const supabaseCancel = getAdminClient();
  if (!supabaseCancel) {
    return {
      ok: false,
      error: supabaseConfigErrorMessage(),
      code: "validation",
    };
  }

  try {
    const { data, error } = await supabaseCancel
      .from("reservations")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by: "reception",
      })
      .eq("id", idParsed.data)
      .eq("status", "active")
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return {
        ok: false,
        error: "Reserva não encontrada ou já cancelada.",
        code: "validation",
      };
    }

    return { ok: true };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      error: "Não foi possível cancelar. Tente novamente.",
      code: "network",
    };
  }
}

/**
 * Reservas novas (de qualquer dia e instalação) criadas depois de `since`, para a recepção ser avisada.
 * Só a recepção pode chamar. Não devolve dados pessoais (sem nome nem WhatsApp).
 * `since` nulo = só inicializa o marcador. O marcador devolvido (`cursor`) é a hora do servidor
 * ANTES da consulta; a busca tem uma pequena sobreposição, e a tela descarta repetidas pelo id.
 */
export async function listNewReservations(since: string | null): Promise<
  | { ok: true; items: NewReservationItem[]; cursor: string }
  | { ok: false; error: string; unauthorized?: boolean }
> {
  if (!(await readReceptionAuthed())) {
    return { ok: false, error: "Sessão da recepção expirada.", unauthorized: true };
  }
  const nowMs = Date.now();
  const cursor = new Date(nowMs).toISOString();
  if (since === null) return { ok: true, items: [], cursor };

  const sinceMs = Date.parse(since);
  if (!Number.isFinite(sinceMs)) {
    return { ok: false, error: "Marcador inválido." };
  }
  const from = new Date(
    Math.max(sinceMs - OVERLAP_MS, nowMs - MAX_LOOKBACK_MS)
  ).toISOString();

  const supabase = getAdminClient();
  if (!supabase) return { ok: false, error: supabaseConfigErrorMessage() };

  try {
    const { data, error } = await supabase
      .from("reservations")
      .select(
        "id, facility, reservation_date, slot_start, apartment_number, created_by, created_at"
      )
      .eq("status", "active")
      .gte("created_at", from)
      .order("created_at", { ascending: true })
      .limit(50);
    if (error) throw error;
    return { ok: true, items: (data ?? []) as NewReservationItem[], cursor };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Não foi possível verificar novas reservas." };
  }
}

/**
 * Reservas ativas do hóspede (apto da estadia do link) de hoje até o check-out,
 * para a página inicial. Só vê o próprio apartamento; inclui as feitas pela recepção
 * (sem estadia) e as feitas por este link, e exclui as de outra estadia.
 * Sem estadia válida devolve lista vazia; erro de banco devolve `ok:false`.
 */
export async function listMyReservations(): Promise<
  { ok: true; items: MyReservation[] } | { ok: false }
> {
  let stay: Awaited<ReturnType<typeof getValidatedGuestStay>>;
  try {
    stay = await getValidatedGuestStay();
  } catch {
    return { ok: false };
  }
  if (!stay) return { ok: true, items: [] };

  const supabase = getAdminClient();
  if (!supabase) return { ok: false };

  const todayYmd = hotelCalendarDate();
  const { data, error } = await supabase
    .from("reservations")
    .select("id, facility, reservation_date, slot_start, stay_id")
    .eq("apartment_number", stay.apartmentNumber)
    .eq("status", "active")
    .gte("reservation_date", todayYmd)
    .lte("reservation_date", stay.checkoutDate)
    .limit(100);
  if (error || !data) return { ok: false };

  const rows: MyReservation[] = data.flatMap((row) => {
    // Reserva de outra estadia do mesmo apartamento não é deste hóspede.
    if (row.stay_id && String(row.stay_id) !== stay.id) return [];
    const f = facilitySchema.safeParse(row.facility);
    if (!f.success) return [];
    return [
      {
        id: String(row.id),
        facility: f.data,
        dateYmd: String(row.reservation_date).slice(0, 10),
        slotStart: String(row.slot_start),
      },
    ];
  });
  return { ok: true, items: upcomingReservations(rows, todayYmd, Date.now()) };
}
