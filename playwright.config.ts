import { defineConfig, devices } from "@playwright/test";
const live = !!process.env.E2E_SUPABASE_URL;
const port = process.env.E2E_PORT ?? "5173";
if (!/^\d{4,5}$/.test(port) || Number(port) < 1024 || Number(port) > 65535)
  throw new Error("E2E_PORT must be a valid unprivileged TCP port.");
const origin = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  reporter: "list",
  timeout: 30000,
  testIgnore: live ? "**/public.spec.ts" : undefined,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? origin,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run dev -- --port ${port} --strictPort`,
        url: origin,
        reuseExistingServer: false,
        env: {
          VITE_DEMO_MODE: live ? "false" : "true",
          VITE_SUPABASE_URL: process.env.E2E_SUPABASE_URL ?? "",
          VITE_SUPABASE_PUBLISHABLE_KEY:
            process.env.E2E_SUPABASE_PUBLISHABLE_KEY ?? "",
        },
      },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.PLAYWRIGHT_CHANNEL as "chrome" | undefined,
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium",
        channel: process.env.PLAYWRIGHT_CHANNEL as "chrome" | undefined,
      },
    },
  ],
});
