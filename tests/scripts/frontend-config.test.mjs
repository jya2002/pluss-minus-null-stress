import { test } from "node:test";
import assert from "node:assert/strict";
import { validateFrontendConfig as validate } from "../../scripts/frontend-config.mjs";

const env = {
  VITE_SUPABASE_URL: "https://pmns-ui.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_offline_test",
};

const jwt = (role) =>
  `header.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;

test("custom-domain production and development default to root base", () => {
  assert.equal(validate("production", env).base, "/");
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
