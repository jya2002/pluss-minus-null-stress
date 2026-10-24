import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mockBackend } from "./support/backend";

test("reference identity, real-data card links and responsive header (simulated API)", async ({
  page,
  context,
}, info) => {
  const backend = mockBackend();
  backend.events.push({
    ...backend.events[0],
    id: randomUUID(),
    title: "Testarrangement: Film og pizza",
    category: "Filmkveld",
  });
  await backend.install(context);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Mer fellesskap. Mindre stress." }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("html")).toHaveCSS(
    "background-color",
    "rgb(255, 223, 69)",
  );
  await expect(page.locator(".hero h1")).toHaveCSS("color", "rgb(41, 22, 56)");
  expect(
    await page.evaluate(() => document.fonts.check('900 48px "Fraunces"')),
  ).toBe(true);
  await expect(page.locator("header .logo-mark")).toBeVisible();
  await expect(
    page.locator("header").getByRole("link", { name: "Bli med", exact: true }),
  ).toHaveAttribute("href", "#/min-side");
  const cards = page.locator(".home-events .event-card");
  await expect(cards).toHaveCount(2);
  const firstCard = await cards.first().boundingBox();
  expect(firstCard).not.toBeNull();
  expect(
    firstCard!.y,
    "Upcoming events should appear in the first screen, including on mobile",
  ).toBeLessThan(page.viewportSize()!.height * 0.7);
  await expect(
    page.getByRole("region", { name: "Bli kjent med oss" }),
  ).toContainText("Den sosiale linjeforeningen for matematikkstudenter");
  await expect(cards.nth(0)).toHaveCSS(
    "background-color",
    "rgb(255, 249, 237)",
  );
  await expect(cards.nth(1)).toHaveCSS(
    "background-color",
    "rgb(141, 226, 203)",
  );
  await expect(cards.first().locator("time")).toHaveAttribute(
    "datetime",
    backend.events[0].starts_at,
  );
  const favicon = await page.locator('link[rel="icon"]').getAttribute("href");
  expect(favicon).toBeTruthy();
  expect(
    (await context.request.get(new URL(favicon!, page.url()).href)).status(),
  ).toBe(200);
  if (info.project.name === "chromium")
    await page.setViewportSize({ width: 1280, height: 1000 });
  await page.screenshot({
    path: info.outputPath(`redesign-home-${info.project.name}.png`),
    fullPage: true,
    scale: "css",
  });
  await page.screenshot({
    path: info.outputPath(`redesign-preview-${info.project.name}.png`),
    scale: "css",
  });
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(
      page
        .locator("header")
        .getByRole("link", { name: "Bli med", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
      `width ${width}`,
    ).toBeLessThanOrEqual(width);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(cards.first()).toHaveCSS("transform", "none");
  await cards
    .first()
    .getByRole("link", {
      name: `Meld deg på: ${backend.events[0].title}`,
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/arrangementer/${backend.events[0].id}$`),
  );
  await expect(
    page.getByRole("heading", { name: backend.events[0].title, exact: true }),
  ).toBeVisible();
  expect(backend.writes).toEqual([]);
  expect(backend.unexpected).toEqual([]);
});

test("homepage empty state does not promote drafts or invent events (simulated API)", async ({
  page,
  context,
}) => {
  const backend = mockBackend();
  backend.events[0].status = "draft";
  await backend.install(context);
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Neste møteplass er på vei",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".event-card")).toHaveCount(0);
  await expect(page.locator(".featured")).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText(backend.events[0].title);
  await page
    .locator("header")
    .getByRole("link", { name: "Bli med", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Fortsett med Google", exact: true }),
  ).toBeVisible();
  expect(backend.writes).toEqual([]);
  expect(backend.unexpected).toEqual([]);
});
