"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { CalendarDays, Settings, Trash2 } from "lucide-react";

import { deleteExperience, deleteExperienceBooking, editCinemaSession, loadExperience, moveExperience, editExperienceDetails, saveExperienceBooking, savePizzaCapacity, saveWineCapacity, setupExperience } from "@/app/actions/experiences";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ALLOWED_APARTMENT_NUMBERS } from "@/lib/apartment-codes";
import { PHONE_HINT, formatPhoneDisplay } from "@/lib/phone";
import { PIZZA_DEFAULT_CAPACITY, PIZZA_MAX_ROWS, PIZZA_DEFAULT_PRICE_CENTS, WINE_DEFAULT_CAPACITY, formatPizzaPrice, experiences, type Experience, type ExperienceBooking } from "@/lib/experiences";

import { ReservationDateDialog } from "./reservation-date-dialog";

type Sheet = Extract<Awaited<ReturnType<typeof loadExperience>>, { ok: true }>;
const defaultStartTime = { cinema: "19:30", wine: "18:00", pizza: "20:00" };
const selectClass = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

export function ExperienceSheet({ experience, day, toolbar, onDayChange, onDismissSetup }: { experience: Experience; day: string; toolbar?: ReactNode; onDayChange?: (day: string) => void; onDismissSetup?: () => void }) {
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" })
    .format(new Date(`${day}T12:00:00Z`));
  const dateLabel = `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} | ${day.split("-").reverse().join("/")}`;
  const definition = experiences[experience];
  const isPizza = experience === "pizza";
  const [sheet, setSheet] = useState<Sheet>();
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [showSetup, setShowSetup] = useState(false);
  const [line, setLine] = useState<number>();
  const [dateOpen, setDateOpen] = useState(false);
  const [capacityOpen, setCapacityOpen] = useState(false);
  const [pendingBooking, setPendingBooking] = useState<{ day: string; line: number }>();
  const [overCapacityLine, setOverCapacityLine] = useState<number>();
  const [removing, setRemoving] = useState<ExperienceBooking>();
  const [deletingSheet, setDeletingSheet] = useState(false);
  const [customer, setCustomer] = useState<ExperienceBooking["customer"]>("guest");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const editingSession = showSetup && Boolean(sheet?.session);
  const hasDialogDescription = showSetup && !editingSession;
  const current = sheet?.bookings.find((booking) => booking.line === line);

  useEffect(() => {
    let active = true;
    loadExperience({ experience, day }).then((result) => {
      if (!active) return;
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      setSheet(result);
      setShowSetup(!result.session);
    }).catch(() => {
      if (active) setLoadError("Não foi possível carregar a planilha.");
    });
    return () => { active = false; };
  }, [experience, day, reload]);

  function reloadSheet() {
    setSheet(undefined);
    setShowSetup(false);
    setLine(undefined);
    setRemoving(undefined);
    setError("");
    setStale(false);
    setLoadError("");
    setReload((value) => value + 1);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || stale) return;
    const fields = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      if (line === undefined) {
        const key = { experience, day };
        const details = {
          title: isPizza ? definition.label : fields.get("title"),
          start_time: fields.get("time"),
        };
        if (experience === "cinema" && sheet?.session) {
          const result = await editCinemaSession(key, details, {
            title: sheet.session.title,
            start_time: sheet.session.start_time.slice(0, 5),
          });
          if (!result.ok) {
            setError(result.error);
            setStale("conflict" in result && result.conflict);
            return;
          }
          setSheet((previous) => previous && { ...previous, session: result.session });
          setShowSetup(false);
          return;
        }
        const result = await setupExperience(key, details);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setSheet(result);
        setShowSetup(false);
        return;
      }

      const result = await saveExperienceBooking({ experience, day, line }, {
        customer,
        apartment: fields.get("apartment") ?? undefined,
        name: fields.get("name"),
        pax: experience === "wine" ? Number(fields.get("pax")) : undefined,
        adults: experience === "pizza" ? Number(fields.get("adults")) : undefined,
        children: experience === "pizza" ? Number(fields.get("children")) : undefined,
        notes: fields.get("notes") ?? undefined,
        ...(isPizza && {
          price: fields.get("price"),
          complimentary: fields.has("complimentary"),
        }),
        ...((isPizza || (experience === "wine" && customer === "external")) && {
          numbers: fields.get("numbers"),
          phone: fields.get("phone"),
        }),
        revision: current?.revision ?? null,
      });
      if (!result.ok) {
        setError(result.error);
        setStale("conflict" in result && result.conflict);
        return;
      }
      setSheet((previous) => previous && {
        ...previous,
        bookings: [...previous.bookings.filter((booking) => booking.line !== line), result.booking],
      });
      setLine(undefined);
    } catch {
      setError("Não foi possível salvar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function submitDate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const target = String(new FormData(event.currentTarget).get("targetDay"));
    setBusy(true);
    setError("");
    try {
      const result = await moveExperience({ experience, day }, target);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDateOpen(false);
      onDayChange?.(target);
    } catch {
      setError("Não foi possível alterar a data.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCapacity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    const value = Number(fields.get("capacity"));
    const winery = String(fields.get("winery") ?? "").trim();
    const time = String(fields.get("wineTime") ?? "");
    if (experience === "wine" && (!winery || !time)) {
      setError("Informe a vinícola e o horário.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = experience === "wine"
        ? await saveWineCapacity(day, value)
        : await savePizzaCapacity(day, value);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSheet((previous) => previous && { ...previous, capacity: result.capacity });
      if ((experience === "wine" || experience === "pizza") &&
          ((experience === "wine" && winery !== sheet?.session?.title) || time !== sheet?.session?.start_time.slice(0, 5))) {
        const renamed = await editExperienceDetails(experience, day, { title: isPizza ? definition.label : winery, start_time: time });
        if (!renamed.ok) {
          setError(`Capacidade salva. ${renamed.error}`);
          return;
        }
        setSheet((previous) => previous && { ...previous, session: renamed.session });
      }
      setCapacityOpen(false);
    } catch {
      setError("Não foi possível salvar a capacidade.");
    } finally {
      setBusy(false);
    }
  }

  async function removeSheet() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await deleteExperience({ experience, day });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDeletingSheet(false);
      if (onDismissSetup) onDismissSetup();
      else reloadSheet();
    } catch {
      setError("Não foi possível apagar a experiência.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy || stale || !removing) return;
    setBusy(true);
    setError("");
    try {
      const result = await deleteExperienceBooking({ experience, day, line: removing.line }, removing.revision);
      if (!result.ok) {
        setError(result.error);
        setStale("conflict" in result && result.conflict);
        return;
      }
      setSheet((previous) => previous && {
        ...previous,
        bookings: previous.bookings.filter((booking) => booking.line !== removing.line),
      });
      setRemoving(undefined);
    } catch {
      setError("Não foi possível excluir. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  const heading = sheet?.session;
  const isWine = experience === "wine";
  const pizzaBookings = isPizza ? sheet?.bookings ?? [] : [];
  const wineBookings = isWine ? sheet?.bookings ?? [] : [];
  const capacity = sheet?.capacity ?? (isWine ? WINE_DEFAULT_CAPACITY : PIZZA_DEFAULT_CAPACITY);
  const winePax = wineBookings.reduce((total, booking) => total + (booking.pax ?? 0), 0);
  const wineApartments = new Set(wineBookings.flatMap((booking) => booking.customer === "guest" && booking.apartment ? [booking.apartment] : [])).size;
  const wineExternals = wineBookings.filter((booking) => booking.customer === "external").length;
  const adults = pizzaBookings.reduce((total, booking) => total + (booking.adults ?? 0), 0);
  const children = pizzaBookings.reduce((total, booking) => total + (booking.children ?? 0), 0);
  const apartments = new Set(pizzaBookings.flatMap((booking) => booking.customer === "guest" && booking.apartment ? [booking.apartment] : [])).size;
  const externals = pizzaBookings.filter((booking) => booking.customer === "external").length;
  const lastOccupiedLine = pizzaBookings.reduce((last, booking) => Math.max(last, booking.line), 0);
  const rowCount = Math.max(definition.rows, Math.min(PIZZA_MAX_ROWS, lastOccupiedLine + 1));
  const pizzaTotal = isPizza
    ? sheet?.bookings.reduce((total, booking) =>
        total + (booking.complimentary ? 0 : booking.price_cents ?? PIZZA_DEFAULT_PRICE_CENTS), 0) ?? 0
    : 0;

  const sessionDateControls = (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" disabled={busy} className="min-w-0 flex-1 whitespace-normal"
        onClick={() => { setError(""); setShowSetup(false); setCapacityOpen(false); setDateOpen(true); }}>
        <CalendarDays className="size-4" aria-hidden />
        {dateLabel}
      </Button>
      <Button type="button" variant="ghost" size="icon" disabled={busy}
        className="text-muted-foreground hover:text-destructive"
        aria-label="Apagar experiência" title="Apagar experiência"
        onClick={() => { setError(""); setDeletingSheet(true); }}>
        <Trash2 className="size-4" aria-hidden />
      </Button>
    </div>
  );

  return (
    <Card className="border-border/80 shadow-sm" hidden={!loadError && (!sheet || !heading)}>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <div className="flex items-center gap-1">
            <CardTitle className="font-serif text-lg text-charcoal">{definition.label}</CardTitle>
            {experience === "cinema" && heading && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground"
                  aria-label="Editar experiência"
                  title="Editar experiência"
                  onClick={() => {
                    setError("");
                    setStale(false);
                    setShowSetup(true);
                  }}
                >
                  <Settings className="size-4" aria-hidden />
                </Button>
            )}
            {experience === "wine" && heading && (
              <Button type="button" variant="ghost" size="icon" className="size-8"
                aria-label="Configurar experiência"
                onClick={() => { setError(""); setCapacityOpen(true); }}>
                <Settings className="size-4" aria-hidden />
              </Button>
            )}
            {isPizza && sheet && (
              <Button type="button" variant="ghost" size="icon" className="size-8"
                aria-label="Alterar capacidade" title="Alterar capacidade"
                onClick={() => { setError(""); setCapacityOpen(true); }}>
                <Settings className="size-4" aria-hidden />
              </Button>
            )}
          </div>
          {toolbar}
        </div>
        {heading && experience !== "cinema" && (
          <p className="text-sm [overflow-wrap:anywhere]">
            {!isPizza && `${heading.title} · `}
            {heading.start_time.slice(0, 5)}
          </p>
        )}
        {heading && experience === "cinema" && (
          <div className="flex flex-wrap items-center gap-x-2 text-sm">
            <div className="flex min-w-0 items-center gap-1">
              <p className="[overflow-wrap:anywhere]">{heading.title}</p>
            </div>
            <span>· {heading.start_time.slice(0, 5)}</span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loadError && <p role="alert" className="mb-2 text-sm text-destructive">{loadError}</p>}
        {loadError && <Button variant="outline" onClick={reloadSheet}>Tentar novamente</Button>}
        {!loadError && !sheet && <p role="status">Carregando planilha…</p>}
        {sheet && !heading && (
          <Button variant="outline" onClick={() => { setError(""); setShowSetup(true); }}>Definir experiência</Button>
        )}
        {sheet && heading && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" aria-label={definition.label}>
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th scope="col" className="rounded-l-md px-3 py-3">Apto</th>
                  <th scope="col" className={isPizza ? "w-[23%] min-w-32 px-3 py-3" : "w-full px-3 py-3"}>Nome</th>
                  {isPizza && <>
                    <th scope="col" className="w-full min-w-32 px-3 py-3">Observações</th>
                    <th scope="col" className="px-3 py-3">Contato</th>
                    <th scope="col" className="px-3 py-3">Valor</th>
                    <th scope="col" className="px-3 py-3">Avulsa</th>
                  </>}
                  {isWine && <>
                    <th scope="col" className="min-w-32 px-3 py-3">Observações</th>
                    <th scope="col" className="px-3 py-3">Contato</th>
                    <th scope="col" className="px-3 py-3">Avulsa</th>
                  </>}
                  <th scope="col" className="rounded-r-md px-3 py-3"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: rowCount }, (_, index) => {
                  const row = index + 1;
                  const booking = sheet.bookings.find((item) => item.line === row);
                  function openBooking() {
                    setError("");
                    setStale(false);
                    setCustomer(booking?.customer ?? "guest");
                    if (booking) setLine(row);
                    else setPendingBooking({ day, line: row });
                  }
                  return (
                    <tr key={row} className="cursor-pointer border-b border-border/60 hover:bg-muted/30" onClick={openBooking}>
                      <td className="whitespace-nowrap px-3 py-2">{booking?.apartment ?? (booking ? <span className="italic">Externo</span> : "—")}</td>
                      <td className="px-3 py-2">
                        <button type="button" className="block w-full text-left [overflow-wrap:anywhere]" onClick={(event) => {
                          event.stopPropagation();
                          openBooking();
                        }} aria-label={booking ? `Editar linha ${row}, ${booking.name}` : `Cadastrar na linha ${row}`}>
                          {booking?.name ?? "—"}
                        </button>
                      </td>
                      {isPizza && <>
                        <td className="min-w-32 whitespace-pre-wrap px-3 py-2 [overflow-wrap:anywhere]">{booking?.notes}</td>
                        <td className="whitespace-nowrap px-3 py-2">{booking?.phone && formatPhoneDisplay(booking.phone)}</td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {booking && (booking.complimentary ? <span className="italic">Cortesia</span> : formatPizzaPrice(booking.price_cents ?? PIZZA_DEFAULT_PRICE_CENTS))}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 italic">{booking?.numbers}</td>
                      </>}
                      {isWine && <>
                        <td className="whitespace-pre-wrap px-3 py-2 [overflow-wrap:anywhere]">{booking?.notes}</td>
                        <td className="whitespace-nowrap px-3 py-2">{booking?.phone && formatPhoneDisplay(booking.phone)}</td>
                        <td className="px-3 py-2 [overflow-wrap:anywhere]">{booking?.numbers}</td>
                      </>}
                      <td className="px-3 py-2" onClick={(event) => event.stopPropagation()}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="size-9 p-0 text-muted-foreground hover:bg-transparent hover:text-destructive lg:size-8"
                          aria-label={`Excluir reserva da linha ${row}`}
                          title="Excluir reserva"
                          disabled={!booking}
                          onClick={() => { setError(""); setStale(false); setRemoving(booking); }}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {(isPizza || isWine) && (
                <tfoot className="border-t border-border bg-muted/50 font-semibold">
                  <tr>
                    <td colSpan={isPizza ? 3 : 5} className="px-3 py-2">
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {isPizza ? <>
                          <span>{adults + children}/{capacity} lugares</span>
                          <span>Aptos: {apartments}</span>
                          <span>Externos: {externals}</span>
                          <span>Adultos: {adults}</span>
                          <span>Crianças: {children}</span>
                        </> : <>
                          <span>{winePax}/{capacity} lugares</span>
                          <span>Aptos: {wineApartments}</span>
                          <span>Externos: {wineExternals}</span>
                          <span>Pax: {winePax}</span>
                        </>}
                      </div>
                    </td>
                    {isPizza && <>
                      <th scope="row" className="px-3 py-2 text-right">Total</th>
                      <td className="whitespace-nowrap px-3 py-2">{formatPizzaPrice(pizzaTotal)}</td>
                      <td colSpan={2} />
                    </>}
                    {isWine && <td />}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        <ReservationDateDialog
          day={pendingBooking?.day}
          onCancel={() => setPendingBooking(undefined)}
          onConfirm={() => {
            const pending = pendingBooking;
            setPendingBooking(undefined);
            if (!pending || pending.day !== day) return;
            if ((isPizza && adults + children >= capacity) || (isWine && winePax >= capacity)) setOverCapacityLine(pending.line);
            else setLine(pending.line);
          }}
        />

        <Dialog open={showSetup || line !== undefined} onOpenChange={(open) => {
          if (!open && !busy) {
            if (showSetup && !heading) onDismissSetup?.();
            setShowSetup(false);
            setLine(undefined);
          }
        }}>
          <DialogContent
            className={`max-h-[90dvh] overflow-y-auto sm:max-w-sm ${editingSession ? "pt-12" : ""}`}
            {...(!hasDialogDescription ? { "aria-describedby": undefined } : {})}
          >
            <DialogHeader className={editingSession || (isPizza && !showSetup && !current) ? "sr-only" : "pr-8"}>
              <DialogTitle>{showSetup ? (heading ? "Editar experiência" : definition.label) : current ? "Editar reserva" : "Cadastrar reserva"}</DialogTitle>
              {hasDialogDescription && (
                <DialogDescription>
                  {showSetup && !heading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="relative inline-flex">
                        <input
                          type="date"
                          aria-label="Alterar data da experiência"
                          value={day}
                          onChange={(event) => {
                            if (event.target.value) onDayChange?.(event.target.value);
                          }}
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        />
                        <CalendarDays className="size-4" aria-hidden />
                      </span>
                      <time dateTime={day}>
                        {new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`))} {day.split("-").reverse().join("/")}
                      </time>
                    </span>
                  ) : null}
                </DialogDescription>
              )}
            </DialogHeader>
            <form key={showSetup ? "setup" : line} className="grid gap-4" onSubmit={submit}>
              {showSetup && heading && sessionDateControls}
              {showSetup ? (
                <>
                  {!isPizza && <label className="grid gap-1 text-sm">{definition.setupLabel}<Input name="title" required maxLength={200} defaultValue={heading?.title} /></label>}
                  <label className="grid gap-1 text-sm">Horário<Input name="time" type="time" required defaultValue={heading?.start_time.slice(0, 5) ?? defaultStartTime[experience]} /></label>
                </>
              ) : (
                <>
                  <div className={experience === "wine" ? "grid grid-cols-2 gap-2 sm:gap-4" : isPizza ? "grid grid-cols-2 gap-2 sm:gap-4" : "contents"}>
                    {experience !== "cinema" && (
                      <label className={isPizza && customer === "external" ? "col-span-2 grid gap-1 text-sm" : "grid gap-1 text-sm"}>Cliente
                        <select className={selectClass} value={customer} onChange={(event) => {
                          setCustomer(event.target.value === "external" ? "external" : "guest");
                        }}>
                          <option value="guest">Hóspede</option>
                          <option value="external">Externo</option>
                        </select>
                      </label>
                    )}
                    {isWine && customer === "external" && (
                      <label className="grid min-w-0 gap-1 text-sm">Avulsa
                        <Input name="numbers" inputMode="numeric" pattern="[0-9]*" maxLength={30}
                          defaultValue={current?.numbers ?? ""}
                          onChange={(event) => {
                            event.currentTarget.value = event.currentTarget.value.replace(/[^0-9]/g, "");
                          }} />
                      </label>
                    )}
                    {customer === "guest" && (
                      <label className="grid gap-1 text-sm">Apto
                        <Input name="apartment" list="experience-apartments" inputMode="numeric" required defaultValue={current?.apartment ?? ""} />
                        <datalist id="experience-apartments">
                          {ALLOWED_APARTMENT_NUMBERS.map((apartment) => <option key={apartment} value={apartment} />)}
                        </datalist>
                      </label>
                    )}
                  </div>
                  <label className="grid gap-1 text-sm">{customer === "guest" ? "Nome dos hóspedes" : "Nome"}
                    <Input name="name" required maxLength={200} defaultValue={current?.name ?? ""} />
                  </label>
                  {isWine && (
                    <div className={customer === "external" ? "grid grid-cols-2 gap-2 sm:gap-4" : "grid"}>
                      <label className="grid min-w-0 gap-1 text-sm">Pax
                        <Input name="pax" type="number" min={1} max={999} required defaultValue={current?.pax ?? 1} />
                      </label>
                      {customer === "external" && (
                        <label className="grid min-w-0 gap-1 text-sm">Contato
                          <Input name="phone" type="tel" autoComplete="tel" maxLength={40} defaultValue={current?.phone ?? ""} />
                        </label>
                      )}
                    </div>
                  )}
                  {isPizza && (
                    <>
                      <div className="grid grid-cols-3 gap-2 sm:gap-4">
                        <label className="grid min-w-0 gap-1 text-sm">Adultos
                          <Input name="adults" type="number" min={0} max={999} required defaultValue={current?.adults ?? 1} />
                        </label>
                        <label className="grid min-w-0 gap-1 text-sm">CHD
                          <Input name="children" type="number" min={0} max={999} required defaultValue={current?.children ?? 0} />
                        </label>
                        <label className="grid min-w-0 gap-1 text-sm">Avulsa
                          <Input name="numbers" inputMode="numeric" pattern="[0-9]*" maxLength={30}
                            defaultValue={current?.numbers ?? ""}
                            onChange={(event) => {
                              const input = event.currentTarget;
                              input.value = input.value.replace(/[^0-9]/g, "");
                            }} />
                        </label>
                      </div>
                      <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-x-2 gap-y-1 sm:gap-x-4">
                        <label className="grid min-w-0 gap-1 text-sm">Contato
                          <Input name="phone" type="tel" autoComplete="tel" maxLength={40}
                            aria-describedby="pizza-phone-hint" defaultValue={current?.phone ?? ""} />
                        </label>
                        <label className="grid min-w-0 gap-1 text-sm">Valor
                          <Input name="price" inputMode="decimal" maxLength={24} required
                            defaultValue={formatPizzaPrice(current?.price_cents ?? PIZZA_DEFAULT_PRICE_CENTS)} />
                        </label>
                        <p id="pizza-phone-hint" className="col-span-2 text-xs text-muted-foreground">{PHONE_HINT}</p>
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <input name="complimentary" type="checkbox" defaultChecked={current?.complimentary} />
                        Cortesia
                      </label>
                    </>
                  )}
                  {experience !== "cinema" && (
                    <label className="grid gap-1 text-sm">Observações
                      <Textarea name="notes" maxLength={2000} defaultValue={current?.notes ?? ""} />
                    </label>
                  )}
                </>
              )}
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              {stale
                ? <Button type="button" onClick={reloadSheet}>Recarregar planilha</Button>
                : <Button type="submit" disabled={busy}>{busy ? "Salvando…" : showSetup && !heading ? "Definir experiência" : "Salvar"}</Button>}
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={dateOpen} onOpenChange={(open) => { if (!busy) setDateOpen(open); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Alterar data da experiência</DialogTitle>
              <DialogDescription>As reservas acompanham a experiência para a nova data.</DialogDescription>
            </DialogHeader>
            <form className="grid gap-4" onSubmit={submitDate}>
              <label className="grid gap-1 text-sm">Nova data
                <Input type="date" name="targetDay" defaultValue={day} required />
              </label>
              {error && <p role="alert">{error}</p>}
              <Button type="submit" disabled={busy}>Alterar data</Button>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={capacityOpen} onOpenChange={(open) => { if (!busy) setCapacityOpen(open); }}>
          <DialogContent className="pt-12 sm:max-w-sm" aria-describedby={undefined}>
            <DialogTitle className="sr-only">Alterar capacidade</DialogTitle>
            <form className="grid gap-4" onSubmit={submitCapacity}>
              {sessionDateControls}
              {isWine && (
                <label className="grid gap-1 text-sm">Vinícola
                  <Input name="winery" required maxLength={200} defaultValue={heading?.title} />
                </label>
              )}
              {(isWine || isPizza) && (
                <label className="grid gap-1 text-sm">Horário
                  <Input name="wineTime" type="time" required defaultValue={heading?.start_time.slice(0, 5)} />
                </label>
              )}
              <label className="grid gap-1 text-sm">Capacidade (pax)
                <Input name="capacity" type="number" min={1} max={PIZZA_MAX_ROWS} required defaultValue={capacity} />
              </label>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={overCapacityLine !== undefined}
          onOpenChange={(open) => { if (!open) setOverCapacityLine(undefined); }}>
          <AlertDialogContent className="sm:max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Capacidade máxima atingida</AlertDialogTitle>
              <AlertDialogDescription>Deseja acrescentar mais uma reserva?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row justify-between sm:justify-between">
              <AlertDialogCancel>Não</AlertDialogCancel>
              <AlertDialogAction onClick={() => setLine(overCapacityLine)}>Sim</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={deletingSheet} onOpenChange={(open) => { if (!busy) setDeletingSheet(open); }}>
          <AlertDialogContent className="max-w-[min(22rem,calc(100%-2rem))] p-4 sm:max-w-[22rem] sm:p-5">
            <AlertDialogHeader className="text-center sm:text-center">
              <AlertDialogTitle>Apagar esta experiência?</AlertDialogTitle>
              <AlertDialogDescription className="sr-only">
                A planilha de {definition.label} de {dateLabel} e todas as suas reservas serão apagadas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <AlertDialogFooter className="grid grid-cols-2 gap-2">
              <AlertDialogCancel className="w-full" disabled={busy}>Voltar</AlertDialogCancel>
              <AlertDialogAction className="h-auto min-h-9 w-full whitespace-normal" disabled={busy} onClick={(event) => {
                event.preventDefault();
                void removeSheet();
              }}>{busy ? "Apagando…" : "Apagar experiência"}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={Boolean(removing)} onOpenChange={(open) => {
          if (!open && !busy) setRemoving(undefined);
        }}>
          <AlertDialogContent className="sm:max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir esta reserva?</AlertDialogTitle>
              <AlertDialogDescription className="[overflow-wrap:anywhere]">A linha de {removing?.name} ficará disponível para outro cadastro.</AlertDialogDescription>
            </AlertDialogHeader>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <AlertDialogFooter>
              {stale && <Button onClick={reloadSheet}>Recarregar planilha</Button>}
              <AlertDialogCancel disabled={busy}>Voltar</AlertDialogCancel>
              <AlertDialogAction disabled={busy || stale} onClick={(event) => {
                event.preventDefault();
                void remove();
              }}>{busy ? "Excluindo…" : "Excluir"}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
