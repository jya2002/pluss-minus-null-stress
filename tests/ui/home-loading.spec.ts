import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { accounts, mockBackend } from "./support/backend";

for (const restoredSession of [false, true]) {
  test(`direct homepage load and reload show upcoming events (${restoredSession ? "restored session" : "guest"}, simulated API)`, async ({
    page,
    context,
  }) => {
    const backend = mockBackend();
    const first = backend.events[0];
    const second = { ...first, id: randomUUID(), title: "Neste spillkveld" };
    const past = {
      ...first,
      id: randomUUID(),
      title: "Forrige spillkveld",
      starts_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      ends_at: new Date(Date.now() - 86400000).toISOString(),
    };
    const cancelled = {
      ...first,
      id: randomUUID(),
      title: "Avlyst spillkveld",
      status: "cancelled" as const,
    };
    backend.events.push(second, past, cancelled);
    await backend.install(context);
    if (restoredSession) {
      await context.addInitScript((user) => {
        localStorage.setItem(
          "sb-pmns-ui-auth-token",
          JSON.stringify({
            access_token: `ui-${user.id}`,
            refresh_token: `refresh-${user.id}`,
            token_type: "bearer",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: {
              id: user.id,
              email: user.email,
              aud: "authenticated",
              role: "authenticated",
              app_metadata: {},
              user_metadata: {},
            },
          }),
        );
      }, accounts.a);
    }

    const assertHome = async () => {
      const home = page.locator(".home-events");
      await expect(home.locator(".skeleton-grid")).toHaveCount(0);
      await expect(home.locator(".event-card")).toHaveCount(2);
      await expect(home).toContainText(first.title);
      await expect(home).toContainText(second.title);
      await expect(home).not.toContainText(past.title);
      await expect(home).not.toContainText(cancelled.title);
      await expect(page.locator(".featured h2")).toContainText(first.title);
    };
    for (const reload of [false, true]) {
      const response = page.waitForResponse(
        (res) => new URL(res.url()).pathname === "/rest/v1/events",
      );
      if (reload) await page.reload();
      else await page.goto("/");
      const eventsResponse = await response;
      expect(eventsResponse.status()).toBe(200);
      expect(await eventsResponse.json()).toHaveLength(4);
      await assertHome();
    }

    await page
      .locator(".home-events")
      .getByRole("link", { name: "Alle arrangementer" })
      .click();
    await page.getByRole("button", { name: "Tidligere", exact: true }).click();
    await expect(page.locator(".event-card")).toHaveCount(1);
    await expect(page.locator(".event-card")).toContainText(past.title);
    expect(backend.unexpected).toEqual([]);
  });
}
