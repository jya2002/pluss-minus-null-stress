import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { login } from "../browser/flows";
import { accounts, mockBackend } from "./support/backend";

async function review(page: Page, label: string) {
  await expect(page.locator("h1")).toBeVisible();
  await expect(
    page.locator('[role="status"][aria-label="Laster inn"]'),
  ).toHaveCount(0);
  const report = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    report.violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
    label,
  ).toEqual([]);
  const overflow = await page.evaluate(() => ({
    viewport: innerWidth,
    width: document.documentElement.scrollWidth,
    offset: scrollX,
    offenders: Array.from(document.querySelectorAll("main *"))
      .filter(
        (el) =>
          el.getBoundingClientRect().right > innerWidth + 1 &&
          getComputedStyle(el).position !== "absolute",
      )
      .slice(0, 6)
      .map((el) => `${el.tagName}.${el.className}`),
  }));
  expect(
    overflow.width,
    `${label}: ${JSON.stringify(overflow)}`,
  ).toBeLessThanOrEqual(overflow.viewport);
  expect(overflow.offset, label).toBe(0);
  await page.screenshot({
    path: test
      .info()
      .outputPath(`${label.replace(/[^a-zA-Z0-9_-]/g, "_")}.png`),
    fullPage: true,
    scale: "css",
  });
}

test("public pages, password form and keyboard navigation fit the viewport (simulated API)", async ({
  page,
  context,
}, info) => {
  test.setTimeout(90000);
  const backend = mockBackend();
  await backend.install(context);
  for (const path of [
    "/",
    "/#/logg-inn",
    "/#/arrangementer",
    `/#/arrangementer/${backend.events[0].id}`,
    "/#/om",
    "/#/personvern",
  ]) {
    await page.goto(path);
    await review(page, path);
  }
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Hopp til innhold" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  if (info.project.name === "mobile") {
    const menu = page.getByRole("button", { name: "Åpne meny" });
    await menu.focus();
    await menu.press("Enter");
    await expect(
      page.getByRole("button", { name: "Lukk meny" }),
    ).toHaveAttribute("aria-expanded", "true");
    const events = page
      .getByRole("navigation", { name: "Hovedmeny" })
      .getByRole("link", { name: "Arrangementer", exact: true });
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Hjem", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(events).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("button", { name: "Åpne meny" }),
    ).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("main")).toBeFocused();
  }
  expect(backend.unexpected).toEqual([]);
});

function seedCommunity(backend: ReturnType<typeof mockBackend>) {
  backend.memberships.push({
    user_id: accounts.a.id,
    status: "pending",
    joined_at: new Date().toISOString(),
  });
  backend.suggestions.push({
    id: randomUUID(),
    author_id: accounts.a.id,
    anonymous: true,
    hidden: false,
    title: "En hyggelig torsdag med brettspill og varm kakao",
    description:
      "Et sosialt treff etter forelesning for alle som vil bli kjent.",
    category: "Spillkveld",
    preferred_date: null,
    budget_nok: 300,
    image_path: null,
    author_name: "Anonym student",
    status: "proposed",
    created_at: new Date().toISOString(),
    votes: 0,
    my_vote: false,
  });
  backend.polls.push({
    id: randomUUID(),
    question: "Hva har du lyst til å gjøre på neste sosiale torsdag?",
    opens_at: new Date(Date.now() - 60000).toISOString(),
    closes_at: new Date(Date.now() + 3600000).toISOString(),
    hide_results: true,
    published: true,
    audience: "everyone",
  });
  backend.options.push(
    {
      id: randomUUID(),
      poll_id: backend.polls[0].id,
      label: "Brettspill og kakao etter forelesning",
    },
    { id: randomUUID(), poll_id: backend.polls[0].id, label: "Film og pizza" },
  );
}

test("account, suggestions, polls and modal keyboard focus remain accessible (simulated API)", async ({
  page,
  context,
}) => {
  test.setTimeout(90000);
  const backend = mockBackend();
  seedCommunity(backend);
  await backend.install(context);
  await login(page, accounts.a);
  await review(page, "Min side");
  await page.goto("/#/torsdagsbanken");
  await expect(
    page.getByRole("heading", { name: backend.polls[0].question }),
  ).toBeVisible();
  await review(page, "Forslag og avstemninger");
  const open = page.getByRole("button", {
    name: "Foreslå en aktivitet",
    exact: true,
  });
  await open.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await review(page, "Forslagsskjema");
  await dialog
    .getByRole("button", { name: "Send inn forslaget", exact: true })
    .focus();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Lukk dialog", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    dialog.getByRole("button", { name: "Send inn forslaget", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(open).toBeFocused();
  expect(backend.unexpected).toEqual([]);
});

test("all board tabs and event/poll dialogs fit without page overflow (simulated API)", async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  const backend = mockBackend();
  seedCommunity(backend);
  await backend.install(context);
  await login(page, accounts.admin);
  await page.goto("/#/admin");
  const nav = page.getByRole("navigation", { name: "Administrasjon" });
  for (const label of [
    "Oversikt",
    "Arrangementer",
    "Påmeldinger og lag",
    "Forslag",
    "Avstemninger",
    "Medlemmer og roller",
    "Innhold",
    "Tilgangsgrupper",
    "Kontaktmeldinger",
    "Endringslogg",
  ]) {
    await nav.getByRole("button", { name: label, exact: true }).click();
    await expect(
      nav.getByRole("button", { name: label, exact: true }),
    ).toHaveClass("active");
    await expect(
      nav.getByRole("button", { name: label, exact: true }),
    ).toHaveCSS("background-color", "rgb(41, 22, 56)");
    await review(page, `Styreportal: ${label}`);
  }
  for (const [tab, button] of [
    ["Arrangementer", "Nytt arrangement"],
    ["Avstemninger", "Ny avstemning"],
  ]) {
    await nav.getByRole("button", { name: tab, exact: true }).click();
    await page.getByRole("button", { name: button, exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await review(page, button);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  expect(backend.unexpected).toEqual([]);
});

test("320px reflow keeps public pages, account, board and forms within the viewport (simulated API)", async ({
  page,
  context,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 320, height: 800 });
  const backend = mockBackend();
  seedCommunity(backend);
  await backend.install(context);
  for (const path of [
    "/",
    "/#/logg-inn",
    "/#/arrangementer",
    `/#/arrangementer/${backend.events[0].id}`,
    "/#/torsdagsbanken",
    "/#/om",
    "/#/personvern",
  ]) {
    await page.goto(path);
    await review(page, `320-${path}`);
  }
  await login(page, accounts.admin);
  await review(page, "320-Min-side");
  await page.goto("/#/admin");
  await page
    .getByRole("button", { name: "Medlemmer og roller", exact: true })
    .click();
  await review(page, "320-Medlemmer");
  await page
    .getByRole("button", { name: "Arrangementer", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Nytt arrangement", exact: true })
    .click();
  await review(page, "320-Arrangementsskjema");
  await page.keyboard.press("Escape");
  expect(backend.unexpected).toEqual([]);
});
