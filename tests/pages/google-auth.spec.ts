import { test } from "@playwright/test";
import { googleAuthFlow } from "../browser/google-auth-flow";
for (const outcome of ["success", "cancelled", "invalid"] as const)
  test(`Pages Google OAuth ${outcome} (simulated provider)`, async ({
    page,
    context,
  }) => googleAuthFlow(page, context, "/pluss-minus-null-stress", outcome));
