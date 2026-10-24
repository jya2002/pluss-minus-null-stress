import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { crc32, inflateSync } from "node:zlib";
import {
  developmentProject,
  fixtureEmail,
} from "../../scripts/registration-live-safety.mjs";
import {
  cleanupDeletionFixtures,
  digest,
  fixturePng,
  requireDeletionApproval,
  validateDeletionManifest,
} from "../../scripts/account-delete-test-safety.mjs";

function fixtures(empty = false) {
  const runId = randomUUID(),
    emailBase = "offline.fixture@gmail.com";
  const users = ["a", "b"].map((label) => ({
    id: randomUUID(),
    label,
    email: fixtureEmail(emailBase, runId, label),
  }));
  const [a, b] = users;
  const m = {
    kind: "account-delete-v1",
    project: developmentProject,
    runId,
    testTitle: `[AUTOTEST ${runId}] Påmelding`,
    emailBase,
    users,
    events: [{ id: randomUUID(), createdBy: b.id }],
    group: { id: randomUUID(), name: `[AUTOTEST ${runId}] Slettetest` },
    suggestion: {
      id: randomUUID(),
      author: a.id,
      title: `[AUTOTEST ${runId}] Sletting`,
    },
    files: [
      [a.id, "avatars"],
      [a.id, "suggestion-images"],
      [b.id, "avatars"],
    ].map(([owner, bucket]) => ({
      owner,
      bucket,
      path: `${owner}/${runId}.png`,
      sha256: digest(fixturePng(runId, owner, bucket)),
    })),
  };
  const unrelated = randomUUID(),
    otherEvent = randomUUID();
  const remoteUsers = new Map(
    empty
      ? []
      : users.map((u) => [
          u.id,
          { ...u, app_metadata: { pmns_test_run: runId } },
        ]),
  );
  const tables = Object.fromEntries(
    [
      "profiles",
      "user_roles",
      "memberships",
      "group_members",
      "event_registrations",
      "suggestion_votes",
      "notifications",
      "notification_preferences",
      "contact_submissions",
      "events",
      "suggestions",
      "access_groups",
      "event_access_groups",
    ].map((t) => [t, []]),
  );
  if (!empty) {
    tables.profiles = users.map((u) => ({ id: u.id }));
    tables.user_roles = users.map((u) => ({ user_id: u.id, role: "student" }));
    tables.events.push({
      id: m.events[0].id,
      title: m.testTitle,
      is_demo: true,
      created_by: b.id,
      audience: "groups",
    });
    tables.access_groups.push({ ...m.group });
    tables.group_members = users.map((u) => ({
      group_id: m.group.id,
      user_id: u.id,
    }));
    tables.event_access_groups.push({
      event_id: m.events[0].id,
      group_id: m.group.id,
    });
    tables.event_registrations = users.map((u) => ({
      event_id: m.events[0].id,
      user_id: u.id,
    }));
    tables.suggestions.push({
      id: m.suggestion.id,
      title: m.suggestion.title,
      author_id: a.id,
      hidden: true,
    });
    tables.suggestion_votes.push({
      suggestion_id: m.suggestion.id,
      user_id: a.id,
    });
  }
  tables.profiles.push({ id: unrelated });
  tables.events.push({
    id: otherEvent,
    title: "Existing event",
    created_by: unrelated,
    audience: "everyone",
    is_demo: false,
  });
  const files = new Map(
    empty
      ? []
      : m.files.map((f) => [
          `${f.bucket}/${f.path}`,
          fixturePng(runId, f.owner, f.bucket),
        ]),
  );
  files.set(
    `avatars/${unrelated}/existing.png`,
    Buffer.from("existing content"),
  );
  const writes = [],
    reads = [];
  const state = { removeError: false, readError: false, deleteError: false };
  function cascadeUser(id) {
    remoteUsers.delete(id);
    for (const [table, rows] of Object.entries(tables)) {
      if (table === "profiles") tables[table] = rows.filter((r) => r.id !== id);
      else if (rows.some((r) => r.user_id !== undefined))
        tables[table] = rows.filter((r) => r.user_id !== id);
    }
    for (const s of tables.suggestions)
      if (s.author_id === id) s.author_id = null;
  }
  const service = {
    auth: {
      admin: {
        getUserById: async (id) => {
          reads.push(["user", id]);
          return {
            data: { user: remoteUsers.get(id) },
            error: remoteUsers.has(id) ? null : { status: 404 },
          };
        },
        deleteUser: async (id) => {
          assert.ok(users.some((u) => u.id === id));
          writes.push(["user", id]);
          if (state.deleteError) return { error: { status: 500 } };
          cascadeUser(id);
          return { error: null };
        },
      },
    },
    storage: {
      from: (bucket) => ({
        list: async (owner) => {
          reads.push(["files", owner]);
          if (state.readError) throw Error("private read error");
          return {
            data: [...files.keys()]
              .filter((k) => k.startsWith(`${bucket}/${owner}/`))
              .map((k) => ({ name: k.slice(`${bucket}/${owner}/`.length) })),
            error: null,
          };
        },
        download: async (path) => ({
          data: new Blob([files.get(`${bucket}/${path}`)]),
          error: null,
        }),
        remove: async (paths) => {
          assert.equal(paths.length, 1);
          assert.ok(
            m.files.some((f) => f.bucket === bucket && f.path === paths[0]),
          );
          if (state.removeError)
            return { error: { message: "private remove error" } };
          writes.push(["file", `${bucket}/${paths[0]}`]);
          files.delete(`${bucket}/${paths[0]}`);
          return { error: null };
        },
      }),
    },
    from(table) {
      assert.ok(Object.hasOwn(tables, table));
      let mode = "select",
        patch;
      const filters = [];
      const q = {
        select: () => q,
        eq: (k, v) => {
          filters.push([k, v]);
          return q;
        },
        is: (k, v) => {
          filters.push([k, v]);
          return q;
        },
        limit: () => q,
        delete: () => {
          mode = "delete";
          return q;
        },
        update: (p) => {
          patch = p;
          mode = "update";
          return q;
        },
        maybeSingle: async () => {
          const r = await execute();
          return { ...r, data: r.data?.[0] ?? null };
        },
        then: (resolve, reject) => execute().then(resolve, reject),
      };
      async function execute() {
        reads.push([table, ...filters]);
        const rows = tables[table].filter((r) =>
          filters.every(([k, v]) => r[k] === v),
        );
        if (mode === "delete") {
          assert.ok(["events", "suggestions", "access_groups"].includes(table));
          assert.ok(
            filters.some(
              ([k, v]) =>
                k === "id" &&
                [m.events[0].id, m.suggestion.id, m.group.id].includes(v),
            ),
          );
          assert.ok(filters.length >= 2);
          writes.push([table, filters]);
          tables[table] = tables[table].filter((r) => !rows.includes(r));
          if (table === "events")
            tables.event_registrations = tables.event_registrations.filter(
              (r) => r.event_id !== m.events[0].id,
            );
          if (table === "suggestions")
            tables.suggestion_votes = tables.suggestion_votes.filter(
              (r) => r.suggestion_id !== m.suggestion.id,
            );
          if (table === "access_groups") {
            tables.group_members = [];
            tables.event_access_groups = [];
          }
        }
        if (mode === "update") {
          assert.equal(table, "user_roles");
          assert.deepEqual(patch, { role: "student" });
          writes.push(["role", filters]);
          for (const row of rows) Object.assign(row, patch);
        }
        return { data: rows, error: null };
      }
      return q;
    },
  };
  return {
    m,
    tables,
    remoteUsers,
    service,
    files,
    writes,
    reads,
    state,
    unrelated,
    otherEvent,
    cascadeUser,
  };
}
test("tiny PNG fixtures have valid chunks, image data and a run-specific ownership marker", () => {
  const run = randomUUID(),
    owner = randomUUID(),
    image = fixturePng(run, owner, "avatars"),
    chunks = [];
  assert.equal(image.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  for (let offset = 8; offset < image.length;) {
    const length = image.readUInt32BE(offset),
      name = image.toString("ascii", offset + 4, offset + 8),
      data = image.subarray(offset + 8, offset + 8 + length);
    assert.equal(
      crc32(image.subarray(offset + 4, offset + 8 + length)),
      image.readUInt32BE(offset + 8 + length),
    );
    chunks.push({ name, data });
    offset += length + 12;
  }
  assert.deepEqual(
    chunks.map((c) => c.name),
    ["IHDR", "tEXt", "IDAT", "IEND"],
  );
  assert.equal(chunks[0].data.readUInt32BE(0), 1);
  assert.equal(chunks[0].data.readUInt32BE(4), 1);
  assert.equal(chunks[1].data.toString(), `pmns\0${run}:${owner}:avatars`);
  assert.deepEqual([...inflateSync(chunks[2].data)], [0, 255, 255, 255, 255]);
  assert.notEqual(
    digest(image),
    digest(fixturePng(randomUUID(), owner, "avatars")),
  );
});
test("new deletion flag AND matching fresh approval are mandatory", () => {
  for (const [args, env] of [
    [[], {}],
    [
      ["--allow-development-writes"],
      { PMNS_APPROVE_ACCOUNT_DELETE_TEST: developmentProject },
    ],
    [
      ["--allow-development-account-deletion"],
      { PMNS_APPROVE_ACCOUNT_DELETE_TEST: "another-project" },
    ],
    [
      ["--allow-development-account-deletion"],
      { PMNS_APPROVE_BROWSER_FIXTURES: developmentProject },
    ],
  ])
    assert.throws(() => requireDeletionApproval(args, env));
  assert.doesNotThrow(() =>
    requireDeletionApproval(["--allow-development-account-deletion"], {
      PMNS_APPROVE_ACCOUNT_DELETE_TEST: developmentProject,
    }),
  );
});
test("--plan is offline; an unapproved CLI run stops without fixture setup", () => {
  const file = "scripts/test-account-delete-live.mjs";
  const env = { ...process.env, PMNS_APPROVE_ACCOUNT_DELETE_TEST: "" };
  const plan = spawnSync(process.execPath, [file, "--plan"], {
    env,
    encoding: "utf8",
  });
  assert.equal(plan.status, 0);
  assert.match(plan.stdout, /two disposable/);
  const blocked = spawnSync(process.execPath, [file], {
    env,
    encoding: "utf8",
  });
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /Separate approval/);
});
test("recovery rejects paths instead of a run UUID before reading credentials or contacting Supabase", () => {
  const env = {
    ...process.env,
    PMNS_APPROVE_ACCOUNT_DELETE_TEST: developmentProject,
  };
  for (const run of ["../../.env", "not-a-uuid"]) {
    const result = spawnSync(
      process.execPath,
      [
        "scripts/test-account-delete-live.mjs",
        "--allow-development-account-deletion",
        `--cleanup-run=${run}`,
      ],
      { env, encoding: "utf8" },
    );
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.doesNotMatch(result.stderr, /sb_secret_|password|token/i);
  }
});
test("cleanup removes only exact owned fixtures and confirms Auth/database/Storage absence", async () => {
  const f = fixtures();
  assert.equal((await cleanupDeletionFixtures(f.service, f.m)).complete, true);
  assert.equal(f.remoteUsers.size, 0);
  assert.equal(f.files.size, 1);
  assert.ok(f.files.has(`avatars/${f.unrelated}/existing.png`));
  assert.equal(f.tables.events[0].id, f.otherEvent);
  assert.deepEqual(f.tables.profiles, [{ id: f.unrelated }]);
});
test("an intent-only manifest after setup failure is safe and recoverable", async () => {
  const f = fixtures(true);
  assert.equal((await cleanupDeletionFixtures(f.service, f.m)).complete, true);
  assert.deepEqual(f.writes, []);
});
test("anonymized fixture suggestion can be cleaned only after its owner is actually absent", async () => {
  const f = fixtures();
  f.cascadeUser(f.m.users[0].id);
  assert.equal((await cleanupDeletionFixtures(f.service, f.m)).complete, true);
  const alive = fixtures();
  alive.tables.suggestions[0].author_id = null;
  assert.equal(
    (await cleanupDeletionFixtures(alive.service, alive.m)).complete,
    false,
  );
  assert.deepEqual(alive.writes, []);
});
for (const change of [
  (f) => (f.m.kind = "another-suite"),
  (f) => (f.m.project = "wrong-project"),
  (f) => (f.m.files[0].path = "../existing.png"),
  (f) => (f.m.files[0].sha256 = "0".repeat(64)),
  (f) => (f.m.group.name = "Existing group"),
  (f) => (f.m.users[0].id = f.unrelated),
  (f) => (f.m.events[0].createdBy = f.m.users[0].id),
  (f) => (f.m.suggestion.title = "Existing suggestion"),
])
  test(`invalid manifest ${change.toString()} stops before remote access`, async () => {
    const f = fixtures();
    change(f);
    assert.throws(() => validateDeletionManifest(f.m));
    assert.equal(
      (await cleanupDeletionFixtures(f.service, f.m)).complete,
      false,
    );
    assert.deepEqual(f.reads, []);
    assert.deepEqual(f.writes, []);
  });
