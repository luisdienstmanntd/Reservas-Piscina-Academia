import { describe, expect, it } from "vitest";

import {
  LOGIN_MAX_FAILURES,
  clientIpFromHeaders,
  hashClientKey,
  isLoginBlocked,
  loginWindowStartIso,
} from "./login-rate-limit";

const h = (m: Record<string, string>) => ({ get: (n: string) => m[n] ?? null });

describe("rate limit do login", () => {
  it("bloqueia a partir de 5 falhas", () => {
    expect(isLoginBlocked(LOGIN_MAX_FAILURES - 1)).toBe(false);
    expect(isLoginBlocked(LOGIN_MAX_FAILURES)).toBe(true);
  });

  it("janela de 15 minutos", () => {
    const now = Date.UTC(2026, 10, 8, 12, 0, 0);
    expect(loginWindowStartIso(now)).toBe("2026-11-08T11:45:00.000Z");
  });

  it("prefere o x-real-ip (definido pela plataforma) ao x-forwarded-for, que o cliente pode forjar", () => {
    expect(clientIpFromHeaders(h({ "x-real-ip": "5.6.7.8", "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("5.6.7.8");
    expect(clientIpFromHeaders(h({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
    expect(clientIpFromHeaders(h({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(clientIpFromHeaders(h({}))).toBe("unknown");
  });

  it("grava só hash do IP", () => {
    const k = hashClientKey("1.2.3.4", "s".repeat(32));
    expect(k).toMatch(/^[0-9a-f]{64}$/);
    expect(k).not.toContain("1.2.3.4");
    expect(hashClientKey("1.2.3.5", "s".repeat(32))).not.toBe(k);
  });
});
