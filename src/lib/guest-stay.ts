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
