import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  cleanupFixtures,
  developmentOrigin,
  developmentProject,
  fixtureEmail,
  pinnedFetch,
  validateConfiguration,
} from "../../scripts/registration-live-safety.mjs";

const config = {
  VITE_SUPABASE_URL: developmentOrigin,
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local_fixture",
  PMNS_TEST_SERVICE_ROLE_KEY: "sb_secret_local_fixture",
  // Invented offline fixture only: tests never contact this mailbox or Supabase.
  // The live script has no default address and requires the owner's real input.
  PMNS_TEST_EMAIL_BASE: "offline.fixture@gmail.com",
};
const jwt = (role, ref = developmentProject) =>
  `header.${Buffer.from(JSON.stringify({ role, ref })).toString("base64url")}.signature`;

test("Gmail base is explicit, normalized, and never inferred from a domain", () => {
  assert.equal(
    validateConfiguration({
      ...config,
      PMNS_TEST_EMAIL_BASE: " OFFLINE.FIXTURE@GMAIL.COM ",
    }).emailBase,
    config.PMNS_TEST_EMAIL_BASE,
  );
  for (const value of [
    undefined,
    "",
    "gmail.com",
    "not an email",
    "offline+old@gmail.com",
    "offline..fixture@gmail.com",
    ".offline@gmail.com",
    "offline.@gmail.com",
    "offline@outlook.com",
    "offline@example.com",
    "offline@example.test",
    "offline@invalid.invalid",
    "offline@gmail.com.evil.test",
    `${"a".repeat(31)}@gmail.com`,
  ]) {
    assert.throws(() =>
      validateConfiguration({ ...config, PMNS_TEST_EMAIL_BASE: value }),
    );
  }
  assert.throws(() =>
    validateConfiguration({
      ...config,
      PMNS_TEST_EMAIL_BASE: undefined,
      PMNS_TEST_EMAIL_DOMAIN: "gmail.com",
    }),
  );
});

test("five generated addresses stay in the controlled mailbox and differ per role and run", () => {
  const runId = randomUUID();
  const labels = ["a", "b", "c", "board", "admin"];
  const emails = labels.map((label) =>
    fixtureEmail(config.PMNS_TEST_EMAIL_BASE, runId, label),
  );
  assert.equal(new Set(emails).size, 5);
  for (const email of emails) {
    assert.equal(
      email.replace(/\+[^@]+(?=@)/, ""),
      config.PMNS_TEST_EMAIL_BASE,
    );
    assert.notEqual(email, config.PMNS_TEST_EMAIL_BASE);
  }
  assert.notEqual(
    fixtureEmail(config.PMNS_TEST_EMAIL_BASE, randomUUID(), "a"),
    emails[0],
  );
});

test("the longest Gmail mailbox is preserved and fixture addresses fit within 64 local characters", () => {
  const base = `${"a".repeat(30)}@gmail.com`;
  const email = fixtureEmail(base, randomUUID(), "board");
  assert.equal(email.split("+")[0], "a".repeat(30));
  assert.ok(email.split("@")[0].length <= 64);
  assert.throws(() => fixtureEmail(base, "bad-run", "board"));
  assert.throws(() => fixtureEmail(base, randomUUID(), "unknown"));
});

test("configuration accepts only the pinned project, with a public and a separate server key", () => {
  assert.equal(validateConfiguration(config).url, developmentOrigin);
  assert.equal(
    validateConfiguration({
      ...config,
      VITE_SUPABASE_URL: `${developmentOrigin}/`,
    }).url,
    developmentOrigin,
  );
  for (const url of [
    "https://production.supabase.co",
    `${developmentOrigin}/rest/v1`,
    `${developmentOrigin}?project=production`,
    `http://${developmentProject}.supabase.co`,
    `${developmentOrigin}:444`,
    `https://${developmentProject}.supabase.co.evil.test`,
  ]) {
    assert.throws(() =>
      validateConfiguration({ ...config, VITE_SUPABASE_URL: url }),
    );
  }
  for (const key of [
    "sb_secret_fixture",
    jwt("service_role"),
    jwt("anon", "another-project"),
    "",
  ]) {
    assert.throws(() =>
      validateConfiguration({ ...config, VITE_SUPABASE_PUBLISHABLE_KEY: key }),
    );
  }
  for (const key of [
    "sb_publishable_fixture",
    jwt("anon"),
    jwt("service_role", "another-project"),
    "",
  ]) {
    assert.throws(() =>
      validateConfiguration({ ...config, PMNS_TEST_SERVICE_ROLE_KEY: key }),
    );
  }
  assert.equal(
    validateConfiguration({
      ...config,
      VITE_SUPABASE_PUBLISHABLE_KEY: jwt("anon"),
      PMNS_TEST_SERVICE_ROLE_KEY: jwt("service_role"),
    }).url,
    developmentOrigin,
  );
});