for (const [label, change] of [
  [
    "identity",
    (f) =>
      (f.remoteUsers.get(f.m.users[0].id).app_metadata.pmns_test_run =
        randomUUID()),
  ],
  ["privileged role", (f) => (f.tables.user_roles[0].role = "admin")],
  ["event title", (f) => (f.tables.events[0].title = "Changed event")],
  ["event audience", (f) => (f.tables.events[0].audience = "everyone")],
  [
    "outsider registration",
    (f) =>
      f.tables.event_registrations.push({
        event_id: f.m.events[0].id,
        user_id: f.unrelated,
      }),
  ],
  [
    "outsider group member",
    (f) =>
      f.tables.group_members.push({
        group_id: f.m.group.id,
        user_id: f.unrelated,
      }),
  ],
  [
    "outsider vote",
    (f) =>
      f.tables.suggestion_votes.push({
        suggestion_id: f.m.suggestion.id,
        user_id: f.unrelated,
      }),
  ],
  [
    "other event in group",
    (f) =>
      f.tables.event_access_groups.push({
        event_id: f.otherEvent,
        group_id: f.m.group.id,
      }),
  ],
  [
    "other access group",
    (f) =>
      f.tables.event_access_groups.push({
        event_id: f.m.events[0].id,
        group_id: randomUUID(),
      }),
  ],
  ["visible suggestion", (f) => (f.tables.suggestions[0].hidden = false)],
  [
    "unexpected personal file",
    (f) =>
      f.files.set(
        `avatars/${f.m.users[0].id}/existing.png`,
        Buffer.from("existing"),
      ),
  ],
  [
    "changed file contents",
    (f) =>
      f.files.set(
        `${f.m.files[0].bucket}/${f.m.files[0].path}`,
        Buffer.from("changed"),
      ),
  ],
  ["Storage read failure", (f) => (f.state.readError = true)],
])
  test(`${label} blocks every cleanup mutation`, async () => {
    const f = fixtures();
    change(f);
    assert.equal(
      (await cleanupDeletionFixtures(f.service, f.m)).complete,
      false,
    );
    assert.deepEqual(f.writes, []);
  });
test("Storage or Auth cleanup errors cannot be reported as complete", async () => {
  for (const key of ["removeError", "deleteError"]) {
    const f = fixtures();
    f.state[key] = true;
    assert.equal(
      (await cleanupDeletionFixtures(f.service, f.m)).complete,
      false,
    );
    assert.ok(f.remoteUsers.size > 0);
    if (key === "removeError") assert.deepEqual(f.writes, []);
  }
});
