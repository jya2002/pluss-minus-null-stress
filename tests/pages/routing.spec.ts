import { test, expect } from "@playwright/test";
import { loadEnv } from "vite";
import { mockBackend } from "../ui/support/backend";
test("GitHub Pages assets, direct deep link, reload and navigation", async ({
  page,
  context,
}) => {
  const env = loadEnv("production", process.cwd(), "VITE_");
  const backend = mockBackend(
    env.VITE_SUPABASE_URL || "https://pmns-ui.supabase.co",
  );
  await backend.install(context);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/pluss-minus-null-stress/#/arrangementer");
  await expect(
    page.getByRole("heading", { name: "Arrangementer.", exact: true }),
  ).toBeVisible();
  const assets = await page
    .locator('script[src], link[rel="stylesheet"]')
    .evaluateAll((elements) =>
      elements.map(
        (element) =>
          element.getAttribute("src") ?? element.getAttribute("href")!,
      ),
    );
  expect(assets.length).toBeGreaterThan(1);
  for (const path of assets) {
    expect(path).toMatch(/^\/pluss-minus-null-stress\/assets\//);
    expect((await page.request.get(path)).status()).toBe(200);
  }
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Arrangementer.", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Åpne meny", exact: true })
    .isVisible()
    .then(async (visible) => {
      if (visible)
        await page
          .getByRole("button", { name: "Åpne meny", exact: true })
          .click();
    });
  await page
    .getByRole("navigation", { name: "Hovedmeny" })
    .getByRole("link", { name: "Hjem", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Mer fellesskap. Mindre stress." }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/pluss-minus-null-stress\/#\/$/);
  expect(errors).toEqual([]);
  await page.goto("/pluss-minus-null-stress/#/logg-inn");
  await expect(
    page.getByRole("button", { name: "Fortsett med Google", exact: true }),
  ).toBeVisible();
  await page.getByText("Andre innloggingsmåter", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Send innloggingslenke", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Passord", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Passord (utvikling)", exact: true }),
  ).toHaveCount(0);
  await page.goto("/pluss-minus-null-stress/#/min-side");
  await expect(page).toHaveURL(
    /\/pluss-minus-null-stress\/#\/logg-inn\?retur=/,
  );
  expect(backend.unexpected).toEqual([]);
});
