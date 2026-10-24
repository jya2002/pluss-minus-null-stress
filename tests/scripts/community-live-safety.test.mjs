import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cleanupCommunity } from "../../scripts/test-community-live.mjs";
import {
  developmentProject,
  fixtureEmail,
} from "../../scripts/registration-live-safety.mjs";

function fixtures() {
  const runId = randomUUID();
  // Offline fixture only. This address is never submitted to an external API.
  const emailBase = "offline.fixture@gmail.com";
  const users = ["a", "b", "admin"].map((label) => ({
    id: randomUUID(),
    label,
    email: fixtureEmail(emailBase, runId, label),
  }));
  const community = [
    {
      kind: "Forslag",
      title: `[AUTOTEST ${runId}] Forslag`,
      id: randomUUID(),
      owner: users[0].id,
    },
    {
      kind: "Åpen avstemning",
      title: `[AUTOTEST ${runId}] Åpen avstemning`,
      id: randomUUID(),
      owner: users[2].id,
    },
  ];
  const manifest = {
    project: developmentProject,
    runId,
    testTitle: `[AUTOTEST ${runId}] Påmelding`,
    emailBase,
    users,
    events: [],
    community,
  };
  const unrelated = {
    suggestion: randomUUID(),
    poll: randomUUID(),
    owner: randomUUID(),
  };
  const rows = {
    suggestions: [
      {
        id: community[0].id,
        title: community[0].title,
        author_id: community[0].owner,
      },
      {
        id: unrelated.suggestion,
        title: "Existing suggestion",
        author_id: unrelated.owner,
      },
    ],
    polls: [
      { id: community[1].id, question: community[1].title },
      { id: unrelated.poll, question: "Existing poll" },
    ],
    audit_logs: [
      {
        id: 1,
        entity: "polls",
        entity_id: community[1].id,
        actor_id: community[1].owner,
        action: "create",
      },
      {
        id: 2,
        entity: "polls",
        entity_id: unrelated.poll,
        actor_id: unrelated.owner,
        action: "create",
      },
    ],
    events: [],
    suggestion_votes: [],
    poll_votes: [],
    user_roles: users.map(({ id }) => ({ user_id: id, role: "student" })),
  };
  const remoteUsers = new Map(
    users.map((u) => [u.id, { ...u, app_metadata: { pmns_test_run: runId } }]),
  );
  const mutations = [];
  const deletedUsers = [];
  const failReads = new Set();
  const failDeletes = new Set();
  const service = {
    auth: {
      admin: {
        getUserById: async (id) => ({
          data: { user: remoteUsers.get(id) },
          error: remoteUsers.has(id) ? null : { status: 404 },
        }),
        deleteUser: async (id) => {
          deletedUsers.push(id);
          remoteUsers.delete(id);
          return { error: null };
        },
      },
    },
    from(table) {
      assert.ok(
        Object.hasOwn(rows, table),
        "Only known fixture tables may be queried",
      );
      let action = "select",
        max,
        patch;
      const filters = [];
      const query = {
        select: () => query,
        eq: (column, value) => {
          filters.push([column, value]);
          return query;
        },
        limit: (value) => {
          max = value;
          return query;
        },
        delete: () => {
          action = "delete";
          return query;
        },
        update: (value) => {
          action = "update";
          patch = value;
          return query;
        },
        maybeSingle: () => execute(true),
        then: (resolve, reject) => execute().then(resolve, reject),
      };
      async function execute(single = false) {
        if (action === "select" && failReads.has(table))
          throw new Error("simulated read failure");
        const matches = rows[table].filter((row) =>
          filters.every(([key, value]) => row[key] === value),
        );
        if (action === "delete") {
          assert.ok(
            ["suggestions", "polls"].includes(table),
            "No audit deletion or broad unrelated-table deletion",
          );
          assert.deepEqual(
            filters.map(([key]) => key),
            table === "suggestions"
              ? ["id", "title", "author_id"]
              : ["id", "question"],
          );
          if (failDeletes.has(table))
            return { data: null, error: { code: "offline" } };
          mutations.push({ table, action, filters });
          for (const row of matches)
            rows[table].splice(rows[table].indexOf(row), 1);
        } else if (action === "update") {
          assert.ok(["user_roles", "suggestions", "polls"].includes(table));
          if (table !== "user_roles") {
            assert.deepEqual(
              filters.map(([key]) => key),
              table === "suggestions"
                ? ["id", "title", "author_id"]
                : ["id", "question"],
            );
            assert.deepEqual(
              patch,
              table === "suggestions" ? { hidden: true } : { published: false },
            );
            for (const row of matches) Object.assign(row, patch);
          }
          mutations.push({ table, action, filters });
        }
        return {
          data: single ? (matches[0] ?? null) : matches.slice(0, max),
          error: null,
        };
      }
      return query;
    },
  };
  return {
    manifest,
    service,
    rows,
    unrelated,
    remoteUsers,
    mutations,
    deletedUsers,
    failReads,
    failDeletes,
  };
}