test("transport refuses other origins before calling fetch and forbids redirects", async () => {
  const calls = [];
  const transport = pinnedFetch(undefined, async (...args) => {
    calls.push(args);
    return "response";
  });
  assert.throws(() =>
    transport("https://production.supabase.co/rest/v1/events"),
  );
  assert.throws(() =>
    transport(
      `https://name:secret@${developmentProject}.supabase.co/rest/v1/events`,
    ),
  );
  assert.equal(calls.length, 0);
  assert.equal(
    await transport(`${developmentOrigin}/rest/v1/events`, {
      redirect: "follow",
    }),
    "response",
  );
  assert.equal(calls[0][1].redirect, "error");
  assert.ok(calls[0][1].signal instanceof AbortSignal);
});

test("plan and missing approval flag never enter the API flow, even when keys are present", () => {
  const args = ["scripts/test-registration-live.mjs"];
  const env = { ...process.env, ...config };
  const blocked = spawnSync(process.execPath, args, { env, encoding: "utf8" });
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /Stopped without network access/);
  const plan = spawnSync(process.execPath, [...args, "--plan"], {
    env,
    encoding: "utf8",
  });
  assert.equal(plan.status, 0);
  assert.match(plan.stdout, /create 5 temporary/);
  assert.ok(!plan.stdout.includes(config.PMNS_TEST_SERVICE_ROLE_KEY));
});

function fixtureService() {
  const runId = randomUUID();
  const emailBase = config.PMNS_TEST_EMAIL_BASE;
  const owner = {
    id: randomUUID(),
    email: fixtureEmail(emailBase, runId, "board"),
    label: "board",
  };
  const student = {
    id: randomUUID(),
    email: fixtureEmail(emailBase, runId, "a"),
    label: "a",
  };
  const testTitle = `[AUTOTEST ${runId}] Påmelding`;
  const event = { id: randomUUID(), createdBy: owner.id };
  const manifest = {
    project: developmentProject,
    runId,
    testTitle,
    emailBase,
    users: [owner, student],
    events: [event],
  };
  const users = new Map(
    manifest.users.map((user) => [
      user.id,
      { ...user, app_metadata: { pmns_test_run: runId } },
    ]),
  );
  const existing = {
    id: randomUUID(),
    title: "Eksisterende arrangement",
    is_demo: false,
    created_by: randomUUID(),
  };
  const events = [
    { id: event.id, title: testTitle, is_demo: true, created_by: owner.id },
    existing,
  ];
  const mutations = [];
  const deletedUsers = [];
  const failReads = new Set();
  const service = {
    auth: {
      admin: {
        getUserById: async (id) => ({
          data: { user: users.get(id) },
          error: users.has(id) ? null : { status: 404 },
        }),
        deleteUser: async (id) => {
          deletedUsers.push(id);
          users.delete(id);
          return { error: null };
        },
      },
    },
    from(table) {
      const filters = [];
      let action = "select";
      let limit;
      const query = {
        select: () => query,
        eq: (column, value) => {
          filters.push([column, value]);
          return query;
        },
        limit: (value) => {
          limit = value;
          return query;
        },
        delete: () => {
          action = "delete";
          return query;
        },
        update: () => {
          action = "update";
          return query;
        },
        maybeSingle: () => execute(true),
        then: (resolve, reject) => execute().then(resolve, reject),
      };
      async function execute(single = false) {
        if (table === "events") {
          if (
            filters.some(([column, id]) => column === "id" && failReads.has(id))
          )
            throw new Error("simulated network failure");
          const matches = events.filter((row) =>
            filters.every(([column, value]) => row[column] === value),
          );
          if (action === "delete") {
            mutations.push({ table, action, filters });
            assert.deepEqual(
              filters.map(([column]) => column),
              ["id", "title", "is_demo", "created_by"],
            );
            for (const row of matches) events.splice(events.indexOf(row), 1);
            return { data: matches.map(({ id }) => ({ id })), error: null };
          }
          return {
            data: single ? (matches[0] ?? null) : matches.slice(0, limit),
            error: null,
          };
        }
        assert.equal(
          table,
          "user_roles",
          "cleanup must not touch audit logs or other tables",
        );
        assert.equal(action, "update");
        mutations.push({ table, action, filters });
        return { data: [{ user_id: filters[0][1] }], error: null };
      }
      return query;
    },
  };
  return {
    service,
    manifest,
    users,
    events,
    existing,
    mutations,
    deletedUsers,
    failReads,
  };
}

