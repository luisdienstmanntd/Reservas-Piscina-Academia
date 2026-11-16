// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExperienceSheet } from "./experience-sheet";

const actions = vi.hoisted(() => ({
  loadExperience: vi.fn(),
  moveExperience: vi.fn(),
  editCinemaSession: vi.fn(),
  editExperienceDetails: vi.fn(),
  setupExperience: vi.fn(),
  saveExperienceBooking: vi.fn(),
  savePizzaCapacity: vi.fn(),
  saveWineCapacity: vi.fn(),
  deleteExperienceBooking: vi.fn(),
}));
vi.mock("@/app/actions/experiences", () => actions);

const day = "2026-11-15";

beforeEach(() => {
  vi.resetAllMocks();
  actions.loadExperience.mockResolvedValue({ ok: true, session: null, bookings: [] });
  actions.setupExperience.mockImplementation(async (key, details) => ({
    ...await actions.loadExperience(key),
    session: details,
  }));
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
    fireEvent.click(within(dialog).getByRole("button", { name: "Definir experiência" }));
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
    fireEvent.click(await screen.findByRole("button", { name: "Editar experiência" }));
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

  it("muda a data do vinho pela engrenagem somente após salvar", async () => {
    actions.loadExperience.mockResolvedValue({
      ok: true, session: { title: "Vinícola", start_time: "18:00" }, bookings: [],
    });
    actions.moveExperience.mockResolvedValue({ ok: true });
    const onDayChange = vi.fn();
    render(<ExperienceSheet experience="wine" day={day} onDayChange={onDayChange} />);
    fireEvent.click(await screen.findByRole("button", { name: "Configurar experiência" }));
    fireEvent.click(await screen.findByRole("button", { name: /15\/11\/2026/ }));
    const dialog = within(await screen.findByRole("dialog", { name: "Alterar data da experiência" }));
    fireEvent.change(dialog.getByLabelText("Nova data"), { target: { value: "2026-11-22" } });
    expect(onDayChange).not.toHaveBeenCalled();
    fireEvent.click(dialog.getByRole("button", { name: "Alterar data" }));
    await waitFor(() => expect(onDayChange).toHaveBeenCalledWith("2026-11-22"));
    expect(actions.moveExperience).toHaveBeenCalledWith({ experience: "wine", day }, "2026-11-22");
    expect(onDayChange).toHaveBeenCalledWith("2026-11-22");
  });

  it("configura capacidade do vinho em 12 por padrão e exibe a contagem de pax", async () => {
    actions.loadExperience.mockResolvedValue({
      ok: true,
      session: { title: "Vinícola Valle", start_time: "18:00:00" },
      bookings: [
        { line: 1, customer: "guest", apartment: "101", name: "Ana", pax: 3 },
        { line: 2, customer: "external", apartment: null, name: "Maria", pax: 2 },
      ],
      capacity: 12,
    });
    actions.saveWineCapacity.mockResolvedValue({ ok: true, capacity: 15 });
    render(<ExperienceSheet experience="wine" day={day} />);
    const table = await screen.findByRole("table");
    expect(within(table).getByText("5/12 lugares")).toBeTruthy();
    expect(within(table).getByText("Aptos: 1")).toBeTruthy();
    expect(within(table).getByText("Externos: 1")).toBeTruthy();
    expect(within(table).getByText("Pax: 5")).toBeTruthy();

    fireEvent.click(await screen.findByRole("button", { name: "Configurar experiência" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Alterar capacidade" }));
    expect((dialog.getByLabelText("Capacidade (pax)") as HTMLInputElement).value).toBe("12");
    fireEvent.change(dialog.getByLabelText("Capacidade (pax)"), { target: { value: "15" } });
    fireEvent.click(dialog.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(actions.saveWineCapacity).toHaveBeenCalledWith(day, 15));
    expect(await within(table).findByText("5/15 lugares")).toBeTruthy();
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
    expect(within(table).getAllByRole("row")).toHaveLength(10);
    fireEvent.click(within(table).getByRole("button", { name: "Cadastrar na linha 1" }));
    fireEvent.click(await screen.findByRole("button", { name: "domingo 15/11/2026" }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.queryByText("L'ora del vino · Linha 1")).toBeNull();
    expect(dialog.getByLabelText("Cliente").parentElement?.parentElement)
      .toBe(dialog.getByLabelText("Apto").parentElement?.parentElement);
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
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText("domingo 15/11/2026")).toBeTruthy();
    fireEvent.click(dialog.getByRole("button", { name: "Definir experiência" }));
    const table = await screen.findByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(10);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(within(table).getByRole("button", { name: "Excluir reserva da linha 2" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Excluir" }));
    expect(await screen.findByRole("button", { name: "Cadastrar na linha 2" })).toBeTruthy();
    expect(actions.deleteExperienceBooking).toHaveBeenCalledWith({ experience: "pizza", day, line: 2 }, "revision");
  });

  it("mostra o preço padrão no modal de pizza e identifica a cortesia na planilha", async () => {
    actions.loadExperience.mockResolvedValue({
      ok: true, session: null, bookings: [
        { line: 1, name: "Ana", customer: "guest", apartment: "101", complimentary: true, price_cents: 18900 },
        { line: 2, name: "Bruno", customer: "external", price_cents: 18900, notes: "Sem queijo" },
        { line: 4, name: "Carla", customer: "external", price_cents: 5050 },
      ],
    });
    render(<ExperienceSheet experience="pizza" day={day} />);
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Definir experiência" }));
    const rows = within(await screen.findByRole("table")).getAllByRole("row");
    expect(within(rows[0]).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "Apto", "Nome", "Observações", "Contato", "Valor", "Avulsa", "Ações",
    ]);
    expect(within(rows[1]).getAllByRole("cell")[4].textContent).toBe("Cortesia");
    expect(rows[2].textContent).toContain("189,00");
    expect(within(rows.at(-1)!).getByRole("rowheader", { name: "Total" })).toBeTruthy();
    expect(within(rows.at(-1)!).getAllByRole("cell")[1].textContent).toMatch(/239,50/);
    expect(within(rows[0]).getAllByRole("columnheader")[2].textContent).toBe("Observações");
    expect(within(rows[2]).getAllByRole("cell")[2].textContent).toBe("Sem queijo");
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar na linha 3" }));
    fireEvent.click(await screen.findByRole("button", { name: "domingo 15/11/2026" }));
    const modal = await screen.findByRole("dialog", { name: "Cadastrar reserva" });
    expect(modal.textContent).not.toContain("Linha 3");
    const avulsa = within(modal).getByLabelText("Avulsa") as HTMLInputElement;
    fireEvent.change(avulsa, { target: { value: "a007x" } });
    expect(avulsa.value).toBe("007");
    expect((within(modal).getByLabelText("Valor") as HTMLInputElement).value).toMatch(/R\$\s189,00/);
    fireEvent.change(within(modal).getByLabelText("Cliente"), { target: { value: "external" } });
    expect(within(modal).getByRole("checkbox", { name: "Cortesia" })).toBeTruthy();
  });

  it("configura capacidade e permite confirmar uma reserva acima do limite", async () => {
    actions.loadExperience.mockResolvedValue({
      ok: true, session: null, bookings: [
        { line: 8, customer: "guest", apartment: "101", name: "Ana", adults: 10, children: 1 },
        { line: 1, customer: "external", name: "Bia", adults: 1, children: 0 },
      ],
    });
    actions.savePizzaCapacity.mockResolvedValue({ ok: true, capacity: 13 });
    actions.saveExperienceBooking.mockResolvedValue({
      ok: true, booking: { line: 9, customer: "guest", apartment: "102", name: "Carla", adults: 2, children: 0 },
    });
    render(<ExperienceSheet experience="pizza" day={day} />);
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Definir experiência" }));
    expect(await screen.findByText("12/12 lugares")).toBeTruthy();
    for (const label of ["Aptos: 1", "Externos: 1", "Adultos: 11", "Crianças: 1"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }

    const newBooking = screen.getByRole("button", { name: "Cadastrar na linha 9" });
    fireEvent.click(newBooking);
    fireEvent.click(await screen.findByRole("button", { name: "domingo 15/11/2026" }));
    const warning = await screen.findByRole("alertdialog", { name: "Capacidade máxima atingida" });
    fireEvent.click(within(warning).getByRole("button", { name: "Não" }));
    expect(screen.queryByRole("dialog", { name: "Cadastrar reserva" })).toBeNull();
    fireEvent.click(newBooking);
    fireEvent.click(await screen.findByRole("button", { name: "domingo 15/11/2026" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Sim" }));
    const booking = within(await screen.findByRole("dialog", { name: "Cadastrar reserva" }));
    fireEvent.change(booking.getByLabelText("Apto"), { target: { value: "102" } });
    fireEvent.change(booking.getByLabelText("Nome dos hóspedes"), { target: { value: "Carla" } });
    fireEvent.change(booking.getByLabelText("Adultos"), { target: { value: "2" } });
    fireEvent.click(booking.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("14/12 lugares")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Alterar capacidade" }));
    const settings = within(await screen.findByRole("dialog", { name: "Alterar capacidade" }));
    fireEvent.change(settings.getByLabelText("Capacidade (pax)"), { target: { value: "13" } });
    fireEvent.click(settings.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("14/13 lugares")).toBeTruthy();
    expect(actions.savePizzaCapacity).toHaveBeenCalledWith(day, 13);
  });

  it("permite tentar novamente após falha de carregamento", async () => {
    actions.loadExperience.mockResolvedValueOnce({ ok: false, error: "Banco indisponível" });
    render(<ExperienceSheet experience="pizza" day={day} />);
    expect((await screen.findByRole("alert")).textContent).toBe("Banco indisponível");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Definir experiência" }));
    await screen.findByRole("table");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("recarrega a planilha ao detectar que outro atendente ocupou a linha", async () => {
    actions.saveExperienceBooking.mockResolvedValue({ ok: false, conflict: true, error: "Linha alterada" });
    actions.setupExperience.mockResolvedValueOnce({ ok: true, session: { title: "La vera pizza", start_time: "20:00" }, bookings: [] });
    actions.loadExperience.mockResolvedValueOnce({ ok: true, session: null, bookings: [] })
      .mockResolvedValueOnce({
        ok: true, session: { title: "La vera pizza", start_time: "20:00" },
        bookings: [{ line: 1, customer: "external", name: "Reserva de outro atendente" }],
      });
    render(<ExperienceSheet experience="pizza" day={day} />);
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Definir experiência" }));
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar na linha 1" }));
    fireEvent.click(await screen.findByRole("button", { name: "domingo 15/11/2026" }));
    const dialog = within(await screen.findByRole("dialog"));
    fireEvent.change(dialog.getByLabelText("Apto"), { target: { value: "101" } });
    fireEvent.change(dialog.getByLabelText("Nome dos hóspedes"), { target: { value: "Ana" } });
    fireEvent.click(dialog.getByRole("button", { name: "Salvar" }));
    expect((await dialog.findByRole("alert")).textContent).toBe("Linha alterada");
    fireEvent.click(dialog.getByRole("button", { name: "Recarregar planilha" }));
    expect(await screen.findByText("Reserva de outro atendente")).toBeTruthy();
  });

});
