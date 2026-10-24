import { expect, type Page, type BrowserContext } from "@playwright/test";
import { accounts, mockBackend } from "../ui/support/backend";

// Only simulated provider navigation. No Google/Supabase network or real users.
export async function googleAuthFlow(
  page: Page,
  context: BrowserContext,
  root = "",
  outcome: "success" | "cancelled" | "invalid" = "success",
) {
  const backend = mockBackend();
  await backend.install(context);
  let authorizations = 0,
    exchanges = 0;
  await page.route("**/auth/v1/authorize?**", async (route) => {
    authorizations++;
    const params = new URL(route.request().url()).searchParams;
    const redirect = `${new URL(page.url()).origin}${root}/`;
    expect(params.get("provider")).toBe("google");
    expect(params.get("redirect_to")).toBe(redirect);
    expect(params.get("scopes")).toBe("openid email profile");
    expect(params.get("code_challenge_method")).toBe("s256");
    expect(params.get("code_challenge")?.length).toBeGreaterThan(20);
    expect(params.get("prompt")).toBe("select_account");
    expect(params.has("access_type")).toBe(false);
    await route.fulfill({
      status: 302,
      headers: {
        location:
          redirect +
          (outcome === "cancelled"
            ? "?error=access_denied&error_description=private-cancel-details"
            : "?code=offline-google-code"),
      },
    });
  });
  await page.route("**/auth/v1/token?grant_type=pkce", async (route) => {
    exchanges++;
    const body = route.request().postDataJSON();
    expect(body.auth_code).toBe("offline-google-code");
    expect(body.code_verifier.length).toBeGreaterThan(20);
    if (outcome === "invalid")
      return route.fulfill({
        status: 400,
        json: {
          error: "invalid_grant",
          error_code: "flow_state_expired",
          msg: "private-invalid-details",
        },
      });
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
          app_metadata: { provider: "google", providers: ["google"] },
          user_metadata: { role: "admin", email_verified: true },
          created_at: new Date().toISOString(),
        },
      },
    });
  });
  await page.goto(`${root}/#/logg-inn?retur=%2Ftorsdagsbanken`);
  if (root) {
    await expect(page.locator("details.auth-alternatives")).not.toHaveAttribute(
      "open",
    );
    await expect(
      page.getByText("Send innloggingslenke", { exact: true }),
    ).not.toBeVisible();
    await expect(page.getByLabel("Passord", { exact: true })).toHaveCount(0);
  }
  const google = page.getByRole("button", {
    name: "Fortsett med Google",
    exact: true,
  });
  await google.focus();
  await page.keyboard.press("Enter");
  if (outcome === "success") {
    await expect(
      page.getByRole("heading", { name: "Torsdagsbanken.", exact: true }),
    ).toBeVisible();
    await page.goto(`${root}/#/min-side`);
    await expect(page.getByRole("heading", { name: /Hei,/ })).toBeVisible();
    await page.goto(`${root}/#/admin`);
    await expect(
      page.getByText("Kontoen din har ikke tilgang til styreportalen."),
    ).toBeVisible();
  } else {
    await expect(page.getByRole("alert")).toContainText(
      "Innloggingen ble ikke fullført",
    );
    await expect(
      page.getByRole("button", { name: "Fortsett med Google", exact: true }),
    ).toBeEnabled();
    expect(page.url()).toContain("#/logg-inn");
    await expect(page.locator("body")).not.toContainText(
      /private-cancel-details|private-invalid-details/,
    );
    await page.goto(`${root}/#/min-side`);
    await expect(
      page.getByRole("button", { name: "Fortsett med Google", exact: true }),
    ).toBeVisible();
  }
  expect(page.url()).not.toMatch(/[?&]code=|error_description=|private-/);
  expect(authorizations).toBe(1);
  expect(exchanges).toBe(outcome === "cancelled" ? 0 : 1);
  expect(backend.writes).toEqual([]);
  expect(backend.unexpected).toEqual([]);
}
