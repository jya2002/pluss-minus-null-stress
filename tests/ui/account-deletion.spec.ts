import { test, expect } from "@playwright/test";
import { login } from "../browser/flows";
import { accounts, mockBackend } from "./support/backend";

for (const deleted of [true, false]) {
  test(`account deletion requires explicit success before clearing session: ${deleted} (simulated Edge)`, async ({
    page,
    context,
  }) => {
    const backend = mockBackend();
    await backend.install(context);
    let requests = 0;
    await page.route("**/functions/v1/account-delete", async (route) => {
      requests++;
      expect(route.request().postDataJSON()).toEqual({ confirmation: "SLETT" });
      expect(route.request().headers().authorization).toBe(
        `Bearer ui-${accounts.a.id}`,
      );
      await route.fulfill({ json: deleted ? { deleted: true } : {} });
    });
    await login(page, accounts.a);
    await page.goto("/#/min-side");
    await page
      .getByRole("button", { name: "Slett kontoen min", exact: true })
      .click();
    expect(requests).toBe(0);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Bekreft", exact: true })
      .click();
    if (deleted) {
      await expect(
        page.getByRole("button", { name: "Logg inn med passord", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Slett kontoen min", exact: true }),
      ).toHaveCount(0);
    } else {
      await expect(page.getByRole("alert")).toContainText(
        "Kontoen ble ikke slettet",
      );
      await page
        .getByRole("button", { name: "Lukk dialog", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Logg ut", exact: true }),
      ).toBeVisible();
    }
    expect(requests).toBe(1);
    expect(backend.unexpected).toEqual([]);
  });
}
