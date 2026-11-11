"use client";

import { useEffect, useRef, useState } from "react";
import { ConciergeBell, Dumbbell, Settings, Smartphone, Waves, X } from "lucide-react";

import { listReservationHistory } from "@/app/actions/reservations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  actorLabel,
  changedFieldsLabel,
  formatEventWhen,
  historyTitle,
  reservationDetail,
  type HistoryItem,
} from "@/lib/reservation-history";
import { cn } from "@/lib/utils";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; items: HistoryItem[]; limit: number };

/** Quem fez: mesmos ícones da planilha (celular = hóspede, sineta = recepção). */
function ActorIcon({ actor }: { actor: string | null }) {
  if (actor === "guest") {
    return (
      <Smartphone
        className="text-muted-foreground size-4 shrink-0"
        aria-label={actorLabel(actor)}
        role="img"
      />
    );
  }
  if (actor === "reception") {
    return (
      <ConciergeBell
        className="text-muted-foreground size-4 shrink-0"
        aria-label={actorLabel(actor)}
        role="img"
      />
    );
  }
  return null;
}

/** Instalação: mesmos ícones da página inicial (ondas = piscina, halter = academia). */
function FacilityIcon({ facility }: { facility: "pool" | "gym" }) {
  const Icon = facility === "gym" ? Dumbbell : Waves;
  const label = facility === "gym" ? "Academia" : "Piscina";
  return (
    <Icon
      className="text-muted-foreground size-4 shrink-0"
      aria-label={label}
      role="img"
    />
  );
}