test("offline plan and missing explicit approval never reach fetch", () => {
  const blockFetch =
    "data:text/javascript,globalThis.fetch=()=>process.exit(99)";
  const env = { ...process.env, PMNS_APPROVE_COMMUNITY_FIXTURES: "" };
  const run = (args, extraEnv = {}) =>
    spawnSync(
      process.execPath,
      ["--import", blockFetch, "scripts/test-community-live.mjs", ...args],
      { env: { ...env, ...extraEnv }, encoding: "utf8" },
    );
  const plan = run(["--plan"]);
  assert.equal(plan.status, 0);
  assert.match(plan.stdout, /three temporary confirmed/);
  assert.match(
    plan.stdout,
    /one anonymous labelled suggestion and three labelled polls/,
  );
  assert.equal(run([]).status, 2);
  assert.equal(run(["--allow-development-writes"]).status, 2);
  assert.equal(
    run([], { PMNS_APPROVE_COMMUNITY_FIXTURES: developmentProject }).status,
    2,
  );
  assert.equal(
    run(["--allow-development-writes"], {
      PMNS_APPROVE_COMMUNITY_FIXTURES: "production",
    }).status,
    2,
  );
});

test("verified cleanup removes only own rows and accounts and retains all audit records", async () => {
  const f = fixtures();
  const originalAudit = structuredClone(f.rows.audit_logs);
  assert.deepEqual(await cleanupCommunity(f.service, f.manifest), {
    complete: true,
    failures: [],
  });
  assert.deepEqual(
    f.rows.suggestions.map((r) => r.id),
    [f.unrelated.suggestion],
  );
  assert.deepEqual(
    f.rows.polls.map((r) => r.id),
    [f.unrelated.poll],
  );
  assert.deepEqual(f.rows.audit_logs, originalAudit);
  assert.equal(f.deletedUsers.length, 3);
});

test("RPC timeout recovery requires exact intent, author/audit verification, and durable ID before delete", async () => {
  const f = fixtures();
  const ids = f.manifest.community.map((e) => e.id);
  f.manifest.community.forEach((e) => {
    e.id = null;
  });
  const saves = [];
  const result = await cleanupCommunity(f.service, f.manifest, async () => {
    assert.equal(
      f.mutations.length,
      0,
      "All recovered IDs must be saved before mutations",
    );
    saves.push(structuredClone(f.manifest.community));
  });
  assert.equal(result.complete, true);
  assert.equal(saves.length, 2);
  assert.deepEqual(
    f.manifest.community.map((e) => e.id),
    ids,
  );
});

test("invalid project, shortened marker, duplicate users and base-mailbox targets fail before any API call", async () => {
  const changes = [
    (m) => {
      m.project = "production";
    },
    (m) => {
      m.community[0].title = "AUTOTEST";
    },
    (m) => {
      m.users[1] = { ...m.users[0] };
    },
    (m) => {
      m.users[0].email = m.emailBase;
    },
    (m) => {
      m.community[0].owner = randomUUID();
    },
    (m) => {
      m.community[0].id = "not-a-uuid";
    },
  ];
  for (const change of changes) {
    const f = fixtures();
    change(f.manifest);
    const forbidden = new Proxy(
      {},
      {
        get() {
          throw new Error("No network permitted");
        },
      },
    );
    assert.deepEqual(await cleanupCommunity(forbidden, f.manifest), {
      complete: false,
      failures: ["invalid-manifest"],
    });
  }
});

