import { expect, test, type Locator, type Page } from "@playwright/test";

const password = process.env.EXPERIENCE_E2E_PASSWORD;
const target = process.env.PLAYWRIGHT_BASE_URL;
const local = target && ["localhost", "127.0.0.1"].includes(new URL(target).hostname);

async function selectDay(page: Page, date: string) {
  const label = date.split("-").reverse().join("/");
  await expect(async () => {
    await page.getByLabel("Dia", { exact: true }).fill(date);
    await expect(page.getByTestId("day-label")).toContainText(label, { timeout: 500 });
  }).toPass({ timeout: 8000 });
}

async function openExperienceOnDay(page: Page, tab: Locator, today: string, date: string) {
  await tab.click();
  await expect(page.getByRole("button", { name: "Gerar acesso" })).toHaveCount(0);
  const setup = page.getByRole("dialog");
  await expect(setup.or(page.getByRole("table"))).toBeVisible();
  if (await setup.isVisible()) {
    await setup.getByRole("button", { name: "Fechar janela" }).click();
  }
  await expect(page.getByLabel("Dia", { exact: true })).toHaveValue(today);
  await selectDay(page, date);
}

async function fitsViewport(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 320, height: 568 }]) {
  test.describe(`recepção ${viewport.width}px`, () => {
    test.use({ viewport });
    test("configura, cadastra, reabre, edita e exclui experiências", async ({ page }) => {
      test.skip(!password || !local, "Requer um servidor local com banco de teste descartável.");
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await page.goto("/recepcao");
      await page.getByLabel("Senha", { exact: true }).fill(password!);
      await page.getByRole("button", { name: "Entrar" }).click();
      const grid = page.getByRole("region", { name: "Grade de reservas do dia" });
      await expect(grid).toBeVisible();
      await expect(grid.getByRole("listitem").first()).toBeVisible();
      await fitsViewport(page);
      const date = new Date(Date.UTC(2030, 0, 1 + (Math.floor(Date.now() / 1000) % 20000) * 2 + (viewport.width === 320 ? 1 : 0)))
        .toISOString().slice(0, 10);
      const today = await page.getByLabel("Dia", { exact: true }).inputValue();
      await selectDay(page, date);
      await page.getByRole("button", { name: "Academia", exact: true }).click();
      await expect(page.getByLabel("Dia", { exact: true })).toHaveValue(today);
      await selectDay(page, date);
      await expect(grid.getByRole("listitem")).toHaveCount(24);
      await expect(grid.getByRole("button", { name: "Gerar acesso" })).toBeVisible();
      await grid.getByRole("button", { name: "Reservar às 15h00" }).click();
      await page.getByRole("dialog", { name: "Confirmar data da reserva" })
        .getByRole("button", { name: date.split("-").reverse().join("/") }).click();
      await expect(page.getByRole("dialog").getByText("Nova reserva").first()).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);

      const cinema = page.getByRole("button", { name: "Cine in Toscana", exact: true });
      await openExperienceOnDay(page, cinema, today, date);
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Nome do filme").fill("Cinema Paradiso");
      await expect(dialog.getByLabel("Horário")).toHaveValue("19:30");
      await dialog.getByLabel("Horário").fill("20:30");
      await dialog.getByRole("button", { name: "Definir experiência" }).click();
      await expect(page.getByText("Cinema Paradiso", { exact: true })).toBeVisible();
      const sheet = page.getByRole("table");
      await expect(sheet.getByRole("row")).toHaveCount(6);
      await sheet.getByRole("button", { name: "Cadastrar na linha 5" }).click();
      await page.getByRole("dialog", { name: "Confirmar data da reserva" })
        .getByRole("button", { name: date.split("-").reverse().join("/") }).click();
      await dialog.getByLabel("Apto").fill("101");
      const longName = "Hóspede" + "x".repeat(160);
      await dialog.getByLabel("Nome dos hóspedes").fill(longName);
      await dialog.getByRole("button", { name: "Salvar" }).click();
      await expect(sheet.getByText(longName)).toBeVisible();
      await fitsViewport(page);
      expect(await sheet.evaluate((table) => table.scrollWidth)).toBeLessThanOrEqual(
        await sheet.evaluate((table) => table.parentElement!.clientWidth)
      );
      await page.getByRole("button", { name: "Piscina", exact: true }).click();
      await expect(grid).toBeVisible();
      await openExperienceOnDay(page, cinema, today, date);
      await expect(sheet.getByText(longName)).toBeVisible();
      await expect(dialog).toHaveCount(0);
      await page.getByRole("button", { name: "Editar experiência" }).click();
      await expect(dialog.getByLabel("Nome do filme")).toHaveValue("Cinema Paradiso");
      await expect(dialog.getByLabel("Horário")).toHaveValue("20:30");
      await dialog.getByLabel("Nome do filme").fill("Novo filme");
      await dialog.getByLabel("Horário").fill("21:00");
      await dialog.getByRole("button", { name: "Salvar" }).click();
      await expect(page.getByText("Novo filme", { exact: true })).toBeVisible();
      await expect(page.getByText("· 21:00", { exact: true })).toBeVisible();
      await expect(sheet.getByText(longName)).toBeVisible();
      await sheet.getByRole("button", { name: "Excluir reserva da linha 5" }).click();
      const confirm = page.getByRole("alertdialog");
      await confirm.getByRole("button", { name: "Voltar" }).click();
      await expect(sheet.getByText(longName)).toBeVisible();
      await sheet.getByRole("button", { name: "Excluir reserva da linha 5" }).click();
      await confirm.getByRole("button", { name: "Excluir" }).click();
      await expect(sheet.getByRole("button", { name: "Cadastrar na linha 5" })).toBeVisible();

      const wine = page.getByRole("button", { name: "L'ora del vino", exact: true });
      await openExperienceOnDay(page, wine, today, date);
      await dialog.getByLabel("Vinícola").fill("Vinícola Valle");
      await dialog.getByLabel("Horário").fill("18:00");
      await dialog.getByRole("button", { name: "Definir experiência" }).click();
      await expect(page.getByText("Vinícola Valle · 18:00")).toBeVisible();
      await expect(sheet.getByRole("row")).toHaveCount(9);
      await sheet.getByRole("button", { name: "Cadastrar na linha 8" }).click();
      await page.getByRole("dialog", { name: "Confirmar data da reserva" })
        .getByRole("button", { name: date.split("-").reverse().join("/") }).click();
      await dialog.getByLabel("Cliente").selectOption("external");
      await expect(dialog.getByLabel("Apto")).toHaveCount(0);
      await dialog.getByLabel("Nome", { exact: true }).fill("Maria");
      await dialog.getByLabel("Pax").fill("3");
      await dialog.getByLabel("Observações").fill("Chega às 18h");
      await dialog.getByRole("button", { name: "Salvar" }).click();
      await expect(sheet.getByText("Maria")).toBeVisible();
      await sheet.getByRole("button", { name: "Cadastrar na linha 7" }).click();
      await page.getByRole("dialog", { name: "Confirmar data da reserva" })
        .getByRole("button", { name: date.split("-").reverse().join("/") }).click();
      await dialog.getByLabel("Apto").fill("103");
      await dialog.getByLabel("Nome dos hóspedes").fill("João");
      await dialog.getByLabel("Pax").fill("4");
      await dialog.getByRole("button", { name: "Salvar" }).click();
      await expect(sheet.getByText("João")).toBeVisible();
      await page.reload();
      await openExperienceOnDay(page, wine, today, date);
      await expect(sheet.getByText("João")).toBeVisible();
      await expect(dialog).toHaveCount(0);

      await openExperienceOnDay(page, page.getByRole("button", { name: "La vera pizza", exact: true }), today, date);
      await expect(sheet.getByRole("row")).toHaveCount(10);
      await expect(dialog).toHaveCount(0);
      await sheet.getByRole("button", { name: "Cadastrar na linha 1" }).click();
      await page.getByRole("dialog", { name: "Confirmar data da reserva" })
        .getByRole("button", { name: date.split("-").reverse().join("/") }).click();
      await expect(dialog.getByText("La vera pizza · Linha 1")).toHaveCount(0);
      for (const labels of [["Cliente", "Apto"], ["Adultos", "CHD", "Avulsa"], ["Contato", "Valor"]]) {
        const boxes = await Promise.all(labels.map((label) => dialog.getByLabel(label, { exact: true }).boundingBox()));
        for (let i = 1; i < boxes.length; i++) {
          expect(boxes[i]!.y).toBeCloseTo(boxes[0]!.y);
          expect(boxes[i]!.x).toBeGreaterThan(boxes[i - 1]!.x);
        }
      }
      await expect(dialog.getByLabel("Valor")).toHaveValue(/R\$\s189,00/);
      await dialog.getByLabel("Apto").fill("102");
      await dialog.getByLabel("Avulsa").fill("a007x");
      await expect(dialog.getByLabel("Avulsa")).toHaveValue("007");
      await dialog.getByLabel("Contato").fill("+44 7911 123456");
      await dialog.getByLabel("Nome dos hóspedes").fill("Ana");
      await dialog.getByLabel("Adultos").fill("2");
      await dialog.getByLabel("CHD").fill("1");
      await dialog.getByLabel("Observações").fill("Sem queijo");
      await fitsViewport(page);
      const dialogBox = await dialog.boundingBox();
      expect(dialogBox?.y).toBeGreaterThanOrEqual(0);
      expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(viewport.height);
      await dialog.getByRole("button", { name: "Salvar" }).click();
      const pizzaRow = sheet.getByRole("row").filter({ hasText: "Ana" });
      await expect(pizzaRow.getByText(/R\$\s189,00/)).toBeVisible();
      await expect(pizzaRow.getByText("007", { exact: true })).toBeVisible();
      await expect(pizzaRow.getByRole("cell").nth(2)).toHaveText("Sem queijo");
      await expect(pizzaRow.getByText("+44 7911 123456", { exact: true })).toBeVisible();
      await fitsViewport(page);
      const columnWidth = await pizzaRow.getByRole("cell").nth(1).evaluate((cell) => cell.getBoundingClientRect().width);
      expect(columnWidth).toBeGreaterThanOrEqual(128);
      await sheet.getByRole("button", { name: "Editar linha 1, Ana" }).click();
      await expect(dialog.getByLabel("Contato")).toHaveValue("+447911123456");
      await expect(dialog.getByLabel("Avulsa")).toHaveValue("007");
      await dialog.getByLabel("Cortesia").check();
      await expect(dialog.getByLabel("CHD")).toHaveValue("1");
      await expect(dialog.getByLabel("Observações")).toHaveValue("Sem queijo");
      await dialog.getByLabel("Cliente").selectOption("external");
      await expect(dialog.getByLabel("Apto")).toHaveCount(0);
      await dialog.getByRole("button", { name: "Salvar" }).click();
      await expect(sheet.getByText("Externo")).toBeVisible();
      await expect(pizzaRow.getByRole("cell").nth(4)).toHaveText("Cortesia");
      await expect(sheet.getByRole("row").filter({ has: page.getByRole("rowheader", { name: "Total" }) }).getByRole("cell").nth(1)).toHaveText(/0,00/);
      await selectDay(page, "2199-01-03");
      await expect(sheet.getByRole("button", { name: "Cadastrar na linha 1" })).toBeVisible();
      await fitsViewport(page);
      expect(pageErrors).toEqual([]);
    });
  });
}
