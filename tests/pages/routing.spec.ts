import { test, expect } from "@playwright/test";
import { loadEnv } from "vite";
import { mockBackend } from "../ui/support/backend";
test("custom domain root assets, direct deep link, reload and navigation", async ({
  page,
  context,
}) => {
  const env = loadEnv("production", process.cwd(), "VITE_");
  const backend = mockBackend(
    env.VITE_SUPABASE_URL || "https://pmns-ui.supabase.co",
  );
  await backend.install(context);
  const errors: string[] = [];
  const failedAssets: string[] = [];
  const fonts: number[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("response", (response) => {
    const type = response.request().resourceType();
    if (["script", "stylesheet", "image", "font"].includes(type) && !response.ok())
      failedAssets.push(new URL(response.url()).pathname);
    if (type === "font") fonts.push(response.status());
  });
  await page.goto("/#/arrangementer");
  await expect(
    page.getByRole("heading", { name: "Arrangementer.", exact: true }),
  ).toBeVisible();
  const assets = await page
    .locator('script[src], link[rel="stylesheet"], link[rel="modulepreload"], link[rel="icon"]')
    .evaluateAll((elements) =>
      elements.map(
        (element) =>
          element.getAttribute("src") ?? element.getAttribute("href")!,
      ),
    );
  expect(assets.length).toBeGreaterThan(1);
  for (const path of assets) {
    const asset = new URL(path, page.url());
    expect(asset.origin).toBe(new URL(page.url()).origin);
    expect(asset.pathname).toMatch(/^\/assets\//);
    const response = await page.request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).not.toContain("text/html");
  }
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  expect(fonts.length).toBeGreaterThan(0);
  expect(fonts.every((status) => status === 200)).toBe(true);
  for (const logo of await page.locator("img.logo-mark").all()) {
    await expect(logo).toHaveAttribute("src", /^\/assets\//);
    await expect.poll(() => logo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
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
  await expect(page).toHaveURL(/\/#\/$/);
  expect(errors).toEqual([]);
  await page.goto("/#/logg-inn");
  await expect(
    page.getByRole("button", { name: "Fortsett med Google", exact: true }),
  ).toBeVisible();
  const googleImage = page.locator(".google-sign-in img");
  await expect(googleImage).toHaveAttribute("src", /^\/assets\//);
  await expect.poll(() => googleImage.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await page.getByText("Andre innloggingsmåter", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Send innloggingslenke", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Passord", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Passord (utvikling)", exact: true }),
  ).toHaveCount(0);
  await page.goto("/#/min-side");
  await expect(page).toHaveURL(
    /\/#\/logg-inn\?retur=/,
  );
  expect(backend.unexpected).toEqual([]);
  expect(failedAssets).toEqual([]);
  expect(errors).toEqual([]);
});