test("cleanup removes verified fixtures only and leaves existing events and audit logs untouched", async () => {
  const f = fixtureService();
  assert.deepEqual(await cleanupFixtures(f.service, f.manifest), {
    complete: true,
    failures: [],
  });
  assert.deepEqual(f.events, [f.existing]);
  assert.deepEqual(
    new Set(f.deletedUsers),
    new Set(f.manifest.users.map(({ id }) => id)),
  );
  assert.ok(f.mutations.every(({ table }) => table !== "audit_logs"));
});

test("wrong account run marker prevents user and owned-event deletion", async () => {
  const f = fixtureService();
  const owner = f.manifest.users[0].id;
  f.users.get(owner).app_metadata.pmns_test_run = randomUUID();
  assert.equal((await cleanupFixtures(f.service, f.manifest)).complete, false);
  assert.ok(!f.deletedUsers.includes(owner));
  assert.equal(f.events.length, 2);
});

test("base mailbox and unrelated aliases cannot become cleanup targets", async () => {
  for (const email of [
    config.PMNS_TEST_EMAIL_BASE,
    "offline.fixture+unrelated@gmail.com",
  ]) {
    const f = fixtureService();
    f.manifest.users[0].email = email;
    const forbidden = new Proxy(
      {},
      {
        get() {
          throw new Error("API must not be accessed");
        },
      },
    );
    assert.equal(
      (await cleanupFixtures(forbidden, f.manifest)).complete,
      false,
    );
  }
});

test("remote account email must exactly match the recorded fixture alias before cleanup", async () => {
  const f = fixtureService();
  f.users.get(f.manifest.users[0].id).email = config.PMNS_TEST_EMAIL_BASE;
  assert.equal((await cleanupFixtures(f.service, f.manifest)).complete, false);
  assert.equal(f.deletedUsers.length, 0);
  assert.equal(f.events.length, 2);
});

test("changed event ownership, title or demo flag retains event and its creator", async () => {
  for (const change of [
    { title: "Reelt arrangement" },
    { is_demo: false },
    { created_by: randomUUID() },
  ]) {
    const f = fixtureService();
    Object.assign(f.events[0], change);
    const result = await cleanupFixtures(f.service, f.manifest);
    assert.equal(result.complete, false);
    assert.equal(f.events.length, 2);
    assert.equal(f.deletedUsers.length, 0);
  }
});

test("a network failure retains affected data but cleanup continues for other fixtures", async () => {
  const f = fixtureService();
  f.failReads.add(f.manifest.events[0].id);
  const second = { id: randomUUID(), createdBy: f.manifest.users[0].id };
  f.manifest.events.push(second);
  f.events.push({
    id: second.id,
    title: f.manifest.testTitle,
    is_demo: true,
    created_by: second.createdBy,
  });
  const result = await cleanupFixtures(f.service, f.manifest);
  assert.equal(result.complete, false);
  assert.equal(f.events.length, 2);
  assert.ok(!f.deletedUsers.includes(f.manifest.users[0].id));
  assert.equal(f.deletedUsers.length, 0);
  assert.ok(!f.events.some((event) => event.id === second.id));
});

test("invalid manifest is rejected before any API access", async () => {
  const f = fixtureService();
  const forbidden = new Proxy(
    {},
    {
      get() {
        throw new Error("API must not be accessed");
      },
    },
  );
  assert.equal(
    (await cleanupFixtures(forbidden, { ...f.manifest, project: "production" }))
      .complete,
    false,
  );
  assert.equal(
    (
      await cleanupFixtures(forbidden, {
        ...f.manifest,
        users: [{ id: undefined }],
      })
    ).complete,
    false,
  );
});
