import type { BrowserContext, Route } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { defaultSettings, demoEvents } from "../../../src/lib/demo";
import type {
  Event,
  Notification,
  Profile,
  Registration,
  Membership,
  Suggestion,
  Poll,
  PollOption,
} from "../../../src/lib/types";

const origin = "https://pmns-ui.supabase.co";
type TestNotification = Notification & {
  user_id: string;
  event_id: string;
  kind: "registration" | "promotion";
};
export const accounts = {
  a: {
    id: randomUUID(),
    email: "student-a@example.test",
    password: "Offline-only-A-123!",
    role: "student",
  },
  b: {
    id: randomUUID(),
    email: "student-b@example.test",
    password: "Offline-only-B-123!",
    role: "student",
  },
  admin: {
    id: randomUUID(),
    email: "admin@example.test",
    password: "Offline-only-admin-123!",
    role: "admin",
  },
};

// State exists only in the Playwright process. This is UI simulation, not a
// reimplementation or verification of PostgreSQL locking, RLS or real Auth.
export function mockBackend(backendOrigin = origin) {
  const registrations: Registration[] = [];
  const notifications: TestNotification[] = [];
  const memberships: Membership[] = [];
  const contacts: {
    id: string;
    user_id: string;
    subject: string;
    message: string;
    resolved: boolean;
    created_at: string;
  }[] = [];
  const preferences = new Map(
    Object.values(accounts).map((user) => [
      user.id,
      { email_events: false, email_announcements: false },
    ]),
  );
  const suggestions: (Suggestion & {
    author_id: string;
    anonymous: boolean;
    hidden: boolean;
  })[] = [];
  const suggestionVotes: { suggestion_id: string; user_id: string }[] = [];
  const polls: Poll[] = [];
  const options: PollOption[] = [];
  const pollVotes: { poll_id: string; user_id: string; option_id: string }[] =
    [];
  const events: Event[] = [
    {
      ...demoEvents[0],
      id: randomUUID(),
      title: "Nettlesertest: Brettspilltorsdag",
      status: "published",
      capacity: 1,
      registration_mode: "individual",
      image_path: null,
      starts_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      ends_at: new Date(Date.now() + 7 * 86400000 + 7200000).toISOString(),
      deadline: new Date(Date.now() + 6 * 86400000).toISOString(),
    },
  ];
  const profiles: Profile[] = Object.values(accounts).map((user) => ({
    id: user.id,
    display_name:
      user.role === "admin"
        ? "Testadministrator"
        : user.id === accounts.a.id
          ? "Teststudent A"
          : "Teststudent B",
    study_programme: null,
    study_year: null,
    avatar_path: null,
    created_at: new Date().toISOString(),
  }));
  const writes: string[] = [];
  const unexpected: string[] = [];
  const notify = (
    user: string,
    event: string,
    kind: TestNotification["kind"],
    subject: string,
  ) =>
    notifications.push({
      id: randomUUID(),
      user_id: user,
      event_id: event,
      kind,
      subject,
      body: "Status er oppdatert.",
      read_at: null,
      created_at: new Date().toISOString(),
    });
  async function install(context: BrowserContext) {
    await context.route("**/*", async (route: Route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== backendOrigin) {
        if (["127.0.0.1", "localhost"].includes(url.hostname))
          return route.continue();
        unexpected.push(`${request.method()} ${url.origin}${url.pathname}`);
        return route.abort();
      }
      const body = request.postDataJSON() as Record<string, unknown> | null;
      const reply = (data: unknown, status = 200) =>
        route.fulfill({ status, json: data });
      if (url.pathname === "/auth/v1/logout") return reply(null);
      if (
        url.pathname === "/auth/v1/token" &&
        url.searchParams.get("grant_type") === "password"
      ) {
        const user = Object.values(accounts).find(
          (user) =>
            user.email === body?.email && user.password === body?.password,
        );
        if (!user)
          return reply(
            { code: "invalid_credentials", msg: "Invalid login credentials" },
            400,
          );
        const token = `ui-${user.id}`;
        return reply({
          access_token: token,
          refresh_token: `refresh-${user.id}`,
          token_type: "bearer",
          expires_in: 3600,
          user: {
            id: user.id,
            email: user.email,
            aud: "authenticated",
            role: "authenticated",
            app_metadata: {},
            user_metadata: {},
            created_at: new Date().toISOString(),
          },
        });
      }
      const token = request.headers().authorization?.replace("Bearer ui-", "");
      const user = Object.values(accounts).find(
        (candidate) => candidate.id === token,
      );
      const staff = user?.role === "admin";
      const table = url.pathname.replace("/rest/v1/", "");
      // Supabase invokes read-only RPCs with POST as well as GET.
      if (table === "rpc/event_summary")
        return reply(
          events.map((event) => ({
            event_id: event.id,
            confirmed: registrations.filter(
              (r) => r.event_id === event.id && r.status === "confirmed",
            ).length,
            waitlisted: registrations.filter(
              (r) => r.event_id === event.id && r.status === "waitlisted",
            ).length,
          })),
        );
      if (table === "rpc/suggestion_feed")
        return reply(
          suggestions
            .filter((s) => !s.hidden)
            .map((s) => ({
              id: s.id,
              title: s.title,
              description: s.description,
              category: s.category,
              preferred_date: s.preferred_date,
              budget_nok: s.budget_nok,
              image_path: s.anonymous ? null : s.image_path,
              author_name: s.anonymous
                ? "Anonym student"
                : profiles.find((p) => p.id === s.author_id)?.display_name,
              status: s.status,
              created_at: s.created_at,
              votes: suggestionVotes.filter((v) => v.suggestion_id === s.id)
                .length,
              my_vote: suggestionVotes.some(
                (v) => v.suggestion_id === s.id && v.user_id === user?.id,
              ),
            })),
        );
      if (table === "rpc/poll_results") {
        const poll = polls.find((p) => p.id === body?.p_poll);
        return reply(
          !poll ||
            (!poll.published && !staff) ||
            (poll.hide_results &&
              Date.parse(poll.closes_at) > Date.now() &&
              !staff)
            ? []
            : options
                .filter((o) => o.poll_id === poll.id)
                .map((o) => ({
                  option_id: o.id,
                  votes: pollVotes.filter((v) => v.option_id === o.id).length,
                })),
        );
      }
      if (request.method() !== "GET") writes.push(table);
      if (table === "rpc/delete_draft_event") {
        if (user?.role !== "admin")
          return reply(
            {
              code: "42501",
              message: "Bare administratorer kan slette arrangementer.",
            },
            403,
          );
        const index = events.findIndex((e) => e.id === body?.p_event);
        if (index < 0)
          return reply(
            { code: "P0002", message: "Arrangementet finnes ikke." },
            404,
          );
        const event = events[index];
        if (event.status !== "draft" || body?.p_title !== event.title)
          return reply(
            {
              code: "22023",
              message: "Bare upubliserte utkast med eksakt tittel kan slettes.",
            },
            400,
          );
        if (
          registrations.some((r) => r.event_id === event.id) ||
          notifications.some((n) => n.event_id === event.id)
        )
          return reply(
            {
              code: "23503",
              message: "Utkastet har tilknyttede data og kan ikke slettes.",
            },
            409,
          );
        events.splice(index, 1);
        return reply(event.id);
      }
      if (table === "rpc/submit_contact" && user) {
        contacts.push({
          id: randomUUID(),
          user_id: user.id,
          subject: String(body?.p_subject),
          message: String(body?.p_message),
          resolved: false,
          created_at: new Date().toISOString(),
        });
        return reply(null);
      }
      if (
        table === "contact_submissions" &&
        staff &&
        request.method() === "PATCH"
      ) {
        const contact = contacts.find(
          (c) => `eq.${c.id}` === url.searchParams.get("id"),
        );
        if (contact) contact.resolved = Boolean(body?.resolved);
        return reply(null);
      }
      if (
        table === "profiles" &&
        user &&
        request.method() === "PATCH" &&
        url.searchParams.get("id") === `eq.${user.id}`
      ) {
        Object.assign(
          profiles.find((p) => p.id === user.id)!,
          body,
        );
        return reply(null);
      }
      if (
        table === "notification_preferences" &&
        user &&
        request.method() === "PATCH"
      ) {
        Object.assign(preferences.get(user.id)!, body);
        return reply(null);
      }
      if (table === "rpc/read_notification" && user) {
        const notification = notifications.find(
          (n) => n.id === body?.p_id && n.user_id === user.id,
        );
        if (notification) notification.read_at = new Date().toISOString();
        return reply(null);
      }
      if (table === "rpc/export_my_data" && user)
        return reply({
          profile: profiles.find((p) => p.id === user.id),
          memberships: memberships.filter((m) => m.user_id === user.id),
          event_registrations: registrations.filter(
            (r) => r.user_id === user.id,
          ),
        });
      if (url.pathname === "/functions/v1/account-delete")
        return reply({ error: "Offline test: unavailable" }, 503);
      if (table === "rpc/apply_membership" && user) {
        const membership = memberships.find((m) => m.user_id === user.id);
        if (membership) membership.status = "pending";
        else
          memberships.push({
            user_id: user.id,
            status: "pending",
            joined_at: new Date().toISOString(),
          });
        return reply(null);
      }
      if (table === "rpc/manage_member" && staff) {
        const membership = memberships.find((m) => m.user_id === body?.p_user);
        if (membership)
          membership.status = body?.p_status as Membership["status"];
        return reply(null);
      }
      if (table === "rpc/submit_suggestion" && user) {
        const id = randomUUID();
        suggestions.push({
          id,
          author_id: user.id,
          anonymous: Boolean(body?.p_anonymous),
          hidden: false,
          title: String(body?.p_title),
          description: String(body?.p_description),
          category: body?.p_category as Suggestion["category"],
          preferred_date: body?.p_date as string | null,
          budget_nok: body?.p_budget as number | null,
          image_path: body?.p_image as string | null,
          author_name: "",
          status: "proposed",
          created_at: new Date().toISOString(),
          votes: 0,
          my_vote: false,
        });
        return reply(id);
      }
      if (table === "rpc/vote_suggestion" && user) {
        const index = suggestionVotes.findIndex(
          (v) =>
            v.suggestion_id === body?.p_suggestion && v.user_id === user.id,
        );
        if (body?.p_vote && index < 0)
          suggestionVotes.push({
            suggestion_id: body.p_suggestion as string,
            user_id: user.id,
          });
        if (!body?.p_vote && index >= 0) suggestionVotes.splice(index, 1);
        return reply(null);
      }
      if (table === "rpc/moderate_suggestion" && staff) {
        const suggestion = suggestions.find((s) => s.id === body?.p_id);
        if (suggestion)
          Object.assign(suggestion, {
            status: body?.p_status,
            hidden: body?.p_hidden,
          });
        return reply(null);
      }
      if (table === "rpc/create_poll" && staff) {
        const id = randomUUID();
        polls.push({
          id,
          question: String(body?.p_question),
          opens_at: String(body?.p_opens),
          closes_at: String(body?.p_closes),
          hide_results: Boolean(body?.p_hide),
          audience: body?.p_audience as Poll["audience"],
          published: true,
        });
        for (const label of body?.p_options as string[])
          options.push({ id: randomUUID(), poll_id: id, label });
        return reply(id);
      }
      if (table === "polls" && staff && request.method() === "PATCH") {
        const poll = polls.find(
          (p) => `eq.${p.id}` === url.searchParams.get("id"),
        );
        if (poll) Object.assign(poll, body);
        return reply(null);
      }
      if (table === "rpc/vote_poll" && user) {
        if (
          pollVotes.some(
            (v) => v.poll_id === body?.p_poll && v.user_id === user.id,
          )
        )
          return reply({ message: "Duplicate vote" }, 409);
        pollVotes.push({
          poll_id: body?.p_poll as string,
          option_id: body?.p_option as string,
          user_id: user.id,
        });
        return reply(null);
      }
      if (table === "rpc/register_event" && user) {
        const id = body?.p_event as string;
        const status = registrations.some(
          (r) => r.event_id === id && r.status === "confirmed",
        )
          ? "waitlisted"
          : "confirmed";
        registrations.push({
          id: randomUUID(),
          event_id: id,
          user_id: user.id,
          status,
          team_id: null,
          dietary: null,
          attended: false,
          created_at: new Date().toISOString(),
        });
        notify(user.id, id, "registration", "Påmeldingen er lagret");
        return reply(status);
      }
      if (table === "rpc/cancel_registration" && user) {
        const registration = registrations.find(
          (r) => r.event_id === body?.p_event && r.user_id === user.id,
        );
        if (!registration) return reply({ message: "Ingen påmelding" }, 400);
        registration.status = "cancelled";
        const next = registrations.find(
          (r) =>
            r.event_id === registration.event_id && r.status === "waitlisted",
        );
        if (next) {
          next.status = "confirmed";
          notify(next.user_id, next.event_id, "promotion", "Du har fått plass");
        }
        return reply(null);
      }
      if (table === "events" && staff && request.method() === "POST") {
        events.push({
          ...body,
          id: randomUUID(),
          created_at: new Date().toISOString(),
        } as unknown as Event);
        return reply(null, 201);
      }
      if (table === "events" && staff && request.method() === "PATCH") {
        const event = events.find(
          (event) => `eq.${event.id}` === url.searchParams.get("id"),
        );
        if (event) Object.assign(event, body);
        return reply(null);
      }
      if (request.method() !== "GET") {
        unexpected.push(`${request.method()} ${url.pathname}`);
        return reply({ message: "Unexpected test request" }, 400);
      }
      const single = request.headers().accept?.includes("vnd.pgrst.object");
      switch (table) {
        case "events":
          return reply(events.filter((e) => e.status !== "draft" || staff));
        case "rpc/event_summary":
          return reply(
            events.map((event) => ({
              event_id: event.id,
              confirmed: registrations.filter(
                (r) => r.event_id === event.id && r.status === "confirmed",
              ).length,
              waitlisted: registrations.filter(
                (r) => r.event_id === event.id && r.status === "waitlisted",
              ).length,
            })),
          );
        case "site_settings":
          return reply(defaultSettings);
        case "user_roles":
          return reply(
            single
              ? { role: user?.role ?? "student" }
              : Object.values(accounts)
                  .filter((a) => staff || a.id === user?.id)
                  .map((a) => ({ user_id: a.id, role: a.role })),
          );
        case "profiles":
          return reply(
            single
              ? profiles.find((p) => p.id === user?.id)
              : staff
                ? profiles
                : profiles.filter((p) => p.id === user?.id),
          );
        case "event_registrations":
          return reply(
            registrations.filter((r) => staff || r.user_id === user?.id),
          );
        case "notifications":
          return reply(notifications.filter((n) => n.user_id === user?.id));
        case "notification_preferences":
          return reply(user ? preferences.get(user.id) : null);
        case "memberships":
          return reply(
            memberships.filter((m) => staff || m.user_id === user?.id),
          );
        case "suggestions":
          return reply(
            suggestions.filter((s) => staff || s.author_id === user?.id),
          );
        case "suggestion_votes":
          return reply(suggestionVotes.filter((v) => v.user_id === user?.id));
        case "poll_votes":
          return reply(
            pollVotes.filter(
              (v) =>
                v.user_id === user?.id &&
                (!url.searchParams.has("poll_id") ||
                  `eq.${v.poll_id}` === url.searchParams.get("poll_id")),
            ),
          );
        case "polls":
          return reply(polls.filter((p) => p.published || staff));
        case "poll_options":
          return reply(
            options.filter((o) =>
              polls.some((p) => p.id === o.poll_id && (p.published || staff)),
            ),
          );
        case "access_groups":
        case "group_members":
        case "event_access_groups":
        case "audit_logs":
        case "announcements":
          return reply([]);
        case "contact_submissions":
          return reply(contacts.filter((c) => staff || c.user_id === user?.id));
        default:
          unexpected.push(`GET ${url.pathname}`);
          return reply({ message: "Unexpected test query" }, 400);
      }
    });
  }
  return {
    install,
    events,
    registrations,
    memberships,
    contacts,
    suggestions,
    polls,
    options,
    writes,
    unexpected,
  };
}
