import { createClient } from "@supabase/supabase-js";
import "./auth-callback";
import { defaultSettings, demoEvents, demoSuggestions } from "./demo";
import type {
  Announcement,
  Event,
  EventSummary,
  Poll,
  PollOption,
  Settings,
  Suggestion,
} from "./types";
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const supabase =
  import.meta.env.MODE === "test" || import.meta.env.VITE_DEMO_MODE === "true"
    ? null
    : url && key
      ? createClient(url, key, {
          auth: {
            flowType: "pkce",
            detectSessionInUrl: false,
            persistSession: true,
            autoRefreshToken: true,
          },
        })
      : null;
export const demo = !supabase;
export function db() {
  if (!supabase)
    throw new Error("Demovisning: Koble til Supabase for å lagre endringer.");
  return supabase;
}
export async function request<T>(
  query: PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as T;
}
export async function rpc<T = void>(
  name: string,
  args?: Record<string, unknown>,
) {
  return request<T>(db().rpc(name, args));
}

export async function deleteDraftEvent(
  eventId: string,
  exactTitle: string,
): Promise<string> {
  const { data: deletedId, error } = await db().rpc("delete_draft_event", {
    p_event: eventId,
    p_title: exactTitle,
  });
  if (error)
    throw new Error(
      error.code === "PGRST202"
        ? "Slettefunksjonen er ikke tilgjengelig i databasen ennå. Kontakt prosjektansvarlig."
        : error.message,
    );
  if (deletedId !== eventId)
    throw new Error(
      "Slettingen kunne ikke bekreftes. Last arrangementsoversikten på nytt før du prøver igjen.",
    );
  return eventId;
}
type QueryResult = PromiseLike<{
  data: unknown;
  error: { message: string } | null;
}>;
async function collectRows<T>(page: (from: number, to: number) => QueryResult) {
  const rows: T[] = [];
  // Stay below Supabase's default 1000-row response limit and never silently
  // truncate participant lists or the statistics derived from them.
  const size = 500;
  for (let from = 0; ; from += size) {
    const chunk = await request<T[]>(page(from, from + size - 1));
    rows.push(...chunk);
    if (chunk.length < size) return rows;
  }
}
export function tableRows<T>(
  table: string,
  options: {
    columns?: string;
    order?: string[];
    ascending?: boolean;
    eq?: Record<string, string>;
  } = {},
) {
  return collectRows<T>((from, to) => {
    let query = db()
      .from(table)
      .select(options.columns ?? "*");
    for (const [column, value] of Object.entries(options.eq ?? {}))
      query = query.eq(column, value);
    for (const column of options.order ?? ["id"])
      query = query.order(column, { ascending: options.ascending ?? true });
    return query.range(from, to);
  });
}
export function rpcRows<T>(
  name: string,
  args?: Record<string, unknown>,
  order = "id",
) {
  return collectRows<T>((from, to) =>
    db().rpc(name, args).order(order).range(from, to),
  );
}
export const api = {
  events: () =>
    demo
      ? Promise.resolve(demoEvents)
      : tableRows<Event>("events", { order: ["starts_at", "id"] }),
  summary: () =>
    demo
      ? Promise.resolve([] as EventSummary[])
      : rpcRows<EventSummary>("event_summary", undefined, "event_id"),
  suggestions: () =>
    demo
      ? Promise.resolve(demoSuggestions)
      : rpcRows<Suggestion>("suggestion_feed"),
  polls: () =>
    demo
      ? Promise.resolve([] as Poll[])
      : tableRows<Poll>("polls", {
          order: ["closes_at", "id"],
          ascending: false,
        }),
  options: () =>
    demo
      ? Promise.resolve([] as PollOption[])
      : tableRows<PollOption>("poll_options"),
  announcements: () =>
    demo
      ? Promise.resolve([] as Announcement[])
      : tableRows<Announcement>("announcements", {
          order: ["created_at", "id"],
          ascending: false,
        }),
  settings: () =>
    demo
      ? Promise.resolve(defaultSettings)
      : request<Settings>(db().from("site_settings").select("*").single()),
};
export function imageUrl(path: string | null, bucket = "event-images") {
  return path && supabase
    ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
    : undefined;
}
export async function upload(
  file: File,
  bucket: "event-images" | "avatars" | "suggestion-images",
  userId: string,
) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 4 * 1024 * 1024
  )
    throw new Error("Velg JPG, PNG eller WebP på maks 4 MB.");
  if (bucket === "event-images") {
    const body = new FormData();
    body.append("file", file);
    const { data, error } = await db().functions.invoke<{ path: string }>(
      "image-upload",
      { body },
    );
    if (error || !data?.path)
      throw new Error(
        "Bildet ble ikke lastet opp. Kontroller format, kvote og at image-upload er konfigurert.",
      );
    return data.path;
  }
  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[
    file.type
  ];
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await db()
    .storage.from(bucket)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}
