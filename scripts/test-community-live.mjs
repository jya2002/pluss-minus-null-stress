import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "vite";
import {
  cleanupFixtures,
  developmentProject as project,
  fixtureEmail,
  pinnedFetch,
  validateConfiguration,
} from "./registration-live-safety.mjs";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const communityScope = `Only development project ${project}: three temporary confirmed password accounts (two students and one administrator), one anonymous labelled suggestion and three labelled polls. Verify membership, suggestion votes/moderation, poll voting/times/audiences/hidden results and RLS. No OTP, invitations, email delivery, cron, settings changes, migration or deployment. Remove only verified fixtures; retain audit logs. Live execution requires PMNS_APPROVE_COMMUNITY_FIXTURES=${project} and --allow-development-writes. --plan is offline.`;
const marker = (runId, kind) => `[AUTOTEST ${runId}] ${kind}`;

function validManifest(manifest) {
  try {
    return (
      manifest.project === project &&
      uuid.test(manifest.runId) &&
      manifest.testTitle === marker(manifest.runId, "Påmelding") &&
      Array.isArray(manifest.events) &&
      manifest.events.length === 0 &&
      Array.isArray(manifest.users) &&
      manifest.users.length <= 3 &&
      new Set(manifest.users.map((u) => u.id)).size === manifest.users.length &&
      new Set(manifest.users.map((u) => u.label)).size ===
        manifest.users.length &&
      manifest.users.every(
        (u) =>
          uuid.test(u.id) &&
          ["a", "b", "admin"].includes(u.label) &&
          u.email === fixtureEmail(manifest.emailBase, manifest.runId, u.label),
      ) &&
      Array.isArray(manifest.community) &&
      manifest.community.length <= 4 &&
      new Set(manifest.community.map((e) => e.kind)).size ===
        manifest.community.length &&
      manifest.community.every(
        (e) =>
          [
            "Forslag",
            "Åpen avstemning",
            "Fremtidig avstemning",
            "Medlemsavstemning",
          ].includes(e.kind) &&
          e.title === marker(manifest.runId, e.kind) &&
          (e.id === null || uuid.test(e.id)) &&
          manifest.users.some(
            (u) =>
              u.id === e.owner &&
              u.label === (e.kind === "Forslag" ? "a" : "admin"),
          ),
      )
    );
  } catch {
    return false;
  }
}

