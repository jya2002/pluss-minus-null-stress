import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { login } from "../browser/flows";
import { accounts, mockBackend } from "./support/backend";

test("homepage with no suggestions has a usable invitation instead of a blank column (simulated API)", async ({
  page,
  context,
}) => {
  const backend = mockBackend();
  await backend.install(context);
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Den neste ideen kan være din",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("link", {
      name: "Foreslå noe du vil være med på →",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Hva har du lyst til å finne på?" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("link", { name: "Logg inn", exact: true }),
  ).toBeVisible();
  expect(backend.unexpected).toEqual([]);
});

test("contact form reaches the board and can be marked handled (simulated API)", async ({
  page,
  context,
  browser,
}, info) => {
  const backend = mockBackend();
  await backend.install(context);
  await login(page, accounts.a);
  await page.goto("/#/om");
  await page.getByLabel("Emne", { exact: true }).fill("Pilot: Kontakt styret");
  await page
    .getByLabel("Melding", { exact: true })
    .fill("En lokal testmelding om tilgjengelighet på arrangementet.");
  await page
    .getByRole("button", { name: "Send til styret", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Meldingen er lagret til styret" }),
  ).toBeVisible();
  await expect(page.getByLabel("Emne", { exact: true })).toHaveValue("");
  const use = info.project.use;
  const staff = await browser.newContext({
    viewport: use.viewport,
    userAgent: use.userAgent,
    isMobile: use.isMobile,
    hasTouch: use.hasTouch,
    deviceScaleFactor: use.deviceScaleFactor,
  });
  try {
    await backend.install(staff);
    const board = await staff.newPage();
    await login(board, accounts.admin);
    await board.goto("/#/admin");
    await board
      .getByRole("button", { name: "Kontaktmeldinger", exact: true })
      .click();
    const message = board
      .locator("article.panel")
      .filter({ hasText: "Pilot: Kontakt styret" });
    await expect(message).toContainText(
      "En lokal testmelding om tilgjengelighet",
    );
    await message
      .getByRole("button", { name: "Marker behandlet", exact: true })
      .click();
    await expect(message).toContainText("Behandlet");
    await expect(
      message.getByRole("button", { name: "Marker behandlet", exact: true }),
    ).toHaveCount(0);
    expect(backend.contacts).toHaveLength(1);
    expect(backend.contacts[0].resolved).toBe(true);
    expect(backend.unexpected).toEqual([]);
  } finally {
    await staff.close();
  }
});

test("closing registration preserves a student's stored status (simulated API)", async ({
  page,
  context,
}) => {
  const backend = mockBackend();
  const event = backend.events[0];
  event.deadline = new Date(Date.now() - 60000).toISOString();
  backend.registrations.push({
    id: randomUUID(),
    event_id: event.id,
    user_id: accounts.a.id,
    status: "confirmed",
    team_id: null,
    dietary: null,
    attended: false,
    created_at: new Date().toISOString(),
  });
  await backend.install(context);
  await login(page, accounts.a);
  await page.goto(`/#/arrangementer/${event.id}`);
  await expect(page.locator(".notice.success")).toContainText("Du er påmeldt!");
  await expect(
    page.getByRole("button", { name: "Meld meg på / sett meg på venteliste" }),
  ).toHaveCount(0);
  backend.registrations[0].status = "waitlisted";
  await page.reload();
  await expect(page.locator(".notice.success")).toContainText(
    "Du står på ventelisten.",
  );
  backend.registrations[0].status = "cancelled";
  await page.reload();
  await expect(
    page.getByText("Påmeldingen er stengt.", { exact: true }),
  ).toBeVisible();
  expect(backend.writes).toEqual([]);
  expect(backend.unexpected).toEqual([]);
});

test("featured mobile event uses the card width and keeps its title readable (simulated API)", async ({
  page,
  context,
}, info) => {
  const backend = mockBackend();
  backend.events[0].title = "Brettspilltorsdag på Blindern";
  await backend.install(context);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await expect(page.locator(".featured h2")).toContainText(
      backend.events[0].title,
    );
    const dimensions = await page.locator(".featured").evaluate((el) => {
      const copy = el.querySelector<HTMLElement>(".featured-copy")!;
      const title = el.querySelector<HTMLElement>("h2")!;
      return {
        card: el.clientWidth,
        copy: copy.clientWidth,
        lines:
          title.clientHeight / parseFloat(getComputedStyle(title).lineHeight),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(dimensions.copy).toBeGreaterThanOrEqual(dimensions.card - 2);
    expect(dimensions.lines).toBeLessThanOrEqual(3.1);
    expect(dimensions.overflow).toBe(false);
    await page.screenshot({
      path: info.outputPath(`featured-${width}.png`),
      fullPage: true,
      scale: "css",
    });
  }
  expect(backend.unexpected).toEqual([]);
});
