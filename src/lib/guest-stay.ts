/** Cookie httpOnly definido pelo middleware após ?token= ou validação. */
export const GUEST_TOKEN_COOKIE = "guest_token";

/**
 * Hoje (yyyy-MM-dd) no fuso America/Sao_Paulo — seguro para Edge e Node.
 * `at` permite testes determinísticos sem alterar o fuso.
 */
export function hotelTodayYmd(at: Date = new Date()): string {
  return at.toLocaleDateString("sv-SE", {
    timeZone: "America/Sao_Paulo",
  });
}

/** Valor de `?token=` ou cookie: string não vazia após trim, ou null. */
export function parseGuestTokenInput(
  value: string | null | undefined
): string | null {
  const t = value?.trim();
  return t ? t : null;
}

export function isCheckoutStillValid(
  checkoutYmd: string,
  todayYmd: string
): boolean {
  return checkoutYmd >= todayYmd;
}

export type StayRow = { apartment_number: string; checkout_date: string };

/**
 * Resultado da consulta de uma estadia pelo token:
 * - ok: existe e ainda vale;
 * - invalid: o servidor respondeu com clareza que não existe ou já venceu (único caso em que a sessão do hóspede é apagada);
 * - error: queda, lentidão, erro do servidor ou de configuração. NUNCA apaga a sessão do hóspede.
 */
export type StayLookup =
  | { kind: "ok"; row: StayRow }
  | { kind: "invalid" }
  | { kind: "error" };

export function classifyStayLookup(
  httpStatus: number,
  body: unknown,
  todayYmd: string
): StayLookup {
  if (httpStatus !== 200 || !Array.isArray(body)) return { kind: "error" };
  const row = body[0] as StayRow | undefined;
  if (!row) return { kind: "invalid" };
  const checkout = String(row.checkout_date).slice(0, 10);
  if (!isCheckoutStillValid(checkout, todayYmd)) return { kind: "invalid" };
  return { kind: "ok", row };
}
