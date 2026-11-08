import { cookies } from "next/headers";

import {
  RECEPTION_SESSION_TTL_SECONDS,
  createReceptionSessionValue,
  getSessionSecret,
  verifyReceptionSessionValue,
} from "@/lib/reception-session";

export const RECEPTION_COOKIE = "reception_auth";

/** Autenticado somente com cookie assinado (HMAC) e ainda não expirado. */
export async function readReceptionAuthed(): Promise<boolean> {
  const jar = await cookies();
  return verifyReceptionSessionValue(
    jar.get(RECEPTION_COOKIE)?.value,
    getSessionSecret()
  );
}

/** Grava o cookie de sessão assinado. Retorna `false` se SESSION_SECRET não estiver configurado. */
export async function startReceptionSession(): Promise<boolean> {
  const secret = getSessionSecret();
  if (!secret) return false;
  const jar = await cookies();
  jar.set(RECEPTION_COOKIE, createReceptionSessionValue(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: RECEPTION_SESSION_TTL_SECONDS,
    path: "/",
  });
  return true;
}

export async function endReceptionSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(RECEPTION_COOKIE);
}
