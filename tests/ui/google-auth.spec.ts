import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockBackend } from "./support/backend";
import { googleAuthFlow } from "../browser/google-auth-flow";
for (const outcome of ["success", "cancelled", "invalid"] as const)
  test(`Google OAuth ${outcome}: PKCE, return path and student permissions (simulated provider)`, async ({
    page,
    context,
  }) => googleAuthFlow(page, context, "", outcome));
test("Google login fits the viewport and passes automated accessibility checks", async ({
  page,
  context,
}) => {
  const backend = mockBackend();
  await backend.install(context);
  await page.goto("/#/logg-inn");
  await expect(
    page.getByRole("button", { name: "Fortsett med Google", exact: true }),
  ).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((node) => ({
        target: node.target,
        reason: node.failureSummary,
      })),
    })),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("google-login.png"),
    fullPage: true,
  });
  expect(backend.unexpected).toEqual([]);
});
