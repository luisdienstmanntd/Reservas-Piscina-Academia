"use server";

import { cookies } from "next/headers";
import { z } from "zod";

import {
  getAdminClient,
  supabaseConfigErrorMessage,
} from "@/lib/supabase/admin";
import { hotelCalendarDate } from "@/lib/hotel-time";
import { isAllowedApartmentNumber } from "@/lib/apartment-codes";
import {
  normalizeSlotStart,
  slotStartsFor,
  type Facility,
  type ReservationRow,
} from "@/lib/reservations";
import {
  RECEPTION_COOKIE,
  RECEPTION_COOKIE_VALUE,
  readReceptionAuthed,
} from "@/lib/reception-auth";
import { getValidatedGuestStay } from "@/app/actions/stays";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const apartmentStr = z
  .string()
  .trim()
  .min(1, "Informe o número do apartamento.")
  .refine((s) => isAllowedApartmentNumber(s), {
    message: "Apartamento inválido. Use um número da lista do hotel.",
  });

const facilitySchema = z.enum(["pool", "gym"]);

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
  if (password !== expected) {
    return { ok: false, error: "Senha incorreta." };
  }
  const jar = await cookies();
  jar.set(RECEPTION_COOKIE, RECEPTION_COOKIE_VALUE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 12,
    path: "/",
  });
  return { ok: true };
}

export async function logoutReception(): Promise<void> {
  const jar = await cookies();
  jar.delete(RECEPTION_COOKIE);
}

export async function getReceptionAuthState(): Promise<boolean> {
  return readReceptionAuthed();
}

/** Slots já ocupados e apartamentos que já têm reserva nesse dia (por instalação). */
export async function getReservationDaySummary(
  reservationDate: string,
  facility: Facility
): Promise<
  | { ok: true; occupiedSlots: string[]; apartmentsBooked: string[] }
  | { ok: false; error: string }
> {
  const parsed = dateStr.safeParse(reservationDate);
  if (!parsed.success) {
    return { ok: false, error: "Data inválida." };
  }
  const f = facilitySchema.safeParse(facility);
  if (!f.success) {
    return { ok: false, error: "Instalação inválida." };
  }

  if (!(await readReceptionAuthed())) {
    const stay = await getValidatedGuestStay();
    if (!stay) {
      return {
        ok: false,
        error:
          "Acesso indisponível. Use o link enviado pela recepção ou peça um novo.",
      };
    }
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
      .eq("facility", f.data);

    if (error) throw error;

    const rows = data ?? [];
    const occupiedSlots = rows.map((r) =>
      normalizeSlotStart(String(r.slot_start))
    );
    const apartmentsBooked = [
      ...new Set(rows.map((r) => String(r.apartment_number).trim())),
    ];
    return { ok: true, occupiedSlots, apartmentsBooked };
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

  const parsed = dateStr.safeParse(reservationDate);
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

const guestWhatsappRequiredSchema = z
  .string()
  .trim()
  .min(1, "Informe o seu WhatsApp.")
  .transform((s) => s.replace(/\D/g, ""))
  .refine((d) => d.length >= 10 && d.length <= 13, {
    message: "WhatsApp inválido. Use DDD + número (10 a 13 dígitos).",
  });

const guestNameOptionalSchema = z
  .string()
  .max(200, "Nome muito longo (máx. 200 caracteres).")
  .optional()
  .transform((s) => {
    if (s === undefined) return null;
    const t = s.trim();
    return t.length ? t : null;
  });

const createGuestSchema = z.object({
  facility: facilitySchema,
  reservationDate: dateStr,
  slotStart: z.string(),
  guestWhatsapp: guestWhatsappRequiredSchema,
  guestName: guestNameOptionalSchema,
});

function validateStayAndSlot(
  facility: Facility,
  reservationDate: string,
  guestCheckoutDate: string,
  slotStart: string
): string | null {
  const today = hotelCalendarDate();
  if (reservationDate < today) {
    return "Não é possível reservar datas passadas.";
  }
  if (reservationDate > guestCheckoutDate) {
    return "A data da reserva deve ser até o seu check-out.";
  }
  const norm = normalizeSlotStart(slotStart);
  const allowed = new Set(slotStartsFor(facility));
  if (!allowed.has(norm)) {
    return "Horário inválido.";
  }
  return null;
}

/** Garante que horário e apartamento estão livres (antes do insert; a BD continua a validar em corrida). */
async function assertSlotAndApartmentFree(
  supabase: NonNullable<ReturnType<typeof getAdminClient>>,
  params: {
    facility: Facility;
    reservationDate: string;
    normSlot: string;
    apartmentNumber: string;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("reservations")
    .select("slot_start, apartment_number")
    .eq("facility", params.facility)
    .eq("reservation_date", params.reservationDate);

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
          "Este apartamento já tem reserva neste dia nesta instalação. Limite: 1 hora por dia.",
      };
    }
  }
  return { ok: true };
}

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
  const stay = await getValidatedGuestStay();
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

  const free = await assertSlotAndApartmentFree(supabaseGuest, {
    facility,
    reservationDate,
    normSlot,
    apartmentNumber,
  });
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
          error:
            "Seu apartamento já possui uma reserva neste dia nesta instalação. Limite: 1 hora por dia.",
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

const guestWhatsappOptionalSchema = z
  .string()
  .optional()
  .transform((s) => {
    if (s === undefined) return null;
    const t = s.trim();
    if (!t) return null;
    return t.replace(/\D/g, "");
  })
  .refine((d) => d === null || (d.length >= 10 && d.length <= 13), {
    message:
      "WhatsApp inválido. Deixe em branco ou use DDD + número (10 a 13 dígitos).",
  });

/** Balcão: data da reserva no formulário; check-out interno = mesmo dia (só validação). */
const createReceptionSchema = z.object({
  facility: facilitySchema,
  apartmentNumber: apartmentStr,
  reservationDate: dateStr,
  slotStart: z.string(),
  notes: z.string().max(500).optional(),
  guestWhatsapp: guestWhatsappOptionalSchema,
  guestName: guestNameOptionalSchema,
});

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
  const guestCheckoutDate = reservationDate;
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

  const supabaseRec = getAdminClient();
  if (!supabaseRec) {
    return {
      ok: false,
      error: supabaseConfigErrorMessage(),
      code: "validation",
    };
  }

  const freeRec = await assertSlotAndApartmentFree(supabaseRec, {
    facility,
    reservationDate,
    normSlot,
    apartmentNumber,
  });
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
        guest_checkout_date: guestCheckoutDate,
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

  const t = guestName === null || guestName === undefined ? "" : String(guestName).trim();
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

  const digits =
    raw == null || !String(raw).trim()
      ? null
      : String(raw).replace(/\D/g, "");

  if (digits !== null && (digits.length < 10 || digits.length > 13)) {
    return {
      ok: false,
      error: "WhatsApp inválido. Use DDD + número (10 a 13 dígitos).",
      code: "validation",
    };
  }

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

export async function deleteReservation(id: string): Promise<ActionResult> {
  if (!(await readReceptionAuthed())) {
    return { ok: false, error: "Não autorizado.", code: "validation" };
  }

  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) {
    return { ok: false, error: "Reserva inválida.", code: "validation" };
  }

  const supabaseDel = getAdminClient();
  if (!supabaseDel) {
    return {
      ok: false,
      error: supabaseConfigErrorMessage(),
      code: "validation",
    };
  }

  try {
    const { error } = await supabaseDel
      .from("reservations")
      .delete()
      .eq("id", idParsed.data);

    if (error) throw error;

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
