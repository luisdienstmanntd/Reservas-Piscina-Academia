import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Acesso indisponível",
  robots: { index: false, follow: false },
};

export default function AcessoNegadoPage() {
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
          Acesso indisponível
        </h1>
        <p className="text-muted-foreground mt-4 text-sm leading-relaxed md:text-base">
          Para agendar a piscina ou a academia é necessário o link pessoal que a
          recepção gera no check-in.
        </p>
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed md:text-base">
          Se o link expirou ou não abre, dirija-se à recepção para obter um novo
          acesso.
        </p>
      </div>
    </div>
  );
}
