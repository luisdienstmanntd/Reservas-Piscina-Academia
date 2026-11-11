"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, LogOut, Trash2 } from "lucide-react";

import {
  createReceptionReservation,
  cancelReservation,
  getReservationDaySummary,
  getReservationsForDate,
  loginReception,
  logoutReception,
  updateReservationGuestName,
  updateReservationNotes,
  updateReservationGuestWhatsapp,
} from "@/app/actions/reservations";
import { guestWhatsappOptionalSchema } from "@/lib/booking-zod";
import { formatPhoneDisplay, PHONE_HINT } from "@/lib/phone";
import { generateStayToken } from "@/app/actions/stays";
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
import { cn } from "@/lib/utils";
import { receptionSlotOrder, slotStartLabel } from "@/lib/reservation-grid";
import {
  NewReservationBanner,
  useNewReservationAlerts,
  SoundToggleButton,
} from "@/app/recepcao/new-reservation-alerts";
import type { NewReservationItem } from "@/lib/new-reservations";
import {
  SLOT_BLOCK_LABEL,
  SLOT_BLOCK_MESSAGE,
  isSlotEnded,
  slotBlockReason,
} from "@/lib/slot-availability";
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
import { ALLOWED_APARTMENT_NUMBERS } from "@/lib/apartment-codes";
import { hotelCalendarDate } from "@/lib/hotel-time";
import {
  normalizeSlotStart,
  slotLabel,
  receptionSlotStartsFor,
  slotStartsFor,
  type Facility,
  type ReservationRow,
} from "@/lib/reservations";

const GUEST_ACCESS_WELCOME_TEXT =
  "Sejam bem-vindos ao Valle D'incanto! Para sua melhor experiência, segue o link para agendamentos da piscina e academia:";

function guestAccessClipText(link: string): string {
  return `${GUEST_ACCESS_WELCOME_TEXT}\n\nlink:\n${link}`;
}

