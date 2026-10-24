import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createAccountDeleteHandler } from "../../supabase/functions/account-delete/handler.ts";
const now = Date.parse("2026-10-24T12:00:00Z");
const token = (iat, amr) =>
  `header.${Buffer.from(JSON.stringify({ iat, amr })).toString("base64url")}.signature`;
function fixture() {
  const uid = randomUUID(),
    peer = randomUUID(),
    file = randomUUID() + ".png";
  const calls = [],
    files = {
      avatars: [{ name: file }],
      "suggestion-images": [{ name: file }],
    };
  const state = {
    origin: "http://127.0.0.1:5173",
    iat: now / 1000,
    amr: [{ method: "password", timestamp: now / 1000 }],
    last: new Date(now).toISOString(),
    authError: null,
    prepareError: null,
    listError: null,
    removeError: null,
    deleteError: null,
    repeat: false,
    throw: false,
  };
  const service = {
    auth: {
      getUser: async () => {
        calls.push("getUser");
        if (state.throw) throw Error("private response");
        return {
          data: { user: { id: uid, last_sign_in_at: state.last } },
          error: state.authError,
        };
      },
      admin: {
        deleteUser: async (id) => {
          calls.push(["deleteUser", id]);
          return { error: state.deleteError };
        },
      },
    },
    storage: {
      from: (bucket) => ({
        list: async (prefix) => {
          calls.push(["list", bucket, prefix]);
          return { data: files[bucket], error: state.listError };
        },
        remove: async (paths) => {
          calls.push(["remove", bucket, paths]);
          if (!state.repeat && !state.removeError) files[bucket] = [];
          return { error: state.removeError };
        },
      }),
    },
  };
  const handler = createAccountDeleteHandler({
    allowedOrigin: () => state.origin,
    service: () => service,
    prepare: async (value) => {
      calls.push(["prepare", value]);
      return { error: state.prepareError };
    },
    now: () => now,
  });
  const invoke = (o = {}) =>
    handler(
      new Request("https://development.invalid/functions/v1/account-delete", {
        method: o.method ?? "POST",
        headers: {
          Origin: o.origin ?? state.origin,
          "Content-Type": "application/json",
          Authorization:
            o.authorization ?? `Bearer ${token(state.iat, state.amr)}`,
          ...o.headers,
        },
        ...((o.method ?? "POST") === "POST"
          ? {
              body:
                o.raw ?? JSON.stringify(o.body ?? { confirmation: "SLETT" }),
            }
          : {}),
      }),
    );
  return { uid, peer, file, calls, files, state, invoke };
}
const writes = (f) =>
  f.calls.filter(
    (c) => Array.isArray(c) && ["remove", "deleteUser"].includes(c[0]),
  );
