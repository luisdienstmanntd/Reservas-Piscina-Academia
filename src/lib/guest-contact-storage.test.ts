import { describe, expect, it } from "vitest";

import { clearLegacyGuestContacts } from "./guest-contact-storage";

class MemStorage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

describe("clearLegacyGuestContacts", () => {
  it("apaga só os contatos antigos guardados no navegador, nada mais", () => {
    const s = new MemStorage();
    s.setItem("valle.guest.contact.v1:207:2026-11-12", "{}");
    s.setItem("valle.guest.contact.v1:101:2026-11-20", "{}");
    s.setItem("outra.chave", "x");
    clearLegacyGuestContacts(s);
    expect(s.length).toBe(1);
    expect(s.getItem("outra.chave")).toBe("x");
  });

  it("não quebra quando o armazenamento está indisponível", () => {
    const broken = { get length(): number { throw new Error("bloqueado"); }, key: () => null, removeItem: () => undefined };
    expect(() => clearLegacyGuestContacts(broken)).not.toThrow();
  });
});
