// @vitest-environment jsdom
/* eslint-disable @next/next/no-img-element */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import * as React from "react";
import { ReceptionDashboard } from "@/app/recepcao/reception-dashboard";

const reservationActions = vi.hoisted(() => ({
  createReceptionReservation: vi.fn(),
  cancelReservation: vi.fn(),
  getReservationDaySummary: vi.fn(),
  getReservationsForDate: vi.fn(),
  loginReception: vi.fn(),
  logoutReception: vi.fn(),
  setSlotBlocked: vi.fn(),
  updateReservationGuestName: vi.fn(),
  updateReservationNotes: vi.fn(),
  updateReservationGuestWhatsapp: vi.fn(),
}));

vi.mock("@/app/actions/reservations", () => reservationActions);
vi.mock("@/app/actions/stays", () => ({ generateStayToken: vi.fn() }));
vi.mock("next/image", () => ({ default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={props.alt ?? ""} {...props} /> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/app/recepcao/new-reservation-alerts", () => ({
  NewReservationBanner: () => null,
  SoundToggleButton: () => null,
  useNewReservationAlerts: () => ({}),
}));
vi.mock("@/app/recepcao/history-dialog", () => ({ HistoryButton: () => null }));
vi.mock("@/components/reception-wa-actions", () => ({ ReceptionWaActions: () => null }));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  reservationActions.getReservationDaySummary.mockResolvedValue({
    ok: true,
    occupiedSlots: [],
    apartmentsBooked: [],
    serverNowMs: Date.now(),
  });
  reservationActions.getReservationsForDate.mockResolvedValue({
    ok: true,
    rows: [],
    cancelled: [],
    blocked: [],
  });
});

afterEach(() => cleanup());

function renderReception() {
  return render(<ReceptionDashboard initialAuthed />);
}

describe("modais de ações da recepção", () => {
  it("abre o modal de reserva com todos os campos já existentes", async () => {
    renderReception();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar reserva" }));

    const dialog = await screen.findByRole("dialog", { name: "Nova reserva" });
    expect(within(dialog).getByLabelText("Apto")).toBeTruthy();
    expect(within(dialog).getByLabelText("Hóspede (opcional)")).toBeTruthy();
    expect(within(dialog).getByLabelText("Data")).toBeTruthy();
    expect(within(dialog).getByLabelText("Horário")).toBeTruthy();
    expect(within(dialog).getByLabelText("WhatsApp (opcional)")).toBeTruthy();
    expect(within(dialog).getByLabelText("Observações")).toBeTruthy();
  });

  it("usa no formulário a data selecionada no calendário", async () => {
    renderReception();
    fireEvent.change(screen.getByLabelText("Dia"), {
      target: { value: "2026-11-20" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar reserva" }));

    const dialog = await screen.findByRole("dialog", { name: "Nova reserva" });
    expect((within(dialog).getByLabelText("Data") as HTMLInputElement).value).toBe("2026-11-20");
  });

  it("abre o modal de acesso com apartamento e check-out", async () => {
    renderReception();
    fireEvent.click(screen.getByRole("button", { name: "Gerar acesso" }));

    const dialog = await screen.findByRole("dialog", { name: "Gerar acesso hóspede" });
    expect(within(dialog).getByLabelText("Apartamento")).toBeTruthy();
    expect(within(dialog).getByLabelText("Check-out")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Gerar link" })).toBeTruthy();
  });

  it("fecha o modal ao receber Escape", async () => {
    renderReception();
    fireEvent.click(screen.getByRole("button", { name: "Gerar acesso" }));
    const dialog = await screen.findByRole("dialog", { name: "Gerar acesso hóspede" });

    fireEvent(dialog, new Event("cancel", { bubbles: false, cancelable: true }));

    await waitFor(() => expect(dialog.hasAttribute("open")).toBe(false));
  });
});
