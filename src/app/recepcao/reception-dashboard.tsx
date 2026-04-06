"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogOut, Trash2 } from "lucide-react";
import Link from "next/link";

import {
  createReceptionReservation,
  deleteReservation,
  getReservationDaySummary,
  getReservationsForDate,
  loginReception,
  logoutReception,
} from "@/app/actions/reservations";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { ReceptionWaActions } from "@/components/reception-wa-actions";
import { ValleWordmark } from "@/components/valle-wordmark";
import { ALLOWED_APARTMENT_NUMBERS } from "@/lib/apartment-codes";
import { hotelCalendarDate } from "@/lib/hotel-time";
import {
  normalizeSlotStart,
  slotLabel,
  slotStartsFor,
  type Facility,
  type ReservationRow,
} from "@/lib/reservations";

function fromYmd(localYmd: string): Date {
  const [y, m, d] = localYmd.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Exibe dígitos armazenados como WhatsApp legível (BR). */
function formatWhatsappDisplay(digits: string | null | undefined): string {
  if (!digits || digits.length < 10) return "—";
  const d = digits.replace(/\D/g, "");
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return d;
}

type Props = { initialAuthed: boolean };

export function ReceptionDashboard({ initialAuthed }: Props) {
  const router = useRouter();
  const [authed, setAuthed] = useState(initialAuthed);

  useEffect(() => {
    setAuthed(initialAuthed);
  }, [initialAuthed]);
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const todayStr = useMemo(() => hotelCalendarDate(), []);
  const [facility, setFacility] = useState<Facility>("pool");
  const slotList = useMemo(() => [...slotStartsFor(facility)], [facility]);

  const [dateStr, setDateStr] = useState(todayStr);
  const [rows, setRows] = useState<ReservationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [newApt, setNewApt] = useState("");
  const [newReservationDate, setNewReservationDate] = useState(todayStr);
  const [newSlot, setNewSlot] = useState<string>(slotStartsFor("pool")[0] ?? "13:00:00");
  const [newWhatsapp, setNewWhatsapp] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [formOccupiedSlots, setFormOccupiedSlots] = useState<Set<string>>(
    () => new Set()
  );
  const [formBookedApts, setFormBookedApts] = useState<Set<string>>(
    () => new Set()
  );
  const [formSummaryLoading, setFormSummaryLoading] = useState(false);
  const [, setMinuteTick] = useState(0);

  useEffect(() => {
    let intervalId: number | undefined;
    const tick = () => setMinuteTick((n) => n + 1);
    const msToNextMinute = 60_000 - (Date.now() % 60_000);
    const timeoutId = window.setTimeout(() => {
      tick();
      intervalId = window.setInterval(tick, 60_000);
    }, msToNextMinute);
    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const first = slotStartsFor(facility)[0];
    if (first) setNewSlot(first);
  }, [facility]);

  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    setFormSummaryLoading(true);
    void (async () => {
      const r = await getReservationDaySummary(newReservationDate, facility);
      if (cancelled) return;
      setFormSummaryLoading(false);
      if (!r.ok) {
        setFormOccupiedSlots(new Set());
        setFormBookedApts(new Set());
        return;
      }
      const occ = new Set(
        r.occupiedSlots.map((s) => normalizeSlotStart(s))
      );
      setFormOccupiedSlots(occ);
      setFormBookedApts(new Set(r.apartmentsBooked));
      const list = slotStartsFor(facility);
      setNewSlot((prev) => {
        const pn = normalizeSlotStart(prev);
        if (!occ.has(pn)) return prev;
        const firstFree = list.find((s) => !occ.has(normalizeSlotStart(s)));
        return firstFree ?? prev;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [authed, newReservationDate, facility]);

  const bySlot = useMemo(() => {
    const m = new Map<string, ReservationRow>();
    for (const r of rows) {
      m.set(normalizeSlotStart(String(r.slot_start)), r);
    }
    return m;
  }, [rows]);

  const load = useCallback(async (dateOverride?: string) => {
    const ymd = dateOverride ?? dateStr;
    setLoading(true);
    try {
      const r = await getReservationsForDate(ymd, facility);
      if (!r.ok) {
        if (r.unauthorized) {
          setAuthed(false);
          toast.error(r.error);
          return;
        }
        toast.error(r.error);
        return;
      }
      setRows(r.rows);
    } catch {
      toast.error("Falha de rede ao carregar reservas.");
    } finally {
      setLoading(false);
    }
  }, [dateStr, facility]);

  useEffect(() => {
    if (!authed) return;
    void load();
  }, [authed, load]);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoggingIn(true);
    try {
      const r = await loginReception(password);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setPassword("");
      setAuthed(true);
      setDateStr(hotelCalendarDate());
      router.refresh();
      toast.success("Acesso liberado.");
    } catch {
      toast.error("Não foi possível validar a senha. Tente de novo.");
    } finally {
      setLoggingIn(false);
    }
  }

  async function onLogout() {
    await logoutReception();
    setAuthed(false);
    setRows([]);
    router.refresh();
    toast.message("Sessão encerrada.");
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const r = await deleteReservation(pendingDelete);
      setPendingDelete(null);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Reserva cancelada.");
      await load();
    } catch {
      toast.error("Falha ao cancelar. Tente novamente.");
    } finally {
      setDeleting(false);
    }
  }

  const aptAlreadyBooked =
    Boolean(newApt) && formBookedApts.has(newApt.trim());
  const slotAlreadyTaken = formOccupiedSlots.has(
    normalizeSlotStart(newSlot)
  );

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newApt.trim()) {
      toast.error("Selecione o apartamento.");
      return;
    }
    if (aptAlreadyBooked) {
      toast.error(
        "Este apartamento já tem reserva neste dia nesta instalação."
      );
      return;
    }
    if (slotAlreadyTaken) {
      toast.error("Este horário já está reservado. Escolha outro.");
      return;
    }
    setCreating(true);
    try {
      const r = await createReceptionReservation({
        facility,
        apartmentNumber: newApt,
        reservationDate: newReservationDate,
        slotStart: newSlot,
        guestWhatsapp: newWhatsapp.trim() ? newWhatsapp : undefined,
        notes: newNotes || undefined,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Reserva criada.");
      setNewApt("");
      setNewWhatsapp("");
      setNewNotes("");
      setNewReservationDate(hotelCalendarDate());
      await load();
    } catch {
      toast.error("Falha ao salvar. Verifique a conexão.");
    } finally {
      setCreating(false);
    }
  }

  if (!authed) {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <div className="mx-auto flex max-w-md flex-1 flex-col justify-center gap-6 p-6">
        <ValleWordmark size="md" className="mb-2" />
        <Card className="border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="font-serif text-lg text-charcoal">
              Acesso restrito
            </CardTitle>
            <CardDescription>Digite a senha da recepção.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onLogin} className="flex flex-col gap-4">
              <div className="space-y-2">
                <Label htmlFor="pw">Senha</Label>
                <Input
                  id="pw"
                  type="password"
                  autoComplete="current-password"
                  className="border-border bg-white"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={loggingIn} className="w-full">
                {loggingIn ? "Entrando…" : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>
        <Button variant="link" asChild className="text-muted-foreground">
          <Link href="/">← Voltar ao início</Link>
        </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-5xl space-y-5 px-4 pb-8 pt-4 sm:space-y-6 sm:px-6 md:pt-6 lg:max-w-6xl lg:space-y-8 lg:px-8 lg:pb-10 xl:max-w-7xl 2xl:max-w-[min(100%-4rem,96rem)]">
        <header className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
          <div className="min-w-0 space-y-3">
            <ValleWordmark size="sm" className="items-start text-left" />
            <h1 className="font-serif text-2xl font-semibold tracking-tight text-charcoal lg:text-3xl xl:text-4xl">
              Reservas
            </h1>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                className="lg:h-10 lg:px-4 lg:text-sm"
                variant={facility === "pool" ? "default" : "outline"}
                onClick={() => setFacility("pool")}
              >
                Piscina
              </Button>
              <Button
                type="button"
                size="sm"
                className="lg:h-10 lg:px-4 lg:text-sm"
                variant={facility === "gym" ? "default" : "outline"}
                onClick={() => setFacility("gym")}
              >
                Academia
              </Button>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void onLogout()}
            >
              <LogOut className="size-4" />
              Sair
            </Button>
          </div>
        </header>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4 lg:gap-6">
          <div className="min-w-0 space-y-1">
            <Input
              id="day"
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              aria-label="Dia"
              className="h-10 w-full max-w-full border-border bg-white sm:w-auto sm:min-w-[220px] lg:min-w-[240px]"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            className="w-full shrink-0 sm:w-auto lg:h-10"
            disabled={loading}
            onClick={() => void load()}
          >
            {loading ? "Atualizando…" : "Atualizar"}
          </Button>
          <p className="text-muted-foreground text-sm sm:ml-auto lg:text-base">
            {format(fromYmd(dateStr), "EEEE, dd/MM/yyyy", { locale: ptBR })}
          </p>
        </div>

        <Card className="border-border/80 shadow-sm">
          <CardContent
            className="min-w-0 overflow-x-auto overscroll-x-contain px-2 pb-2 pt-4 [scrollbar-gutter:stable] sm:px-6 sm:pb-6 sm:pt-6"
            role="region"
            aria-label="Grade de reservas do dia"
          >
            <table className="w-full min-w-[1040px] text-sm lg:min-w-[1100px] lg:text-[15px]">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 pr-4 font-medium lg:pr-5">Horário</th>
                  <th className="pb-2 pr-4 font-medium lg:pr-5">Apto</th>
                  <th className="pb-2 pr-4 font-medium lg:pr-5">Observações</th>
                  <th className="pb-2 pr-4 font-medium lg:pr-5">WhatsApp</th>
                  <th className="pb-2 pr-4 font-medium lg:pr-5">whatsapp</th>
                  <th className="pb-2 pr-4 font-medium lg:pr-5">Origem</th>
                  <th className="pb-2 pr-2 font-medium text-right lg:pl-2">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {slotList.map((slot) => {
                  const norm = normalizeSlotStart(slot);
                  const row = bySlot.get(norm);
                  return (
                    <tr key={slot} className="border-b border-border/60">
                      <td className="py-3 pr-4 font-medium lg:py-3.5 lg:pr-5">
                        {slotLabel(slot)}
                      </td>
                      <td className="py-3 pr-4 lg:py-3.5 lg:pr-5">
                        {row ? (
                          <span className="font-mono text-base lg:text-lg">
                            {row.apartment_number}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="max-w-[min(280px,72vw)] py-3 pr-4 align-top sm:max-w-[280px] lg:max-w-xs lg:py-3.5 lg:pr-5 xl:max-w-sm">
                        {row ? (
                          row.notes?.trim() ? (
                            <span
                              className="text-charcoal/90 line-clamp-3 text-xs leading-snug break-words"
                              title={row.notes}
                            >
                              {row.notes}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 lg:py-3.5 lg:pr-5">
                        {row ? (
                          <span className="font-mono text-xs sm:text-sm lg:text-[15px]">
                            {formatWhatsappDisplay(row.guest_whatsapp)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 align-middle lg:py-3.5 lg:pr-5">
                        {row ? (
                          <ReceptionWaActions
                            row={row}
                            onUpdated={() => void load()}
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 lg:py-3.5 lg:pr-5">
                        {row ? (
                          <Badge
                            variant={
                              row.created_by === "reception"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {row.created_by === "reception"
                              ? "Recepção"
                              : "Hóspede"}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 pl-2 text-right lg:py-3.5">
                        {row && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive lg:h-9 lg:px-3"
                            onClick={() => setPendingDelete(row.id)}
                          >
                            <Trash2 className="size-4" />
                            <span className="sr-only">Cancelar</span>
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="px-4 sm:px-6 lg:px-8">
            <CardTitle className="font-serif text-lg text-charcoal lg:text-xl">
              Nova reserva
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 lg:px-8">
            <form
              onSubmit={(e) => void onCreate(e)}
              className="grid gap-4 sm:grid-cols-2 lg:gap-6 xl:max-w-5xl"
            >
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="na">Apto</Label>
                <select
                  id="na"
                  required
                  className="border-input flex h-9 w-full rounded-md border border-border bg-white px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  value={newApt}
                  onChange={(e) => setNewApt(e.target.value)}
                >
                  <option value="">Selecione…</option>
                  {ALLOWED_APARTMENT_NUMBERS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="nd">Data</Label>
                <Input
                  id="nd"
                  type="date"
                  min={todayStr}
                  className="border-border bg-white"
                  value={newReservationDate}
                  onChange={(e) => setNewReservationDate(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="ns">Horário</Label>
                <select
                  id="ns"
                  className="border-input flex h-9 w-full rounded-md border border-border bg-white px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  value={newSlot}
                  onChange={(e) => setNewSlot(e.target.value)}
                >
                  {slotList.map((s) => {
                    const taken = formOccupiedSlots.has(
                      normalizeSlotStart(s)
                    );
                    return (
                      <option key={s} value={s} disabled={taken}>
                        {slotLabel(s)}
                        {taken ? " — ocupado" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="nw">WhatsApp (opcional)</Label>
                <Input
                  id="nw"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(00) 00000-0000"
                  className="border-border bg-white"
                  value={newWhatsapp}
                  onChange={(e) => setNewWhatsapp(e.target.value)}
                />
              </div>
              {(aptAlreadyBooked || slotAlreadyTaken) && (
                <p className="text-destructive text-sm sm:col-span-2">
                  {aptAlreadyBooked
                    ? "Este apartamento já possui reserva neste dia nesta instalação."
                    : "Este horário já está ocupado. Selecione outro."}
                </p>
              )}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="nn">Observações</Label>
                <Textarea
                  id="nn"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Opcional: pedido especial, nome do hóspede…"
                />
              </div>
              <div className="sm:col-span-2">
                <Button
                  type="submit"
                  disabled={
                    creating ||
                    formSummaryLoading ||
                    aptAlreadyBooked ||
                    slotAlreadyTaken
                  }
                >
                  {creating ? "Salvando…" : "Registrar reserva"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Button variant="link" asChild className="text-muted-foreground px-0">
          <Link href="/">← Início</Link>
        </Button>
      </div>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && !deleting && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar esta reserva?</AlertDialogTitle>
            <AlertDialogDescription>
              O horário voltará a ficar disponível para outros hóspedes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {deleting ? "Cancelando…" : "Sim, cancelar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
