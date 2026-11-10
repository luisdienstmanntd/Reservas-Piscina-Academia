import { beforeEach, describe, expect, it } from "vitest";

import {
  purgeExpiredContacts,
  readGuestContact,
  saveGuestContact,
} from "./guest-contact-storage";

class MemStorage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

const ok = (w: string) => (/^\+?\d{10,}$/.test(w) ? w : null);

describe("guest-contact-storage", () => {
  let s: MemStorage;
  beforeEach(() => { s = new MemStorage(); });

  it("salva e lê por apartamento e check-out", () => {
    saveGuestContact(s, "207", "2026-11-12", { name: "Ana", whatsapp: "5554999999999" });
    expect(readGuestContact(s, "207", "2026-11-12", ok)).toEqual({ name: "Ana", whatsapp: "5554999999999" });
    expect(readGuestContact(s, "208", "2026-11-12", ok)).toBeNull();
    expect(readGuestContact(s, "207", "2026-11-15", ok)).toBeNull();
  });

  it("ignora WhatsApp inválido e dados corrompidos", () => {
    saveGuestContact(s, "207", "2026-11-12", { name: "", whatsapp: "abc" });
    expect(readGuestContact(s, "207", "2026-11-12", ok)).toBeNull();
    s.setItem("valle.guest.contact.v1:101:2026-11-12", "{não é json");
    expect(readGuestContact(s, "101", "2026-11-12", ok)).toBeNull();
  });

  it("apaga estadias já encerradas e mantém as atuais", () => {
    saveGuestContact(s, "1", "2026-11-09", { name: "", whatsapp: "5554999999999" });
    saveGuestContact(s, "2", "2026-11-10", { name: "", whatsapp: "5554999999999" });
    s.setItem("outra.chave", "x");
    purgeExpiredContacts(s, "2026-11-10");
    expect(readGuestContact(s, "1", "2026-11-09", ok)).toBeNull();
    expect(readGuestContact(s, "2", "2026-11-10", ok)).not.toBeNull();
    expect(s.getItem("outra.chave")).toBe("x");
  });

  it("não quebra quando o armazenamento lança erro", () => {
    const bad = {
      length: 0,
      key: () => null,
      getItem: () => { throw new Error("x"); },
      setItem: () => { throw new Error("x"); },
      removeItem: () => { throw new Error("x"); },
    };
    expect(() => saveGuestContact(bad, "1", "2026-11-12", { name: "", whatsapp: "1" })).not.toThrow();
    expect(readGuestContact(bad, "1", "2026-11-12", ok)).toBeNull();
  });
});
