import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Dumbbell } from "lucide-react";

import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-10 px-6 py-12 md:max-w-2xl">
        <div className="text-center">
          <Image
            src="/logo-valle-dincanto.jpg"
            alt="Logo Valle D'Incanto"
            width={1024}
            height={364}
            priority
            className="mx-auto mb-4 h-auto w-full max-w-[min(100%,18rem)] object-contain md:max-w-md"
          />
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-charcoal md:text-4xl">
            Agendamentos
          </h1>
          <div className="text-muted-foreground mx-auto mt-3 max-w-md space-y-1 text-sm leading-relaxed md:text-base">
            <p>Piscina: 09h às 01h</p>
            <p>Academia: 24h</p>
          </div>
        </div>

        <div className="grid w-full gap-4 md:grid-cols-2">
          <Card className="border-border/80 bg-card shadow-md transition-shadow hover:shadow-lg">
            <CardHeader>
              <div className="text-primary mb-1 flex items-center gap-2">
                <CalendarDays className="size-5" aria-hidden />
                <CardTitle className="font-serif text-lg font-semibold text-charcoal">
                  Piscina
                </CardTitle>
              </div>
              <CardDescription>
                Uso exclusivo 13h às 01h - 1 hora por apto.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" size="lg" asChild>
                <Link href="/hospede/piscina">Agendar piscina</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card shadow-md transition-shadow hover:shadow-lg">
            <CardHeader>
              <div className="text-primary mb-1 flex items-center gap-2">
                <Dumbbell className="size-5" aria-hidden />
                <CardTitle className="font-serif text-lg font-semibold text-charcoal">
                  Academia
                </CardTitle>
              </div>
              <CardDescription>
                Academia 24 horas · 1 hora por apartamento.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" size="lg" asChild>
                <Link href="/hospede/academia">Agendar academia</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <p className="text-muted-foreground text-center text-xs">
          <Link
            href="/recepcao"
            className="underline-offset-4 hover:text-charcoal hover:underline"
          >
            Área da recepção
          </Link>
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}
