"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";

import { deleteExperienceBooking, loadExperience, saveExperienceBooking, setupExperience } from "@/app/actions/experiences";
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
import { experiences, type Experience, type ExperienceBooking } from "@/lib/experiences";

type Sheet = Extract<Awaited<ReturnType<typeof loadExperience>>, { ok: true }>;
const selectClass = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

export function ExperienceSheet({ experience, day }: { experience: Experience; day: string }) {
  const definition = experiences[experience];
  const [sheet, setSheet] = useState<Sheet>();
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [showSetup, setShowSetup] = useState(false);
  const [line, setLine] = useState<number>();
  const [removing, setRemoving] = useState<ExperienceBooking>();
  const [customer, setCustomer] = useState<ExperienceBooking["customer"]>("guest");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
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
      setShowSetup(experience !== "pizza" && !result.session);
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
        const result = await setupExperience({ experience, day }, {
          title: fields.get("title"),
          start_time: fields.get("time"),
        });
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

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="font-serif text-lg text-charcoal">{definition.label}</CardTitle>
        {heading && <p className="text-sm [overflow-wrap:anywhere]">{heading.title} · {heading.start_time.slice(0, 5)}</p>}
      </CardHeader>
      <CardContent>
        {loadError && <p role="alert" className="mb-2 text-sm text-destructive">{loadError}</p>}
        {loadError && <Button variant="outline" onClick={reloadSheet}>Tentar novamente</Button>}
        {!loadError && !sheet && <p role="status">Carregando planilha…</p>}
        {sheet && definition.setupLabel && !heading && (
          <Button variant="outline" onClick={() => { setError(""); setShowSetup(true); }}>Definir experiência</Button>
        )}
        {sheet && (!definition.setupLabel || heading) && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" aria-label={definition.label}>
              <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th scope="col" className="rounded-l-md px-3 py-3">Apto</th>
                  <th scope="col" className="w-full px-3 py-3">Nome</th>
                  <th scope="col" className="rounded-r-md px-3 py-3"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: definition.rows }, (_, index) => {
                  const row = index + 1;
                  const booking = sheet.bookings.find((item) => item.line === row);
                  function openBooking() {
                    setError("");
                    setStale(false);
                    setCustomer(booking?.customer ?? "guest");
                    setLine(row);
                  }
                  return (
                    <tr key={row} className="cursor-pointer border-b border-border/60 hover:bg-muted/30" onClick={openBooking}>
                      <td className="whitespace-nowrap px-3 py-2">{booking?.apartment ?? (booking ? "Externo" : "—")}</td>
                      <td className="px-3 py-2">
                        <button type="button" className="block w-full text-left [overflow-wrap:anywhere]" onClick={(event) => {
                          event.stopPropagation();
                          openBooking();
                        }} aria-label={booking ? `Editar linha ${row}, ${booking.name}` : `Cadastrar na linha ${row}`}>
                          {booking?.name ?? "—"}
                        </button>
                      </td>
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
            </table>
          </div>
        )}

        <Dialog open={showSetup || line !== undefined} onOpenChange={(open) => {
          if (!open && !busy) {
            setShowSetup(false);
            setLine(undefined);
          }
        }}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto">
            <DialogHeader className="pr-8">
              <DialogTitle>{showSetup ? definition.label : current ? "Editar reserva" : "Cadastrar reserva"}</DialogTitle>
              <DialogDescription>
                {showSetup ? "Preencha os dados para abrir a planilha." : `${definition.label} · Linha ${line}`}
              </DialogDescription>
            </DialogHeader>
            <form key={showSetup ? "setup" : line} className="grid gap-4" onSubmit={submit}>
              {showSetup ? (
                <>
                  <label className="grid gap-1 text-sm">{definition.setupLabel}<Input name="title" required maxLength={200} /></label>
                  <label className="grid gap-1 text-sm">Horário<Input name="time" type="time" required /></label>
                </>
              ) : (
                <>
                  {experience !== "cinema" && (
                    <label className="grid gap-1 text-sm">Cliente
                      <select className={selectClass} value={customer} onChange={(event) => {
                        setCustomer(event.target.value === "external" ? "external" : "guest");
                      }}>
                        <option value="guest">Hóspede</option>
                        <option value="external">Externo</option>
                      </select>
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
                  <label className="grid gap-1 text-sm">{customer === "guest" ? "Nome dos hóspedes" : "Nome"}
                    <Input name="name" required maxLength={200} defaultValue={current?.name ?? ""} />
                  </label>
                  {experience === "wine" && (
                    <label className="grid gap-1 text-sm">Pax
                      <Input name="pax" type="number" min={1} max={999} required defaultValue={current?.pax ?? 1} />
                    </label>
                  )}
                  {experience === "pizza" && (
                    <div className="grid grid-cols-2 gap-4">
                      <label className="grid gap-1 text-sm">Adultos
                        <Input name="adults" type="number" min={0} max={999} required defaultValue={current?.adults ?? 1} />
                      </label>
                      <label className="grid gap-1 text-sm">CHD
                        <Input name="children" type="number" min={0} max={999} required defaultValue={current?.children ?? 0} />
                      </label>
                    </div>
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
                : <Button type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button>}
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={Boolean(removing)} onOpenChange={(open) => {
          if (!open && !busy) setRemoving(undefined);
        }}>
          <AlertDialogContent>
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
