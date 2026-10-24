import { test as base } from "@playwright/test";
import type { BrowserContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { loadEnv } from "vite";
import {
  cleanupFixtures,
  developmentOrigin,
  developmentProject,
  fixtureEmail,
  pinnedFetch,
  validateConfiguration,
} from "../../scripts/registration-live-safety.mjs";
import type { FixtureManifest } from "../../scripts/registration-live-safety.mjs";
import type { Credentials } from "../browser/flows";

type Fixture = {
  accounts: { a: Credentials; b: Credentials; admin: Credentials };
  title: string;
  guardBrowser: (context: BrowserContext) => Promise<void>;
  blockedRequests: string[];
};

export const test = base.extend<{ live: Fixture }>({
  live: [
    async ({ baseURL }, use) => {
      if (baseURL !== "http://127.0.0.1:5179")
        throw new Error(
          "Live browser fixture requires the isolated local frontend.",
        );
      if (process.env.PMNS_APPROVE_BROWSER_FIXTURES !== developmentProject)
        throw new Error(
          "User approval is required before creating live browser fixtures.",
        );
      const config = validateConfiguration(
        loadEnv("registration-tests", process.cwd(), ""),
      );
      const stop = new AbortController();
      const interrupt = () => stop.abort();
      process.once("SIGINT", interrupt);
      process.once("SIGTERM", interrupt);
      const options = {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      };
      const service = createClient(config.url, config.serviceKey, {
        ...options,
        global: { fetch: pinnedFetch(stop.signal) },
      });
      const cleanupService = createClient(config.url, config.serviceKey, {
        ...options,
        global: { fetch: pinnedFetch() },
      });
      const runId = randomUUID();
      const users = (["a", "b", "admin"] as const).map((label) => ({
        id: randomUUID(),
        label,
        email: fixtureEmail(config.emailBase, runId, label),
      }));
      const accounts = Object.fromEntries(
        users.map((user) => [
          user.label,
          {
            email: user.email,
            password: randomBytes(32).toString("base64url"),
          },
        ]),
      ) as Fixture["accounts"];
      const administrator = users[2];
      const publishedId = randomUUID();
      const draftId = randomUUID();
      const manifest: FixtureManifest = {
        project: developmentProject,
        runId,
        testTitle: `[AUTOTEST ${runId}] Påmelding`,
        emailBase: config.emailBase,
        users: [],
        events: [],
        cleanupComplete: false,
      };
      const manifestPath = `.runtime/registration-live/${runId}.json`;
      const save = async () => {
        await writeFile(
          `${manifestPath}.tmp`,
          JSON.stringify(manifest, null, 2),
          { mode: 0o600 },
        );
        await rename(`${manifestPath}.tmp`, manifestPath);
      };
      async function ok<T>(
        operation: PromiseLike<{ data: T; error: unknown }>,
      ) {
        const result = await operation;
        if (result.error)
          throw new Error(
            "Live fixture API request failed; sensitive details omitted.",
          );
        return result.data;
      }
      const blockedRequests: string[] = [];
      const guardBrowser = async (context: BrowserContext) => {
        await context.route("**/*", async (route) => {
          const request = route.request();
          const url = new URL(request.url());
          if (url.origin === "http://127.0.0.1:5179") return route.continue();
          const block = () => {
            blockedRequests.push(
              `${request.method()} ${url.origin}${url.pathname}`,
            );
            return route.abort();
          };
          if (url.origin !== developmentOrigin) return block();
          let postData = request.postData();
          if (request.method() !== "GET" && request.method() !== "OPTIONS") {
            const body = (request.postDataJSON() ?? {}) as Record<
              string,
              unknown
            >;
            if (url.pathname === "/auth/v1/token") {
              if (
                url.searchParams.get("grant_type") !== "password" ||
                !users.some((user) => user.email === body.email)
              )
                return block();
            } else if (url.pathname === "/rest/v1/events") {
              if (
                body.title !== manifest.testTitle ||
                body.is_demo !== true ||
                body.status !== "draft"
              )
                return block();
              if (
                request.method() === "POST" &&
                body.created_by === administrator.id
              ) {
                // Only add the pretracked fixture UUID. The browser's real JWT,
                // SQL/RLS and the actual Supabase response remain in use.
                postData = JSON.stringify({ ...body, id: draftId });
              } else if (
                request.method() !== "PATCH" ||
                url.searchParams.get("id") !== `eq.${draftId}`
              )
                return block();
            } else if (
              [
                "/rest/v1/rpc/register_event",
                "/rest/v1/rpc/cancel_registration",
              ].includes(url.pathname)
            ) {
              if (body.p_event !== publishedId || body.p_user != null)
                return block();
            } else if (
              ![
                "/rest/v1/rpc/event_summary",
                "/rest/v1/rpc/suggestion_feed",
              ].includes(url.pathname)
            )
              return block();
          }
          try {
            // Forward the real request; never follow a redirect with credentials.
            // No Auth/API responses are fabricated in this suite.
            const headers = { ...request.headers() };
            // A pretracked UUID changes the JSON length. Let the transport
            // calculate Content-Length from the forwarded body.
            delete headers["content-length"];
            const response = await route.fetch({
              headers,
              ...(postData ? { postData } : {}),
              maxRedirects: 0,
              timeout: 20000,
            });
            if (response.status() >= 300 && response.status() < 400)
              return block();
            await route.fulfill({ response });
          } catch {
            await route.abort().catch(() => {});
          }
        });
      };
      let setupFailure: unknown;
      let cleanupFailure: Error | undefined;
      try {
        await mkdir(".runtime/registration-live", { recursive: true });
        await save();
        for (const user of users) {
          manifest.users.push(user);
          await save();
          const result = await service.auth.admin.createUser({
            id: user.id,
            email: user.email,
            password: accounts[user.label].password,
            email_confirm: true,
            app_metadata: { pmns_test_run: runId },
          });
          if (
            result.error ||
            result.data.user?.id !== user.id ||
            result.data.user?.email !== user.email
          )
            throw new Error(
              "Unexpected fixture identity; stopping. Sensitive details omitted.",
            );
          if (user.label === "admin")
            await ok(
              service
                .from("user_roles")
                .update({ role: "admin" })
                .eq("user_id", user.id),
            );
          await ok(
            service
              .from("notification_preferences")
              .update({ email_events: false, email_announcements: false })
              .eq("user_id", user.id),
          );
        }
        manifest.events.push(
          { id: publishedId, createdBy: administrator.id },
          { id: draftId, createdBy: administrator.id },
        );
        await save();
        await ok(
          service.from("events").insert({
            id: publishedId,
            title: manifest.testTitle,
            description: "Midlertidig nettlesertest, ikke et ekte arrangement.",
            starts_at: new Date(Date.now() + 7 * 86400000).toISOString(),
            ends_at: new Date(
              Date.now() + 7 * 86400000 + 7200000,
            ).toISOString(),
            deadline: new Date(Date.now() + 6 * 86400000).toISOString(),
            category: "Sosialt",
            capacity: 1,
            status: "published",
            is_demo: true,
            waitlist_enabled: true,
            created_by: administrator.id,
          }),
        );
        await use({
          accounts,
          title: manifest.testTitle,
          guardBrowser,
          blockedRequests,
        });
      } catch (error) {
        setupFailure = error;
      }
      try {
        const result = await cleanupFixtures(cleanupService, manifest);
        manifest.cleanupComplete = result.complete;
        manifest.pendingIds = result.failures;
        await save();
        if (!result.complete) throw new Error("Incomplete fixture cleanup.");
        console.log("Live browser fixtures removed; audit logs retained.");
      } catch {
        cleanupFailure = new Error(
          `Live browser cleanup incomplete. Review ${manifestPath}; no credentials stored there.`,
        );
      } finally {
        process.removeListener("SIGINT", interrupt);
        process.removeListener("SIGTERM", interrupt);
      }
      if (setupFailure && cleanupFailure)
        throw new AggregateError(
          [setupFailure, cleanupFailure],
          "Live setup and cleanup require review.",
        );
      if (setupFailure) throw setupFailure;
      if (cleanupFailure) throw cleanupFailure;
    },
    { timeout: 90000 },
  ],
});
