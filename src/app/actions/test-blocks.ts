/**
 * Ajuda para os testes das ações: o app agora também consulta `slot_blocks` (horários bloqueados).
 * Faz o cliente falso responder "nenhum bloqueio" a essa tabela, sem mexer nos bancos falsos de cada teste.
 * `blocked` define horários bloqueados (HH:MM:SS) para testes do bloqueio.
 */
export function blocksAware(
  fn: { mockReturnValue: (v: unknown) => unknown },
  blocked: () => string[] = () => []
) {
  const f = fn as typeof fn & { __blocked?: () => string[]; __orig?: typeof fn.mockReturnValue };
  // Idempotente: vários testes do mesmo arquivo chamam isto; vale sempre o `blocked` mais recente.
  f.__blocked = blocked;
  if (f.__orig) return fn;
  const orig = (f.__orig = fn.mockReturnValue.bind(fn));
  fn.mockReturnValue = (client: unknown) => {
    const c = client as { from: (t: string) => unknown };
    return orig({
      ...c,
      from: (t: string) => {
        if (t !== "slot_blocks") return c.from(t);
        const q: Record<string, unknown> = {};
        q.eq = () => q;
        q.is = () =>
          Promise.resolve({
            data: (f.__blocked ?? blocked)().map((slot_start) => ({ slot_start })),
            error: null,
          });
        return { select: () => q };
      },
    });
  };
  return fn;
}
