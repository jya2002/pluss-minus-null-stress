import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, rename, writeFile, readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "vite";
import { validateFrontendConfig } from "./frontend-config.mjs";
import {
  developmentProject,
  developmentOrigin,
  fixtureEmail,
  pinnedFetch,
  validateConfiguration,
} from "./registration-live-safety.mjs";
import {
  cleanupDeletionFixtures,
  deletionOrigin,
  digest,
  fixturePng,
  inspectDeletionFixtures,
  requireDeletionApproval,
  validateDeletionManifest,
} from "./account-delete-test-safety.mjs";

export const deletionScope = `Only ${developmentProject}: create two disposable confirmed student users, one private test group, one labelled capacity-1 event restricted to that group, one hidden suggestion, three tiny marked personal PNGs, and the students' membership/vote/registration data. Delete A through account-delete, verify Auth/database/Storage cleanup and B's promotion, then remove only verified test leftovers. No existing accounts or privileged roles are changed; no messages, email, settings, cron, deployment or audit deletion.`;
const options = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};
async function ok(query) {
  const { data, error } = await query;
  if (error)
    throw new Error("Test API operation failed; sensitive response omitted.");
  return data;
}

export async function deletionPreflight(url, key) {
  if (url !== developmentOrigin) throw new Error("Unexpected project.");
  const transport = pinnedFetch();
  const endpoint = `${url}/functions/v1/account-delete`;
  const get = await transport(endpoint, { headers: { apikey: key } });
  if (get.status !== 405)
    throw new Error(
      `account-delete GET expected 405, received ${get.status}. No fixtures created.`,
    );
  const preflight = await transport(endpoint, {
    method: "OPTIONS",
    headers: {
      Origin: deletionOrigin,
      apikey: key,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization,apikey,content-type",
    },
  });
  if (
    preflight.status !== 204 ||
    preflight.headers.get("access-control-allow-origin") !== deletionOrigin
  )
    throw new Error("Origin configuration is not ready. No fixtures created.");
}