test("changed titles, authors, create-audit actor and remote account ownership retain every account", async () => {
  const changes = [
    (f) => {
      f.rows.suggestions[0].title = "Real suggestion";
    },
    (f) => {
      f.rows.suggestions[0].author_id = f.unrelated.owner;
    },
    (f) => {
      f.rows.polls[0].question = "Real poll";
    },
    (f) => {
      f.rows.audit_logs[0].actor_id = f.unrelated.owner;
    },
    (f) => {
      f.remoteUsers.get(f.manifest.users[0].id).app_metadata.pmns_test_run =
        randomUUID();
    },
    (f) => {
      f.remoteUsers.get(f.manifest.users[2].id).email = f.manifest.emailBase;
    },
  ];
  for (const change of changes) {
    const f = fixtures();
    change(f);
    assert.equal(
      (await cleanupCommunity(f.service, f.manifest)).complete,
      false,
    );
    assert.equal(f.deletedUsers.length, 0);
    assert.equal(f.mutations.length, 0);
  }
});

test("ambiguous RPC discovery and failed manifest save prevent deletion", async () => {
  const f = fixtures();
  f.manifest.community[0].id = null;
  f.rows.suggestions.push({ ...f.rows.suggestions[0], id: randomUUID() });
  assert.equal((await cleanupCommunity(f.service, f.manifest)).complete, false);
  assert.equal(f.mutations.length, 0);
  const other = fixtures();
  assert.equal(
    (
      await cleanupCommunity(other.service, other.manifest, async () => {
        throw new Error("disk full");
      })
    ).complete,
    false,
  );
  assert.equal(other.mutations.length, 0);
});

test("read and delete failures preserve users for reviewed recovery", async () => {
  for (const table of ["suggestions", "polls", "audit_logs"]) {
    const f = fixtures();
    f.failReads.add(table);
    assert.equal(
      (await cleanupCommunity(f.service, f.manifest)).complete,
      false,
    );
    assert.equal(f.deletedUsers.length, 0);
    assert.equal(f.mutations.length, 0);
  }
  const f = fixtures();
  f.failDeletes.add("polls");
  assert.equal((await cleanupCommunity(f.service, f.manifest)).complete, false);
  assert.equal(f.deletedUsers.length, 0);
  assert.ok(f.rows.polls.some((r) => r.id === f.manifest.community[1].id));
});

test("untracked content owned by a fixture blocks user deletion instead of cascading it", async () => {
  for (const kind of ["suggestion", "poll"]) {
    const f = fixtures();
    if (kind === "suggestion")
      f.rows.suggestions.push({
        id: randomUUID(),
        title: "Retain me",
        author_id: f.manifest.users[0].id,
      });
    else
      f.rows.audit_logs.push({
        id: 3,
        actor_id: f.manifest.users[2].id,
        entity: "polls",
        action: "create",
        entity_id: randomUUID(),
      });
    assert.equal(
      (await cleanupCommunity(f.service, f.manifest)).complete,
      false,
    );
    assert.equal(f.deletedUsers.length, 0);
  }
});

test("non-fixture votes are retained together with their parent and all fixture users", async () => {
  for (const suggestion of [true, false]) {
    const f = fixtures();
    const entity = f.manifest.community[suggestion ? 0 : 1];
    f.rows[suggestion ? "suggestion_votes" : "poll_votes"].push({
      [suggestion ? "suggestion_id" : "poll_id"]: entity.id,
      user_id: f.unrelated.owner,
    });
    assert.equal(
      (await cleanupCommunity(f.service, f.manifest)).complete,
      false,
    );
    assert.equal(f.deletedUsers.length, 0);
    assert.equal(f.mutations.filter((m) => m.action === "delete").length, 0);
    assert.equal(f.rows.suggestions.length, 2);
    assert.equal(f.rows.polls.length, 2);
  }
});
