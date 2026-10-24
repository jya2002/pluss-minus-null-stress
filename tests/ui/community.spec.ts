import { test, expect } from "@playwright/test";
import { membershipJourney } from "../browser/membership-flow";
import { suggestionJourney } from "../browser/suggestion-flow";
import { pollFlow } from "../browser/poll-flow";
import { login } from "../browser/flows";
import { accounts, mockBackend } from "./support/backend";

for (const area of ["membership", "suggestions", "polls"] as const) {
  test(`${area}: student and administrator journey (simulated API)`, async ({
    page,
    context,
    browser,
  }, testInfo) => {
    const backend = mockBackend();
    await backend.install(context);
    const use = testInfo.project.use;
    const staff = await browser.newContext({
      viewport: use.viewport,
      userAgent: use.userAgent,
      isMobile: use.isMobile,
      hasTouch: use.hasTouch,
      deviceScaleFactor: use.deviceScaleFactor,
    });
    try {
      await backend.install(staff);
      const administrator = await staff.newPage();
      if (area === "membership")
        await membershipJourney(
          page,
          administrator,
          { student: accounts.a, staff: accounts.admin },
          "Teststudent A",
        );
      if (area === "suggestions")
        await suggestionJourney(
          page,
          administrator,
          { student: accounts.a, admin: accounts.admin },
          "Nettlesertest: Kakao og brettspill",
        );
      if (area === "polls") {
        await login(page, accounts.a);
        await login(administrator, accounts.admin);
        await pollFlow({ studentPage: page, adminPage: administrator });
      }
      expect(backend.unexpected).toEqual([]);
    } finally {
      await staff.close();
    }
  });
}