// An RPC-generated ID cannot be known before the call. The durable exact-marker
// intent is saved first. Recovery discovers at most one exact match and verifies
// author / immutable create-audit actor before recording its ID and deleting it.
// Never delete accounts when an entity cannot be positively verified/removed.
export async function cleanupCommunity(
  service,
  manifest,
  save = async () => {},
) {
  if (!validManifest(manifest))
    return { complete: false, failures: ["invalid-manifest"] };
  const failures = [];
  const owners = new Set();
  for (const user of manifest.users) {
    try {
      const result = await service.auth.admin.getUserById(user.id);
      if (result.error?.status === 404) continue;
      if (
        result.error ||
        result.data.user?.id !== user.id ||
        result.data.user.email !== user.email ||
        result.data.user.app_metadata?.pmns_test_run !== manifest.runId
      )
        failures.push(user.id);
      else owners.add(user.id);
    } catch {
      failures.push(user.id);
    }
  }
  // Verify every entity before deleting any: a changed marker never becomes a
  // permission to cascade-delete its author or to search arbitrary table rows.
  const verified = [];
  for (const entity of manifest.community) {
    try {
      if (!owners.has(entity.owner)) throw new Error("unverified-owner");
      const suggestion = entity.kind === "Forslag";
      const table = suggestion ? "suggestions" : "polls";
      const column = suggestion ? "title" : "question";
      let query = service
        .from(table)
        .select(suggestion ? "id,title,author_id" : "id,question");
      query = entity.id
        ? query.eq("id", entity.id)
        : query.eq(column, entity.title);
      const { data, error } = await query.limit(2);
      if (error || !Array.isArray(data) || data.length > 1)
        throw new Error("ambiguous-entity");
      if (!data.length) continue;
      const row = data[0];
      if (
        !uuid.test(row.id) ||
        row[column] !== entity.title ||
        (entity.id && entity.id !== row.id)
      )
        throw new Error("changed-entity");
      if (suggestion) {
        if (row.author_id !== entity.owner) throw new Error("changed-author");
      } else {
        const audit = await service
          .from("audit_logs")
          .select("id")
          .eq("entity", "polls")
          .eq("entity_id", row.id)
          .eq("action", "create")
          .eq("actor_id", entity.owner)
          .limit(2);
        if (audit.error || audit.data?.length !== 1)
          throw new Error("unverified-create-audit");
      }
      entity.id = row.id;
      await save();
      verified.push({ entity, table, column, suggestion });
    } catch {
      failures.push(entity.kind);
    }
  }
  if (failures.length) return { complete: false, failures };
  // Close verified fixtures first. Their voting RPCs lock the parent row, so
  // closing waits for in-flight votes and prevents new student votes before
  // checking dependants. Retain everything if a real account interacted.
  for (const { entity, table, column, suggestion } of verified) {
    try {
      let freeze = service
        .from(table)
        .update(suggestion ? { hidden: true } : { published: false })
        .eq("id", entity.id)
        .eq(column, entity.title);
      if (suggestion) freeze = freeze.eq("author_id", entity.owner);
      const frozen = await freeze.select("id");
      if (frozen.error || frozen.data?.length !== 1)
        throw new Error("freeze-failed");
      const votes = await service
        .from(suggestion ? "suggestion_votes" : "poll_votes")
        .select("user_id")
        .eq(suggestion ? "suggestion_id" : "poll_id", entity.id);
      if (
        votes.error ||
        !Array.isArray(votes.data) ||
        votes.data.some((vote) => !owners.has(vote.user_id))
      )
        throw new Error("untracked-participant");
    } catch {
      failures.push(entity.kind);
    }
  }
  if (failures.length) return { complete: false, failures };
  for (const { entity, table, column, suggestion } of verified) {
    try {
      let deletion = service
        .from(table)
        .delete()
        .eq("id", entity.id)
        .eq(column, entity.title);
      if (suggestion) deletion = deletion.eq("author_id", entity.owner);
      const removed = await deletion.select("id");
      if (removed.error || removed.data?.length !== 1)
        failures.push(entity.kind);
    } catch {
      failures.push(entity.kind);
    }
  }
  if (failures.length) return { complete: false, failures };
  // A privileged fixture account may have acquired unrelated content during a
  // run. Keep it rather than orphan/anonymize untracked records on deletion.
  for (const owner of owners) {
    try {
      const suggestions = await service
        .from("suggestions")
        .select("id")
        .eq("author_id", owner)
        .limit(1);
      const polls = await service
        .from("audit_logs")
        .select("entity_id")
        .eq("actor_id", owner)
        .eq("entity", "polls")
        .eq("action", "create");
      if (
        suggestions.error ||
        suggestions.data?.length ||
        polls.error ||
        !Array.isArray(polls.data) ||
        polls.data.some(
          (row) =>
            !manifest.community.some(
              (e) => e.kind !== "Forslag" && e.id === row.entity_id,
            ),
        )
      )
        failures.push(owner);
    } catch {
      failures.push(owner);
    }
  }
  if (failures.length) return { complete: false, failures };
  return cleanupFixtures(service, manifest);
}

