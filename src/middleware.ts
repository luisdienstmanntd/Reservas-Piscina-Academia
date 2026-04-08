import { NextResponse, type NextRequest } from "next/server";

import {
  GUEST_TOKEN_COOKIE,
  hotelTodayYmd,
  isCheckoutStillValid,
} from "@/lib/guest-stay";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 45;

type StayRow = { apartment_number: string; checkout_date: string };

async function fetchStayFromSupabase(
  token: string
): Promise<StayRow | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) return null;

  const enc = encodeURIComponent(token);
  const url = `${base.replace(/\/$/, "")}/rest/v1/active_stays?token=eq.${enc}&select=apartment_number,checkout_date&limit=1`;

  try {
    const res = await fetch(url, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as StayRow[];
    const row = rows[0];
    if (!row) return null;
    const checkout = String(row.checkout_date).slice(0, 10);
    if (!isCheckoutStillValid(checkout, hotelTodayYmd())) return null;
    return row;
  } catch {
    return null;
  }
}

function redirectAcessoNegado(request: NextRequest, clearCookie: boolean) {
  const res = NextResponse.redirect(new URL("/acesso-negado", request.url));
  if (clearCookie) {
    res.cookies.set(GUEST_TOKEN_COOKIE, "", {
      maxAge: 0,
      path: "/",
    });
  }
  return res;
}

function setGuestCookie(response: NextResponse, token: string) {
  response.cookies.set(GUEST_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function middleware(request: NextRequest) {
  const tokenParam = request.nextUrl.searchParams.get("token")?.trim();

  if (tokenParam) {
    const row = await fetchStayFromSupabase(tokenParam);
    if (!row) {
      return redirectAcessoNegado(request, false);
    }
    const clean = request.nextUrl.clone();
    clean.searchParams.delete("token");
    const qs = clean.searchParams.toString();
    clean.search = qs ? `?${qs}` : "";
    const res = NextResponse.redirect(clean);
    setGuestCookie(res, tokenParam);
    return res;
  }

  const cookieToken = request.cookies.get(GUEST_TOKEN_COOKIE)?.value?.trim();
  if (!cookieToken) {
    return redirectAcessoNegado(request, false);
  }

  const row = await fetchStayFromSupabase(cookieToken);
  if (!row) {
    return redirectAcessoNegado(request, true);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/hospede", "/hospede/:path*"],
};
