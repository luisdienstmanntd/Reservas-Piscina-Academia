import { createHmac } from "node:crypto";

/** Máximo de senhas erradas por origem dentro da janela. */
export const LOGIN_MAX_FAILURES = 5;
/** Janela de contagem (e de bloqueio) em minutos. */
export const LOGIN_WINDOW_MINUTES = 15;

export function isLoginBlocked(recentFailures: number): boolean {
  return recentFailures >= LOGIN_MAX_FAILURES;
}

export function loginWindowStartIso(nowMs: number = Date.now()): string {
  return new Date(nowMs - LOGIN_WINDOW_MINUTES * 60 * 1000).toISOString();
}

/** IP do cliente a partir dos cabeçalhos (Vercel preenche x-forwarded-for). */
export function clientIpFromHeaders(headers: {
  get(name: string): string | null;
}): string {
  // Na Vercel o x-real-ip é definido pela plataforma e não aceita valor enviado pelo cliente;
  // o x-forwarded-for é o plano B (e pode ser forjado fora da Vercel).
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/** Só o hash do IP é gravado (LGPD: sem IP em texto puro). */
export function hashClientKey(ip: string, secret: string): string {
  return createHmac("sha256", secret).update(`login:${ip}`).digest("hex");
}
