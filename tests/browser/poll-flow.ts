import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { osloInput } from "../../src/lib/utils";

// Pages are already authenticated by the caller. The same actions can run with
// isolated API simulations or authorized real test fixtures.
export async function pollFlow({
  adminPage: admin,
  studentPage: student,
  question = "Hva skal vi gjøre på neste testtorsdag?",
}: {
  adminPage: Page;
  studentPage: Page;
  question?: string;
}) {
  await test.step("Board creates a hidden-results poll through its form", async () => {
    await admin.goto("/#/admin");
    await admin
      .getByRole("button", { name: "Avstemninger", exact: true })
      .click();
    await admin
      .getByRole("button", { name: "Ny avstemning", exact: true })
      .click();
    const dialog = admin.getByRole("dialog", { name: "Ny torsdagsavstemning" });
    await dialog.getByLabel("Spørsmål", { exact: true }).fill(question);
    await dialog
      .getByLabel("Åpner (Europe/Oslo)", { exact: true })
      .fill(osloInput(new Date(Date.now() - 300000).toISOString()));
    await dialog
      .getByLabel("Stenger (Europe/Oslo)", { exact: true })
      .fill(osloInput(new Date(Date.now() + 3600000).toISOString()));
    await dialog
      .getByLabel("Alternativer, ett per linje (2–12)", { exact: true })
      .fill("Brettspillkveld\nFilm og pizza");
    await expect(dialog.getByLabel("Skjul resultater til slutt")).toBeChecked();
    await dialog
      .getByRole("button", { name: "Opprett avstemning", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
  });
  const row = admin
    .locator("article.panel")
    .filter({
      has: admin.getByRole("heading", { name: question, exact: true }),
    });
  await test.step("Board can unpublish and republish the poll", async () => {
    await row.getByRole("button", { name: "Avpubliser", exact: true }).click();
    await expect(
      row.getByRole("button", { name: "Publiser", exact: true }),
    ).toBeVisible();
    await student.goto("/#/torsdagsbanken");
    await expect(
      student.getByRole("heading", { name: question, exact: true }),
    ).toHaveCount(0);
    await row.getByRole("button", { name: "Publiser", exact: true }).click();
    await expect(
      row.getByRole("button", { name: "Avpubliser", exact: true }),
    ).toBeVisible();
  });
  const card = student
    .locator("article.poll-card")
    .filter({
      has: student.getByRole("heading", { name: question, exact: true }),
    });
  await test.step("A student casts exactly one vote and cannot see hidden results", async () => {
    await student.reload();
    await expect(card).toContainText("Åpen avstemning");
    await expect(card).toContainText(
      "Resultatene vises når avstemningen er stengt.",
    );
    await expect(card.locator(".poll-option strong")).toHaveCount(0);
    const choice = card.getByRole("radio", {
      name: "Brettspillkveld",
      exact: true,
    });
    await choice.focus();
    await choice.press("Space");
    await expect(choice).toBeChecked();
    await card
      .getByRole("button", { name: "Registrer min stemme", exact: true })
      .click();
    await expect(card).toContainText("Du har stemt.");
    await expect(
      card.getByRole("radio", { name: "Brettspillkveld", exact: true }),
    ).toBeChecked();
    await expect(
      card.getByRole("radio", { name: "Film og pizza", exact: true }),
    ).toBeDisabled();
    await expect(card.locator(".poll-option strong")).toHaveCount(0);
    await student.reload();
    await expect(card).toContainText("Du har stemt.");
    await expect(
      card.getByRole("button", { name: "Registrer min stemme", exact: true }),
    ).toHaveCount(0);
  });
  await test.step("Board edits the voting period, validates dates and controls result visibility", async () => {
    await row
      .getByRole("button", { name: "Endre stemmeperiode", exact: true })
      .click();
    const dialog = admin.getByRole("dialog", { name: "Endre stemmeperiode" });
    const opens = osloInput(new Date(Date.now() - 600000).toISOString());
    const closes = osloInput(new Date(Date.now() + 1800000).toISOString());
    await dialog.getByLabel("Åpner (Europe/Oslo)", { exact: true }).fill(opens);
    await dialog
      .getByLabel("Stenger (Europe/Oslo)", { exact: true })
      .fill(opens);
    await dialog
      .getByRole("button", { name: "Lagre stemmeperiode", exact: true })
      .click();
    await expect(
      admin.getByText("Stengetiden må være etter åpningstiden.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(dialog).toBeVisible();
    await dialog
      .getByLabel("Stenger (Europe/Oslo)", { exact: true })
      .fill(closes);
    await dialog
      .getByRole("button", { name: "Lagre stemmeperiode", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await row
      .getByRole("button", { name: "Endre stemmeperiode", exact: true })
      .click();
    await expect(
      dialog.getByLabel("Åpner (Europe/Oslo)", { exact: true }),
    ).toHaveValue(opens);
    await expect(
      dialog.getByLabel("Stenger (Europe/Oslo)", { exact: true }),
    ).toHaveValue(closes);
    await dialog
      .getByRole("button", { name: "Lukk dialog", exact: true })
      .click();
    await row.getByLabel("Skjul resultater til slutt").click();
    await expect(
      row.getByLabel("Skjul resultater til slutt"),
    ).not.toBeChecked();
    await student.reload();
    await expect(card.locator(".poll-option strong").first()).toContainText(
      "1 (100 %)",
    );
    await row.getByLabel("Skjul resultater til slutt").click();
    await expect(row.getByLabel("Skjul resultater til slutt")).toBeChecked();
    await student.reload();
    await expect(card.locator(".poll-option strong")).toHaveCount(0);
  });
  await test.step("Closing the poll reveals actual results and disables voting", async () => {
    await row.getByRole("button", { name: "Avslutt nå", exact: true }).click();
    await expect(
      row.getByRole("button", { name: "Avslutt nå", exact: true }),
    ).toHaveCount(0);
    await student.reload();
    await expect(card).toContainText("Avsluttet");
    await expect(card.locator(".poll-option strong").first()).toContainText(
      "1 (100 %)",
    );
    await expect(card.getByRole("radio").first()).toBeDisabled();
    await expect(card).toContainText("ikke en bekreftelse på et arrangement");
  });
}
