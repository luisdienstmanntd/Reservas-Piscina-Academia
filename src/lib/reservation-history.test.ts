import { describe, expect, it } from "vitest";

import {
  actorLabel,
  escapeLike,
  historyDayRange,
  normalizeHistoryFilters,
  changedFieldsLabel,
  formatEventDateTime,
  formatEventWhen,
  historyTitle,
  reservationLine,
  type HistoryItem,
} from "./reservation-history";

const item = (o: Partial<HistoryItem> = {}): HistoryItem => ({
  id: "1",
  type: "created",
  actor: "guest",
  changedFields: [],
  occurredAt: "2026-11-11T13:24:00Z",
  facility: "pool",
  reservationDate: "2026-11-11",
  slotStart: "19:00:00",
  apartment: "101",
  guestName: "ANA",
  ...o,
});

describe("histórico de alterações", () => {
  it("títulos dos eventos", () => {
    expect(historyTitle("created")).toBe("Reserva incluída");
    expect(historyTitle("updated")).toBe("Reserva alterada");
    expect(historyTitle("cancelled")).toBe("Reserva excluída");
    expect(historyTitle("outro")).toBe("Evento");
  });
  it("quem fez", () => {
    expect(actorLabel("guest")).toBe("Hóspede");
    expect(actorLabel("reception")).toBe("Recepção");
    expect(actorLabel("system")).toBe("Sistema");
    expect(actorLabel(null)).toBe("Não informado");
  });
  it("lista os campos alterados em português", () => {
    expect(changedFieldsLabel([])).toBe("");
    expect(changedFieldsLabel(["notes"])).toBe("observações");
    expect(changedFieldsLabel(["slot_start", "reservation_date"])).toBe("horário e data");
    expect(changedFieldsLabel(["guest_name", "guest_whatsapp", "notes"])).toBe(
      "nome, WhatsApp e observações"
    );
  });
  it("data e hora no fuso do hotel (UTC-3)", () => {
    expect(formatEventDateTime("2026-11-11T13:24:00Z")).toBe("11/11/2026, 10:24");
    expect(formatEventDateTime("2026-11-12T02:05:00Z")).toBe("11/11/2026, 23:05");
    expect(formatEventDateTime("lixo")).toBe("—");
  });
  it("data do evento: dia da semana - data - hora", () => {
    expect(formatEventWhen("2026-11-11T13:57:00Z")).toBe("Quarta-feira - 11/11/2026 - 10:57");
    expect(formatEventWhen("2026-11-12T02:05:00Z")).toBe("Quarta-feira - 11/11/2026 - 23:05");
    expect(formatEventWhen("lixo")).toBe("—");
  });
  it("linha da reserva (sem dia quando é o do evento)", () => {
    // evento em 11/11 10:24 (hotel) e reserva no mesmo dia
    expect(reservationLine(item())).toBe("Piscina · Apto 101 · 19h às 20h");
    expect(reservationLine(item({ slotMayDiffer: true }))).toBe(
      "Piscina · Apto 101 · 19h às 20h (atual)"
    );
    expect(reservationLine(item({ facility: "gym", slotStart: "12:00:00", apartment: "103", slotMayDiffer: true }))).toBe(
      "Academia · Apto 103 · 12h às 13h (atual)"
    );
    // reserva para outro dia: mostra dd/MM
    expect(reservationLine(item({ reservationDate: "2026-11-13" }))).toBe(
      "Piscina · Apto 101 · 13/11 · 19h às 20h"
    );
    expect(reservationLine(item({ facility: null, apartment: null, reservationDate: null, slotStart: null }))).toBe("");
  });
  it("normaliza os filtros", () => {
    expect(normalizeHistoryFilters(undefined)).toEqual({});
    expect(normalizeHistoryFilters({ date: "2026-11-11", apartment: " 101 ", name: "  ana   souza " })).toEqual({
      date: "2026-11-11",
      apartment: "101",
      name: "ana souza",
    });
    expect(normalizeHistoryFilters({ date: "11/11/2026", apartment: "10 1;", name: "   " })).toEqual({});
    expect(normalizeHistoryFilters({ date: "2026-13-45" })).toEqual({});
    expect(normalizeHistoryFilters({ name: "x".repeat(100) }).name).toHaveLength(60);
    expect(normalizeHistoryFilters({ date: 5, apartment: null, name: {} })).toEqual({});
  });
  it("escapa curingas do LIKE", () => {
    expect(escapeLike("100%_a\\b")).toBe("100\\%\\_a\\\\b");
    expect(escapeLike("ana")).toBe("ana");
  });
  it("intervalo do dia no fuso do hotel", () => {
    expect(historyDayRange("2026-11-11")).toEqual({
      from: "2026-11-11T03:00:00.000Z",
      to: "2026-11-12T03:00:00.000Z",
    });
  });
});