function fromYmd(localYmd: string): Date {
  const [y, m, d] = localYmd.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

const formatWhatsappDisplay = formatPhoneDisplay;

function ReceptionGuestWhatsappCell({
  row,
  onSaved,
}: {
  row: ReservationRow;
  onSaved: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(() => {
    const raw = row.guest_whatsapp?.replace(/\D/g, "") ?? "";
    if (!raw) return "";
    const disp = formatWhatsappDisplay(row.guest_whatsapp);
    return disp !== "—" ? disp : raw;
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (inputRef.current === document.activeElement) return;
    const raw = row.guest_whatsapp?.replace(/\D/g, "") ?? "";
    if (!raw) {
      setValue("");
      return;
    }
    const disp = formatWhatsappDisplay(row.guest_whatsapp);
    setValue(disp !== "—" ? disp : raw);
  }, [row.id, row.guest_whatsapp]);

  async function commit() {
    const parsed = guestWhatsappOptionalSchema.safeParse(value);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message);
      setValue(row.guest_whatsapp ? formatWhatsappDisplay(row.guest_whatsapp) : "");
      return;
    }
    if (value.trim() === (row.guest_whatsapp ? formatWhatsappDisplay(row.guest_whatsapp) : "")) return;
    setSaving(true);
    try {
      const r = await updateReservationGuestWhatsapp(
        row.id,
        parsed.data
      );
      if (!r.ok) {
        toast.error(r.error);
        setValue(
          row.guest_whatsapp ? formatWhatsappDisplay(row.guest_whatsapp) : ""
        );
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Input
      ref={inputRef}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      className="h-9 w-full min-w-0 border-border bg-white font-mono text-xs xl:h-8"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => void commit()}
      disabled={saving}
      placeholder="DDD ou + país"
      title={PHONE_HINT}
      aria-label="WhatsApp do hóspede"
    />
  );
}

function ReceptionGuestNameCell({
  row,
  onSaved,
}: {
  row: ReservationRow;
  onSaved: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(row.guest_name ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (inputRef.current === document.activeElement) return;
    setValue(row.guest_name ?? "");
  }, [row.id, row.guest_name]);

  async function commit() {
    const next = value.trim();
    const prev = (row.guest_name ?? "").trim();
    if (next === prev) return;
    setSaving(true);
    try {
      const r = await updateReservationGuestName(
        row.id,
        next.length ? next : null
      );
      if (!r.ok) {
        toast.error(r.error);
        setValue(row.guest_name ?? "");
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Input
      ref={inputRef}
      className="h-9 w-full min-w-0 border-border bg-white text-sm xl:h-8"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => void commit()}
      disabled={saving}
      placeholder="Nome"
      aria-label="Nome do hóspede"
      maxLength={200}
    />
  );
}

function ReceptionNotesCell({
  row,
  onSaved,
}: {
  row: ReservationRow;
  onSaved: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(row.notes ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (inputRef.current === document.activeElement) return;
    setValue(row.notes ?? "");
  }, [row.id, row.notes]);

  async function commit() {
    const next = value.trim();
    const prev = (row.notes ?? "").trim();
    if (next === prev) return;
    setSaving(true);
    try {
      const r = await updateReservationNotes(
        row.id,
        next.length ? next : null
      );
      if (!r.ok) {
        toast.error(r.error);
        setValue(row.notes ?? "");
        return;
      }
      onSaved();
    } catch {
      toast.error("Não foi possível salvar as observações. Tente novamente.");
      setValue(row.notes ?? "");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Input
      ref={inputRef}
      className="h-9 w-full min-w-0 border-border bg-white text-sm xl:h-8"
      title={value || "Observações"}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => void commit()}
      disabled={saving}
      placeholder="Observações"
      aria-label="Observações da reserva"
      maxLength={2000}
    />
  );
}

/** Colunas da grade em telas largas (xl+). Abaixo disso cada reserva vira um cartão. */
const GRID_TEMPLATE =
  "xl:grid-cols-[7.5rem_5.5rem_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1fr)_18rem_2.25rem]";
const GRID = `xl:grid xl:items-center xl:gap-x-3 ${GRID_TEMPLATE}`;

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-0.5 block text-xs text-muted-foreground xl:hidden">
      {children}
    </span>
  );
}

/** Horário sem reserva: só a hora, numa linha compacta (a planilha mostra o dia inteiro, uma linha por hora). */
function EmptySlotRow({ slot, past }: { slot: string; past: boolean }) {
  return (
    <li
      className={cn(
        "flex items-center rounded-md border border-dashed px-3 py-1 text-sm tabular-nums",
        "xl:rounded-none xl:border-0 xl:border-b xl:border-solid xl:border-border/60 xl:px-0",
        past ? "border-border/50 bg-muted/40 text-muted-foreground" : "border-border/70"
      )}
    >
      <span className="whitespace-nowrap font-medium xl:w-[7.5rem]">
        {slotStartLabel(slot)}
      </span>
    </li>
  );
}

