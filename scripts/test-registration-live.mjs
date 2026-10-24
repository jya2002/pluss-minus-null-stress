import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "vite";
import { mkdir, rename, writeFile } from "node:fs/promises";
import {
  cleanupFixtures,
  developmentProject as project,
  fixtureEmail,
  pinnedFetch,
  validateConfiguration,
} from "./registration-live-safety.mjs";

// Manual opt-in only; deliberately absent from CI and the default test scripts.
const scope = `Development project ${project}: create 5 temporary confirmed password users (3 students, board, admin), create 4 labelled test events, exercise registration/RLS through real user sessions, then remove only fixtures created by this run. No email API, scheduler or production deployment is invoked.`;
if (process.argv.includes("--plan")) {
  console.log(scope);
} else if (!process.argv.includes("--allow-development-writes")) {
  console.error(
    "Stopped without network access: user approval and --allow-development-writes are required. Use --plan to review the scope.",
  );
  process.exitCode = 2;
} else {
  const env = loadEnv("registration-tests", process.cwd(), "");
  let config;
  try {
    config = validateConfiguration(env);
  } catch {
    console.error(
      "Stopped without network access: configure the expected development URL/public key plus PMNS_TEST_SERVICE_ROLE_KEY and your own Gmail PMNS_TEST_EMAIL_BASE (without a plus tag) in .env.registration-tests.local. No values logged.",
    );
    process.exitCode = 2;
  }
  if (config)
    await run(config.url, config.key, config.serviceKey, config.emailBase);
}