async function run(config) {
  const stop = new AbortController();
  const interrupt = () => stop.abort();
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  const options = {
    global: { fetch: pinnedFetch(stop.signal) },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  };
  const service = createClient(config.url, config.serviceKey, options);
  const cleanup = createClient(config.url, config.serviceKey, {
    ...options,
    global: { fetch: pinnedFetch() },
  });
  const anonymous = createClient(config.url, config.key, options);
  const runId = randomUUID();
  const manifest = {
    project,
    runId,
    testTitle: marker(runId, "Påmelding"),
    emailBase: config.emailBase,
    users: [],
    events: [],
    community: [],
    cleanupComplete: false,
  };
  const path = `.runtime/community-live/${runId}.json`;
  const save = async () => {
    await writeFile(`${path}.tmp`, JSON.stringify(manifest, null, 2), {
      mode: 0o600,
    });
    await rename(`${path}.tmp`, path);
  };
  const ok = async (query) => {
    const { data, error } = await query;
    if (error)
      throw new Error(
        "API request failed; response and credentials suppressed.",
      );
    return data;
  };
  const denied = async (query, code) => {
    const { error } = await query;
    assert.ok(error, "Request must be rejected");
    if (code) assert.equal(error.code, code);
  };
  let current = "temporary fixture setup";
  let passed = 0;
  const check = async (label, fn) => {
    current = label;
    await fn();
    passed++;
    console.log(`PASS ${label}`);
  };
  const user = async (label) => {
    const id = randomUUID();
    const email = fixtureEmail(config.emailBase, runId, label);
    const password = randomBytes(32).toString("base64url");
    manifest.users.push({ id, email, label });
    await save();
    const created = await ok(
      service.auth.admin.createUser({
        id,
        email,
        password,
        email_confirm: true,
        app_metadata: { pmns_test_run: runId },
      }),
    );
    assert.equal(created.user.id, id);
    if (label === "admin")
      await ok(
        service
          .from("user_roles")
          .update({ role: "admin" })
          .eq("user_id", id)
          .select("user_id")
          .single(),
      );
    await ok(
      service
        .from("notification_preferences")
        .update({ email_events: false, email_announcements: false })
        .eq("user_id", id)
        .select("user_id")
        .single(),
    );
    const client = createClient(config.url, config.key, options);
    await ok(client.auth.signInWithPassword({ email, password }));
    return { id, client };
  };
  const intent = async (kind, owner) => {
    const entity = { kind, owner, title: marker(runId, kind), id: null };
    manifest.community.push(entity);
    await save();
    return entity;
  };
  try {
    await mkdir(".runtime/community-live", { recursive: true });
    await save();
    console.log(communityScope);
    const a = await user("a"),
      b = await user("b"),
      admin = await user("admin");
    await ok(
      a.client
        .from("profiles")
        .update({ display_name: marker(runId, "Student A") })
        .eq("id", a.id),
    );
    const membership = async () =>
      (
        await ok(
          a.client
            .from("memberships")
            .select("status")
            .eq("user_id", a.id)
            .single(),
        )
      ).status;
    await check(
      "membership: application, own status, peer isolation and denied self approval",
      async () => {
        const settings = await ok(
          anonymous
            .from("site_settings")
            .select("membership_approval")
            .single(),
        );
        await ok(a.client.rpc("apply_membership"));
        assert.equal(
          await membership(),
          settings.membership_approval ? "pending" : "approved",
        );
        assert.deepEqual(
          await ok(
            b.client.from("memberships").select("user_id").eq("user_id", a.id),
          ),
          [],
        );
        await denied(
          a.client.rpc("manage_member", { p_user: a.id, p_status: "approved" }),
          "42501",
        );
        await denied(
          a.client
            .from("memberships")
            .update({ status: "approved" })
            .eq("user_id", a.id),
          "42501",
        );
      },
    );
    await check(
      "membership: administrator approves and rejects without a role grant",
      async () => {
        await ok(
          admin.client.rpc("manage_member", {
            p_user: a.id,
            p_status: "approved",
          }),
        );
        assert.equal(await membership(), "approved");
        await denied(a.client.rpc("apply_membership"));
        await ok(
          admin.client.rpc("manage_member", {
            p_user: a.id,
            p_status: "rejected",
          }),
        );
        assert.equal(await membership(), "rejected");
        await ok(
          admin.client.rpc("manage_member", {
            p_user: a.id,
            p_status: "approved",
          }),
        );
        assert.equal(
          (await ok(a.client.from("user_roles").select("role").single())).role,
          "student",
        );
      },
    );
    const suggestion = await intent("Forslag", a.id);
    suggestion.id = await ok(
      a.client.rpc("submit_suggestion", {
        p_title: suggestion.title,
        p_description:
          "Midlertidig, tydelig merket utviklingstest. Ikke et ekte aktivitetsforslag.",
        p_category: "Sosialt",
        p_anonymous: true,
        // No file is uploaded. A synthetic owner path checks the server's
        // anonymous-path redaction, including protection for old records.
        p_image: `${a.id}/${randomUUID()}.jpg`,
      }),
    );
    assert.match(suggestion.id, uuid);
    await save();
    await check(
      "suggestions: anonymous feed, private author, idempotent votes and withdrawal",
      async () => {
        const row = (await ok(anonymous.rpc("suggestion_feed"))).find(
          (s) => s.id === suggestion.id,
        );
        assert.ok(row);
        assert.equal(row.author_name, "Anonym student");
        assert.equal(row.image_path, null);
        assert.equal(JSON.stringify(row).includes(a.id), false);
        for (const field of ["author_id", "email", "user_id"])
          assert.equal(Object.hasOwn(row, field), false);
        assert.deepEqual(
          await ok(
            b.client
              .from("suggestions")
              .select("id,author_id")
              .eq("id", suggestion.id),
          ),
          [],
        );
        await ok(
          b.client.rpc("vote_suggestion", {
            p_suggestion: suggestion.id,
            p_vote: true,
          }),
        );
        await ok(
          b.client.rpc("vote_suggestion", {
            p_suggestion: suggestion.id,
            p_vote: true,
          }),
        );
        assert.equal(
          (
            await ok(
              service
                .from("suggestion_votes")
                .select("user_id")
                .eq("suggestion_id", suggestion.id),
            )
          ).length,
          1,
        );
        await ok(
          b.client.rpc("vote_suggestion", {
            p_suggestion: suggestion.id,
            p_vote: false,
          }),
        );
        assert.equal(
          (
            await ok(
              service
                .from("suggestion_votes")
                .select("user_id")
                .eq("suggestion_id", suggestion.id),
            )
          ).length,
          0,
        );
      },
    );
    await check(
      "suggestions: only staff moderate; hidden proposals disappear from public feed",
      async () => {
        await denied(
          a.client.rpc("moderate_suggestion", {
            p_id: suggestion.id,
            p_status: "planned",
            p_hidden: false,
          }),
          "42501",
        );
        await denied(
          a.client
            .from("suggestions")
            .update({ status: "planned" })
            .eq("id", suggestion.id),
          "42501",
        );
        await ok(
          admin.client.rpc("moderate_suggestion", {
            p_id: suggestion.id,
            p_status: "reviewing",
            p_hidden: true,
          }),
        );
        assert.equal(
          (await ok(anonymous.rpc("suggestion_feed"))).some(
            (s) => s.id === suggestion.id,
          ),
          false,
        );
      },
    );
    const createPoll = async (kind, audience, future = false) => {
      const entity = await intent(kind, admin.id);
      const args = {
        p_question: entity.title,
        p_opens: new Date(
          Date.now() + (future ? 3600000 : -3600000),
        ).toISOString(),
        p_closes: new Date(Date.now() + 7200000).toISOString(),
        p_options: ["Brettspill", "Film"],
        p_hide: true,
        p_audience: audience,
      };
      entity.id = await ok(admin.client.rpc("create_poll", args));
      assert.match(entity.id, uuid);
      await save();
      const options = await ok(
        a.client.from("poll_options").select("id").eq("poll_id", entity.id),
      );
      assert.equal(options.length, 2);
      return { ...entity, options };
    };
    const open = await createPoll("Åpen avstemning", "everyone");
    const future = await createPoll("Fremtidig avstemning", "everyone", true);
    const members = await createPoll("Medlemsavstemning", "members");
    const vote = (who, poll, option = poll.options[0].id) =>
      who.client.rpc("vote_poll", { p_poll: poll.id, p_option: option });
    await check(
      "polls: one vote, no forged votes, hidden results and administrator visibility",
      async () => {
        await ok(vote(a, open));
        await denied(vote(a, open), "23505");
        await denied(
          b.client.from("poll_votes").insert({
            poll_id: open.id,
            user_id: a.id,
            option_id: open.options[0].id,
          }),
          "42501",
        );
        assert.deepEqual(
          await ok(anonymous.rpc("poll_results", { p_poll: open.id })),
          [],
        );
        assert.deepEqual(
          await ok(a.client.rpc("poll_results", { p_poll: open.id })),
          [],
        );
        assert.equal(
          (
            await ok(admin.client.rpc("poll_results", { p_poll: open.id }))
          ).reduce((n, r) => n + Number(r.votes), 0),
          1,
        );
        assert.deepEqual(
          await ok(
            b.client
              .from("poll_votes")
              .select("user_id")
              .eq("poll_id", open.id),
          ),
          [],
        );
      },
    );
    await check(
      "polls: opening time, membership audience, option ownership and closed deadline",
      async () => {
        await denied(vote(a, future));
        await denied(vote(b, members), "42501");
        await denied(vote(b, open, members.options[0].id), "23503");
        await ok(vote(a, members));
        await ok(
          admin.client
            .from("polls")
            .update({ closes_at: new Date(Date.now() - 1000).toISOString() })
            .eq("id", open.id),
        );
        await denied(vote(b, open));
        assert.equal(
          (await ok(anonymous.rpc("poll_results", { p_poll: open.id }))).reduce(
            (n, r) => n + Number(r.votes),
            0,
          ),
          1,
        );
        assert.deepEqual(
          await ok(
            b.client
              .from("polls")
              .update({ hide_results: false })
              .eq("id", members.id)
              .select("id"),
          ),
          [],
        );
        assert.equal(
          (
            await ok(
              admin.client
                .from("polls")
                .select("hide_results")
                .eq("id", members.id)
                .single(),
            )
          ).hide_results,
          true,
        );
      },
    );
  } catch {
    console.error(
      `FAIL ${current}. Details suppressed to protect credentials; no raw API response logged.`,
    );
    process.exitCode = 1;
  } finally {
    stop.abort();
    const result = await cleanupCommunity(cleanup, manifest, save);
    manifest.cleanupComplete = result.complete;
    manifest.pendingIds = result.failures;
    await save();
    if (!result.complete) {
      console.error(
        `Cleanup incomplete; retained fixtures require review using ${path}. No broad deletion attempted.`,
      );
      process.exitCode = 1;
    } else
      console.log(
        "Cleanup complete; only verified fixture rows/accounts removed. Audit logs retained.",
      );
    console.log(`${passed} real API checks passed during this run.`);
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", interrupt);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (process.argv.includes("--plan")) console.log(communityScope);
  else if (
    !process.argv.includes("--allow-development-writes") ||
    process.env.PMNS_APPROVE_COMMUNITY_FIXTURES !== project
  ) {
    console.error(
      "Stopped without network access: explicit community fixture approval and --allow-development-writes are required. Use --plan.",
    );
    process.exitCode = 2;
  } else {
    let config;
    try {
      config = validateConfiguration(
        loadEnv("registration-tests", process.cwd(), ""),
      );
    } catch {
      console.error(
        "Stopped without network access: configure the existing development project, public/server keys and controlled Gmail base. Values suppressed.",
      );
      process.exitCode = 2;
    }
    if (config) await run(config);
  }
}