function ReservationSlotRow({
  slot,
  row,
  onChanged,
  onAskCancel,
}: {
  slot: string;
  row: ReservationRow;
  onChanged: () => void;
  onAskCancel: (id: string) => void;
}) {
  const label = slotStartLabel(slot);

  return (
    <li
      className={cn(
        "space-y-2 rounded-lg border border-border bg-card p-3 shadow-sm",
        "xl:space-y-0 xl:rounded-none xl:border-0 xl:border-b xl:border-border/60 xl:bg-transparent xl:px-0 xl:py-2 xl:shadow-none",
        GRID
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 xl:contents">
        <span className="order-1 whitespace-nowrap font-medium tabular-nums xl:order-1">
          {label}
        </span>
        <span className="order-3 flex basis-full items-center gap-2 sm:order-2 sm:basis-auto xl:order-2 xl:flex-col xl:items-start xl:gap-0.5">
          <span className="font-mono text-base xl:text-lg">
            <span className="font-sans text-sm text-muted-foreground xl:hidden">
              Apto{" "}
            </span>
            {row.apartment_number}
          </span>
          <Badge
            variant={row.created_by === "reception" ? "secondary" : "outline"}
          >
            {row.created_by === "reception" ? "Recepção" : "Hóspede"}
          </Badge>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="order-2 ml-auto size-9 p-0 text-destructive hover:text-destructive sm:order-3 xl:order-7 xl:ml-0"
          onClick={() => onAskCancel(row.id)}
          title="Cancelar reserva"
        >
          <Trash2 className="size-4" />
          <span className="sr-only">Cancelar</span>
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)] xl:contents">
        <div className="order-1 min-w-0 xl:order-3">
          <FieldLabel>Hóspede</FieldLabel>
          <ReceptionGuestNameCell row={row} onSaved={onChanged} />
        </div>
        <div className="order-3 col-span-2 min-w-0 sm:col-span-1 xl:order-4">
          <FieldLabel>Observações</FieldLabel>
          <ReceptionNotesCell row={row} onSaved={onChanged} />
        </div>
        <div className="order-2 min-w-0 xl:order-5">
          <FieldLabel>WhatsApp</FieldLabel>
          <ReceptionGuestWhatsappCell row={row} onSaved={onChanged} />
        </div>
      </div>
      <div className="xl:order-6">
        <ReceptionWaActions row={row} onUpdated={onChanged} />
      </div>
    </li>
  );
}

type Props = { initialAuthed: boolean };

