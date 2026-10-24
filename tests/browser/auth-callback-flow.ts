import { expect, type Page, type BrowserContext } from "@playwright/test";
import { accounts, mockBackend } from "../ui/support/backend";
export async function authCallbackFlow(
  page: Page,
  context: BrowserContext,
  root = "",
) {
  let changedInputControl = false;
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      message.text().includes("changing an uncontrolled input")
    )
      changedInputControl = true;
  });
  const backend = mockBackend();
  await backend.install(context);
  let redirect = "",
    exchanges = 0;
  await page.route(/\/auth\/v1\/otp(?:\?|$)/, async (route) => {
    redirect =
      route.request().postDataJSON().email_redirect_to ??
      new URL(route.request().url()).searchParams.get("redirect_to") ??
      "";
    await route.fulfill({ json: {} });
  });
  await page.route("**/auth/v1/token?grant_type=pkce", async (route) => {
    exchanges++;
    const body = route.request().postDataJSON();
    expect(body.auth_code).toBe("offline-code");
    expect(body.code_verifier.length).toBeGreaterThan(20);
    await route.fulfill({
      json: {
        access_token: `ui-${accounts.a.id}`,
        refresh_token: `refresh-${accounts.a.id}`,
        token_type: "bearer",
        expires_in: 3600,
        user: {
          id: accounts.a.id,
          email: accounts.a.email,
          aud: "authenticated",
          role: "authenticated",
          app_metadata: {},
          user_metadata: {},
          created_at: new Date().toISOString(),
        },
      },
    });
  });
  await page.goto(`${root}/#/logg-inn?retur=%2Ftorsdagsbanken`);
  if (root)
    await page.getByText("Andre innloggingsmåter", { exact: true }).click();
  if (!root)
    await page
      .getByRole("button", { name: "Innloggingslenke", exact: true })
      .click();
  await page
    .getByLabel("E-postadresse", { exact: true })
    .fill(accounts.a.email);
  await page
    .getByRole("button", { name: "Send innloggingslenke", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sjekk innboksen din", exact: true }),
  ).toBeVisible();
  expect(redirect).toBe(`${new URL(page.url()).origin}${root}/`);
  await page.goto(`${root}/?code=offline-code`);
  await expect(
    page.getByRole("heading", { name: "Torsdagsbanken.", exact: true }),
  ).toBeVisible();
  expect(exchanges).toBe(1);
  expect(page.url()).not.toContain("code=");
  expect(backend.unexpected).toEqual([]);
  expect(changedInputControl).toBe(false);
}
