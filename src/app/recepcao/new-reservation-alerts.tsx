"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Volume2, VolumeX, WifiOff } from "lucide-react";
import { toast } from "sonner";

import {
  listEndingSoonReservations,
  listNewReservations,
} from "@/app/actions/reservations";
import { Button } from "@/components/ui/button";
import { endingSoonLabel } from "@/lib/ending-soon";
import {
  alertLabel,
  mergeNewItems,
  type NewReservationItem,
} from "@/lib/new-reservations";

/** A cada quantos segundos a recepção pergunta ao servidor se entrou reserva nova. */
export const NEW_RESERVATION_POLL_MS = 10_000;
/** Depois de quantas falhas seguidas o aviso de "sem conexão" aparece. */
const OFFLINE_AFTER_FAILURES = 2;

/** Avisos da recepção (nova reserva, horário alterado, horário acabando) ficam na tela até alguém fechar. */
const STAY_UNTIL_CLOSED = Infinity;

const CURSOR_KEY = "valle.reception.newReservationsCursor";
const SOUND_KEY = "valle.reception.alertSound";
const UNREAD_KEY = "valle.reception.unreadAlerts";
const UNREAD_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** Reservas cujo alarme dos 10 min finais já tocou (id -> instante), para não repetir ao recarregar a página. */
const ENDING_KEY = "valle.reception.endingAlerted";
const ENDING_MAX_AGE_MS = 3 * 60 * 60 * 1000;

function readEndingAlerted(): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(readStorage(ENDING_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object") return {};
    const limit = Date.now() - ENDING_MAX_AGE_MS;
    const out: Record<string, number> = {};
    for (const [id, at] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof at === "number" && at >= limit) out[id] = at;
    }
    return out;
  } catch {
    return {};
  }
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* navegador sem armazenamento: segue sem lembrar */
  }
}

type Options = {
  enabled: boolean;
  todayYmd: string;
  /** Chamado quando chegam reservas novas (para atualizar a grade e o formulário na hora). */
  onFresh: (items: NewReservationItem[]) => void;
  onUnauthorized: () => void;
};

