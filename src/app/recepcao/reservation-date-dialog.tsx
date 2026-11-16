"use client";

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function ReservationDateDialog({ day, onCancel, onConfirm }: {
  day: string | undefined;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={Boolean(day)} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent>
        <DialogHeader className="pr-8">
          <DialogTitle>Confirmar data da reserva</DialogTitle>
          <DialogDescription>Confira a data e clique nela para continuar.</DialogDescription>
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
