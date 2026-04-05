"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import { ptBR } from "date-fns/locale";

import { cn } from "@/lib/utils";

import "react-day-picker/style.css";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, ...props }: CalendarProps) {
  return (
    <div
      className={cn(
        "inline-block rounded-xl border bg-card p-2 shadow-sm [--rdp-accent-color:var(--color-primary)] [--rdp-background-color:var(--color-background)]",
        className
      )}
    >
      <DayPicker locale={ptBR} {...props} />
    </div>
  );
}

export { Calendar };
