import { expect, test } from "@playwright/test";

test.describe("smoke", () => {
  test("página inicial responde", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.ok()).toBeTruthy();
    await expect(page).toHaveTitle(/Valle/i);
  });
});
