import { test } from "node:test";
import assert from "node:assert/strict";
import { validateFrontendConfig as validate } from "../../scripts/frontend-config.mjs";
const env = {
  VITE_SUPABASE_URL: "https://pmns-ui.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_offline_test",
};
const jwt = (role) =>
  `header.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;
test("production defaults to repository base and development to root", () => {
  assert.equal(validate("production", env).base, "/pluss-minus-null-stress/");
  assert.equal(validate("development", env).base, "/");
  assert.equal(
    validate("production", env, "/another-repo/").base,
    "/another-repo/",
  );
  for (const path of [
    "https://other/",
    "//other/",
    "/../",
    "/repo?x=1",
    "/repo",
  ])
    assert.throws(() => validate("production", env, path));
});
test("production cannot silently become a demo without explicit opt-in", () => {
  assert.throws(() => validate("production", {}));
  assert.throws(() =>
    validate("production", { VITE_SUPABASE_URL: env.VITE_SUPABASE_URL }),
  );
  assert.doesNotThrow(() => validate("production", { VITE_DEMO_MODE: "true" }));
});
test("every VITE field rejects server credentials without echoing values", () => {
  for (const extra of [
    { VITE_OTHER: "sb_secret_offline_test" },
    { VITE_OTHER: "GOCSPX-offline-sensitive" },
    { VITE_OTHER: jwt("service_role") },
    { VITE_SERVER_SECRET: "offline-sensitive" },
    { VITE_OTHER: "-----BEGIN PRIVATE KEY-----" },
  ]) {
    let error;
    try {
      validate("production", { ...env, ...extra });
    } catch (e) {
      error = e;
    }
    assert.ok(error);
    for (const value of Object.values(extra))
      assert.equal(error.message.includes(value), false);
  }
  assert.doesNotThrow(() =>
    validate("production", {
      ...env,
      VITE_SUPABASE_PUBLISHABLE_KEY: jwt("anon"),
    }),
  );
  assert.doesNotThrow(() =>
    validate("production", { ...env, VITE_ENABLE_DEV_PASSWORD_LOGIN: "true" }),
  );
  assert.throws(() =>
    validate("production", {
      ...env,
      VITE_SUPABASE_PUBLISHABLE_KEY: jwt("authenticated"),
    }),
  );
});
test("project URL rejects credentials, paths and insecure production endpoints", () => {
  for (const url of [
    "https://pmns-ui.supabase.co/rest/v1",
    "https://name:password@pmns-ui.supabase.co",
    "https://pmns-ui.supabase.co/?x=1",
    "http://127.0.0.1:54321",
    "not-a-url",
  ])
    assert.throws(() =>
      validate("production", { ...env, VITE_SUPABASE_URL: url }),
    );
  assert.doesNotThrow(() =>
    validate("development", {
      ...env,
      VITE_SUPABASE_URL: "http://127.0.0.1:54321",
    }),
  );
});