export async function runDeletionLive(config) {
  requireDeletionApproval(process.argv, process.env);
  await deletionPreflight(config.url, config.key); // Before the first write.
  const stop = new AbortController(),
    interrupt = () => stop.abort();
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  const service = createClient(config.url, config.serviceKey, {
    ...options,
    global: { fetch: pinnedFetch(stop.signal) },
  });
  const cleanupService = createClient(config.url, config.serviceKey, {
    ...options,
    global: { fetch: pinnedFetch() },
  });
  const runId = randomUUID();
  const users = ["a", "b"].map((label) => ({
    id: randomUUID(),
    label,
    email: fixtureEmail(config.emailBase, runId, label),
  }));
  const [a, b] = users;
  const m = {
    kind: "account-delete-v1",
    project: developmentProject,
    runId,
    testTitle: `[AUTOTEST ${runId}] Påmelding`,
    emailBase: config.emailBase,
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
    edgeDeletionVerified: false,
    cleanupComplete: false,
  };
  validateDeletionManifest(m);
  const manifestPath = `.runtime/account-delete-live/${runId}.json`;
  await mkdir(".runtime/account-delete-live", { recursive: true });
  const save = async () => {
    await writeFile(`${manifestPath}.tmp`, JSON.stringify(m, null, 2), {
      mode: 0o600,
    });
    await rename(`${manifestPath}.tmp`, manifestPath);
  };
  await save(); // Full intent before writing even the first account.
  const clients = new Map(),
    tokens = new Map();
  let current = "fixture setup",
    failed = false,
    passed = 0;
  async function check(label, fn) {
    current = label;
    await fn();
    passed++;
    console.log(`PASS ${label}`);
  }
  async function ownRows(table, column, id) {
    return await ok(service.from(table).select(column).eq(column, id));
  }
  async function edge(token, body) {
    return await pinnedFetch(stop.signal)(
      `${config.url}/functions/v1/account-delete`,
      {
        method: "POST",
        headers: {
          Origin: deletionOrigin,
          apikey: config.key,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
  }
  try {
    console.log(deletionScope);
    for (const u of users) {
      const password = randomBytes(32).toString("base64url");
      const result = await ok(
        service.auth.admin.createUser({
          id: u.id,
          email: u.email,
          password,
          email_confirm: true,
          app_metadata: { pmns_test_run: runId },
        }),
      );
      assert.equal(result.user?.id, u.id);
      assert.equal(result.user?.email, u.email);
      await ok(
        service
          .from("notification_preferences")
          .update({ email_events: false, email_announcements: false })
          .eq("user_id", u.id),
      );
      const client = createClient(config.url, config.key, {
        ...options,
        global: { fetch: pinnedFetch(stop.signal) },
      });
      const signed = await ok(
        client.auth.signInWithPassword({ email: u.email, password }),
      );
      assert.equal(signed.user?.id, u.id);
      assert.ok(signed.session?.access_token);
      clients.set(u.id, client);
      tokens.set(u.id, signed.session.access_token);
    }
    await ok(service.from("access_groups").insert(m.group));
    await ok(
      service
        .from("group_members")
        .insert(users.map((u) => ({ group_id: m.group.id, user_id: u.id }))),
    );
    const event = m.events[0].id;
    await ok(
      service.from("events").insert({
        id: event,
        created_by: b.id,
        title: m.testTitle,
        description:
          "Disposable account-delete integration fixture. Not a real event.",
        starts_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        ends_at: new Date(Date.now() + 7 * 86400000 + 3600000).toISOString(),
        deadline: new Date(Date.now() + 6 * 86400000).toISOString(),
        category: "Sosialt",
        capacity: 1,
        waitlist_enabled: true,
        status: "published",
        audience: "groups",
        is_demo: true,
      }),
    );
    await ok(
      service
        .from("event_access_groups")
        .insert({ event_id: event, group_id: m.group.id }),
    );
    await ok(
      service.from("suggestions").insert({
        id: m.suggestion.id,
        author_id: a.id,
        title: m.suggestion.title,
        description: "Hidden disposable deletion test suggestion.",
        category: "Sosialt",
        anonymous: true,
        hidden: true,
      }),
    );
    await ok(
      service
        .from("suggestion_votes")
        .insert({ suggestion_id: m.suggestion.id, user_id: a.id }),
    );
    await ok(clients.get(a.id).rpc("apply_membership"));
    for (const f of m.files)
      await ok(
        clients
          .get(f.owner)
          .storage.from(f.bucket)
          .upload(f.path, fixturePng(runId, f.owner, f.bucket), {
            contentType: "image/png",
            upsert: false,
          }),
      );
    await check(
      "real sessions, personal uploads and capacity-1 waitlist",
      async () => {
        assert.equal(
          await ok(clients.get(a.id).rpc("register_event", { p_event: event })),
          "confirmed",
        );
        assert.equal(
          await ok(clients.get(b.id).rpc("register_event", { p_event: event })),
          "waitlisted",
        );
        assert.equal(
          (await inspectDeletionFixtures(service, m)).present.length,
          3,
        );
        for (const table of [
          "memberships",
          "suggestion_votes",
          "event_registrations",
          "notifications",
        ])
          assert.ok((await ownRows(table, "user_id", a.id)).length > 0);
      },
    );
    await check(
      "caller cannot target the other disposable account",
      async () => {
        assert.equal(
          (
            await edge(tokens.get(a.id), {
              confirmation: "SLETT",
              user_id: b.id,
            })
          ).status,
          400,
        );
        assert.equal(
          (await ok(service.auth.admin.getUserById(b.id))).user?.id,
          b.id,
        );
        assert.equal(
          (await inspectDeletionFixtures(service, m)).present.length,
          3,
        );
      },
    );
    await check(
      "Edge self-deletion succeeds with a fresh password session",
      async () => {
        // Verify account, roles, all row owners and all image hashes immediately
        // before invoking the real destructive endpoint for this fixture only.
        await inspectDeletionFixtures(service, m);
        m.deletionRequested = true;
        await save();
        const response = await edge(tokens.get(a.id), {
          confirmation: "SLETT",
        });
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { deleted: true });
      },
    );
    await check(
      "Auth and seeded personal database rows are removed",
      async () => {
        const result = await service.auth.admin.getUserById(a.id);
        assert.equal(result.error?.status, 404);
        for (const [table, column] of [
          ["profiles", "id"],
          ["user_roles", "user_id"],
          ["memberships", "user_id"],
          ["group_members", "user_id"],
          ["event_registrations", "user_id"],
          ["suggestion_votes", "user_id"],
          ["notifications", "user_id"],
          ["notification_preferences", "user_id"],
          ["contact_submissions", "user_id"],
        ])
          assert.equal((await ownRows(table, column, a.id)).length, 0);
        const suggestion = await ok(
          service
            .from("suggestions")
            .select("author_id,hidden")
            .eq("id", m.suggestion.id)
            .single(),
        );
        assert.equal(suggestion.author_id, null);
        assert.equal(suggestion.hidden, true);
      },
    );
    await check(
      "Storage is cleared for A while B, event and promotion survive",
      async () => {
        const state = await inspectDeletionFixtures(service, m);
        assert.equal(state.present.length, 1);
        assert.equal(state.present[0].owner, b.id);
        const registration = await ok(
          service
            .from("event_registrations")
            .select("status")
            .eq("event_id", event)
            .eq("user_id", b.id)
            .single(),
        );
        assert.equal(registration.status, "confirmed");
        assert.equal(
          (await ok(service.auth.admin.getUserById(b.id))).user?.id,
          b.id,
        );
        assert.equal((await ownRows("events", "id", event)).length, 1);
        const deletedSession = await clients.get(a.id).auth.getUser();
        assert.ok(deletedSession.error);
        assert.equal(deletedSession.data.user, null);
      },
    );
    m.edgeDeletionVerified = true;
    await save();
  } catch {
    failed = true;
    console.error(
      `FAIL ${current}. Sensitive details omitted; review the local manifest.`,
    );
  } finally {
    try {
      const result = await cleanupDeletionFixtures(cleanupService, m);
      m.cleanupComplete = result.complete;
      await save();
      if (!result.complete) {
        failed = true;
        console.error(
          `Cleanup incomplete: review ${manifestPath}. No broad recovery deletion is attempted.`,
        );
      } else
        console.log(
          "Disposable Auth/database/Storage fixtures verified absent; audit logs retained.",
        );
    } catch {
      failed = true;
      console.error(`Cleanup requires review: ${manifestPath}.`);
    }
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", interrupt);
  }
  console.log(
    `${passed} Edge integration checks passed; Edge deletion verified: ${m.edgeDeletionVerified}; cleanup complete: ${m.cleanupComplete}.`,
  );
  if (failed || !m.edgeDeletionVerified || !m.cleanupComplete)
    process.exitCode = 1;
}

async function main() {
  if (process.argv.includes("--plan")) {
    console.log(deletionScope);
    return;
  }
  try {
    if (process.argv.includes("--preflight")) {
      const env = loadEnv("development", process.cwd(), "VITE_");
      validateFrontendConfig("development", env);
      if (
        env.VITE_SUPABASE_URL?.replace(/\/$/, "") !== developmentOrigin ||
        !env.VITE_SUPABASE_PUBLISHABLE_KEY
      )
        throw new Error("Invalid public configuration.");
      await deletionPreflight(
        developmentOrigin,
        env.VITE_SUPABASE_PUBLISHABLE_KEY,
      );
      console.log(
        "Read-only GET/OPTIONS preflight passed. No fixtures created.",
      );
      return;
    }
    requireDeletionApproval(process.argv, process.env);
    const recovery = process.argv.find((arg) =>
      arg.startsWith("--cleanup-run="),
    );
    if (recovery) {
      const id = recovery.slice("--cleanup-run=".length);
      if (
        !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
          id,
        )
      )
        throw new Error("Invalid recovery run.");
      const config = validateConfiguration(
        loadEnv("registration-tests", process.cwd(), ""),
      );
      const path = `.runtime/account-delete-live/${id}.json`,
        m = validateDeletionManifest(JSON.parse(await readFile(path, "utf8")));
      if (m.runId !== id || m.emailBase !== config.emailBase)
        throw new Error("Recovery manifest does not match this operator.");
      const service = createClient(config.url, config.serviceKey, {
        ...options,
        global: { fetch: pinnedFetch() },
      });
      const result = await cleanupDeletionFixtures(service, m);
      m.cleanupComplete = result.complete;
      await writeFile(`${path}.tmp`, JSON.stringify(m, null, 2), {
        mode: 0o600,
      });
      await rename(`${path}.tmp`, path);
      if (!result.complete)
        throw new Error("Fixture recovery incomplete; preserve for review.");
      console.log(
        "Only verified fixtures from the specified run were removed. This is not a passing Edge integration test.",
      );
      return;
    }
    const config = validateConfiguration(
      loadEnv("registration-tests", process.cwd(), ""),
    );
    await runDeletionLive(config);
  } catch (error) {
    const safe =
      error instanceof Error &&
      /^(account-delete GET expected|Origin configuration is not ready|Separate approval)/.test(
        error.message,
      );
    console.error(
      safe
        ? error.message
        : "Stopped: configuration or preflight failed. No sensitive response logged.",
    );
    process.exitCode = 2;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
