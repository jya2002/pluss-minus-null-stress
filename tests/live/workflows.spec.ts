import { expect } from "@playwright/test";
import { test } from "./fixture";
import { adminJourney, studentJourney } from "../browser/flows";

test("real Supabase browser: student registration and waitlist, cancellation, promotion, roles, administrator create/edit", async ({
  browser,
  live,
}) => {
  const contexts = await Promise.all(
    [1, 2, 3].map(() =>
      browser.newContext({ baseURL: "http://127.0.0.1:5179" }),
    ),
  );
  try {
    for (const context of contexts) await live.guardBrowser(context);
    const [a, b, admin] = await Promise.all(
      contexts.map((context) => context.newPage()),
    );
    await studentJourney(a, b, live.accounts, live.title);
    await adminJourney(admin, live.accounts.admin, live.title);
    expect(live.blockedRequests).toEqual([]);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
