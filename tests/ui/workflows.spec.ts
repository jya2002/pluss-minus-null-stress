import { test, expect } from "@playwright/test";
import { adminJourney, studentJourney } from "../browser/flows";
import { accounts, mockBackend } from "./support/backend";

test("password login, directory, confirmed/waitlisted, cancellation, promotion and student admin restriction (simulated API)", async ({
  page,
  context,
  browser,
}, testInfo) => {
  const backend = mockBackend();
  await backend.install(context);
  const use = testInfo.project.use;
  const second = await browser.newContext({
    viewport: use.viewport,
    userAgent: use.userAgent,
    isMobile: use.isMobile,
    hasTouch: use.hasTouch,
    deviceScaleFactor: use.deviceScaleFactor,
  });
  try {
    await backend.install(second);
    const b = await second.newPage();
    await studentJourney(page, b, accounts, backend.events[0].title);
    expect(backend.registrations.map((r) => r.status)).toEqual([
      "cancelled",
      "confirmed",
    ]);
    expect(backend.unexpected).toEqual([]);
  } finally {
    await second.close();
  }
});

test("administrator creates and edits an event; location typing/paste preserve values (simulated API)", async ({
  page,
  context,
}) => {
  const backend = mockBackend();
  await backend.install(context);
  const title = "Nettlesertest: Administrators utkast";
  await adminJourney(page, accounts.admin, title);
  const saved = backend.events.find((event) => event.title === title);
  expect(saved?.subtitle).toBe("Oppdatert av administrator");
  expect(saved?.location).toBe("Blindern, rom 101");
  expect(backend.writes).toEqual(["events", "events"]);
  expect(backend.unexpected).toEqual([]);
});
