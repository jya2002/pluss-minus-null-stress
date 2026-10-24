import { execFileSync } from "node:child_process";
import {
  readFile,
  readdir,
  lstat,
  mkdir,
  writeFile,
  realpath,
} from "node:fs/promises";
import { resolve, relative, extname, join } from "node:path";
import { loadEnv } from "vite";
import { validateFrontendConfig } from "./frontend-config.mjs";

// Read-only local review plus optional GET-only development backend probes.
// Output contains counts, file names and booleans, never secret values/rows.
const env = loadEnv("registration-tests", process.cwd(), "");
const report = {
  branch: "",
  gitCommits: 0,
  gitRemotes: 0,
  reviewedAt: new Date().toISOString(),
  candidateFiles: 0,
  builtFiles: 0,
  ignoredPrivateFiles: false,
  findings: [],
  backend: null,
};
const git = (args) =>
  execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
report.branch = git(["branch", "--show-current"]).trim();
report.gitCommits = Number(git(["rev-list", "--all", "--count"]).trim());
report.gitRemotes = git(["remote"])
  .trim()
  .split(/\r?\n/)
  .filter(Boolean).length;
const candidates = git([
  "ls-files",
  "--cached",
  "--others",
  "--exclude-standard",
  "-z",
])
  .split("\0")
  .filter(Boolean);
try {
  report.ignoredPrivateFiles =
    git([
      "check-ignore",
      ".env",
      ".env.registration-tests.local",
      ".runtime/prelaunch-audit.json",
      "participants.csv",
      "exports/private.json",
      "mine-personopplysninger.json",
    ])
      .trim()
      .split(/\r?\n/).length === 6;
} catch {
  /* fail closed below */
}
const privateValues = Object.entries(env)
  .filter(
    ([name, value]) =>
      !name.startsWith("VITE_") &&
      /SECRET|SERVICE_ROLE|PASSWORD|TOKEN|RESEND_API_KEY|PMNS_TEST_EMAIL_BASE/i.test(
        name,
      ) &&
      value.length >= 12,
  )
  .map(([, value]) => value);
const root = await realpath(process.cwd());
async function inspect(file, built = false) {
  const path = resolve(file),
    info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) return;
  const actual = await realpath(path);
  if (relative(root, actual).startsWith(".."))
    throw new Error("File outside workspace refused.");
  if (built) report.builtFiles++;
  else report.candidateFiles++;
  if (
    /(?:^|\/)\.env(?:\.|$)/.test(file.replaceAll("\\", "/")) &&
    !file.endsWith(".env.example")
  )
    report.findings.push({ file, kind: "private-env-in-git-candidates" });
  if (
    info.size > 8 * 1024 * 1024 ||
    ![
      ".js",
      ".mjs",
      ".ts",
      ".tsx",
      ".json",
      ".html",
      ".css",
      ".sql",
      ".md",
      ".yml",
      ".yaml",
      ".txt",
      ".example",
    ].includes(extname(file))
  )
    return;
  const text = await readFile(path, "utf8");
  if (privateValues.some((value) => text.includes(value)))
    report.findings.push({ file, kind: "configured-private-value" });
  if (
    /sb_secret_[A-Za-z0-9_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\s+[A-Za-z0-9+/=]{20,}|\b(?:ghp_|github_pat_)[A-Za-z0-9_]{30,}/.test(
      text,
    )
  )
    report.findings.push({ file, kind: "recognized-secret-pattern" });
  for (const token of text.matchAll(
    /[A-Za-z0-9_-]{10,}\.([A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g,
  )) {
    try {
      if (
        JSON.parse(Buffer.from(token[1], "base64url").toString()).role ===
        "service_role"
      )
        report.findings.push({ file, kind: "service-role-jwt" });
    } catch {
      /* not a JWT payload */
    }
  }
}
for (const file of candidates) await inspect(file);
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (entry.isFile()) await inspect(path, true);
  }
}
try {
  await walk("dist");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  report.findings.push({ file: "dist", kind: "build-missing" });
}
if (!report.ignoredPrivateFiles)
  report.findings.push({
    file: ".gitignore",
    kind: "private-files-not-ignored",
  });
if (report.branch !== "develop")
  report.findings.push({ file: "HEAD", kind: "unexpected-branch" });

if (process.argv.includes("--read-only-backend")) {
  validateFrontendConfig("production", env);
  const url = new URL(env.VITE_SUPABASE_URL);
  if (url.origin !== "https://gawhbppuhnixqvhnnpnn.supabase.co")
    throw new Error("GET probes are pinned to the agreed development project.");
  const result = {
    project: "gawhbppuhnixqvhnnpnn",
    auth: null,
    settings: null,
    anonymousIsolation: [],
    functions: [],
  };
  const get = async (path) => {
    const response = await fetch(new URL(path, url), {
      method: "GET",
      headers: { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY },
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    return {
      status: response.status,
      ok: response.ok,
      body: await response.json().catch(() => null),
    };
  };
  const auth = await get("/auth/v1/settings");
  result.auth = {
    status: auth.status,
    emailEnabled: auth.body?.external?.email === true,
    signupEnabled: auth.body?.disable_signup === false,
  };
  const settings = await get(
    "/rest/v1/site_settings?select=contact_email,instagram_url,facebook_url",
  );
  result.settings = {
    status: settings.status,
    contactConfigured: !!settings.body?.[0]?.contact_email,
    socialLinkConfigured: !!(
      settings.body?.[0]?.instagram_url || settings.body?.[0]?.facebook_url
    ),
  };
  for (const table of [
    "profiles",
    "user_roles",
    "memberships",
    "event_registrations",
    "suggestions",
    "suggestion_votes",
    "poll_votes",
    "notifications",
    "contact_submissions",
    "audit_logs",
  ]) {
    const response = await get(`/rest/v1/${table}?select=*&limit=1`);
    result.anonymousIsolation.push({
      table,
      status: response.status,
      noRowsVisible:
        [401, 403].includes(response.status) ||
        (response.ok &&
          Array.isArray(response.body) &&
          response.body.length === 0),
    });
  }
  // Both functions reject non-POST requests before any mutation by source review.
  for (const name of ["image-upload", "account-delete"]) {
    const response = await get(`/functions/v1/${name}`);
    result.functions.push({
      name,
      status: response.status,
      missing: response.status === 404,
    });
  }
  report.backend = result;
}
await mkdir(".runtime", { recursive: true });
await writeFile(
  ".runtime/prelaunch-audit.json",
  JSON.stringify(report, null, 2),
  { mode: 0o600 },
);
console.log(JSON.stringify(report, null, 2));
if (
  report.findings.length ||
  report.backend?.anonymousIsolation.some((check) => !check.noRowsVisible)
)
  process.exitCode = 1;
