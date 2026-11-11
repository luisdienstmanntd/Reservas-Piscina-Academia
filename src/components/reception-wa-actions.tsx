"use client";

import { useState } from "react";
import { Bell, CircleCheck } from "lucide-react";
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
    <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap lg:justify-end">
      {/* Só o ícone, minimalista (traço fino, como celular/recepção): cinza = ainda não enviada; verde = enviada. */}
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
          "size-9 border-0 bg-transparent p-0 text-muted-foreground shadow-none lg:size-8",
          hasPhone && !confirmDone && "hover:bg-transparent hover:text-green-600",
          // Enviada: verde e sem escurecer como botão desabilitado.
          confirmDone && "text-green-600 opacity-100 disabled:opacity-100"
        )}
        onClick={() => void openWaAndMark("confirmation", confirmMsg)}
      >
        <CircleCheck className="size-4" aria-hidden />
      </Button>
      {/* Só o sino, minimalista. Laranja piscando = hora de avisar; verde = aviso enviado. */}
      <Button
        type="button"
        size="sm"
        variant="ghost"
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
          "size-9 border-0 bg-transparent p-0 text-muted-foreground shadow-none lg:size-8",
          hasPhone && !warnDone && !showWarningPulse && "hover:bg-transparent hover:text-foreground",
          hasPhone &&
            showWarningPulse &&
            "animate-pulse text-orange-600 hover:bg-orange-50 hover:text-orange-700",
          warnDone && "text-green-600 opacity-100 disabled:opacity-100"
        )}
        onClick={() => void openWaAndMark("warning", warnMsg)}
      >
        <Bell className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
