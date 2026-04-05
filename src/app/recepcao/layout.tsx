import type { ReactNode } from "react";

/** Segmento dedicado evita pedidos relativos errados a `layout.css` em dev (rotas aninhadas). */
export default function RecepcaoLayout({ children }: { children: ReactNode }) {
  return children;
}
