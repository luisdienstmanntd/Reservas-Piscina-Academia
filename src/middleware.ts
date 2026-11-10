import { NextResponse, type NextRequest } from "next/server";

import {
  GUEST_TOKEN_COOKIE,
  classifyStayLookup,
  hotelTodayYmd,
  parseGuestTokenInput,
  type StayLookup,
} from "@/lib/guest-stay";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 45;
/** Tempo máximo da consulta ao Supabase; estourar = "sistema indisponível" (a sessão do hóspede é preservada). */
const SUPABASE_TIMEOUT_MS = 5000;

async function lookupStay(token: string): Promise<StayLookup> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!base || !key) return { kind: "error" };

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
      signal: AbortSignal.timeout(SUPABASE_TIMEOUT_MS),
    });
    const body = res.ok ? await res.json() : null;
    return classifyStayLookup(res.status, body, hotelTodayYmd());
  } catch {
    // Queda de rede ou lentidão (timeout): não é "estadia inexistente".
    return { kind: "error" };
  }
}

function redirectIndisponivel(request: NextRequest) {
  return NextResponse.redirect(new URL("/indisponivel", request.url));
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
  const pathname = request.nextUrl.pathname;
  const tokenParam = parseGuestTokenInput(
    request.nextUrl.searchParams.get("token")
  );

  /** Link mágico na raiz: grava cookie e envia para a home (escolha piscina/academia). */
  if (pathname === "/" && tokenParam) {
    const stay = await lookupStay(tokenParam);
    if (stay.kind === "error") return redirectIndisponivel(request);
    if (stay.kind === "invalid") return redirectAcessoNegado(request, false);
    const clean = new URL(request.url);
    clean.pathname = "/";
    clean.search = "";
    const res = NextResponse.redirect(clean);
    setGuestCookie(res, tokenParam);
    return res;
  }

  if (!pathname.startsWith("/hospede")) {
    return NextResponse.next();
  }

  if (tokenParam) {
    const stay = await lookupStay(tokenParam);
    if (stay.kind === "error") return redirectIndisponivel(request);
    if (stay.kind === "invalid") return redirectAcessoNegado(request, false);
    const clean = request.nextUrl.clone();
    clean.searchParams.delete("token");
    const qs = clean.searchParams.toString();
    clean.search = qs ? `?${qs}` : "";
    const res = NextResponse.redirect(clean);
    setGuestCookie(res, tokenParam);
    return res;
  }

  const cookieToken = parseGuestTokenInput(
    request.cookies.get(GUEST_TOKEN_COOKIE)?.value
  );
  if (!cookieToken) {
    return redirectAcessoNegado(request, false);
  }

  const stay = await lookupStay(cookieToken);
  // Só uma resposta clara de "não existe/venceu" apaga a sessão; queda ou lentidão não.
  if (stay.kind === "error") return redirectIndisponivel(request);
  if (stay.kind === "invalid") return redirectAcessoNegado(request, true);

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/hospede", "/hospede/:path*"],
};
