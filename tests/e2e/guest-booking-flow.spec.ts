/**
 * E2E visual: recepção → link com token → hóspede → piscina → data no fim do ano → reserva.
 *
 * AVISO: com `.env.local` apontando para a nuvem, este teste **grava uma reserva real**
 * na data escolhida (30 de dezembro do ano civil atual). Use data futura e apague na
 * receção se precisar. A senha da receção neste E2E está fixa no código (só para este fluxo).
 */
import { expect, test } from "@playwright/test";

const PAUSE_MS = 1000;

test.describe("Fluxo hóspede (recepção → token → piscina)", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test("login, gerar link, reservar slot em 30/12 (ano atual)", async ({
    page,
  }) => {
    const year = new Date().getFullYear();
    const checkoutYmd = `${year}-12-30`;

    await page.goto("/recepcao");
    await page.waitForTimeout(PAUSE_MS);

    await page
      .getByLabel("Senha", { exact: true })
      .first()
      .fill("agendamentovalle2026");
    await page.waitForTimeout(PAUSE_MS);
    await page.getByRole("button", { name: /entrar/i }).first().click();
    await page.locator("#ga-apt").waitFor({ state: "visible", timeout: 30_000 });
    await page.waitForTimeout(PAUSE_MS);

    await page.locator("#ga-apt").selectOption({ index: 1 });
    await page.waitForTimeout(PAUSE_MS);
    await page.locator("#ga-co").fill(checkoutYmd);
    await page.waitForTimeout(PAUSE_MS);
    await page.getByRole("button", { name: /Gerar link/i }).click();

    const linkLocator = page.locator("p.break-all.font-mono").filter({
      hasText: /\?token=/,
    });
    await expect(linkLocator).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(PAUSE_MS);

    const guestUrl = (await linkLocator.textContent())?.trim();
    expect(guestUrl).toBeTruthy();
    expect(guestUrl).toMatch(/^https?:\/\//);

    await page.goto(guestUrl!);
    await page.waitForTimeout(PAUSE_MS);

    await page.getByRole("link", { name: /Agendar piscina/i }).click();
    await expect(
      page.getByRole("heading", { name: /Agendamento da Piscina/i })
    ).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(PAUSE_MS);

    await page.locator("#wa").fill("11999999999");
    await page.waitForTimeout(PAUSE_MS);
    await page.getByRole("button", { name: /^Continuar$/i }).click();
    // CardTitle (shadcn) é <div>, não expõe role heading
    await expect(
      page.locator("main").getByText("Escolha o dia", { exact: true })
    ).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(PAUSE_MS);

    const dayStr = `${year}-12-30`;
    const dayCell = page.locator(`[data-day="${dayStr}"]`);
    for (let i = 0; i < 14; i++) {
      if (await dayCell.isVisible().catch(() => false)) break;
      const next = page.locator("button.rdp-button_next").first();
      await expect(next).toBeVisible({ timeout: 5_000 });
      await next.click();
      await page.waitForTimeout(400);
    }
    await expect(dayCell).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(PAUSE_MS);
    await dayCell.locator("button[type='button']").click();
    await page.waitForTimeout(PAUSE_MS);

    await page.getByRole("button", { name: /Ver horários/i }).click();
    await expect(
      page.locator("main").getByText("Horários", { exact: true })
    ).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(PAUSE_MS);

    const firstFreeSlot = page
      .locator("main ul.grid button[type='button']:not([disabled])")
      .first();
    await expect(firstFreeSlot).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(PAUSE_MS);
    await firstFreeSlot.click();

    await expect(
      page.locator("main").getByText("Reserva confirmada", { exact: true })
    ).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(PAUSE_MS);
  });
});
