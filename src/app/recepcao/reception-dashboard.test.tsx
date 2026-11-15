// @vitest-environment jsdom
/* eslint-disable @next/next/no-img-element */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  it("mantém calendário e gerar acesso dentro da grade", () => {
    renderReception();
    const grid = within(screen.getByRole("region", { name: "Grade de reservas do dia" }));
    expect(grid.getByTestId("day-label")).toBeTruthy();
    expect(grid.getByRole("button", { name: "Escolher a data" })).toBeTruthy();
    expect(grid.getByRole("button", { name: "Gerar acesso" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Adicionar reserva" })).toBeNull();
  });

  it("abre pela linha livre com a data, o horário e os campos de cadastro", async () => {
    renderReception();
    fireEvent.change(screen.getByLabelText("Dia"), { target: { value: "2099-11-20" } });
    const slot = screen.getByRole("button", { name: "Reservar às 15h00" });
    fireEvent.click(slot.closest("li")!);

    const dialog = await screen.findByRole("dialog", { name: "Nova reserva" });
    expect(within(dialog).getByLabelText("Apto")).toBeTruthy();
    expect(within(dialog).getByLabelText("Hóspede (opcional)")).toBeTruthy();
    expect((within(dialog).getByLabelText("Data") as HTMLInputElement).value).toBe("2099-11-20");
    expect((within(dialog).getByLabelText("Horário") as HTMLSelectElement).value).toBe("15:00:00");
    expect(within(dialog).getByLabelText("WhatsApp (opcional)")).toBeTruthy();
    expect(within(dialog).getByLabelText("Observações")).toBeTruthy();
  });

  it("não abre o cadastro ao clicar em uma linha passada ou no cadeado", async () => {
    reservationActions.setSlotBlocked.mockResolvedValue({ ok: true });
    renderReception();
    fireEvent.change(screen.getByLabelText("Dia"), { target: { value: "2000-01-01" } });
    fireEvent.click(screen.getByText("15h00").closest("li")!);
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.change(screen.getByLabelText("Dia"), { target: { value: "2099-11-20" } });
    const slot = screen.getByRole("button", { name: "Reservar às 15h00" });
    fireEvent.click(within(slot.closest("li")!).getByRole("button", { name: "Bloquear horário" }));
    await waitFor(() => expect(reservationActions.setSlotBlocked).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).toBeNull();
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
    await screen.findByRole("dialog", { name: "Gerar acesso hóspede" });

    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("fecha o modal pelo botão de fechar", async () => {
    renderReception();
    fireEvent.click(screen.getByRole("button", { name: "Gerar acesso" }));
    await screen.findByRole("dialog", { name: "Gerar acesso hóspede" });

    fireEvent.click(screen.getByRole("button", { name: "Fechar janela" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
