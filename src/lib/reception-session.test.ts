import { describe, expect, it } from "vitest";

import {
  RECEPTION_SESSION_TTL_SECONDS,
  createReceptionSessionValue,
  getSessionSecret,
  passwordsMatch,
  verifyReceptionSessionValue,
} from "./reception-session";

const SECRET = "a".repeat(32);
const NOW = 1_800_000_000_000;

describe("sessão da recepção assinada", () => {
  it("aceita um cookie recém-criado", () => {
    const v = createReceptionSessionValue(SECRET, NOW);
    expect(verifyReceptionSessionValue(v, SECRET, NOW + 1000)).toBe(true);
  });

  it("rejeita o cookie forjado antigo e valores arbitrários", () => {
    for (const v of ["1", "", "true", "123.abc", undefined, null]) {
      expect(verifyReceptionSessionValue(v, SECRET, NOW)).toBe(false);
    }
  });

  it("rejeita assinatura adulterada ou expiração estendida", () => {
    const v = createReceptionSessionValue(SECRET, NOW);
    const [exp, sig] = v.split(".");
    const flipped = sig.slice(0, -1) + (sig.endsWith("0") ? "1" : "0");
    expect(verifyReceptionSessionValue(`${exp}.${flipped}`, SECRET, NOW)).toBe(false);
    expect(verifyReceptionSessionValue(`${Number(exp) + 1}.${sig}`, SECRET, NOW)).toBe(false);
  });

  it("rejeita segredo diferente ou ausente", () => {
    const v = createReceptionSessionValue(SECRET, NOW);
    expect(verifyReceptionSessionValue(v, "b".repeat(32), NOW)).toBe(false);
    expect(verifyReceptionSessionValue(v, null, NOW)).toBe(false);
  });

  it("expira após 12h no servidor", () => {
    const v = createReceptionSessionValue(SECRET, NOW);
    const ttl = RECEPTION_SESSION_TTL_SECONDS * 1000;
    expect(RECEPTION_SESSION_TTL_SECONDS).toBe(43200);
    expect(verifyReceptionSessionValue(v, SECRET, NOW + ttl - 1)).toBe(true);
    expect(verifyReceptionSessionValue(v, SECRET, NOW + ttl)).toBe(false);
  });

  it("exige SESSION_SECRET com pelo menos 32 caracteres", () => {
    expect(getSessionSecret({ SESSION_SECRET: "curto" } as never)).toBeNull();
    expect(getSessionSecret({} as never)).toBeNull();
    expect(getSessionSecret({ SESSION_SECRET: ` ${SECRET} ` } as never)).toBe(SECRET);
  });

  it("compara senhas sem depender do tamanho", () => {
    expect(passwordsMatch("abc", "abc")).toBe(true);
    expect(passwordsMatch("abc", "abcd")).toBe(false);
    expect(passwordsMatch("", "abc")).toBe(false);
  });
});
