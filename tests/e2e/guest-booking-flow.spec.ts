/**
 * E2E visual: recepção → link com token → hóspede → piscina → data no fim do ano → reserva.
 *
 * AVISO: com `.env.local` apontando para a nuvem, este teste **grava uma reserva real**
 * na data escolhida (30 de dezembro do ano civil atual). Use data futura e apague na
 * receção se precisar. Sem `RECEPTION_PASSWORD` o teste é ignorado.
 */
import { expect, test } from "@playwright/test";

const PAUSE_MS = 1000;

test.describe("Fluxo hóspede (recepção → token → piscina)", () => {
  test.describe.configure({ mode: "serial" });

  test("login, gerar link, reservar slot em 30/12 (ano atual)", async ({
    page,
  }) => {
    test.skip(
      !process.env.RECEPTION_PASSWORD?.trim(),
      "Defina RECEPTION_PASSWORD no .env.local para correr este E2E."
    );

    const password = process.env.RECEPTION_PASSWORD!.trim();
    const year = new Date().getFullYear();
    const checkoutYmd = `${year}-12-30`;

    await page.goto("/recepcao");
    await page.waitForTimeout(PAUSE_MS);

    await page.locator("#pw").fill(password);
    await page.waitForTimeout(PAUSE_MS);
    await page.getByRole("button", { name: /Entrar/i }).click();
    await expect(
      page.getByRole("heading", { name: /Reservas/i })
    ).toBeVisible({ timeout: 30_000 });
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
    await expect(
      page.getByRole("heading", { name: /Escolha o dia/i })
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
      page.getByRole("heading", { name: /Horários/i })
    ).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(PAUSE_MS);

    const firstFreeSlot = page
      .locator("main ul.grid button[type='button']:not([disabled])")
      .first();
    await expect(firstFreeSlot).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(PAUSE_MS);
    await firstFreeSlot.click();

    await expect(
      page.getByRole("heading", { name: /Reserva confirmada/i })
    ).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(PAUSE_MS);
  });
});
