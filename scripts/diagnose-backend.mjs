import { loadEnv } from "vite";

// Read-only diagnostics. Never log keys, tokens, user rows, or full responses.
const env = loadEnv("development", process.cwd(), "VITE_");
const raw = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!raw || !key) throw new Error("Missing public Supabase configuration.");
const url = new URL(raw);
console.log(JSON.stringify({
  configuredOrigin: url.origin,
  rootPath: url.pathname === "/" || url.pathname === "",
  demoMode: env.VITE_DEMO_MODE === "true",
  keyKind: key.startsWith("sb_publishable_") ? "publishable" : key.split(".").length === 3 ? "legacy JWT" : "unknown",
}));
for (const [label, path] of [
  ["Auth configuration", "/auth/v1/settings"],
  ["Events schema", "/rest/v1/events?select=id&limit=0"],
  ["Public settings schema", "/rest/v1/site_settings?select=id&limit=0"],
  ["Public categories schema", "/rest/v1/event_categories?select=name&limit=0"],
]) {
  const response = await fetch(new URL(path, url), {
    headers: { apikey: key }, signal: AbortSignal.timeout(10000),
  });
  const body = await response.json().catch(() => ({}));
  console.log(JSON.stringify({ label, status: response.status,
    ...(response.ok ? label === "Auth configuration" ? { emailEnabled: body.external?.email, signupDisabled: body.disable_signup } : {} : { code: body.code, message: body.message ?? body.msg }) }));
}
