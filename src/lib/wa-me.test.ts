import { describe, expect, it } from "vitest";

import { buildConfirmationMessage, buildWarningMessage, buildWhatsappWaMeUrl } from "./wa-me";

const FLAG = "🇮🇹";

describe("mensagem de confirmação do WhatsApp", () => {
  it("academia: texto pedido, data com ano e hora cheia", () => {
    expect(buildConfirmationMessage("gym", "2026-11-12", "15:00:00")).toBe(
      "Olá! Sua reserva para a academia do Valle D'Incanto está confirmada para o dia 12/11/2026, às 15h.\n" +
        `Aproveite esse momento dedicado ao seu bem-estar. Você merece! ${FLAG}`
    );
  });
  it("piscina: texto pedido", () => {
    expect(buildConfirmationMessage("pool", "2026-11-12", "15:00:00")).toBe(
      "Olá! Sua reserva para a piscina do Valle D'Incanto está confirmada para o dia 12/11/2026, às 15h.\n" +
        `Aproveite esse momento de tranquilidade e relaxamento. Você merece! ${FLAG}`
    );
  });
  it("sempre usa a data (sem 'hoje') e a hora sem zero à esquerda", () => {
    const m = buildConfirmationMessage("pool", "2026-01-05", "09:00:00");
    expect(m).toContain("para o dia 05/01/2026, às 9h.");
    expect(m).not.toMatch(/hoje/i);
  });
  it("minutos só aparecem quando não são zero", () => {
    expect(buildConfirmationMessage("gym", "2026-11-12", "07:30")).toContain("às 7h30.");
  });
  it("a bandeira é o emoji da Itália (U+1F1EE U+1F1F9)", () => {
    const m = buildConfirmationMessage("pool", "2026-11-12", "15:00");
    expect([...m].slice(-2).map((c) => c.codePointAt(0))).toEqual([0x1f1ee, 0x1f1f9]);
  });
  it("vai inteira (com quebra de linha e emoji) no link do WhatsApp", () => {
    const msg = buildConfirmationMessage("pool", "2026-11-12", "15:00");
    const url = buildWhatsappWaMeUrl("+5511999990001", msg)!;
    const text = new URL(url).searchParams.get("text");
    expect(text).toBe(msg);
    expect(url).toContain("%0A");
  });
  it("o aviso de 10 minutos continua igual", () => {
    expect(buildWarningMessage("gym")).toBe(
      "Olá! Lembrando que sua reserva na Academia termina em 10 minutos. Precisamos preparar o ambiente para o próximo hóspede. Agradecemos a compreensão!"
    );
  });
});
