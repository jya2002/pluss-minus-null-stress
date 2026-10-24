import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("student visits homepage, searches and opens calendar", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Mer fellesskap. Mindre stress." }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Se arrangementer", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Søk etter arrangementer" })
    .fill("Brettspill");
  await expect(
    page.getByRole("heading", { name: "Brettspilltorsdag", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Kalendervisning" }).click();
  await expect(
    page.getByRole("region", { name: "Arrangementskalender" }),
  ).toBeVisible();
  await expect(page.locator("body")).toHaveJSProperty(
    "scrollWidth",
    await page.locator("body").evaluate((el) => el.clientWidth),
  );
});
test("Thursday ideas, draft restrictions and administration protection", async ({
  page,
}) => {
  await page.goto("/#/torsdagsbanken");
  await expect(
    page.getByRole("heading", { name: "Torsdagsbanken.", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Foreslå en aktivitet" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto("/#/arrangementer/quiz-kaos");
  await expect(
    page.getByText("Dette er et utkast.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Meld meg på/ })).toHaveCount(
    0,
  );
  await page.goto("/#/admin");
  await expect(
    page.getByText(/Administrasjon krever en ekte Supabase-konto/),
  ).toBeVisible();
});
test("mobile navigation and keyboard access", async ({ page }, info) => {
  await page.goto("/");
  if (info.project.name === "mobile") {
    await page.getByRole("button", { name: "Åpne meny" }).click();
    await page
      .getByRole("navigation", { name: "Hovedmeny" })
      .getByRole("link", { name: "Om oss" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Et fellesskap som går opp." }),
    ).toBeVisible();
  }
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Mer fellesskap. Mindre stress." }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Hopp til innhold" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await expect(page).toHaveURL(/\/$/);
});
test("accessibility and responsive visual review", async ({ page }, info) => {
  for (const path of [
    "/",
    "/#/arrangementer",
    "/#/torsdagsbanken",
    "/#/logg-inn",
    "/#/personvern",
  ]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    const report = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      report.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    const overflow = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      offenders: Array.from(document.querySelectorAll("*"))
        .filter(
          (el) =>
            el.getBoundingClientRect().right > innerWidth + 1 &&
            getComputedStyle(el).position !== "absolute",
        )
        .map((el) => `${el.tagName}.${el.className}`)
        .slice(0, 8),
    }));
    expect(overflow.scroll, JSON.stringify(overflow)).toBeLessThanOrEqual(
      overflow.width,
    );
    if (path === "/")
      await page.screenshot({
        path: `test-results/home-${info.project.name}.png`,
        fullPage: true,
        scale: "css",
      });
  }
});
