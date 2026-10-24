import { test, expect } from "@playwright/test";
import { mockBackend } from "./support/backend";
import { authCallbackFlow } from "../browser/auth-callback-flow";
test("PKCE login returns through HashRouter without exposing callback code (simulated Auth)", async ({
  page,
  context,
}) => authCallbackFlow(page, context));
for (const callback of [
  "/#error=access_denied&error_code=otp_expired&error_description=provider-private",
  "/?code=missing-verifier-code",
]) {
  test(`bad callback explains recovery without a phantom HashRouter page: ${callback.includes("#error") ? "expired" : "missing verifier"}`, async ({
    page,
    context,
  }) => {
    const backend = mockBackend();
    await backend.install(context);
    await page.goto(callback);
    await expect(page.getByRole("alert")).toContainText(
      "Innloggingen ble ikke fullført",
    );
    await expect(
      page.getByRole("button", { name: "Innloggingslenke", exact: true }),
    ).toBeVisible();
    expect(page.url()).toContain("#/logg-inn");
    expect(page.url()).not.toMatch(/code=|provider-private|error_description/);
    await expect(page.locator("body")).not.toContainText("provider-private");
    expect(backend.unexpected).toEqual([]);
  });
}
