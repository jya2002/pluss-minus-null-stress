import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { login } from "../browser/flows";
import { accounts, mockBackend } from "./support/backend";

async function eventsTab(page: Page) {
  await page.goto("/#/admin");
  await page
    .getByRole("navigation", { name: "Administrasjon" })
    .getByRole("button", { name: "Arrangementer", exact: true })
    .click();
}
test("administrator confirms the exact title, can cancel, then deletes a draft and sees a refreshed list (simulated API)", async ({
  page,
  context,
}) => {
  const backend = mockBackend();
  backend.events[0].status = "draft";
  const target = { ...backend.events[0] };
  backend.events.push({
    ...target,
    id: randomUUID(),
    title: "Behold dette andre utkastet",
  });
  await backend.install(context);
  await login(page, accounts.admin);
  await eventsTab(page);
  const row = page.locator(".admin-event-row").filter({
    has: page.getByRole("heading", { name: target.title, exact: true }),
  });
  const open = row.getByRole("button", {
    name: "Slett permanent",
    exact: true,
  });
  await open.click();
  let dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Slett permanent" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(open).toBeFocused();
  expect(backend.writes).toEqual([]);
  await open.click();
  dialog = page.getByRole("dialog");
  const input = dialog.getByLabel("Skriv arrangementets eksakte tittel");
  const confirm = dialog.getByRole("button", {
    name: "Slett permanent",
    exact: true,
  });
  await input.fill(target.title.toLowerCase());
  await expect(confirm).toBeDisabled();
  await input.fill(`${target.title} `);
  await expect(confirm).toBeDisabled();
  await input.fill(target.title);
  await expect(confirm).toBeEnabled();
  const report = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(report.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await confirm.click();
  await expect(dialog).toHaveCount(0);
  await expect(row).toHaveCount(0);
  await expect(
    page.getByRole("heading", {
      name: "Behold dette andre utkastet",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Arrangementer", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: target.title, exact: true }),
  ).toHaveCount(0);
  expect(backend.events.map((e) => e.title)).toEqual([
    "Behold dette andre utkastet",
  ]);
  expect(backend.writes).toEqual(["rpc/delete_draft_event"]);
  expect(backend.unexpected).toEqual([]);
});

test("linked cancelled registration is rejected server-side and dialog/list retain data (simulated API)", async ({
  page,
  context,
}) => {
  const backend = mockBackend();
  backend.events[0].status = "draft";
  const target = backend.events[0];
  backend.registrations.push({
    id: randomUUID(),
    event_id: target.id,
    user_id: accounts.a.id,
    status: "cancelled",
    team_id: null,
    dietary: null,
    attended: false,
    created_at: new Date().toISOString(),
  });
  await backend.install(context);
  await login(page, accounts.admin);
  await eventsTab(page);
  await page
    .getByRole("button", { name: "Slett permanent", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Skriv arrangementets eksakte tittel")
    .fill(target.title);
  await dialog
    .getByRole("button", { name: "Slett permanent", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("tilknyttede data");
  await expect(
    dialog.getByLabel("Skriv arrangementets eksakte tittel"),
  ).toHaveValue(target.title);
  expect(backend.events).toHaveLength(1);
  expect(backend.registrations).toHaveLength(1);
  expect(backend.writes).toEqual(["rpc/delete_draft_event"]);
  await dialog.getByRole("button", { name: "Behold utkastet" }).click();
  await expect(
    page.getByRole("heading", { name: target.title, exact: true }),
  ).toBeVisible();
  expect(backend.unexpected).toEqual([]);
});

for (const status of ["published", "cancelled"] as const)
  test(`${status} event offers publishing/cancellation guidance instead of deletion (simulated API)`, async ({
    page,
    context,
  }) => {
    const backend = mockBackend();
    backend.events[0].status = status;
    await backend.install(context);
    await login(page, accounts.admin);
    await eventsTab(page);
    await page
      .getByRole("button", { name: "Slett permanent", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Arrangementet kan ikke slettes",
    });
    await expect(dialog).toContainText("Bruk avlysning");
    await expect(dialog.getByRole("textbox")).toHaveCount(0);
    await expect(
      dialog.getByRole("button", { name: "Slett permanent" }),
    ).toHaveCount(0);
    await dialog
      .getByRole("button", { name: "Rediger publiseringsstatus" })
      .click();
    await expect(
      page
        .getByRole("dialog", { name: "Rediger arrangement" })
        .getByLabel("Publiseringsstatus"),
    ).toHaveValue(status);
    expect(backend.writes).toEqual([]);
    expect(backend.unexpected).toEqual([]);
  });

for (const failure of [
  "empty-success",
  "missing-migration",
  "network",
] as const)
  test(`${failure} cannot produce false deletion success or automatic retry (simulated API)`, async ({
    page,
    context,
  }) => {
    const backend = mockBackend();
    backend.events[0].status = "draft";
    await backend.install(context);
    let attempts = 0;
    await context.route("**/rest/v1/rpc/delete_draft_event", async (route) => {
      attempts++;
      if (failure === "network") return route.abort();
      await route.fulfill(
        failure === "empty-success"
          ? { status: 200, json: null }
          : {
              status: 404,
              json: { code: "PGRST202", message: "Missing function" },
            },
      );
    });
    await login(page, accounts.admin);
    await eventsTab(page);
    await page
      .getByRole("button", { name: "Slett permanent", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Skriv arrangementets eksakte tittel")
      .fill(backend.events[0].title);
    await dialog
      .getByRole("button", { name: "Slett permanent", exact: true })
      .click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    if (failure === "missing-migration")
      await expect(dialog.getByRole("alert")).toContainText(
        "ikke tilgjengelig i databasen ennå",
      );
    if (failure === "empty-success")
      await expect(dialog.getByRole("alert")).toContainText(
        "kunne ikke bekreftes",
      );
    await expect(
      dialog.getByRole("button", { name: "Slett permanent", exact: true }),
    ).toBeEnabled();
    expect(attempts).toBe(1);
    expect(backend.events).toHaveLength(1);
    expect(backend.unexpected).toEqual([]);
  });

test("stale publication is rejected after confirmation and the dialog fits 320px (simulated API)", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const backend = mockBackend();
  backend.events[0].status = "draft";
  backend.events[0].title =
    "Nettlesertest: Et langt arrangementsnavn som skal brytes pent i den smale bekreftelsesdialogen";
  await backend.install(context);
  await login(page, accounts.admin);
  await eventsTab(page);
  await page
    .getByRole("button", { name: "Slett permanent", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Skriv arrangementets eksakte tittel")
    .fill(backend.events[0].title);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  const report = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(report.violations).toEqual([]);
  // Another organizer publishes after the browser's draft data was loaded.
  backend.events[0].status = "published";
  await dialog
    .getByRole("button", { name: "Slett permanent", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Bare upubliserte utkast",
  );
  expect(backend.events).toHaveLength(1);
  expect(backend.events[0].status).toBe("published");
  expect(backend.writes).toEqual(["rpc/delete_draft_event"]);
  expect(backend.unexpected).toEqual([]);
});

test("students cannot enter the deletion UI; board members have no delete controls (simulated API)", async ({
  page,
  context,
}) => {
  const backend = mockBackend();
  await backend.install(context);
  await login(page, accounts.a);
  await page.goto("/#/admin");
  await expect(
    page.getByRole("heading", { name: "Kun for styret" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Slett permanent" }),
  ).toHaveCount(0);
  await context.route("**/rest/v1/user_roles*", (route) =>
    route.fulfill({ json: { role: "board" } }),
  );
  await page.reload();
  await eventsTab(page);
  await expect(
    page.getByRole("heading", { name: backend.events[0].title, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Slett permanent" }),
  ).toHaveCount(0);
  expect(backend.writes).toEqual([]);
  expect(backend.unexpected).toEqual([]);
});
