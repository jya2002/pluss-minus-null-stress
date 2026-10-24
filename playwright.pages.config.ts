import { defineConfig, devices } from "@playwright/test";
const port = Number(process.env.PLAYWRIGHT_PAGES_PORT ?? 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error(
    "PLAYWRIGHT_PAGES_PORT must be a valid local port above 1023.",
  );
const origin = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "./tests/pages",
  outputDir: "test-results/pages",
  use: {
    baseURL: origin,
    channel: process.env.PLAYWRIGHT_CHANNEL as "chrome" | undefined,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: `npm run preview -- --port ${port} --strictPort`,
    url: `${origin}/pluss-minus-null-stress/`,
    env: { VITE_BASE_PATH: "/pluss-minus-null-stress/" },
    reuseExistingServer: false,
  },
});
