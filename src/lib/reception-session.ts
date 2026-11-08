import { createHmac, timingSafeEqual } from "node:crypto";

/** Duração da sessão da recepção (também usada como maxAge do cookie). */
export const RECEPTION_SESSION_TTL_SECONDS = 60 * 60 * 12;

const MIN_SECRET_LENGTH = 32;
const PURPOSE = "reception-session-v1";

/** Segredo de sessão válido (>= 32 caracteres) ou `null` se ausente/fraco. */
export function getSessionSecret(
  env: NodeJS.ProcessEnv = process.env
): string | null {
  const secret = env.SESSION_SECRET?.trim();
  return secret && secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

function sign(secret: string, expiresAtMs: number): string {
  return createHmac("sha256", secret)
    .update(`${PURPOSE}:${expiresAtMs}`)
    .digest("hex");
}

/** Valor do cookie: `<expiraEmMs>.<hmac-sha256-hex>`. */
export function createReceptionSessionValue(
  secret: string,
  nowMs: number = Date.now()
): string {
  const expiresAtMs = nowMs + RECEPTION_SESSION_TTL_SECONDS * 1000;
  return `${expiresAtMs}.${sign(secret, expiresAtMs)}`;
}

/** Valida assinatura (tempo constante) e expiração no servidor. */
export function verifyReceptionSessionValue(
  value: string | undefined | null,
  secret: string | null,
  nowMs: number = Date.now()
): boolean {
  if (!value || !secret) return false;
  const match = /^(\d{1,15})\.([0-9a-f]{64})$/.exec(value);
  if (!match) return false;
  const expiresAtMs = Number(match[1]);
  if (!Number.isSafeInteger(expiresAtMs) || expiresAtMs <= nowMs) return false;
  const expected = Buffer.from(sign(secret, expiresAtMs), "hex");
  const given = Buffer.from(match[2], "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Comparação de senha em tempo constante (digest evita vazar o tamanho). */
export function passwordsMatch(given: string, expected: string): boolean {
  const a = createHmac("sha256", "pw").update(given).digest();
  const b = createHmac("sha256", "pw").update(expected).digest();
  return timingSafeEqual(a, b);
}
