import type { ReactNode } from "react";

/**
 * Evita rolagem no documento: o conteúdo cabe na viewport e só a área central rola se precisar.
 */
export default function HospedeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background fixed inset-0 z-0 flex flex-col overflow-hidden">
      {children}
    </div>
  );
}