export function ReceptionDashboard({ initialAuthed }: Props) {
  const router = useRouter();
  const [authed, setAuthed] = useState(initialAuthed);

  useEffect(() => {
    setAuthed(initialAuthed);
  }, [initialAuthed]);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  const todayStr = useMemo(() => hotelCalendarDate(), []);
  const [facility, setFacility] = useState<Facility>("pool");
  // A recepção vê (e pode reservar) também os horários de uso compartilhado da piscina (09h–12h).
  const slotList = useMemo(
    () => [...receptionSlotStartsFor(facility)],
    [facility]
  );

  const [dateStr, setDateStr] = useState(todayStr);
  const [rows, setRows] = useState<ReservationRow[]>([]);
  /** Dia e instalação a que `rows` se refere (evita misturar dados de outra instalação). */
  const [rowsKey, setRowsKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [newApt, setNewApt] = useState("");
  const [newReservationDate, setNewReservationDate] = useState(todayStr);
  const [newSlot, setNewSlot] = useState<string>(slotStartsFor("pool")[0] ?? "13:00:00");
  const [newGuestName, setNewGuestName] = useState("");
  const [newWhatsapp, setNewWhatsapp] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [creating, setCreating] = useState(false);
  /** Trava imediata contra duplo clique em "Registrar reserva". */
  const creatingRef = useRef(false);
  const [formOccupiedSlots, setFormOccupiedSlots] = useState<Set<string>>(
    () => new Set()
  );
  const [formBookedApts, setFormBookedApts] = useState<Set<string>>(
    () => new Set()
  );
  const [formSummaryLoading, setFormSummaryLoading] = useState(false);
  /** Diferença entre o relógio do servidor e o deste aparelho. */
  const [serverSkewMs, setServerSkewMs] = useState(0);
  const [minuteTick, setMinuteTick] = useState(0);
  /** O usuário escolheu o horário à mão: nunca trocar sozinho por baixo dele. */
  const slotPickedByUserRef = useRef(false);
  const summaryReqRef = useRef(0);

  const [guestAccessApt, setGuestAccessApt] = useState("");
  const [guestAccessCheckout, setGuestAccessCheckout] = useState(todayStr);
  const [guestAccessLoading, setGuestAccessLoading] = useState(false);
  const [guestAccessUrl, setGuestAccessUrl] = useState<string | null>(null);

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

  const refreshFormSummary = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      const req = ++summaryReqRef.current;
      if (!silent) setFormSummaryLoading(true);
      try {
        const r = await getReservationDaySummary(newReservationDate, facility);
        if (req !== summaryReqRef.current) return; // resposta de uma consulta antiga
        if (!r.ok) {
          if (!silent) {
            setFormOccupiedSlots(new Set());
            setFormBookedApts(new Set());
          }
          return;
        }
        setServerSkewMs(r.serverNowMs - Date.now());
        setFormOccupiedSlots(
          new Set(r.occupiedSlots.map((s) => normalizeSlotStart(s)))
        );
        setFormBookedApts(new Set(r.apartmentsBooked));
      } catch {
        // Falha de rede numa atualização em segundo plano: mantém o que já está na tela.
      } finally {
        if (req === summaryReqRef.current) setFormSummaryLoading(false);
      }
    },
    [newReservationDate, facility]
  );

  // Novo dia/instalação: nova escolha de horário (o usuário ainda não escolheu nada).
  useEffect(() => {
    slotPickedByUserRef.current = false;
  }, [newReservationDate, facility]);

  // Ocupação do formulário: ao abrir, a cada 20 s e ao voltar para a aba (outro usuário pode ter reservado).
  useEffect(() => {
    if (!authed) return;
    void refreshFormSummary();
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshFormSummary({ silent: true });
      }
    };
    const id = window.setInterval(refreshIfVisible, 20_000);
    document.addEventListener("visibilitychange", refreshIfVisible);
    window.addEventListener("focus", refreshIfVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.removeEventListener("focus", refreshIfVisible);
    };
  }, [authed, refreshFormSummary]);

  const bySlot = useMemo(() => {
    const m = new Map<string, ReservationRow>();
    for (const r of rows) {
      m.set(normalizeSlotStart(String(r.slot_start)), r);
    }
    return m;
  }, [rows]);

  const load = useCallback(
    async (
      dateOverride?: string,
      options?: { silent?: boolean }
    ) => {
      const ymd = dateOverride ?? dateStr;
      const silent = options?.silent ?? false;
      if (!silent) setLoading(true);
      try {
        const r = await getReservationsForDate(ymd, facility);
        if (!r.ok) {
          if (r.unauthorized) {
            setAuthed(false);
            toast.error(r.error);
            return;
          }
          if (!silent) toast.error(r.error);
          return;
        }
        setRows(r.rows);
        setRowsKey(`${ymd}|${facility}`);
      } catch {
        if (!silent) toast.error("Falha de rede ao carregar reservas.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [dateStr, facility]
  );

  useEffect(() => {
    if (!authed) return;
    void load();
  }, [authed, load]);

  const pauseGridPollRef = useRef(false);
  pauseGridPollRef.current =
    pendingDelete !== null || deleting || loading;

  useEffect(() => {
    if (!authed) return;
    const refreshIfVisible = () => {
      if (pauseGridPollRef.current) return;
      if (document.visibilityState !== "visible") return;
      void load(undefined, { silent: true });
    };
    const id = window.setInterval(refreshIfVisible, 30_000);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
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
      const r = await cancelReservation(pendingDelete);
      setPendingDelete(null);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Reserva cancelada.");
      await Promise.all([load(), refreshFormSummary({ silent: true })]);
    } catch {
      toast.error("Falha ao cancelar. Tente novamente.");
    } finally {
      setDeleting(false);
    }
  }

  // Relógio do hotel: hora do servidor, atualizada a cada minuto.
  const nowMs = Date.now() + serverSkewMs;
  void minuteTick;
  const hotelToday = hotelCalendarDate(new Date(nowMs));

  // Aviso de novas reservas (qualquer dia/instalação): faixa, toast, som e contador no título da aba.
  const newReservationAlerts = useNewReservationAlerts({
    enabled: authed,
    todayYmd: hotelToday,
    onFresh: () => {
      void load(undefined, { silent: true });
      void refreshFormSummary({ silent: true });
    },
    onUnauthorized: () => {
      setAuthed(false);
      toast.error("Sessão da recepção expirada. Entre de novo.");
    },
  });
  function viewNewReservation(item: NewReservationItem) {
    setFacility(item.facility === "gym" ? "gym" : "pool");
    setDateStr(item.reservation_date);
  }

  // Ocupação = consulta do formulário + grade já carregada (a grade atualiza a cada 30 s e após cada ação).
  const formOccupied = useMemo(() => {
    const set = new Set(formOccupiedSlots);
    if (rowsKey === `${newReservationDate}|${facility}`) {
      for (const r of rows) set.add(normalizeSlotStart(String(r.slot_start)));
    }
    return set;
  }, [formOccupiedSlots, rows, rowsKey, newReservationDate, facility]);

  const reasonForSlot = (slot: string) =>
    slotBlockReason({
      facility,
      reservationDateYmd: newReservationDate,
      slotStart: slot,
      occupied: formOccupied,
      apartmentBooked: false,
      todayYmd: hotelToday,
      nowMs,
    });
  const slotReason = reasonForSlot(newSlot);
  const aptAlreadyBooked =
    Boolean(newApt) && formBookedApts.has(newApt.trim());
  const noFreeSlot = slotList.every((s) => reasonForSlot(s) !== null);

  // Pré-seleciona o primeiro horário livre (só enquanto o usuário não escolheu um).
  // Prefere os horários normais (o 1º livre do hóspede); o uso compartilhado só se não houver outro.
  const firstFreeSlot =
    slotStartsFor(facility).find((s) => reasonForSlot(s) === null) ??
    slotList.find((s) => reasonForSlot(s) === null);
  useEffect(() => {
    if (slotPickedByUserRef.current) return;
    if (slotReason === null) return;
    if (firstFreeSlot && firstFreeSlot !== newSlot) setNewSlot(firstFreeSlot);
  }, [slotReason, firstFreeSlot, newSlot]);

  async function onGenerateGuestAccess(e: React.FormEvent) {
    e.preventDefault();
    if (!guestAccessApt.trim()) {
      toast.error("Selecione o apartamento.");
      return;
    }
    setGuestAccessLoading(true);
    setGuestAccessUrl(null);
    try {
      const r = await generateStayToken({
        apartmentNumber: guestAccessApt,
        checkoutDate: guestAccessCheckout,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      const url = `${window.location.origin}/?token=${encodeURIComponent(r.token)}`;
      setGuestAccessUrl(url);
      toast.success("Link gerado. Copie e envie ao hóspede.");
    } catch {
      toast.error("Falha ao gerar o link. Tente novamente.");
    } finally {
      setGuestAccessLoading(false);
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creatingRef.current) return;
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
    if (slotReason) {
      toast.error(SLOT_BLOCK_MESSAGE[slotReason]);
      return;
    }
    const phone = guestWhatsappOptionalSchema.safeParse(newWhatsapp);
    if (!phone.success) {
      toast.error(phone.error.issues[0]?.message);
      return;
    }
    creatingRef.current = true;
    setCreating(true);
    try {
      const r = await createReceptionReservation({
        facility,
        apartmentNumber: newApt,
        reservationDate: newReservationDate,
        slotStart: newSlot,
        guestName: newGuestName.trim() ? newGuestName : undefined,
        guestWhatsapp: phone.data ?? undefined,
        notes: newNotes || undefined,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Reserva criada.");
      setNewApt("");
      setNewGuestName("");
      setNewWhatsapp("");
      setNewNotes("");
      setNewReservationDate(hotelCalendarDate());
      slotPickedByUserRef.current = false; // o horário escolhido acabou de ser ocupado: pré-seleciona o próximo livre
      await Promise.all([load(), refreshFormSummary({ silent: true })]);
    } catch {
      toast.error("Falha ao salvar. Verifique a conexão.");
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  }

  if (!authed) {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <div className="mx-auto flex max-w-md flex-1 flex-col justify-center gap-6 p-6">
        <Image
          src="/logo-valle-dincanto.jpg"
          alt="Logo Valle D'Incanto"
          width={1024}
          height={364}
          className="mx-auto mb-2 h-auto w-full max-w-[min(100%,10rem)] object-contain sm:max-w-[11rem] md:max-w-[12rem]"
        />
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
                <div className="relative">
                  <Input
                    id="pw"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    className="border-border bg-white pr-12"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full w-11 text-muted-foreground"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    aria-controls="pw"
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((visible) => !visible)}
                  >
                    {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                  </Button>
                </div>
              </div>
              <Button type="submit" disabled={loggingIn} className="w-full">
                {loggingIn ? "Entrando…" : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-5xl space-y-5 px-4 pb-8 pt-4 sm:space-y-6 sm:px-6 md:pt-6 lg:max-w-6xl lg:space-y-8 lg:px-8 lg:pb-10 xl:max-w-7xl 2xl:max-w-[min(100%-4rem,96rem)]">
        <header className="flex flex-col gap-4 border-b border-border pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
            <div className="min-w-0 space-y-3">
              <Image
                src="/logo-valle-dincanto.jpg"
                alt="Logo Valle D'Incanto"
                width={1024}
                height={364}
                className="block h-8 w-auto max-w-none object-contain object-left sm:h-9 md:h-10"
              />
              <h1 className="font-serif text-2xl font-semibold tracking-tight text-charcoal lg:text-3xl xl:text-4xl">
                Reservas
              </h1>
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
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
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
            <SoundToggleButton alerts={newReservationAlerts} />
          </div>
        </header>

        <NewReservationBanner
          alerts={newReservationAlerts}
          todayYmd={hotelToday}
          onView={viewNewReservation}
        />

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
          <p className="text-muted-foreground text-sm sm:ml-auto lg:text-base">
            {format(fromYmd(dateStr), "EEEE, dd/MM/yyyy", { locale: ptBR })}
          </p>
        </div>

        <Card className="border-border/80 shadow-sm">
          <CardContent
            className="px-2 pb-2 pt-4 sm:px-6 sm:pb-6 sm:pt-6"
            role="region"
            aria-label="Grade de reservas do dia"
          >
            <div
              className={cn(
                "hidden border-b pb-2 text-left text-sm font-medium",
                "xl:grid xl:items-center xl:gap-x-3",
                GRID_TEMPLATE
              )}
              aria-hidden
            >
              <span>Horário</span>
              <span>Apto</span>
              <span>Hóspede</span>
              <span>Observações</span>
              <span>WhatsApp</span>
              <span className="text-right">Mensagens</span>
              <span />
            </div>
            <ul className="space-y-2 xl:space-y-0">
              {receptionSlotOrder(slotList).map((slot) => {
                const row = bySlot.get(normalizeSlotStart(slot));
                return row ? (
                  <ReservationSlotRow
                    key={slot}
                    slot={slot}
                    row={row}
                    onChanged={() => void load()}
                    onAskCancel={setPendingDelete}
                  />
                ) : (
                  <EmptySlotRow
                    key={slot}
                    slot={slot}
                    past={isSlotEnded(facility, dateStr, slot, hotelToday, nowMs)}
                  />
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-sm">
          <CardHeader className="px-4 sm:px-6 lg:px-8">
            <CardTitle className="font-serif text-lg text-charcoal lg:text-xl">
              Gerar acesso hóspede
            </CardTitle>
            <CardDescription>
              Link com token de estadia para agendar piscina ou academia no
              telemóvel do hóspede.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-4 sm:px-6 lg:px-8">
            <form
              onSubmit={(e) => void onGenerateGuestAccess(e)}
              className="grid gap-4 sm:grid-cols-2 lg:max-w-3xl"
            >
              <div className="space-y-2">
                <Label htmlFor="ga-apt">Apartamento</Label>
                <select
                  id="ga-apt"
                  required
                  className="border-input flex h-9 w-full rounded-md border border-border bg-white px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  value={guestAccessApt}
                  onChange={(e) => setGuestAccessApt(e.target.value)}
                >
                  <option value="">Selecione…</option>
                  {ALLOWED_APARTMENT_NUMBERS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ga-co">Check-out</Label>
                <Input
                  id="ga-co"
                  type="date"
                  min={todayStr}
                  className="border-border bg-white"
                  value={guestAccessCheckout}
                  onChange={(e) => setGuestAccessCheckout(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={guestAccessLoading}>
                  {guestAccessLoading ? "A gerar…" : "Gerar link"}
                </Button>
              </div>
            </form>
            {guestAccessUrl ? (
              <div className="space-y-3 rounded-md border border-border/80 bg-muted/30 p-3">
                <p className="text-sm leading-relaxed text-charcoal">
                  {GUEST_ACCESS_WELCOME_TEXT}
                </p>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-charcoal">link:</p>
                  <p className="break-all font-mono text-xs text-charcoal sm:text-sm">
                    {guestAccessUrl}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(
                      guestAccessClipText(guestAccessUrl)
                    );
                    toast.message("Mensagem e link copiados.");
                  }}
                >
                  Copiar mensagem e link
                </Button>
              </div>
            ) : null}
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
                  {ALLOWED_APARTMENT_NUMBERS.map((n) => {
                    const booked = formBookedApts.has(n);
                    return (
                      <option
                        key={n}
                        value={n}
                        disabled={booked}
                        className={booked ? "text-muted-foreground" : undefined}
                      >
                        {n}
                        {booked ? " — já tem reserva neste dia" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="ngn">Hóspede (opcional)</Label>
                <Input
                  id="ngn"
                  type="text"
                  autoComplete="name"
                  placeholder="Nome do hóspede"
                  maxLength={200}
                  className="border-border bg-white"
                  value={newGuestName}
                  onChange={(e) => setNewGuestName(e.target.value)}
                />
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
                  onChange={(e) => {
                    slotPickedByUserRef.current = true;
                    setNewSlot(e.target.value);
                  }}
                >
                  {slotList.map((s) => {
                    const reason = reasonForSlot(s);
                    return (
                      <option
                        key={s}
                        value={s}
                        disabled={reason !== null}
                        className={reason ? "text-muted-foreground" : undefined}
                      >
                        {slotLabel(s)}
                        {reason ? ` — ${SLOT_BLOCK_LABEL[reason].toLowerCase()}` : ""}
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
                  placeholder="(54) 99999-9999 ou +44 7911 123456"
                  className="border-border bg-white"
                  value={newWhatsapp}
                  onChange={(e) => setNewWhatsapp(e.target.value)}
                />
              </div>
              {(aptAlreadyBooked || slotReason || noFreeSlot) && (
                <p
                  className="text-destructive text-sm sm:col-span-2"
                  role="alert"
                >
                  {aptAlreadyBooked
                    ? "Este apartamento já possui reserva neste dia nesta instalação."
                    : slotReason
                      ? noFreeSlot
                        ? "Não há horários disponíveis neste dia."
                        : SLOT_BLOCK_MESSAGE[slotReason]
                      : "Não há horários disponíveis neste dia."}
                </p>
              )}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="nn">Observações</Label>
                <Textarea
                  id="nn"
                  maxLength={2000}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Opcional: pedido especial, notas internas…"
                />
              </div>
              <div className="sm:col-span-2">
                <Button
                  type="submit"
                  disabled={
                    creating ||
                    formSummaryLoading ||
                    aptAlreadyBooked ||
                    slotReason !== null
                  }
                >
                  {creating ? "Salvando…" : "Registrar reserva"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

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
