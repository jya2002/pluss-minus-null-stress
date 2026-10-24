import { test, expect } from "@playwright/test";

// UI regression only: every backend request is intercepted; no real account or
// database is used. Run with playwright.ui.config.ts.
test.beforeEach(async ({ page }) => {
  await page.route("https://pmns-ui.supabase.co/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith("/user_roles")
      ? { role: "board" }
      : path.endsWith("/site_settings")
        ? {
            about: "Test",
            contact_email: "",
            instagram_url: "",
            facebook_url: "",
            membership_approval: true,
          }
        : [];
    await route.fulfill({ json: data });
  });
  await page.addInitScript(() => {
    localStorage.setItem(
      "sb-pmns-ui-auth-token",
      JSON.stringify({
        access_token: "ui-test-token",
        refresh_token: "ui-test-refresh",
        token_type: "bearer",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: {
          id: "11111111-1111-4111-8111-111111111111",
          aud: "authenticated",
          role: "authenticated",
          email: "board@example.test",
          app_metadata: {},
          user_metadata: {},
        },
      }),
    );
  });
  await page.goto("/#/admin");
  await page.getByRole("button", { name: "Arrangementer", exact: true }).click();
  await page.getByRole("button", { name: "Nytt arrangement", exact: true }).click();
});

test("keeps event values when typing and pasting a location", async ({ page }) => {
  const dialog = page.getByRole("dialog", { name: "Nytt arrangement" });
  await dialog.getByLabel("Tittel", { exact: true }).fill("Brettspilltorsdag");
  await dialog.getByLabel("Undertittel", { exact: true }).fill("En sosial kveld");
  await dialog
    .getByLabel("Beskrivelse", { exact: true })
    .fill("Ta med favorittspillet ditt.");
  await dialog.getByLabel("Start (Europe/Oslo)").fill("2027-04-01T18:00");
  await dialog.getByLabel("Slutt (Europe/Oslo)").fill("2027-04-01T21:00");
  const location = dialog.getByLabel("Sted", { exact: true });
  await location.selectText();
  await location.pressSequentially("Blindern");
  await expect(location).toHaveValue("Blindern");
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.evaluate(() =>
    navigator.clipboard.writeText("Vilhelm Bjerknes' hus"),
  );
  await location.selectText();
  await location.press("Control+V");
  await expect(location).toHaveValue("Vilhelm Bjerknes' hus");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Tittel", { exact: true })).toHaveValue(
    "Brettspilltorsdag",
  );
  await expect(dialog.getByLabel("Undertittel", { exact: true })).toHaveValue(
    "En sosial kveld",
  );
  await expect(dialog.getByLabel("Beskrivelse", { exact: true })).toHaveValue(
    "Ta med favorittspillet ditt.",
  );
  await expect(dialog.getByLabel("Start (Europe/Oslo)")).toHaveValue(
    "2027-04-01T18:00",
  );
  await expect(dialog.getByLabel("Slutt (Europe/Oslo)")).toHaveValue(
    "2027-04-01T21:00",
  );
});

test("selecting location text and releasing over dialog spacing does not discard the event", async ({ page }) => {
  const dialog = page.getByRole("dialog", { name: "Nytt arrangement" });
  await dialog.getByLabel("Tittel", { exact: true }).fill("Brettspilltorsdag");
  const location = dialog.getByLabel("Sted", { exact: true });
  await location.scrollIntoViewIfNeeded();
  const inputBox = (await location.boundingBox())!;
  const dialogBox = (await dialog.boundingBox())!;
  // Drag across the text into the dialog's padding, as when replacing the
  // default location before typing or pasting.
  await page.mouse.move(inputBox.x + 140, inputBox.y + inputBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(dialogBox.x + 5, inputBox.y + inputBox.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Tittel", { exact: true })).toHaveValue(
    "Brettspilltorsdag",
  );
  await location.fill("Blindern");
  await expect(location).toHaveValue("Blindern");
});

test("dialog padding keeps the form open while close button, Escape and backdrop still work", async ({ page }) => {
  const dialog = page.getByRole("dialog", { name: "Nytt arrangement" });
  const newEvent = page.getByRole("button", {
    name: "Nytt arrangement",
    exact: true,
  });
  const bounds = (await dialog.boundingBox())!;
  await page.mouse.click(bounds.x + 5, bounds.y + 50);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Lukk dialog" }).click();
  await expect(dialog).toHaveCount(0);
  await newEvent.click();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await newEvent.click();
  await page.mouse.click(2, 2);
  await expect(dialog).toHaveCount(0);
});
