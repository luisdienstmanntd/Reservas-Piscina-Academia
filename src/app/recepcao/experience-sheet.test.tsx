// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExperienceSheet } from "./experience-sheet";

const actions = vi.hoisted(() => ({
  loadExperience: vi.fn(),
  editCinemaSession: vi.fn(),
  setupExperience: vi.fn(),
  saveExperienceBooking: vi.fn(),
  deleteExperienceBooking: vi.fn(),
}));
vi.mock("@/app/actions/experiences", () => actions);

const day = "2026-11-15";

beforeEach(() => {
  vi.resetAllMocks();
  actions.loadExperience.mockResolvedValue({ ok: true, session: null, bookings: [] });
});
afterEach(cleanup);

describe("planilhas de experiências", () => {
  it("solicita o filme e o horário uma vez e abre as cinco linhas", async () => {
    const session = { title: "Cinema Paradiso", start_time: "20:30:00" };
    actions.setupExperience.mockResolvedValue({ ok: true, session, bookings: [] });
    const view = render(<ExperienceSheet experience="cinema" day={day} />);
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Nome do filme"), { target: { value: session.title } });
    expect((within(dialog).getByLabelText("Horário") as HTMLInputElement).value).toBe("19:30");
    fireEvent.change(within(dialog).getByLabelText("Horário"), { target: { value: "20:30" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Cinema Paradiso", { exact: true })).toBeTruthy();
    expect(within(await screen.findByRole("table")).getAllByRole("row")).toHaveLength(6);
    expect(actions.setupExperience).toHaveBeenCalledWith({ experience: "cinema", day }, {
      title: session.title,
      start_time: "20:30",
    });

    view.unmount();
    actions.loadExperience.mockResolvedValue({ ok: true, session, bookings: [] });
    render(<ExperienceSheet experience="cinema" day={day} />);
    await screen.findByRole("table");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("edita filme e horário pelo lápis e preserva as reservas", async () => {
    const session = { title: "Filme anterior", start_time: "19:30:00" };
    actions.loadExperience.mockResolvedValue({
      ok: true, session, bookings: [{ line: 1, apartment: "101", name: "Ana" }],
    });
    actions.editCinemaSession.mockResolvedValue({
      ok: true, session: { title: "Novo filme", start_time: "21:00:00" },
    });
    render(<ExperienceSheet experience="cinema" day={day} />);
    fireEvent.click(await screen.findByRole("button", { name: "Editar filme e horário" }));
    const dialog = within(await screen.findByRole("dialog"));
    const title = dialog.getByLabelText("Nome do filme") as HTMLInputElement;
    const time = dialog.getByLabelText("Horário") as HTMLInputElement;
    expect(title.value).toBe("Filme anterior");
    expect(time.value).toBe("19:30");
    fireEvent.change(title, { target: { value: "Novo filme" } });
    fireEvent.change(time, { target: { value: "21:00" } });
    fireEvent.click(dialog.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Novo filme")).toBeTruthy();
    expect(screen.getByText("· 21:00")).toBeTruthy();
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(actions.editCinemaSession).toHaveBeenCalledWith(
      { experience: "cinema", day },
      { title: "Novo filme", start_time: "21:00" },
      { title: "Filme anterior", start_time: "19:30" }
    );
  });

  it("cadastra cliente externo no vinho sem pedir apartamento", async () => {
    actions.loadExperience.mockResolvedValue({
      ok: true,
      session: { title: "Vinícola Valle", start_time: "18:00:00" },
      bookings: [],
    });
    actions.saveExperienceBooking.mockResolvedValue({
      ok: true,
      booking: { line: 1, customer: "external", apartment: null, name: "Maria", pax: 2 },
    });
    render(<ExperienceSheet experience="wine" day={day} />);
    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(9);
    fireEvent.click(within(table).getByRole("button", { name: "Cadastrar na linha 1" }));
    const dialog = within(await screen.findByRole("dialog"));
    fireEvent.change(dialog.getByLabelText("Cliente"), { target: { value: "external" } });
    expect(dialog.queryByLabelText("Apto")).toBeNull();
    fireEvent.change(dialog.getByLabelText("Nome"), { target: { value: "Maria" } });
    fireEvent.change(dialog.getByLabelText("Pax"), { target: { value: "2" } });
    fireEvent.click(dialog.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Maria")).toBeTruthy();
    expect(actions.saveExperienceBooking).toHaveBeenCalledWith(
      { experience: "wine", day, line: 1 },
      expect.objectContaining({ customer: "external", name: "Maria", pax: 2, revision: null })
    );
  });

  it("abre pizza direto e libera uma linha depois da confirmação de exclusão", async () => {
    actions.loadExperience.mockResolvedValue({
      ok: true, session: null, bookings: [
        { line: 2, revision: "revision", customer: "guest", apartment: "101", name: "Ana", adults: 2, children: 1 },
      ],
    });
    actions.deleteExperienceBooking.mockResolvedValue({ ok: true });
    render(<ExperienceSheet experience="pizza" day={day} />);
    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(9);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(within(table).getByRole("button", { name: "Excluir reserva da linha 2" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Excluir" }));
    expect(await screen.findByRole("button", { name: "Cadastrar na linha 2" })).toBeTruthy();
    expect(actions.deleteExperienceBooking).toHaveBeenCalledWith({ experience: "pizza", day, line: 2 }, "revision");
  });

  it("permite tentar novamente após falha de carregamento", async () => {
    actions.loadExperience.mockResolvedValueOnce({ ok: false, error: "Banco indisponível" });
    render(<ExperienceSheet experience="pizza" day={day} />);
    expect((await screen.findByRole("alert")).textContent).toBe("Banco indisponível");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByRole("table");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("recarrega a planilha ao detectar que outro atendente ocupou a linha", async () => {
    actions.saveExperienceBooking.mockResolvedValue({ ok: false, conflict: true, error: "Linha alterada" });
    actions.loadExperience.mockResolvedValueOnce({ ok: true, session: null, bookings: [] })
      .mockResolvedValueOnce({
        ok: true, session: null,
        bookings: [{ line: 1, customer: "external", name: "Reserva de outro atendente" }],
      });
    render(<ExperienceSheet experience="pizza" day={day} />);
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar na linha 1" }));
    const dialog = within(await screen.findByRole("dialog"));
    fireEvent.change(dialog.getByLabelText("Apto"), { target: { value: "101" } });
    fireEvent.change(dialog.getByLabelText("Nome dos hóspedes"), { target: { value: "Ana" } });
    fireEvent.click(dialog.getByRole("button", { name: "Salvar" }));
    expect((await dialog.findByRole("alert")).textContent).toBe("Linha alterada");
    fireEvent.click(dialog.getByRole("button", { name: "Recarregar planilha" }));
    expect(await screen.findByText("Reserva de outro atendente")).toBeTruthy();
  });

});
