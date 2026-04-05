"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { CalendarCheck, CalendarDays, ChevronLeft, Home } from "lucide-react";
import Link from "next/link";

import {
  createGuestReservation,
  getReservationDaySummary,
} from "@/app/actions/reservations";
import { ValleWordmark } from "@/components/valle-wordmark";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { ALLOWED_APARTMENT_NUMBERS } from "@/lib/apartment-codes";
import { hotelCalendarDate } from "@/lib/hotel-time";
import {
  normalizeSlotStart,
  slotLabel,
  slotStartsFor,
  type Facility,
} from "@/lib/reservations";

type Step = 1 | 2 | 3 | 4;

type ConfirmedReservation = { dateYmd: string; slot: string };

function sortConfirmed(a: ConfirmedReservation, b: ConfirmedReservation): number {
  const d = a.dateYmd.localeCompare(b.dateYmd);
  if (d !== 0) return d;
  return normalizeSlotStart(a.slot).localeCompare(normalizeSlotStart(b.slot));
}

function fromYmd(localYmd: string): Date {
  const [y, m, d] = localYmd.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

const copy: Record<Facility, { title: string; step3Hint: string }> = {
  pool: {
    title: "Agendamento da Piscina",
    step3Hint:
      "09h–13h coletivo (sem reserva). 13h–01h exclusivo — toque para reservar.",
  },
  gym: {
    title: "Agendamento da Academia",
    step3Hint:
      "Academia 24 horas. 1 hora por apartamento — toque num horário livre.",
  },
};

export function GuestBooking({ facility }: { facility: Facility }) {
  const slots = useMemo(() => slotStartsFor(facility), [facility]);
  const t = copy[facility];

  const [step, setStep] = useState<Step>(1);
  const [apartment, setApartment] = useState("");
  const [checkout, setCheckout] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [occupied, setOccupied] = useState<Set<string>>(new Set());
  const [apartmentBookedThisDay, setApartmentBookedThisDay] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmedReservations, setConfirmedReservations] = useState<
    ConfirmedReservation[]
  >([]);
  /** De onde o calendário (passo 2) volta com “Voltar”: identificação ou resumo. */
  const [calendarBackTarget, setCalendarBackTarget] = useState<1 | 4>(1);

  const todayStr = useMemo(() => hotelCalendarDate(), []);

  const minDate = useMemo(() => fromYmd(todayStr), [todayStr]);
  const maxDate = useMemo(() => fromYmd(checkout), [checkout]);

  const headerDisplayDate = useMemo(() => {
    if (selectedDate) return selectedDate;
    return fromYmd(todayStr);
  }, [selectedDate, todayStr]);

  const loadOccupied = useCallback(
    async (ymd: string) => {
      setLoadingSlots(true);
      try {
        const r = await getReservationDaySummary(ymd, facility);
        if (!r.ok) {
          toast.error(r.error);
          return;
        }
        setOccupied(
          new Set(r.occupiedSlots.map((s) => normalizeSlotStart(s)))
        );
        const apt = apartment.trim();
        setApartmentBookedThisDay(
          apt.length > 0 && r.apartmentsBooked.includes(apt)
        );
      } catch {
        toast.error(
          "Falha de rede ao carregar horários. Verifique a internet e tente de novo."
        );
      } finally {
        setLoadingSlots(false);
      }
    },
    [facility, apartment]
  );

  useEffect(() => {
    if (step !== 3 || !selectedDate) return;
    const ymd = format(selectedDate, "yyyy-MM-dd");
    void loadOccupied(ymd);
  }, [step, selectedDate, loadOccupied, apartment]);

  function submitIdentify(e: React.FormEvent) {
    e.preventDefault();
    const apt = apartment.trim();
    if (!apt) {
      toast.error("Selecione o apartamento.");
      return;
    }
    if (!checkout) {
      toast.error("Informe a data de check-out.");
      return;
    }
    if (checkout < todayStr) {
      toast.error("Check-out não pode ser anterior a hoje.");
      return;
    }
    const wa = whatsapp.trim();
    if (!wa) {
      toast.error("Informe o seu WhatsApp.");
      return;
    }
    const waDigits = wa.replace(/\D/g, "");
    if (waDigits.length < 10 || waDigits.length > 13) {
      toast.error(
        "WhatsApp inválido. Use DDD + número (10 a 13 dígitos, com ou sem 9)."
      );
      return;
    }
    setApartment(apt);
    setCalendarBackTarget(1);
    setStep(2);
    setSelectedDate(undefined);
  }

  /** Após confirmar: nova reserva = só calendário (mantém apto, check-out, WhatsApp). */
  function goNewReservationFromSummary() {
    setCalendarBackTarget(4);
    setSelectedDate(undefined);
    setStep(2);
  }

  function goBackFromStep() {
    if (step === 2) {
      setStep(calendarBackTarget);
      return;
    }
    if (step === 3) setStep(2);
  }

  function submitDatePick(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDate) {
      toast.error("Escolha o dia da reserva.");
      return;
    }
    const ymd = format(selectedDate, "yyyy-MM-dd");
    if (ymd < todayStr || ymd > checkout) {
      toast.error("Data fora do período da sua estadia.");
      return;
    }
    setStep(3);
  }

  async function pickSlot(slot: string) {
    if (!selectedDate || submitting) return;
    if (apartmentBookedThisDay) {
      toast.error(
        "Este apartamento já tem reserva neste dia nesta instalação. Limite: 1 hora por dia."
      );
      return;
    }
    const norm = normalizeSlotStart(slot);
    if (occupied.has(norm)) {
      toast.error("Este horário já está reservado. Escolha outro.");
      return;
    }
    const ymd = format(selectedDate, "yyyy-MM-dd");
    setSubmitting(true);
    try {
      const r = await createGuestReservation({
        facility,
        apartmentNumber: apartment,
        guestCheckoutDate: checkout,
        reservationDate: ymd,
        slotStart: slot,
        guestWhatsapp: whatsapp,
      });
      if (!r.ok) {
        toast.error(r.error);
        if (r.code === "conflict" || r.code === "network") {
          await loadOccupied(ymd);
        }
        return;
      }
      setConfirmedReservations((prev) => {
        const next = [...prev, { dateYmd: ymd, slot }];
        next.sort(sortConfirmed);
        return next;
      });
      setStep(4);
      toast.success("Reserva confirmada!");
    } catch {
      toast.error(
        "Conexão interrompida. Sua seleção foi mantida — tente confirmar de novo."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const gridCols =
    facility === "gym"
      ? "grid-cols-4 sm:grid-cols-6"
      : "grid-cols-4";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="border-border/50 flex shrink-0 items-center justify-between gap-2 border-b bg-background px-3 py-1.5 text-[11px] text-charcoal sm:text-xs">
        <Link
          href="/"
          className="text-muted-foreground inline-flex items-center gap-1 hover:text-charcoal"
        >
          <Home className="size-3.5 shrink-0 opacity-70" aria-hidden />
          Início
        </Link>
        <span className="flex items-center gap-1.5 capitalize tabular-nums">
          <CalendarDays className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
          {format(headerDisplayDate, "EEE, dd MMM yyyy", { locale: ptBR })}
        </span>
      </div>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col px-3 pt-2 pb-1">
        <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col overflow-y-auto overscroll-contain md:max-w-2xl">
          <div className="space-y-2 pb-2">
            <ValleWordmark size="sm" className="mb-1" />
            <h1 className="font-serif text-charcoal text-center text-base font-semibold tracking-tight sm:text-lg">
              {t.title}
            </h1>

            {step > 1 && step < 4 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-charcoal/80 h-8 px-2 text-xs"
                onClick={goBackFromStep}
              >
                <ChevronLeft className="size-4" />
                Voltar
              </Button>
            )}

            {step === 1 && (
              <Card className="border-border/80 shadow-sm">
                <CardHeader className="space-y-0.5 p-3 pb-2">
                  <CardTitle className="font-serif text-charcoal text-base font-semibold">
                    Identificação (check-in)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Apartamento, check-out e WhatsApp (obrigatório).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 p-3 pt-0">
                  <form
                    onSubmit={submitIdentify}
                    className="flex flex-col gap-3"
                  >
                    <div className="space-y-1">
                      <Label htmlFor="apt" className="text-charcoal text-xs">
                        Nº do Apartamento
                      </Label>
                      <select
                        id="apt"
                        required
                        className="border-input flex h-9 w-full rounded-md border border-border bg-white px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        value={apartment}
                        onChange={(e) => setApartment(e.target.value)}
                      >
                        <option value="">Selecione…</option>
                        {ALLOWED_APARTMENT_NUMBERS.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="co" className="text-charcoal text-xs">
                        Check-out
                      </Label>
                      <Input
                        id="co"
                        type="date"
                        min={todayStr}
                        className="border-border h-9 bg-white text-sm"
                        value={checkout}
                        onChange={(e) => setCheckout(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="wa" className="text-charcoal text-xs">
                        WhatsApp
                      </Label>
                      <Input
                        id="wa"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        required
                        placeholder="(00) 00000-0000"
                        className="border-border h-9 bg-white text-sm"
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(e.target.value)}
                      />
                    </div>
                    <Button type="submit" className="h-10 w-full" size="default">
                      Continuar
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {step === 2 && (
              <Card className="border-border/80 shadow-sm">
                <CardHeader className="p-3 pb-2">
                  <CardTitle className="font-serif text-charcoal text-base font-semibold">
                    Escolha o dia
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Apto. {apartment} · até{" "}
                    {checkout
                      ? format(fromYmd(checkout), "dd/MM/yy", { locale: ptBR })
                      : "—"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 p-3 pt-0">
                  <form
                    onSubmit={submitDatePick}
                    className="flex flex-col gap-3"
                  >
                    <div className="flex justify-center overflow-x-auto rounded-lg border border-border/60 bg-white p-1 [&_.rdp-root]:scale-[0.92] sm:[&_.rdp-root]:scale-100">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        disabled={{ before: minDate, after: maxDate }}
                        defaultMonth={minDate}
                      />
                    </div>
                    <Button type="submit" className="h-10 w-full">
                      Ver horários
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {step === 3 && selectedDate && (
              <Card className="border-border/80 shadow-sm">
                <CardHeader className="space-y-1 p-3 pb-2">
                  <CardTitle className="font-serif text-charcoal text-base font-semibold">
                    Horários
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {format(selectedDate, "EEE dd/MM", { locale: ptBR })} · 1h/
                    apto./dia
                  </CardDescription>
                  <p className="text-muted-foreground text-[11px] leading-snug">
                    {t.step3Hint}
                  </p>
                  {apartmentBookedThisDay ? (
                    <p className="text-destructive text-[11px] font-medium leading-snug">
                      Este apartamento já tem reserva neste dia nesta instalação.
                      Limite: 1 hora por dia.
                    </p>
                  ) : null}
                </CardHeader>
                <CardContent className="flex flex-col gap-2 p-3 pt-0">
                  {loadingSlots ? (
                    <p className="text-muted-foreground py-4 text-center text-xs">
                      Carregando…
                    </p>
                  ) : (
                    <ul className={cn("grid gap-1.5", gridCols)}>
                      {slots.map((slot) => {
                        const norm = normalizeSlotStart(slot);
                        const taken =
                          apartmentBookedThisDay || occupied.has(norm);
                        return (
                          <li key={slot}>
                            <button
                              type="button"
                              disabled={taken || submitting}
                              onClick={() => void pickSlot(slot)}
                              className={cn(
                                "flex min-h-[2.5rem] w-full flex-col items-center justify-center rounded-md border px-0.5 py-1 text-center text-[9px] leading-tight font-semibold transition-[transform,opacity] sm:min-h-[2.75rem] sm:text-[10px]",
                                taken
                                  ? "border-slot-occupied bg-slot-occupied text-slot-occupied-fg cursor-not-allowed"
                                  : "border-slot-available/50 bg-slot-available text-slot-available-fg active:scale-[0.97]"
                              )}
                            >
                              <span className="tabular-nums">
                                {slotLabel(slot)}
                              </span>
                              {taken ? (
                                <span className="mt-0.5 text-[8px] opacity-90">
                                  {apartmentBookedThisDay
                                    ? "Apto."
                                    : "Ocup."}
                                </span>
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )}

            {step === 4 && confirmedReservations.length > 0 && (
              <Card className="border-primary/25 shadow-md">
                <CardHeader className="space-y-1 p-3 pb-2">
                  <div className="flex items-center gap-2 text-primary">
                    <CalendarCheck className="size-5" aria-hidden />
                    <CardTitle className="font-serif text-charcoal text-base">
                      {confirmedReservations.length === 1
                        ? "Reserva confirmada"
                        : "Reservas confirmadas"}
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs">
                    Apto. {apartment} · ordem por data
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 p-3 pt-0">
                  <ul className="space-y-3">
                    {confirmedReservations.map((r) => (
                      <li
                        key={`${r.dateYmd}-${normalizeSlotStart(r.slot)}`}
                        className="border-border/70 text-charcoal border-b pb-3 text-sm last:border-0 last:pb-0"
                      >
                        <span className="font-medium tabular-nums">
                          {format(fromYmd(r.dateYmd), "EEE, dd/MM/yy", {
                            locale: ptBR,
                          })}
                        </span>
                        <span className="text-muted-foreground"> · </span>
                        <span className="tabular-nums font-semibold">
                          {slotLabel(r.slot)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-charcoal/90 text-xs leading-snug">
                    Alterações na recepção.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 w-full border-charcoal/20 text-sm"
                    onClick={goNewReservationFromSummary}
                  >
                    Nova reserva
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      <footer className="bg-footer flex w-full shrink-0 flex-col items-center gap-1 py-2 text-center text-footer-fg/95">
        <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-footer-fg/90 sm:text-[11px]">
          Hotel Valle D&apos;incanto
        </p>
        <p className="text-[10px] leading-tight sm:text-[11px]">
          Dúvidas, fale conosco através do ramal 9
        </p>
      </footer>
    </div>
  );
}
