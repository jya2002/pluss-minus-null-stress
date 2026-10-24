import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Isolated UI regressions with intercepted Supabase responses. Neither local
// .env credentials nor a real backend are used by this server.
export default defineConfig({
  ...base,
  testDir: "./tests/ui",
  outputDir: "test-results/ui",
  testIgnore: [],
  use: { ...base.use, baseURL: "http://127.0.0.1:5177" },
  webServer: {
    command: "npm run dev -- --port 5177 --strictPort",
    url: "http://127.0.0.1:5177",
    reuseExistingServer: false,
    env: {
      VITE_DEMO_MODE: "false",
      VITE_SUPABASE_URL: "https://pmns-ui.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ui_test",
      VITE_ENABLE_DEV_PASSWORD_LOGIN: "true",
    },
  },
});
