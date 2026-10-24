const returnKey = "pmns.auth.return";
export function safeAuthDestination(value: string | null | undefined) {
  return value &&
    value.length <= 1000 &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !/[\\#]/.test(value) &&
    !Array.from(value).some((character) => character.charCodeAt(0) <= 32)
    ? value
    : "/min-side";
}
export function rememberAuthDestination(destination: string) {
  try {
    sessionStorage.setItem(
      returnKey,
      JSON.stringify({
        path: safeAuthDestination(destination),
        at: Date.now(),
      }),
    );
  } catch {
    /* Storage may be unavailable; safe default still works. */
  }
}
type ReturnStorage = Pick<Storage, "getItem" | "removeItem">;
function takeDestination(storage: ReturnStorage, now: number) {
  try {
    const saved = JSON.parse(storage.getItem(returnKey) ?? "null");
    storage.removeItem(returnKey);
    return saved &&
      Number.isFinite(saved.at) &&
      now - saved.at >= 0 &&
      now - saved.at < 3600000
      ? safeAuthDestination(saved.path)
      : "/min-side";
  } catch {
    return "/min-side";
  }
}
export type AuthCallback =
  { code: string; flowId?: string } | { error: true } | null;
// Capture before the SDK and HashRouter initialize. Auth material is retained
// only in this module's memory, never in a route, error message or log.
export function captureAuthCallback(
  href: string,
  history: Pick<History, "replaceState" | "state">,
  storage: ReturnStorage,
  now = Date.now(),
): AuthCallback {
  const url = new URL(href);
  const fragment = new URLSearchParams(url.hash.slice(1).split("?").at(-1));
  const error = [url.searchParams, fragment].some((params) =>
    [
      "error",
      "error_code",
      "error_description",
      "access_token",
      "refresh_token",
    ].some((key) => params.has(key)),
  );
  if (!error && !url.searchParams.has("code")) return null;
  const code = url.searchParams.get("code");
  const flowId = url.searchParams.get("sb_flow_id") ?? undefined;
  for (const key of [
    "code",
    "sb_flow_id",
    "error",
    "error_code",
    "error_description",
    "access_token",
    "refresh_token",
    "token_type",
    "expires_in",
  ])
    url.searchParams.delete(key);
  url.hash = `/logg-inn?retur=${encodeURIComponent(takeDestination(storage, now))}`;
  history.replaceState(history.state, "", url.toString());
  return error ||
    !code ||
    code.length > 4096 ||
    (flowId && !/^[A-Za-z0-9_-]{1,128}$/.test(flowId))
    ? { error: true }
    : { code, flowId };
}
const initial =
  typeof window !== "undefined"
    ? captureAuthCallback(window.location.href, window.history, {
        getItem: (key) => {
          try {
            return window.sessionStorage.getItem(key);
          } catch {
            return null;
          }
        },
        removeItem: (key) => {
          try {
            window.sessionStorage.removeItem(key);
          } catch {
            /* No persisted return path. */
          }
        },
      })
    : null;
type CallbackClient = {
  auth: {
    exchangeCodeForSession: (
      code: string,
      options?: { flowId?: string },
    ) => Promise<{ error: unknown }>;
  };
};
export function callbackCompletion(callback: AuthCallback) {
  const completions = new WeakMap<CallbackClient, Promise<Error | null>>();
  return function complete(client: CallbackClient) {
    const existing = completions.get(client);
    if (existing) return existing;
    const pending = (async () => {
      if (!callback) return null;
      const unavailable = () =>
        new Error(
          "Innloggingen ble ikke fullført. Den ble avbrutt, eller lenken er ugyldig, utløpt eller åpnet i en annen nettleser. Prøv Google på nytt, eller be om en ny e-postlenke.",
        );
      if ("error" in callback) return unavailable();
      try {
        const { error } = await client.auth.exchangeCodeForSession(
          callback.code,
          callback.flowId ? { flowId: callback.flowId } : undefined,
        );
        return error ? unavailable() : null;
      } catch {
        return unavailable();
      }
    })();
    completions.set(client, pending);
    return pending;
  };
}
export const completeAuthCallback = callbackCompletion(initial);
