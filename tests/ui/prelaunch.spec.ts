import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { accounts, mockBackend } from "./support/backend";
import { login } from "../browser/flows";

test("one account keeps membership, event, suggestion and poll history together; logout isolates the next account (simulated API)", async ({
  page,
  context,
}, info) => {
  test.setTimeout(60000);
  const backend = mockBackend();
  await backend.install(context);
  const pollId = randomUUID(),
    choice = randomUUID();
  backend.polls.push({
    id: pollId,
    question: "Pilot: Hvilken aktivitet ønsker du?",
    opens_at: new Date(Date.now() - 60000).toISOString(),
    closes_at: new Date(Date.now() + 3600000).toISOString(),
    published: true,
    hide_results: true,
    audience: "members",
  });
  backend.options.push(
    { id: choice, poll_id: pollId, label: "Brettspill" },
    { id: randomUUID(), poll_id: pollId, label: "Film" },
  );
  await login(page, accounts.a);
  await page.getByLabel("Visningsnavn", { exact: true }).fill("Pilotstudent A");
  await page.getByRole("button", { name: "Lagre profil", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Hei, Pilotstudent A!" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Søk medlemskap", exact: true })
    .click();
  await expect(
    page.getByText("Venter på godkjenning", { exact: true }),
  ).toBeVisible();
  // Approval is simulated fixture state, not an actual staff authorization test.
  backend.memberships[0].status = "approved";
  await page.reload();
  await expect(
    page.getByText("Godkjent medlem", { exact: true }),
  ).toBeVisible();
  await page.goto(`/#/arrangementer/${backend.events[0].id}`);
  await page
    .getByRole("button", { name: "Meld meg på / sett meg på venteliste" })
    .click();
  await expect(page.locator(".notice.success")).toContainText("Du er påmeldt!");
  await page.goto("/#/torsdagsbanken");
  await page
    .getByRole("button", { name: "Foreslå en aktivitet", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Tittel", { exact: true })
    .fill("Pilotstudentens private testidé");
  await dialog
    .getByLabel("Beskriv ideen", { exact: true })
    .fill("En sosial torsdag med brettspill og kakao.");
  await dialog.getByLabel("Vis meg som anonym student").check();
  await dialog
    .getByRole("button", { name: "Send inn forslaget", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Stem på Pilotstudentens private testidé",
      exact: true,
    })
    .click();
  const poll = page.locator(".poll-card");
  await poll.getByRole("radio", { name: "Brettspill", exact: true }).check();
  await poll
    .getByRole("button", { name: "Registrer min stemme", exact: true })
    .click();
  await expect(poll).toContainText("Du har stemt.");
  await page.goto("/#/min-side");
  await expect(
    page.locator(".account-row").filter({ hasText: backend.events[0].title }),
  ).toContainText("Bekreftet");
  await expect(
    page.getByText("Godkjent medlem", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("main")).toContainText(
    "Pilotstudentens private testidé",
  );
  await expect(page.locator("main")).toContainText(
    "Pilot: Hvilken aktivitet ønsker du?",
  );
  const emailEvents = page.getByLabel("E-post om mine arrangementer", {
    exact: true,
  });
  await emailEvents.click();
  await expect(emailEvents).toBeChecked();
  await page.reload();
  await expect(emailEvents).toBeChecked();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Last ned personopplysninger", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe(
    "mine-personopplysninger.json",
  );
  await page.screenshot({
    path: info.outputPath("account-integrated.png"),
    fullPage: true,
    scale: "css",
  });
  await page.getByRole("button", { name: "Logg ut", exact: true }).click();
  await expect(page.getByLabel("Passord", { exact: true })).toBeVisible();
  await login(page, accounts.b);
  await expect(
    page.getByRole("heading", { name: "Hei, Teststudent B!" }),
  ).toBeVisible();
  await expect(page.locator("main")).not.toContainText("Pilotstudent A");
  await expect(
    page.getByText("Du har ingen påmeldinger ennå", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Ikke medlem", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Du har ikke stemt i noen avstemninger.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("E-post om mine arrangementer", { exact: true }),
  ).not.toBeChecked();
  await page.goto("/#/admin");
  await expect(
    page.getByRole("heading", { name: "Kun for styret", exact: true }),
  ).toBeVisible();
  expect(backend.unexpected).toEqual([]);
});

test("failed data, logout and account deletion have recoverable error states (simulated API)", async ({
  page,
  context,
}) => {
  const backend = mockBackend();
  await backend.install(context);
  const failure = async (route: import("@playwright/test").Route) =>
    route.fulfill({
      status: route.request().url().includes("/auth/v1/logout") ? 400 : 500,
      json: { message: "Tjenesten er midlertidig utilgjengelig." },
    });
  await page.route("**/rest/v1/events?**", failure);
  await page.goto("/#/arrangementer");
  await expect(page.getByRole("alert")).toContainText(
    "Vi fikk ikke hentet innholdet.",
  );
  await page.unroute("**/rest/v1/events?**", failure);
  await page.getByRole("button", { name: "Prøv igjen", exact: true }).click();
  await expect(
    page.getByRole("link", { name: backend.events[0].title, exact: true }),
  ).toBeVisible();
  await login(page, accounts.a);
  await page.route("**/auth/v1/logout**", failure);
  await page.getByRole("button", { name: "Logg ut", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Utloggingen kunne ikke bekreftes",
  );
  await expect(page.getByLabel("Passord", { exact: true })).toBeVisible();
  // The installed SDK removes this device's session even if global revocation
  // fails; the toast survives navigation and must not claim other sessions ended.
  await page.unroute("**/auth/v1/logout**", failure);
  await login(page, accounts.a);
  await page
    .getByRole("button", { name: "Slett kontoen min", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Slette kontoen permanent?",
  });
  await dialog.getByRole("button", { name: "Bekreft", exact: true }).click();
  await expect(
    dialog.getByRole("alert").filter({ hasText: "Kontoen ble ikke slettet." }),
  ).toBeVisible();
  await expect(dialog).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("deletion-error.png"),
    scale: "css",
  });
  await dialog.getByRole("button", { name: "Behold", exact: true }).click();
  await page.getByRole("button", { name: "Logg ut", exact: true }).click();
  await expect(page.getByLabel("Passord", { exact: true })).toBeVisible();
  expect(backend.unexpected).toEqual([]);
});

test("poll options failure explains the problem and retry restores the ballot (simulated API)", async ({
  page,
  context,
}) => {
  const backend = mockBackend();
  await backend.install(context);
  const id = randomUUID();
  backend.polls.push({
    id,
    question: "Pilot: En åpen avstemning",
    opens_at: new Date(Date.now() - 60000).toISOString(),
    closes_at: new Date(Date.now() + 3600000).toISOString(),
    published: true,
    hide_results: true,
    audience: "everyone",
  });
  backend.options.push({ id: randomUUID(), poll_id: id, label: "Brettspill" });
  const failure = async (route: import("@playwright/test").Route) =>
    route.fulfill({
      status: 500,
      json: { message: "Alternativene kunne ikke hentes." },
    });
  await page.route("**/rest/v1/poll_options?**", failure);
  await page.goto("/#/torsdagsbanken");
  await expect(page.getByRole("alert")).toContainText(
    "Alternativene kunne ikke hentes.",
  );
  await expect(page.locator(".poll-card")).toHaveCount(0);
  await page.unroute("**/rest/v1/poll_options?**", failure);
  await page.getByRole("button", { name: "Prøv igjen", exact: true }).click();
  await expect(
    page.getByRole("radio", { name: "Brettspill", exact: true }),
  ).toBeVisible();
  expect(backend.unexpected).toEqual([]);
});

test.describe("calendar uses Oslo instead of the viewer's timezone", () => {
  test.use({ timezoneId: "America/Los_Angeles" });
  test("month boundary shows the event in the correct Oslo month and day (simulated API)", async ({
    page,
    context,
  }) => {
    const backend = mockBackend();
    Object.assign(backend.events[0], {
      starts_at: "2031-10-31T23:30:00Z",
      ends_at: "2031-11-01T02:00:00Z",
    });
    await backend.install(context);
    await page.goto("/#/arrangementer?visning=kalender");
    const calendar = page.getByRole("region", { name: "Arrangementskalender" });
    await expect(
      calendar.getByRole("heading", { name: "november 2031" }),
    ).toBeVisible();
    const day = calendar.locator(".calendar-day").filter({
      has: page.getByRole("link", {
        name: new RegExp(backend.events[0].title),
      }),
    });
    await expect(day.locator(":scope > span")).toHaveText("1");
    await expect(day).toContainText("00:30");
    expect(backend.unexpected).toEqual([]);
  });
});
