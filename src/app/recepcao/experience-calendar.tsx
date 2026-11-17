"use client";

import { useEffect, useState } from "react";
import { endOfMonth, format, parseISO } from "date-fns";
import { listExperienceDays } from "@/app/actions/experiences";
import { Calendar } from "@/components/ui/calendar";
import { DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Experience } from "@/lib/experiences";

export function ExperienceCalendar({ experience, day, onSelect }: {
  experience: Experience;
  day: string;
  onSelect: (day: string) => void;
}) {
  const [month, setMonth] = useState(() => parseISO(day));
  const monthEnd = format(endOfMonth(month), "yyyy-MM-dd");
  const [result, setResult] = useState<{ monthEnd: string; days: string[]; error?: string }>();

  useEffect(() => {
    let active = true;
    listExperienceDays({ experience, day: monthEnd })
      .then((response) => {
        if (!active) return;
        setResult(response.ok
          ? { monthEnd, days: response.days }
          : { monthEnd, days: [], error: response.error });
      })
      .catch(() => {
        if (active) setResult({ monthEnd, days: [], error: "Não foi possível consultar as datas." });
      });
    return () => { active = false; };
  }, [experience, monthEnd]);

  const loaded = result?.monthEnd === monthEnd;
  return (
    <DialogContent className="px-3 sm:max-w-sm sm:px-6" aria-describedby={undefined}>
      <DialogHeader className="pr-8">
        <DialogTitle>Consultar data</DialogTitle>
      </DialogHeader>
      <Calendar
        className="mx-auto max-w-full [&_.rdp-root]:[--rdp-day-width:34px] [&_.rdp-root]:[--rdp-day_button-width:32px]"
        mode="single"
        required
        selected={parseISO(day)}
        month={month}
        onMonthChange={setMonth}
        onSelect={(date) => onSelect(format(date, "yyyy-MM-dd"))}
        modifiers={{ scheduled: loaded ? result.days.map((date) => parseISO(date)) : [] }}
        modifiersStyles={{
          scheduled: {
            backgroundColor: "var(--primary)",
            color: "var(--primary-foreground)",
            borderRadius: "0.5rem",
          },
        }}
        labels={{ labelDayButton: (date, modifiers) =>
          `${format(date, "dd/MM/yyyy")}${modifiers.scheduled ? " — experiência cadastrada" : ""}`,
        }}
      />
      {!loaded && <p role="status" className="text-sm">Consultando datas…</p>}
      {loaded && result.error && <p role="alert" className="text-sm text-destructive">{result.error}</p>}
    </DialogContent>
  );
}
