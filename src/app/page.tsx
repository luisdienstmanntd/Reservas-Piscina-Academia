import Image from "next/image";
import Link from "next/link";
import { CalendarCheck, Dumbbell, Waves } from "lucide-react";

import { listMyReservations } from "@/app/actions/reservations";
import { myReservationLabel } from "@/lib/my-reservations";

import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function Home() {
  // Reservas do próprio hóspede (vazio sem link válido ou se o banco falhar: a página segue normal).
  const mine = await listMyReservations();
  const myItems = mine.ok ? mine.items : [];

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
            className="mx-auto mb-3 h-auto w-full max-w-[min(100%,11rem)] object-contain sm:max-w-[12rem] md:max-w-[14rem]"
          />
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-charcoal md:text-4xl">
            Agendamentos
          </h1>
          <div className="text-muted-foreground mx-auto mt-3 max-w-md space-y-1 text-sm leading-relaxed md:text-base">
            <p>Piscina: 09h às 01h</p>
            <p>Academia: 24h</p>
          </div>
        </div>

        {myItems.length > 0 ? (
          <section
            aria-labelledby="minhas-reservas"
            className="border-primary/25 bg-card w-full rounded-xl border p-4 shadow-md"
          >
            <h2
              id="minhas-reservas"
              className="text-primary flex items-center gap-2 font-serif text-base font-semibold text-charcoal"
            >
              <CalendarCheck className="size-5" aria-hidden />
              {myItems.length === 1
                ? "Sua reserva"
                : "Suas reservas"}
            </h2>
            <ul className="mt-2 space-y-1.5">
              {myItems.map((r) => (
                <li
                  key={r.id}
                  className="text-charcoal text-sm leading-snug"
                >
                  {myReservationLabel(r)}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="grid w-full gap-4 md:grid-cols-2">
          <Card className="border-border/80 bg-card shadow-md transition-shadow hover:shadow-lg">
            <CardHeader>
              <div className="text-primary mb-1 flex items-center gap-2">
                <Waves className="size-5" aria-hidden />
                <CardTitle className="font-serif text-lg font-semibold text-charcoal">
                  Piscina
                </CardTitle>
              </div>
              <CardDescription>
                Uso exclusivo 13h às 01h - 1 hora por apto.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
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
                Academia 24 horas · 1 hora por apto.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button className="w-full" size="lg" asChild>
                <Link href="/hospede/academia">Agendar academia</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

      </main>

      <SiteFooter />
    </div>
  );
}