/** Linha do tempo: o mais recente em cima, cartões alternando esquerda/direita (no celular, uma coluna). */
function Timeline({ items }: { items: HistoryItem[] }) {
  return (
    <ol className="relative">
      <span
        aria-hidden
        className="bg-border absolute inset-y-2 left-3 w-px -translate-x-1/2 md:left-1/2"
      />
      {items.map((it, i) => {
        const cardLeft = i % 2 === 0;
        const when = formatEventWhen(it.occurredAt);
        const changed =
          it.type === "updated" ? changedFieldsLabel(it.changedFields) : "";
        return (
          <li
            key={it.id}
            className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-x-3 pb-4 last:pb-0 md:grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)] md:gap-x-0"
          >
            <span
              aria-hidden
              className={cn(
                "ring-card z-10 col-start-1 row-start-1 size-2.5 justify-self-center rounded-full ring-4 md:col-start-2",
                it.type === "cancelled" ? "bg-muted-foreground" : "bg-primary"
              )}
            />
            <div
              className={cn(
                "border-border/70 bg-card col-start-2 row-start-1 min-w-0 rounded-lg border px-4 py-3",
                cardLeft ? "md:col-start-1 md:mr-3" : "md:col-start-3 md:ml-3"
              )}
            >
              <p className="text-charcoal flex items-center gap-2 text-sm font-semibold leading-snug">
                <ActorIcon actor={it.actor} />
                <span className="min-w-0">
                  {historyTitle(it.type)}
                  {changed ? (
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      — {changed}
                    </span>
                  ) : null}
                </span>
              </p>
              {it.facility || reservationDetail(it) ? (
                <p className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
                  {it.facility ? <FacilityIcon facility={it.facility} /> : null}
                  <span className="min-w-0">{reservationDetail(it)}</span>
                </p>
              ) : null}
              {it.guestName ? (
                <p className="text-muted-foreground text-sm">{it.guestName}</p>
              ) : null}
              {it.actor !== "guest" && it.actor !== "reception" ? (
                <p className="text-muted-foreground/80 mt-1 text-xs">
                  {actorLabel(it.actor)}
                </p>
              ) : null}
              <p className="text-muted-foreground/80 mt-1 text-xs md:hidden">{when}</p>
            </div>
            <p
              className={cn(
                "text-muted-foreground hidden text-xs tabular-nums md:col-start-1 md:row-start-1 md:block",
                cardLeft ? "md:col-start-3 md:ml-3" : "md:col-start-1 md:mr-3 md:text-right"
              )}
            >
              {when}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

/** Engrenagem ao lado de "Sair": abre o histórico de alterações das reservas. */
export function HistoryButton({
  onUnauthorized,
}: {
  onUnauthorized: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const [date, setDate] = useState("");
  const [apartment, setApartment] = useState("");
  const [name, setName] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);
  const filtered = Boolean(date || apartment.trim() || name.trim());

  useEffect(() => {
    if (!open) return;
    let alive = true;
    // Espera um instante após digitar para não consultar a cada letra.
    const timer = setTimeout(() => {
      setRefreshing(true);
      listReservationHistory({ date, apartment, name })
      .then((r) => {
        if (!alive) return;
        setRefreshing(false);
        if (r.ok) {
          setState({ status: "ok", items: r.items, limit: r.limit });
          return;
        }
        if (r.unauthorized) {
          setOpen(false);
          onUnauthorized(r.error);
          return;
        }
        setState({ status: "error", message: r.error });
      })
      .catch(() => {
        if (!alive) return;
        setRefreshing(false);
        setState({ status: "error", message: "Falha de rede ao carregar o histórico." });
      });
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [open, onUnauthorized, date, apartment, name]);

  function clearFilters() {
    setDate("");
    setApartment("");
    setName("");
  }

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="size-8 px-0"
        onClick={() => {
          setDate("");
          setApartment("");
          setName("");
          setState({ status: "loading" });
          setOpen(true);
        }}
        aria-label="Histórico de alterações"
        title="Histórico de alterações"
        aria-haspopup="dialog"
      >
        <Settings className="size-4" aria-hidden />
      </Button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 sm:p-6"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="historico-titulo"
            className="bg-card text-card-foreground my-auto w-full max-w-4xl rounded-xl border p-5 sm:p-7"
          >
            <div className="mb-6 flex items-center justify-between gap-3">
              <h2
                id="historico-titulo"
                className="text-charcoal font-serif text-xl font-semibold"
              >
                Histórico
              </h2>
              <Button
                ref={closeRef}
                type="button"
                size="sm"
                variant="ghost"
                className="size-8 px-0"
                onClick={() => setOpen(false)}
                aria-label="Fechar histórico"
                title="Fechar"
              >
                <X className="size-4" aria-hidden />
              </Button>
            </div>
            <div className="mb-6 grid grid-cols-2 items-end gap-3 sm:grid-cols-[10rem_6rem_minmax(0,1fr)_auto]">
              <div className="space-y-1">
                <label htmlFor="hist-data" className="text-muted-foreground block text-xs">
                  Data
                </label>
                <Input
                  id="hist-data"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="hist-apto" className="text-muted-foreground block text-xs">
                  Apto
                </label>
                <Input
                  id="hist-apto"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="101"
                  value={apartment}
                  onChange={(e) => setApartment(e.target.value)}
                />
              </div>
              <div className="col-span-2 space-y-1 sm:col-span-1">
                <label htmlFor="hist-nome" className="text-muted-foreground block text-xs">
                  Nome
                </label>
                <Input
                  id="hist-nome"
                  maxLength={60}
                  placeholder="Nome do hóspede"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              {filtered ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="col-span-2 sm:col-span-1"
                  onClick={clearFilters}
                >
                  Limpar
                </Button>
              ) : null}
            </div>
            {state.status === "loading" ? (
              <p className="text-muted-foreground py-8 text-center text-sm">Carregando…</p>
            ) : state.status === "error" ? (
              <p role="alert" className="py-8 text-center text-sm text-red-700">
                {state.message}
              </p>
            ) : state.items.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                {filtered
                  ? "Nenhuma alteração encontrada com esses filtros."
                  : "Nenhuma alteração registrada ainda."}
              </p>
            ) : (
              <div aria-busy={refreshing} className={cn(refreshing && "opacity-60 transition-opacity")}>
                <Timeline items={state.items} />
                {state.items.length >= state.limit ? (
                  <p className="text-muted-foreground mt-4 text-center text-xs">
                    Mostrando as {state.limit} alterações mais recentes.
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
