"use client";

import { useState } from "react";
import { Bell, MessageCircle } from "lucide-react";
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

  if (!hasPhone) {
    return (
      <span className="text-muted-foreground text-xs" title="Sem WhatsApp">
        —
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <Button
        type="button"
        size="sm"
        variant={confirmDone ? "secondary" : "default"}
        disabled={confirmDone || pending !== null}
        title="Enviar confirmação (WhatsApp Web)"
        className={cn(
          "h-8 gap-1 px-2 text-xs",
          !confirmDone && "bg-green-600 text-white hover:bg-green-700"
        )}
        onClick={() => void openWaAndMark("confirmation", confirmMsg)}
      >
        <MessageCircle className="size-3.5 shrink-0" aria-hidden />
        {confirmDone ? "OK conf." : "Confirmação"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant={warnDone ? "secondary" : "outline"}
        disabled={warnDone || pending !== null}
        title="Aviso 10 min antes do fim"
        className={cn(
          "h-8 gap-1 px-2 text-xs",
          showWarningPulse &&
            "animate-pulse border-orange-600 bg-orange-600 text-white hover:bg-orange-700"
        )}
        onClick={() => void openWaAndMark("warning", warnMsg)}
      >
        <Bell className="size-3.5 shrink-0" aria-hidden />
        {showWarningPulse ? "Aviso pendente!" : warnDone ? "OK aviso" : "Aviso"}
      </Button>
    </div>
  );
}