test("refresh and login on another device cannot replace recent authentication in this session", async () => {
  for (const amr of [
    undefined,
    [],
    [{ method: "token_refresh", timestamp: now / 1000 }],
    [{ method: "password", timestamp: now / 1000 - 901 }],
    [{ method: "otp", timestamp: now / 1000 + 60 }],
    [{ method: "magiclink", timestamp: "recent" }],
  ]) {
    const f = fixture();
    f.state.amr = amr;
    assert.equal((await f.invoke()).status, 401);
    assert.deepEqual(writes(f), []);
  }
  for (const method of ["password", "otp", "magiclink", "email/signup", "oauth"]) {
    const f = fixture();
    f.state.amr = [{ method, timestamp: now / 1000 }];
    assert.equal((await f.invoke()).status, 200);
  }
});
test("CORS accepts configured origin only and fails closed without configuration", async () => {
  for (const origin of ["https://untrusted.invalid", "null", ""]) {
    const f = fixture();
    assert.equal((await f.invoke({ origin })).status, 403);
    assert.deepEqual(f.calls, []);
  }
  const f = fixture();
  f.state.origin = undefined;
  assert.equal(
    (await f.invoke({ origin: "http://127.0.0.1:5173" })).status,
    403,
  );
  const good = fixture();
  const response = await good.invoke({ method: "OPTIONS" });
  assert.equal(response.status, 204);
  assert.equal(
    response.headers.get("access-control-allow-origin"),
    good.state.origin,
  );
  assert.deepEqual(good.calls, []);
});
test("method, missing/malformed tokens and Auth signature rejection cannot write", async () => {
  const get = fixture();
  assert.equal((await get.invoke({ method: "GET" })).status, 405);
  assert.deepEqual(get.calls, []);
  for (const authorization of ["", "Basic secret", "Bearer a b"]) {
    const f = fixture();
    assert.equal((await f.invoke({ authorization })).status, 401);
    assert.deepEqual(f.calls, []);
  }
  const f = fixture();
  f.state.authError = { message: "invalid signature" };
  assert.equal((await f.invoke()).status, 401);
  assert.deepEqual(writes(f), []);
});
test("recent actual login and finite numeric JWT iat are both required", async () => {
  for (const iat of [
    undefined,
    null,
    "recent",
    NaN,
    0,
    now / 1000 - 901,
    now / 1000 + 60,
  ]) {
    const f = fixture();
    f.state.iat = iat;
    assert.equal((await f.invoke()).status, 401);
    assert.deepEqual(writes(f), []);
  }
  for (const last of [
    undefined,
    "invalid",
    new Date(now - 901000).toISOString(),
    new Date(now + 60000).toISOString(),
  ]) {
    const f = fixture();
    f.state.last = last;
    assert.equal((await f.invoke()).status, 401);
    assert.deepEqual(writes(f), []);
  }
  const f = fixture();
  assert.equal(
    (await f.invoke({ authorization: "Bearer invalid" })).status,
    401,
  );
});
test("confirmation is mandatory; foreign target IDs and oversized bodies are rejected", async () => {
  for (const body of [
    {},
    { confirmation: "yes" },
    { confirmation: "SLETT", user_id: randomUUID() },
    { confirmation: "SLETT", id: randomUUID() },
    [],
    null,
  ]) {
    const f = fixture();
    assert.equal((await f.invoke({ raw: JSON.stringify(body) })).status, 400);
    assert.deepEqual(writes(f), []);
  }
  const f = fixture();
  assert.equal((await f.invoke({ raw: "{" })).status, 400);
  const big = fixture();
  assert.equal((await big.invoke({ raw: "x".repeat(1025) })).status, 413);
  assert.deepEqual(writes(big), []);
});
test("last-admin preflight uses caller JWT before Storage deletion", async () => {
  const f = fixture();
  f.state.prepareError = { message: "last admin" };
  assert.equal((await f.invoke()).status, 409);
  assert.equal(f.calls[1][0], "prepare");
  assert.equal(f.calls[1][1], token(f.state.iat, f.state.amr));
  assert.deepEqual(writes(f), []);
});
test("success removes only own personal files, preserves association assets, then deletes own user", async () => {
  const f = fixture();
  const response = await f.invoke();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { deleted: true });
  assert.deepEqual(
    f.calls.filter((c) => Array.isArray(c) && c[0] === "remove"),
    [
      ["remove", "avatars", [`${f.uid}/${f.file}`]],
      ["remove", "suggestion-images", [`${f.uid}/${f.file}`]],
    ],
  );
  assert.deepEqual(f.calls.at(-1), ["deleteUser", f.uid]);
  assert.equal(JSON.stringify(f.calls).includes("event-images"), false);
  assert.equal(JSON.stringify(f.calls).includes(f.peer), false);
  assert.equal(response.headers.get("cache-control"), "no-store");
});
test("folder, traversal, absolute, foreign and legacy object keys require manual review", async () => {
  for (const name of [
    "../other.png",
    `${randomUUID()}/${randomUUID()}.png`,
    "folder",
    "/absolute.png",
    "legacy.png",
  ]) {
    const f = fixture();
    f.files.avatars = [{ name }];
    assert.equal((await f.invoke()).status, 409);
    assert.deepEqual(writes(f), []);
  }
});
test("Storage failures preserve Auth account and a retry can finish", async () => {
  for (const failure of ["listError", "removeError"]) {
    const f = fixture();
    f.state[failure] = { message: "private secret" };
    const response = await f.invoke();
    assert.equal(response.status, 503);
    assert.equal(
      f.calls.some((c) => Array.isArray(c) && c[0] === "deleteUser"),
      false,
    );
    assert.equal((await response.text()).includes("private secret"), false);
    f.state[failure] = null;
    assert.equal((await f.invoke()).status, 200);
  }
});
test("non-progressing Storage cleanup is bounded", async () => {
  const f = fixture();
  f.state.repeat = true;
  assert.equal((await f.invoke()).status, 503);
  assert.equal(
    f.calls.filter((c) => Array.isArray(c) && c[0] === "remove").length,
    20,
  );
  assert.equal(
    f.calls.some((c) => Array.isArray(c) && c[0] === "deleteUser"),
    false,
  );
});
test("final SQL/Auth rejection is not reported as successful deletion", async () => {
  const f = fixture();
  f.state.deleteError = { message: "concurrent last administrator" };
  assert.equal((await f.invoke()).status, 409);
  assert.deepEqual(f.calls.at(-1), ["deleteUser", f.uid]);
});
test("unexpected provider failures return safe retryable responses", async () => {
  const f = fixture();
  f.state.throw = true;
  const response = await f.invoke();
  assert.equal(response.status, 503);
  assert.equal((await response.text()).includes("private response"), false);
  assert.deepEqual(writes(f), []);
});
