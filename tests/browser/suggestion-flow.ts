import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { login } from "./flows";
import type { Credentials } from "./flows";

export async function suggestionJourney(
  student: Page,
  administrator: Page,
  accounts: { student: Credentials; admin: Credentials },
  title: string,
) {
  const card = student.locator(".suggestion-card").filter({ hasText: title });
  await login(student, accounts.student);
  await student.goto("/#/torsdagsbanken");
  await test.step("Student submits a validated anonymous activity suggestion", async () => {
    await student
      .getByRole("button", { name: "Foreslå en aktivitet", exact: true })
      .click();
    const dialog = student.getByRole("dialog", {
      name: "Hva har du lyst til å finne på?",
    });
    await dialog.getByLabel("Tittel", { exact: true }).fill("x");
    await dialog.getByLabel("Beskriv ideen", { exact: true }).fill("Kort");
    await dialog
      .getByRole("button", { name: "Send inn forslaget", exact: true })
      .click();
    await expect(
      dialog.getByText("Minst 3 tegn.", { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByText("Beskriv ideen med minst 10 tegn.", { exact: true }),
    ).toBeVisible();
    await dialog.getByLabel(/^Tittel/).fill(title);
    await dialog
      .getByLabel(/^Beskriv ideen/)
      .fill("Vi samles til brettspill, kakao og en hyggelig torsdag.");
    await dialog
      .getByRole("combobox", { name: "Kategori", exact: true })
      .selectOption("Spillkveld");
    await dialog
      .getByLabel("Budsjett i kr (valgfritt)", { exact: true })
      .fill("300");
    await dialog
      .getByLabel("Vis meg som anonym student", { exact: true })
      .check();
    await expect(dialog.getByLabel("Bilde (valgfritt)")).toBeDisabled();
    await expect(
      dialog.getByText(
        "Anonyme forslag publiseres uten bilde for å beskytte identiteten din.",
      ),
    ).toBeVisible();
    await expect(dialog.getByLabel("Tittel", { exact: true })).toHaveValue(
      title,
    );
    // Tab navigation remains inside the native modal.
    await dialog
      .getByRole("button", { name: "Send inn forslaget", exact: true })
      .focus();
    await student.keyboard.press("Enter");
    await expect(dialog).toHaveCount(0);
    await expect(card).toContainText("Anonym student");
    await expect(card).toContainText("Foreslått");
    await expect(card).toContainText("Budsjettanslag: 300 kr");
    await expect(card.locator("img")).toHaveCount(0);
  });
  await test.step("Student can vote once and withdraw the suggestion vote", async () => {
    const vote = card.getByRole("button", {
      name: `Stem på ${title}`,
      exact: true,
    });
    await expect(vote).toHaveText("0");
    await vote.click();
    const withdraw = card.getByRole("button", {
      name: `Trekk stemmen på ${title}`,
      exact: true,
    });
    await expect(withdraw).toHaveAttribute("aria-pressed", "true");
    await expect(withdraw).toHaveText("1");
    await withdraw.click();
    await expect(vote).toHaveText("0");
    await expect(vote).toHaveAttribute("aria-pressed", "false");
  });
  await login(administrator, accounts.admin);
  await administrator.goto("/#/admin");
  await administrator
    .getByRole("button", { name: "Forslag", exact: true })
    .click();
  const moderation = administrator
    .locator("article.panel")
    .filter({ hasText: title });
  await test.step("Administrator moderates all five proposal statuses", async () => {
    for (const [value, label] of [
      ["reviewing", "Under vurdering"],
      ["planned", "Planlagt"],
      ["completed", "Gjennomført"],
      ["rejected", "Avslått"],
      ["proposed", "Foreslått"],
    ]) {
      const status = moderation.getByRole("combobox", {
        name: "Status",
        exact: true,
      });
      await expect(status).toBeEnabled();
      await status.selectOption(value);
      await expect(status).toHaveValue(value);
      await expect(status).toBeEnabled();
      await student.reload();
      await expect(card).toContainText(label);
      const button = card.getByRole("button");
      if (["planned", "completed", "rejected"].includes(value))
        await expect(button).toBeDisabled();
      else await expect(button).toBeEnabled();
    }
  });
  await test.step("Hidden proposal is removed from the public feed and can be restored", async () => {
    const hidden = moderation.getByLabel("Skjul offentlig", { exact: true });
    await hidden.click();
    await expect(hidden).toBeChecked();
    await expect(hidden).toBeEnabled();
    await student.reload();
    await expect(card).toHaveCount(0);
    await hidden.click();
    await expect(hidden).not.toBeChecked();
    await expect(hidden).toBeEnabled();
    await student.reload();
    await expect(card).toContainText("Anonym student");
  });
}
