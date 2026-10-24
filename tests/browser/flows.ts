import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { osloInput } from "../../src/lib/utils";

export type Credentials = { email: string; password: string };

export async function login(page: Page, account: Credentials) {
  await page.goto("/#/logg-inn");
  await page.getByLabel("E-postadresse", { exact: true }).fill(account.email);
  // Do not let a failed fill print a real generated password in a call log.
  try {
    await page.getByLabel("Passord", { exact: true }).fill(account.password);
  } catch {
    throw new Error("Kunne ikke fylle passordfeltet. Legitimasjon er skjult.");
  }
  await page
    .getByRole("button", { name: "Logg inn med passord", exact: true })
    .click();
  try {
    await expect(page.getByRole("heading", { name: /Hei,/ })).toBeVisible();
  } catch {
    await page
      .locator('input[type="password"]')
      .evaluateAll((inputs) => {
        for (const input of inputs) (input as HTMLInputElement).value = "";
      })
      .catch(() => {});
    throw new Error(
      "Testinnlogging nådde ikke Min side. Passord er fjernet fra skjemaet; kontroller Auth-diagnostikken.",
    );
  }
}

async function navigate(page: Page, label: string) {
  const menu = page.getByRole("button", { name: "Åpne meny", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole("navigation", { name: "Hovedmeny" })
    .getByRole("link", { name: label, exact: true })
    .click();
}

async function openEvent(page: Page, title: string) {
  await navigate(page, "Arrangementer");
  await page
    .getByRole("textbox", { name: "Søk etter arrangementer" })
    .fill(title);
  await page.getByRole("link", { name: title, exact: true }).click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
}

export async function studentJourney(
  a: Page,
  b: Page,
  accounts: { a: Credentials; b: Credentials },
  title: string,
) {
  await test.step("Student A logs in, opens the directory and receives confirmed status", async () => {
    await login(a, accounts.a);
    await openEvent(a, title);
    await a
      .getByRole("button", { name: "Meld meg på / sett meg på venteliste" })
      .click();
    await expect(a.locator(".notice.success")).toContainText("Du er påmeldt!");
  });
  await test.step("Student B signs in separately and sees the waitlist", async () => {
    await login(b, accounts.b);
    await openEvent(b, title);
    await b
      .getByRole("button", { name: "Meld meg på / sett meg på venteliste" })
      .click();
    await expect(b.locator(".notice.success")).toContainText(
      "Du står på ventelisten.",
    );
    await navigate(b, "Min side");
    await expect(
      b.locator(".account-row").filter({ hasText: title }),
    ).toContainText("Venteliste");
  });
  await test.step("Student A cancels through Min side and sees the cancelled status", async () => {
    await navigate(a, "Min side");
    const row = a.locator(".account-row").filter({ hasText: title });
    await row.getByRole("button", { name: "Avbestill", exact: true }).click();
    await a
      .getByRole("dialog", { name: "Avbestille påmeldingen?" })
      .getByRole("button", { name: "Bekreft", exact: true })
      .click();
    await expect(row).toContainText("Avbestilt");
  });
  await test.step("Student B reloads Min side and sees the promoted place", async () => {
    await b.reload();
    await expect(
      b.locator(".account-row").filter({ hasText: title }),
    ).toContainText("Bekreftet");
    await expect(
      b.locator(".notification").filter({ hasText: "Du har fått plass" }),
    ).toBeVisible();
  });
  await test.step("A student cannot enter Styreportalen by changing the URL", async () => {
    await a.goto("/#/admin");
    await expect(
      a.getByRole("heading", { name: "Kun for styret" }),
    ).toBeVisible();
    await expect(
      a.getByRole("button", { name: "Nytt arrangement", exact: true }),
    ).toHaveCount(0);
  });
}

export async function adminJourney(
  page: Page,
  account: Credentials,
  title: string,
) {
  await login(page, account);
  await navigate(page, "Styreportal");
  await page
    .getByRole("button", { name: "Arrangementer", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Nytt arrangement", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Nytt arrangement" });
  const fields = {
    Tittel: title,
    Undertittel: "En kveld uten stress",
    Beskrivelse: "Midlertidig automatisk nettlesertest.",
    "Start (Europe/Oslo)": osloInput(
      new Date(Date.now() + 10 * 86400000).toISOString(),
    ),
    "Slutt (Europe/Oslo)": osloInput(
      new Date(Date.now() + 10 * 86400000 + 7200000).toISOString(),
    ),
    "Påmeldingsfrist (Europe/Oslo)": osloInput(
      new Date(Date.now() + 9 * 86400000).toISOString(),
    ),
    Kapasitet: "1",
    "Pris i kr": "0",
  };
  for (const [name, value] of Object.entries(fields))
    await dialog.getByLabel(name, { exact: true }).fill(value);
  await dialog.getByLabel("Merk som demonstrasjonsinnhold").check();
  const location = dialog.getByLabel("Sted", { exact: true });
  await test.step("Typing and real clipboard paste in Sted preserve every filled field", async () => {
    await location.selectText();
    await location.pressSequentially("Blindern");
    await expect(location).toHaveValue("Blindern");
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.evaluate(() =>
      navigator.clipboard.writeText("Vilhelm Bjerknes' hus"),
    );
    await location.selectText();
    await location.press("Control+V");
    await expect(location).toHaveValue("Vilhelm Bjerknes' hus");
    for (const [name, value] of Object.entries(fields))
      await expect(dialog.getByLabel(name, { exact: true })).toHaveValue(value);
    await expect(
      dialog.getByLabel("Merk som demonstrasjonsinnhold"),
    ).toBeChecked();
  });
  await test.step("Administrator creates a draft event through the form", async () => {
    await dialog
      .getByRole("button", { name: "Lagre arrangement", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
  });
  const row = page
    .locator(".admin-event-row")
    .filter({ hasText: title })
    .filter({ has: page.getByText("Utkast", { exact: true }) });
  await test.step("Administrator edits it and sees persisted values after reload", async () => {
    await row.getByRole("button", { name: "Rediger", exact: true }).click();
    const editor = page.getByRole("dialog", { name: "Rediger arrangement" });
    await expect(editor.getByLabel("Sted", { exact: true })).toHaveValue(
      "Vilhelm Bjerknes' hus",
    );
    await editor
      .getByLabel("Undertittel", { exact: true })
      .fill("Oppdatert av administrator");
    await editor.getByLabel("Sted", { exact: true }).fill("Blindern, rom 101");
    await editor
      .getByRole("button", { name: "Lagre arrangement", exact: true })
      .click();
    await expect(editor).toHaveCount(0);
    await page.reload();
    await page
      .getByRole("button", { name: "Arrangementer", exact: true })
      .click();
    await row.getByRole("button", { name: "Rediger", exact: true }).click();
    await expect(editor.getByLabel("Undertittel", { exact: true })).toHaveValue(
      "Oppdatert av administrator",
    );
    await expect(editor.getByLabel("Sted", { exact: true })).toHaveValue(
      "Blindern, rom 101",
    );
    for (const [name, value] of Object.entries(fields)) {
      if (name !== "Undertittel")
        await expect(editor.getByLabel(name, { exact: true })).toHaveValue(
          value,
        );
    }
  });
}
