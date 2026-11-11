/** Nomes de hóspedes e observações são sempre guardados e mostrados em MAIÚSCULAS. */
export function toUpperText(s: string): string {
  return s.toLocaleUpperCase("pt-BR");
}