async function run(url, key, serviceKey, emailBase) {
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
  const service = createClient(url, serviceKey, options);
  const cleanupService = createClient(url, serviceKey, {
    ...options,
    global: { fetch: pinnedFetch() },
  });
  const anonymous = createClient(url, key, options);
  const users = [];
  const events = [];
  let passed = 0;
  let currentCheck = "temporary user/event setup";
  const runId = randomUUID();
  const testTitle = `[AUTOTEST ${runId}] Påmelding`;
  const manifest = {
    project,
    runId,
    testTitle,
    emailBase,
    users,
    events,
    cleanupComplete: false,
  };
  const manifestPath = `.runtime/registration-live/${runId}.json`;
  const saveManifest = async () => {
    await writeFile(`${manifestPath}.tmp`, JSON.stringify(manifest, null, 2), {
      mode: 0o600,
    });
    await rename(`${manifestPath}.tmp`, manifestPath);
  };
  async function ok(query) {
    const { data, error } = await query;
    if (error)
      throw new Error(
        `API request failed (code=${error.code ?? "unknown"}, status=${error.status ?? "unknown"}).`,
      );
    return data;
  }
  async function denied(query, code) {
    const { error } = await query;
    assert.ok(error, "request must be rejected");
    if (code) assert.equal(error.code, code);
  }
  async function check(label, fn) {
    currentCheck = label;
    await fn();
    passed++;
    console.log(`PASS ${label}`);
  }
  async function newUser(label, role = "student") {
    const email = fixtureEmail(emailBase, runId, label);
    const password = randomBytes(32).toString("base64url");
    // Admin createUser with email_confirm does not request an invitation/OTP.
    const id = randomUUID();
    // Client-generated IDs allow cleanup after ambiguous network timeouts.
    users.push({ id, email, label });
    await saveManifest();
    const result = await ok(
      service.auth.admin.createUser({
        id,
        email,
        password,
        email_confirm: true,
        app_metadata: { pmns_test_run: runId },
      }),
    );
    assert.equal(result.user.id, id);
    assert.equal(result.user.email, email);
    if (role !== "student")
      await ok(service.from("user_roles").update({ role }).eq("user_id", id));
    const client = createClient(url, key, options);
    // Queued fixture notifications must never be opted into delivery. Do this
    // before any event registration, without changing real users' preferences.
    await ok(
      service
        .from("notification_preferences")
        .update({ email_events: false, email_announcements: false })
        .eq("user_id", id),
    );
    await ok(client.auth.signInWithPassword({ email, password }));
    return { id, client };
  }
  async function newEvent(board) {
    const id = randomUUID();
    // Track before insertion so cleanup can handle an ambiguous HTTP timeout.
    events.push({ id, createdBy: board.id });
    await saveManifest();
    await ok(
      board.client.from("events").insert({
        id,
        title: testTitle,
        description:
          "Midlertidig, automatisk utviklingstest. Ikke et ekte arrangement.",
        starts_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        ends_at: new Date(Date.now() + 7 * 86400000 + 7200000).toISOString(),
        deadline: new Date(Date.now() + 6 * 86400000).toISOString(),
        category: "Sosialt",
        capacity: 1,
        waitlist_enabled: true,
        status: "published",
        is_demo: true,
        created_by: board.id,
      }),
    );
    return id;
  }
  const register = (user, event) =>
    ok(user.client.rpc("register_event", { p_event: event }));
  const cancel = (user, event, target) =>
    ok(
      user.client.rpc("cancel_registration", {
        p_event: event,
        ...(target ? { p_user: target } : {}),
      }),
    );
  const rows = (user, event) =>
    ok(
      user.client
        .from("event_registrations")
        .select("id,user_id,status")
        .eq("event_id", event),
    );
  try {
    await mkdir(".runtime/registration-live", { recursive: true });
    await saveManifest();
    console.log(scope);
    const a = await newUser("a");
    const b = await newUser("b");
    const c = await newUser("c");
    const board = await newUser("board", "board");
    const admin = await newUser("admin", "admin");
    const event = await newEvent(board);
    await check(
      "real password sessions and student/board/admin role lookup",
      async () => {
        for (const [user, role] of [
          [a, "student"],
          [b, "student"],
          [c, "student"],
          [board, "board"],
          [admin, "admin"],
        ]) {
          assert.equal(
            (
              await ok(
                user.client
                  .from("user_roles")
                  .select("role")
                  .eq("user_id", user.id)
                  .single(),
              )
            ).role,
            role,
          );
        }
      },
    );
    await check(
      "capacity 1: A confirmed, B waitlisted; duplicate requests rejected",
      async () => {
        assert.equal(await register(a, event), "confirmed");
        assert.equal(await register(b, event), "waitlisted");
        await denied(
          a.client.rpc("register_event", { p_event: event }),
          "23505",
        );
        await denied(
          b.client.rpc("register_event", { p_event: event }),
          "23505",
        );
        const all = await rows(board, event);
        assert.equal(all.length, 2);
        assert.equal(all.find((r) => r.user_id === a.id).status, "confirmed");
        assert.equal(all.find((r) => r.user_id === b.id).status, "waitlisted");
      },
    );
    await check(
      "student cannot act for others or read their private registrations",
      async () => {
        assert.equal((await rows(a, event)).length, 1);
        await denied(
          c.client.rpc("cancel_registration", { p_event: event, p_user: a.id }),
          "42501",
        );
        await denied(
          c.client.rpc("register_event", { p_event: event, p_user: a.id }),
        );
        await denied(
          c.client
            .from("event_registrations")
            .insert({ event_id: event, user_id: a.id, status: "confirmed" }),
          "42501",
        );
        await denied(
          c.client
            .from("event_registrations")
            .update({ status: "cancelled" })
            .eq("event_id", event),
          "42501",
        );
        await denied(
          anonymous
            .from("event_registrations")
            .select("id")
            .eq("event_id", event),
          "42501",
        );
        await denied(
          anonymous.rpc("register_event", { p_event: event }),
          "42501",
        );
      },
    );
    await check("A cancels and B is automatically confirmed", async () => {
      await cancel(a, event);
      assert.equal((await rows(a, event))[0].status, "cancelled");
      assert.equal((await rows(b, event))[0].status, "confirmed");
      const notices = await ok(
        b.client
          .from("notifications")
          .select("id")
          .eq("event_id", event)
          .eq("kind", "promotion"),
      );
      assert.equal(notices.length, 1);
    });
    await check(
      "expired registration rejected by RPC with no saved row",
      async () => {
        const expired = await newEvent(board);
        await ok(
          board.client
            .from("events")
            .update({ deadline: new Date(Date.now() - 3600000).toISOString() })
            .eq("id", expired),
        );
        await denied(
          a.client.rpc("register_event", { p_event: expired }),
          "P0001",
        );
        assert.equal((await rows(board, expired)).length, 0);
      },
    );
    await check(
      "three simultaneous real RPCs yield one confirmed and two waitlisted",
      async () => {
        const race = await newEvent(board);
        const attempts = await Promise.allSettled(
          [a, b, c].map((user) => register(user, race)),
        );
        assert.ok(attempts.every((attempt) => attempt.status === "fulfilled"));
        const statuses = attempts.map((attempt) => attempt.value);
        assert.equal(statuses.filter((s) => s === "confirmed").length, 1);
        assert.equal(statuses.filter((s) => s === "waitlisted").length, 2);
        assert.equal(
          (await rows(board, race)).filter((r) => r.status === "confirmed")
            .length,
          1,
        );
      },
    );
    await check(
      "simultaneous duplicates create a single active registration",
      async () => {
        const race = await newEvent(board);
        const results = await Promise.all(
          [1, 2].map(() => a.client.rpc("register_event", { p_event: race })),
        );
        assert.equal(
          results.filter((r) => r.data === "confirmed" && !r.error).length,
          1,
        );
        assert.equal(
          results.filter((r) => r.error?.code === "23505").length,
          1,
        );
        assert.equal((await rows(board, race)).length, 1);
      },
    );
    await check(
      "board/admin privileges and student self-promotion restriction",
      async () => {
        assert.equal((await rows(admin, event)).length, 2);
        await denied(
          a.client.rpc("set_role", { p_user: a.id, p_role: "admin" }),
          "42501",
        );
        await denied(
          board.client.rpc("set_role", { p_user: c.id, p_role: "board" }),
          "42501",
        );
        const changed = await ok(
          a.client
            .from("events")
            .update({ capacity: 999 })
            .eq("id", event)
            .select("id"),
        );
        assert.equal(changed.length, 0);
        await cancel(board, event, b.id);
        assert.equal((await rows(b, event))[0].status, "cancelled");
        await ok(
          admin.client.rpc("set_role", { p_user: c.id, p_role: "board" }),
        );
        assert.equal(
          (
            await ok(
              c.client
                .from("user_roles")
                .select("role")
                .eq("user_id", c.id)
                .single(),
            )
          ).role,
          "board",
        );
      },
    );
    console.log(
      `${passed} live Supabase API checks passed. This is not a browser UI or email-delivery test.`,
    );
  } catch {
    // Never print SDK responses, session objects, request headers or credentials.
    console.error(
      `FAIL ${currentCheck}. ${passed} checks passed before failure. No sensitive response details logged.`,
    );
    process.exitCode = 1;
  } finally {
    try {
      const result = await cleanupFixtures(cleanupService, manifest);
      manifest.cleanupComplete = result.complete;
      manifest.pendingIds = result.failures;
      await saveManifest();
      console.log(
        result.complete
          ? "Temporary fixtures cleaned up; audit logs retained."
          : `Cleanup incomplete. Review ${manifestPath}.`,
      );
      if (!result.complete) process.exitCode = 1;
    } catch {
      console.error(
        `Cleanup could not finish. Review ${manifestPath}. No credentials stored there.`,
      );
      process.exitCode = 1;
    } finally {
      process.removeListener("SIGINT", interrupt);
      process.removeListener("SIGTERM", interrupt);
    }
  }
}
