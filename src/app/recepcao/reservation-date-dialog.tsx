"use client";

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function ReservationDateDialog({ day, onCancel, onConfirm }: {
  day: string | undefined;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={Boolean(day)} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
        <DialogHeader className="px-8 text-center">
          <DialogTitle>Confirmar data da reserva</DialogTitle>
        </DialogHeader>
        {day && (
          <Button type="button" onClick={onConfirm}>
            {format(parseISO(day), "EEEE dd/MM/yyyy", { locale: ptBR })}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
