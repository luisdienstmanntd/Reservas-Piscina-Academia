"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";

import { isAllowedApartmentNumber } from "@/lib/apartment-codes";
import { experiences, type ExperienceBooking, type ExperienceSession } from "@/lib/experiences";
import { readReceptionAuthed } from "@/lib/reception-auth";
import { getAdminClient } from "@/lib/supabase/admin";

const keySchema = z.object({
  experience: z.enum(["cinema", "wine", "pizza"]),
  day: z.string().date(),
});
const lineSchema = keySchema.extend({ line: z.number().int().positive() }).refine(
  ({ experience, line }) => line <= experiences[experience].rows
);
const setupSchema = z.object({
  title: z.string().trim().min(1).max(200),
  start_time: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/),
});
const count = z.number().int().min(0).max(999);
const bookingSchema = z.object({
  customer: z.enum(["guest", "external"]),
  apartment: z.string().trim().optional(),
  name: z.string().trim().min(1).max(200),
  pax: count.optional(),
  adults: count.optional(),
  children: count.optional(),
  notes: z.string().trim().max(2000).optional(),
  revision: z.string().uuid().nullable(),
});
const accessError = "Sessão da recepção expirada ou banco indisponível.";
const invalid = { ok: false, error: "Confira os dados informados." } as const;
const conflict = { ok: false, conflict: true, error: "A planilha mudou em outra sessão. Recarregue antes de continuar." } as const;

async function receptionClient() {
  return (await readReceptionAuthed()) ? getAdminClient() : null;
}

export async function loadExperience(input: unknown) {
  const db = await receptionClient();
  if (!db) return { ok: false, error: accessError } as const;
  const key = keySchema.safeParse(input);
  if (!key.success) return invalid;

  const [session, bookings] = await Promise.all([
    key.data.experience === "pizza"
      ? { data: null, error: null }
      : db.from("experience_sessions").select("title,start_time").match(key.data).maybeSingle<ExperienceSession>(),
    db.from("experience_bookings").select("line,revision,customer,apartment,name,pax,adults,children,notes")
      .match(key.data).returns<ExperienceBooking[]>(),
  ]);
  if (session.error || bookings.error) {
    return { ok: false, error: "Não foi possível carregar a planilha." } as const;
  }
  return { ok: true, session: session.data, bookings: bookings.data } as const;
}

export async function setupExperience(input: unknown, details: unknown) {
  const db = await receptionClient();
  if (!db) return { ok: false, error: accessError } as const;
  const key = keySchema.safeParse(input);
  const setup = setupSchema.safeParse(details);
  if (!key.success || !setup.success || key.data.experience === "pizza") return invalid;

  const { error } = await db.from("experience_sessions").upsert(
    { ...key.data, ...setup.data },
    { onConflict: "experience,day", ignoreDuplicates: true }
  );
  if (error) return { ok: false, error: "Não foi possível definir a experiência." } as const;
  return loadExperience(key.data);
}

export async function saveExperienceBooking(input: unknown, details: unknown) {
  const db = await receptionClient();
  if (!db) return { ok: false, error: accessError } as const;
  const key = lineSchema.safeParse(input);
  const booking = bookingSchema.safeParse(details);
  if (!key.success || !booking.success) return invalid;
  const { experience, day } = key.data;
  const { customer, apartment, name, pax, adults, children, notes, revision } = booking.data;
  if (customer === "guest" && !isAllowedApartmentNumber(apartment ?? "")) {
    return { ok: false, error: "Selecione um apartamento válido." } as const;
  }
  if (experience === "cinema" && customer !== "guest") return invalid;
  if (experience === "wine" && !pax) return invalid;
  if (experience === "pizza" && (adults === undefined || children === undefined || adults + children === 0)) {
    return { ok: false, error: "Informe ao menos um adulto ou uma criança." } as const;
  }
  if (experience !== "pizza") {
    const { data, error } = await db.from("experience_sessions").select("day").match({ experience, day }).maybeSingle();
    if (error || !data) return { ok: false, error: "Defina a experiência antes de cadastrar uma reserva." } as const;
  }

  const values = {
    customer,
    apartment: customer === "guest" ? apartment : null,
    name,
    pax: experience === "wine" ? pax : null,
    adults: experience === "pizza" ? adults : null,
    children: experience === "pizza" ? children : null,
    notes: experience !== "cinema" ? notes || null : null,
    revision: randomUUID(),
  };
  const table = db.from("experience_bookings");
  const mutation = revision
    ? table.update(values).match({ ...key.data, revision })
    : table.insert({ ...key.data, ...values });
  const { data, error } = await mutation.select("line,revision,customer,apartment,name,pax,adults,children,notes")
    .returns<ExperienceBooking[]>();
  if (error?.code === "23505") return conflict;
  if (error) return { ok: false, error: "Não foi possível salvar a reserva." } as const;
  const [saved] = data;
  if (!saved) return conflict;
  return { ok: true, booking: saved } as const;
}

export async function deleteExperienceBooking(input: unknown, revision: unknown) {
  const db = await receptionClient();
  if (!db) return { ok: false, error: accessError } as const;
  const key = lineSchema.safeParse(input);
  const version = z.string().uuid().safeParse(revision);
  if (!key.success || !version.success) return invalid;
  const { data, error } = await db.from("experience_bookings").delete()
    .match({ ...key.data, revision: version.data }).select("line");
  if (error) return { ok: false, error: "Não foi possível excluir a reserva." } as const;
  if (!data.length) return conflict;
  return { ok: true } as const;
}
