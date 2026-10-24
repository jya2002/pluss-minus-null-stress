import { loadEnv } from "vite";
const env = loadEnv("development", process.cwd(), "VITE_");
const url = env.VITE_SUPABASE_URL,
  key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.log(
    "Backend not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env. No key values logged.",
  );
  process.exitCode = 2;
} else {
  try {
    const projectUrl = new URL(url);
    if (projectUrl.pathname !== "/" || projectUrl.search || projectUrl.hash) {
      throw new Error("Use the Supabase project root URL without /rest/v1, query parameters or fragments.");
    }
    const response = await fetch(`${url}/rest/v1/events?select=id&limit=0`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(10000),
    });
    console.log(
      `Read-only events API probe: HTTP ${response.status}. ${response.ok ? "Schema is available." : "Check migration status and public key settings in Dashboard."}`,
    );
    if (!response.ok) process.exitCode = 1;
  } catch (error) {
    console.log(
      error instanceof Error && error.message.startsWith("Use the Supabase")
        ? error.message
        : "Read-only backend probe could not connect. No credentials logged.",
    );
    process.exitCode = 2;
  }
}
