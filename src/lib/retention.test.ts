import { describe, expect, it } from "vitest";

import {
  WHATSAPP_RETENTION_DAYS,
  retentionMarkerYmd,
  whatsappExpired,
  whatsappFirstRemovalYmd,
} from "./retention";

describe("retenção do WhatsApp: 365 dias após o check-out", () => {
  it("o prazo é de 365 dias", () => {
    expect(WHATSAPP_RETENTION_DAYS).toBe(365);
  });

  it("marco = check-out; sem check-out (balcão) usa o dia da reserva", () => {
    expect(retentionMarkerYmd({ guest_checkout_date: "2026-11-15", reservation_date: "2026-11-11" })).toBe("2026-11-15");
    expect(retentionMarkerYmd({ guest_checkout_date: null, reservation_date: "2026-11-11" })).toBe("2026-11-11");
  });

  it("respeita exatamente o prazo: dia 365 mantém, dia 366 apaga", () => {
    const marker = "2026-11-11";
    expect(whatsappExpired(marker, "2026-11-12")).toBe(false); // dia 1
    expect(whatsappExpired(marker, "2027-11-10")).toBe(false); // dia 364
    expect(whatsappExpired(marker, "2027-11-11")).toBe(false); // dia 365 (ainda mantido)
    expect(whatsappExpired(marker, "2027-11-12")).toBe(true); // dia 366
    expect(whatsappFirstRemovalYmd(marker)).toBe("2027-11-12");
  });

  it("conta dias corridos também ao atravessar ano bissexto", () => {
    const marker = "2027-03-01"; // 2028 é bissexto: 365 dias caem em 28/02/2028
    expect(whatsappExpired(marker, "2028-02-29")).toBe(false); // dia 365
    expect(whatsappExpired(marker, "2028-03-01")).toBe(true); // dia 366
    expect(whatsappFirstRemovalYmd(marker)).toBe("2028-03-01");
  });

  it("o marco é inclusivo no futuro: reserva de hoje nunca vence", () => {
    expect(whatsappExpired("2026-11-11", "2026-11-11")).toBe(false);
    expect(whatsappExpired("2999-01-01", "2026-11-11")).toBe(false);
  });
});
