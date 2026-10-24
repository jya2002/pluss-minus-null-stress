import { defineConfig } from "@playwright/test";
import { loadEnv } from "vite";
import base from "./playwright.config";
import {
  developmentProject,
  validateConfiguration,
} from "./scripts/registration-live-safety.mjs";

// Listing is read-only. Every actual run requires a fresh, explicit opt-in;
// fixtures repeat this guard before creating anything.
if (
  !process.argv.includes("--list") &&
  process.env.PMNS_APPROVE_BROWSER_FIXTURES !== developmentProject
)
  throw new Error(
    "Live browser tests require separate user approval and PMNS_APPROVE_BROWSER_FIXTURES=gawhbppuhnixqvhnnpnn. No fixtures created.",
  );
const config = validateConfiguration(
  loadEnv("registration-tests", process.cwd(), ""),
);
export default defineConfig({
  ...base,
  testDir: "./tests/live",
  outputDir: "./test-results/live-browser",
  testIgnore: [],
  workers: 1,
  retries: 0,
  timeout: 120000,
  projects: base.projects?.filter((project) => project.name === "chromium"),
  use: {
    ...base.use,
    baseURL: "http://127.0.0.1:5179",
    // Real credentials/JWTs must never be captured in traces, video or images.
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: {
    command: "npm run dev -- --port 5179 --strictPort",
    url: "http://127.0.0.1:5179",
    reuseExistingServer: false,
    env: {
      VITE_DEMO_MODE: "false",
      VITE_SUPABASE_URL: config.url,
      VITE_SUPABASE_PUBLISHABLE_KEY: config.key,
      VITE_ENABLE_DEV_PASSWORD_LOGIN: "true",
    },
  },
});
