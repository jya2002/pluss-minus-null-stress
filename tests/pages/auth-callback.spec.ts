import { test } from "@playwright/test";
import { authCallbackFlow } from "../browser/auth-callback-flow";
test("production Pages email redirect and PKCE return through HashRouter (simulated Auth)", async ({
  page,
  context,
}) => authCallbackFlow(page, context, "/pluss-minus-null-stress"));
