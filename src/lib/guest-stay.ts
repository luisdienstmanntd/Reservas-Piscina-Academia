/** Cookie httpOnly definido pelo middleware após ?token= ou validação. */
export const GUEST_TOKEN_COOKIE = "guest_token";

/** Hoje (yyyy-MM-dd) no fuso America/Sao_Paulo — seguro para Edge e Node. */
export function hotelTodayYmd(): string {
  return new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Sao_Paulo",
  });
}

export function isCheckoutStillValid(
  checkoutYmd: string,
  todayYmd: string
): boolean {
  return checkoutYmd >= todayYmd;
}
