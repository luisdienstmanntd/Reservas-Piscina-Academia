import type { ReactNode } from "react";
import type { Viewport } from "next";

/**
 * Área de gestão da recepção: otimizada para desktop (grade larga, formulário em colunas),
 * com scroll horizontal na tabela em ecrãs estreitos.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/** Segmento dedicado evita pedidos relativos errados a `layout.css` em dev (rotas aninhadas). */
export default function RecepcaoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh min-w-0 bg-background text-foreground antialiased">
      {children}
    </div>
  );
}