export function useNewReservationAlerts({
  enabled,
  todayYmd,
  onFresh,
  onUnauthorized,
}: Options) {
  const [unread, setUnread] = useState<NewReservationItem[]>([]);
  const [soundOn, setSoundOn] = useState(true);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const [offline, setOffline] = useState(false);
  const [lastOkAt, setLastOkAt] = useState<Date | null>(null);

  const cursorRef = useRef<string | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const unreadRef = useRef<NewReservationItem[]>([]);
  const inFlightRef = useRef(false);
  const failuresRef = useRef(0);
  const soundOnRef = useRef(true);
  const endingAlertedRef = useRef<Record<string, number> | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const todayRef = useRef(todayYmd);
  const onFreshRef = useRef(onFresh);
  const onUnauthorizedRef = useRef(onUnauthorized);
  todayRef.current = todayYmd;
  onFreshRef.current = onFresh;
  onUnauthorizedRef.current = onUnauthorized;

  // Preferência de som e marcador da última verificação (lembrados neste navegador).
  useEffect(() => {
    const s = readStorage(SOUND_KEY);
    if (s === "off") {
      setSoundOn(false);
      soundOnRef.current = false;
    }
    cursorRef.current = readStorage(CURSOR_KEY);
    // Avisos ainda não vistos sobrevivem a F5 / fechar e reabrir a aba (até 24 h).
    try {
      const raw = readStorage(UNREAD_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        const limit = Date.now() - UNREAD_MAX_AGE_MS;
        const kept = (parsed as NewReservationItem[]).filter(
          (i) =>
            i &&
            typeof i.id === "string" &&
            new Date(i.created_at).getTime() >= limit
        );
        if (kept.length > 0) {
          kept.forEach((i) => seenRef.current.add(i.id));
          unreadRef.current = kept;
          setUnread(kept);
        }
      }
    } catch {
      /* armazenamento corrompido: ignora */
    }
  }, []);

  const persistUnread = useCallback((list: NewReservationItem[]) => {
    writeStorage(UNREAD_KEY, JSON.stringify(list));
  }, []);

  const ensureAudio = useCallback((): AudioContext | null => {
    if (audioRef.current) return audioRef.current;
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      audioRef.current = new Ctor();
      return audioRef.current;
    } catch {
      return null;
    }
  }, []);

  const beep = useCallback(
    async (force = false) => {
      if (!force && !soundOnRef.current) return;
      const ctx = ensureAudio();
      if (!ctx) return;
      if (ctx.state === "suspended") {
        try {
          await ctx.resume();
        } catch {
          /* bloqueado pelo navegador */
        }
      }
      if (ctx.state !== "running") {
        setSoundBlocked(true);
        return;
      }
      setSoundBlocked(false);
      const t0 = ctx.currentTime;
      [880, 660, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t0 + i * 0.22);
        gain.gain.exponentialRampToValueAtTime(0.2, t0 + i * 0.22 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.22 + 0.18);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0 + i * 0.22);
        osc.stop(t0 + i * 0.22 + 0.2);
      });
    },
    [ensureAudio]
  );

  // O navegador só libera o som depois de um clique/tecla na página.
  useEffect(() => {
    if (!enabled) return;
    const unlock = () => {
      const ctx = ensureAudio();
      if (ctx && ctx.state === "suspended") {
        void ctx.resume().then(() => {
          if (ctx.state === "running") setSoundBlocked(false);
        });
      }
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [enabled, ensureAudio]);

  // Faltam 10 min para o fim de algum horário: mesmo alarme sonoro + mensagem na tela (uma vez por reserva).
  const checkEnding = useCallback(async () => {
    try {
      const r = await listEndingSoonReservations();
      if (!r.ok) return;
      if (endingAlertedRef.current === null) {
        endingAlertedRef.current = readEndingAlerted();
      }
      const done = endingAlertedRef.current;
      const fresh = r.items.filter((i) => !(i.id in done));
      if (fresh.length === 0) return;
      const now = Date.now();
      for (const i of fresh) done[i.id] = now;
      writeStorage(ENDING_KEY, JSON.stringify(done));
      for (const item of fresh.slice(0, 3)) {
        toast.warning("Horário acabando", {
          description: endingSoonLabel(item),
          duration: STAY_UNTIL_CLOSED,
        });
      }
      if (fresh.length > 3) {
        toast.warning(`+${fresh.length - 3} horários acabando`, {
          duration: STAY_UNTIL_CLOSED,
        });
      }
      void beep();
    } catch {
      /* falha aqui não afeta o aviso de reservas novas */
    }
  }, [beep]);

  const poll = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const r = await listNewReservations(cursorRef.current);
      if (!r.ok) {
        if (r.unauthorized) {
          onUnauthorizedRef.current();
          return;
        }
        failuresRef.current += 1;
        if (failuresRef.current >= OFFLINE_AFTER_FAILURES) setOffline(true);
        return;
      }
      failuresRef.current = 0;
      setOffline(false);
      setLastOkAt(new Date());
      cursorRef.current = r.cursor;
      writeStorage(CURSOR_KEY, r.cursor);

      const { unread: next, fresh } = mergeNewItems(
        unreadRef.current,
        r.items,
        seenRef.current
      );
      if (fresh.length > 0) {
        unreadRef.current = next;
        setUnread(next);
        persistUnread(next);
        const shown = fresh.slice(0, 3);
        for (const item of shown) {
          toast.success(item.kind === "changed" ? "Reserva alterada" : "Nova reserva", {
            description: alertLabel(item, todayRef.current),
            duration: STAY_UNTIL_CLOSED,
          });
        }
        if (fresh.length > shown.length) {
          toast.success(`+${fresh.length - shown.length} novas reservas`, {
            duration: STAY_UNTIL_CLOSED,
          });
        }
        void beep();
        onFreshRef.current(fresh);
      }
      await checkEnding();
    } catch {
      failuresRef.current += 1;
      if (failuresRef.current >= OFFLINE_AFTER_FAILURES) setOffline(true);
    } finally {
      inFlightRef.current = false;
    }
  }, [beep, persistUnread, checkEnding]);

  // Verificação periódica (também com a aba em segundo plano) e ao voltar para a aba.
  useEffect(() => {
    if (!enabled) return;
    void poll();
    const id = window.setInterval(() => void poll(), NEW_RESERVATION_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [enabled, poll]);

  // Título da aba com o contador. O Next pode reescrever o <title> depois da carga:
  // um observador reaplica o contador sempre que isso acontecer.
  useEffect(() => {
    const titleEl = document.querySelector("title");
    const n = unread.length;
    const compute = (t: string) => {
      const clean = t.replace(/^\(\d+\) Novas reservas · /, "");
      return n > 0 ? `(${n}) Novas reservas · ${clean}` : clean;
    };
    const apply = () => {
      const next = compute(document.title);
      if (document.title !== next) document.title = next;
    };
    apply();
    if (!titleEl) return;
    const mo = new MutationObserver(apply);
    mo.observe(titleEl, { childList: true, characterData: true, subtree: true });
    return () => {
      mo.disconnect();
      document.title = document.title.replace(/^\(\d+\) Novas reservas · /, "");
    };
  }, [unread.length]);

  const dismiss = useCallback((id: string) => {
    unreadRef.current = unreadRef.current.filter((i) => i.id !== id);
    setUnread(unreadRef.current);
    persistUnread(unreadRef.current);
  }, [persistUnread]);

  const dismissAll = useCallback(() => {
    unreadRef.current = [];
    setUnread([]);
    persistUnread([]);
  }, [persistUnread]);

  const toggleSound = useCallback(() => {
    const next = !soundOnRef.current;
    soundOnRef.current = next;
    setSoundOn(next);
    writeStorage(SOUND_KEY, next ? "on" : "off");
    if (next) void beep(true); // o clique libera o som e confirma que está funcionando
  }, [beep]);

  return {
    unread,
    dismiss,
    dismissAll,
    soundOn,
    soundBlocked,
    toggleSound,
    offline,
    lastOkAt,
  };
}

type BannerProps = {
  alerts: ReturnType<typeof useNewReservationAlerts>;
  todayYmd: string;
  onView: (item: NewReservationItem) => void;
};

function timeLabel(d: Date): string {
  return d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export function NewReservationBanner({ alerts, todayYmd, onView }: BannerProps) {
  const { unread, offline, lastOkAt, soundOn, soundBlocked } = alerts;
  return (
    <div className="space-y-2" data-testid="new-reservation-alerts">
      {offline ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            <strong>Sem conexão com o sistema.</strong> Novas reservas podem
            não ser avisadas
            {lastOkAt ? ` (última verificação às ${timeLabel(lastOkAt)})` : ""}.
            Verifique a internet.
          </p>
        </div>
      ) : null}

      {unread.length > 0 ? (
        <div
          role="status"
          aria-live="assertive"
          className="rounded-lg border border-emerald-600/40 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 font-semibold">
              <Bell className="size-4" aria-hidden />
              {unread.length === 1
                ? "1 nova reserva"
                : `${unread.length} novas reservas`}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 border-emerald-700/40 bg-white"
              onClick={alerts.dismissAll}
            >
              Marcar como vistas
            </Button>
          </div>
          <ul className="mt-2 space-y-1">
            {unread.slice(-5).reverse().map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <span className="tabular-nums">
                  {alertLabel(item, todayYmd)}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-emerald-900 underline"
                  onClick={() => {
                    onView(item);
                    alerts.dismiss(item.id);
                  }}
                >
                  Ver na grade
                </Button>
              </li>
            ))}
          </ul>
          {unread.length > 5 ? (
            <p className="mt-1 text-xs">e mais {unread.length - 5}…</p>
          ) : null}
        </div>
      ) : null}

      {soundBlocked && soundOn ? (
        <p className="text-right text-xs text-amber-700">
          O navegador bloqueou o som: clique em qualquer lugar da página.
        </p>
      ) : null}
    </div>
  );
}

export function SoundToggleButton({
  alerts,
}: {
  alerts: ReturnType<typeof useNewReservationAlerts>;
}) {
  const { soundOn } = alerts;
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="size-8 px-0"
      onClick={alerts.toggleSound}
      aria-pressed={soundOn}
      aria-label={soundOn ? "Som ligado" : "Som desligado"}
      title={soundOn ? "Som ligado (clique para desligar)" : "Som desligado (clique para ligar)"}
    >
      {soundOn ? (
        <Volume2 className="size-4" aria-hidden />
      ) : (
        <VolumeX className="size-4" aria-hidden />
      )}
    </Button>
  );
}
