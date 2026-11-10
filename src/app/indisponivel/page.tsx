import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sistema indisponível",
  robots: { index: false, follow: false },
};

export default function IndisponivelPage() {
  return (
    <div className="bg-background flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="mx-auto flex w-full max-w-md flex-col items-center text-center">
        <Image
          src="/logo-valle-dincanto.jpg"
          alt="Logo Valle D'Incanto"
          width={1024}
          height={364}
          className="mx-auto mb-8 h-auto w-full max-w-[min(100%,11rem)] object-contain sm:max-w-[12rem] md:max-w-[14rem]"
        />
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-charcoal md:text-3xl">
          Sistema temporariamente indisponível
        </h1>
        <p className="text-muted-foreground mt-4 text-sm leading-relaxed md:text-base">
          Não foi possível conectar agora. Seu acesso continua válido: tente
          novamente em alguns instantes.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground"
        >
          Tentar novamente
        </Link>
        <p className="text-muted-foreground mt-6 text-xs leading-relaxed">
          Se o problema continuar, fale com a recepção (ramal 9).
        </p>
      </div>
    </div>
  );
}
