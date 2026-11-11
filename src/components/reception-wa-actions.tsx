"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";

import { markMessageAsSent } from "@/app/actions/reservations";
import { hotelCalendarDate } from "@/lib/hotel-time";
import type { ReservationRow } from "@/lib/reservations";
import {
  buildConfirmationMessage,
  buildWhatsappWaMeUrl,
  buildWarningMessage,
  isWarningAlertWindow,
  whatsappDigitsForWaMe,
} from "@/lib/wa-me";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Confirmação ainda não enviada: círculo verde só com o contorno e o "certo" dentro. */
function ConfirmPendingIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden fill="none">
      <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="2.6" />
      <path
        d="M9.5 16.5l4.6 4.6L22.6 11.4"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Confirmação enviada: círculo verde cheio com o "certo" branco. */
function ConfirmDoneIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="14" fill="#16a34a" />
      <circle cx="16" cy="16" r="14" fill="none" stroke="#15803d" strokeWidth="1.5" />
      <path
        d="M9 16.5l5 5L23.5 11"
        fill="none"
        stroke="#ffffff"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Props = {
  row: ReservationRow;
  onUpdated: () => void;
};

export function ReceptionWaActions({ row, onUpdated }: Props) {
  const [pending, setPending] = useState<"confirmation" | "warning" | null>(
    null
  );

  const hasPhone = Boolean(whatsappDigitsForWaMe(row.guest_whatsapp));
  const now = Date.now();
  const showWarningPulse =
    hasPhone &&
    !row.warning_sent &&
    isWarningAlertWindow(row.reservation_date, String(row.slot_start), now);

  async function openWaAndMark(
    type: "confirmation" | "warning",
    message: string
  ) {
    if (!hasPhone) {
      toast.error("Sem número de WhatsApp nesta reserva.");
      return;
    }
    const url = buildWhatsappWaMeUrl(row.guest_whatsapp, message);
    if (!url) {
      toast.error("Número de WhatsApp inválido para o link.");
      return;
    }
    const win = window.open(url, "whatsapp_valle_tab");
    if (win == null) {
      toast.error(
        "Não foi possível abrir o WhatsApp. Verifique o bloqueador de pop-ups."
      );
      return;
    }
    setPending(type);
    try {
      const r = await markMessageAsSent(row.id, type);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      onUpdated();
    } catch {
      toast.error("Falha ao registar envio. Tente de novo.");
    } finally {
      setPending(null);
    }
  }

  const todayYmd = hotelCalendarDate();
  const confirmMsg = buildConfirmationMessage(
    row.facility,
    row.reservation_date,
    String(row.slot_start),
    todayYmd
  );
  const warnMsg = buildWarningMessage(row.facility);

  const confirmDone = row.confirmation_sent === true;
  const warnDone = row.warning_sent === true;

  const noPhoneTitle =
    "Preencha o WhatsApp ao criar a reserva (balcão) para abrir o WhatsApp Web aqui.";

  return (
    <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap xl:justify-end">
      {/* Só o ícone (sem texto): contorno = ainda não enviada; círculo cheio = enviada. */}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={!hasPhone || confirmDone || pending !== null}
        title={
          !hasPhone
            ? noPhoneTitle
            : confirmDone
              ? "Confirmação enviada"
              : "Enviar confirmação (WhatsApp Web)"
        }
        aria-label={confirmDone ? "Confirmação enviada" : "Enviar confirmação"}
        className={cn(
          "size-9 p-0 xl:size-8",
          hasPhone && !confirmDone && "text-green-600 hover:bg-green-50 hover:text-green-700",
          // Enviada: continua com a cor cheia (não escurece como botão desabilitado).
          confirmDone && "opacity-100 disabled:opacity-100",
          !hasPhone && "text-muted-foreground"
        )}
        onClick={() => void openWaAndMark("confirmation", confirmMsg)}
      >
        {confirmDone ? (
          <ConfirmDoneIcon className="size-6" />
        ) : (
          <ConfirmPendingIcon className="size-6" />
        )}
      </Button>
      {/* Só o sino (sem texto). Laranja piscando = hora de avisar; sino com "certo" verde = aviso enviado. */}
      <Button
        type="button"
        size="sm"
        variant={warnDone ? "secondary" : "outline"}
        disabled={!hasPhone || warnDone || pending !== null}
        title={
          !hasPhone
            ? noPhoneTitle
            : warnDone
              ? "Aviso enviado"
              : showWarningPulse
                ? "Aviso pendente: enviar agora (10 min antes do fim)"
                : "Aviso 10 min antes do fim"
        }
        aria-label={
          warnDone
            ? "Aviso enviado"
            : showWarningPulse
              ? "Aviso pendente: enviar agora"
              : "Enviar aviso"
        }
        className={cn(
          "relative size-9 p-0 xl:size-8",
          hasPhone &&
            showWarningPulse &&
            "animate-pulse border-orange-600 bg-orange-600 text-white hover:bg-orange-700"
        )}
        onClick={() => void openWaAndMark("warning", warnMsg)}
      >
        <Bell className="size-4 shrink-0" aria-hidden />
        {warnDone ? (
          <ConfirmDoneIcon className="absolute -right-1 -top-1 size-3.5" />
        ) : null}
      </Button>
    </div>
  );
}
