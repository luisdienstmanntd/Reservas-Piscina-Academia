import { describe, expect, it } from "vitest";
import { toUpperText } from "./text-case";

describe("toUpperText", () => {
  it("passa para maiúsculas, com acentos", () => {
    expect(toUpperText("joão da Silva")).toBe("JOÃO DA SILVA");
    expect(toUpperText("pedido: sem açúcar")).toBe("PEDIDO: SEM AÇÚCAR");
  });
  it("não mexe em números e já maiúsculo", () => {
    expect(toUpperText("APTO 101")).toBe("APTO 101");
  });
});
