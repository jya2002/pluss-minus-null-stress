import { expect, it, vi } from "vitest";
import {
  callbackCompletion,
  captureAuthCallback,
  safeAuthDestination,
} from "./auth-callback";
function capture(url: string, path = "/torsdagsbanken?nytt=1") {
  const history = { state: null, replaceState: vi.fn() };
  const storage = {
    getItem: () => JSON.stringify({ path, at: 100 }),
    removeItem: vi.fn(),
  } as unknown as Storage;
  return {
    result: captureAuthCallback(url, history, storage, 200),
    history,
    storage,
  };
}
it("Pages PKCE callback is routed to login, retains internal destination and strips code before SDK/router", () => {
  const { result, history } = capture(
    "https://association.github.io/pluss-minus-null-stress/?code=private-code&sb_flow_id=flow-123",
  );
  expect(result).toEqual({ code: "private-code", flowId: "flow-123" });
  const url = new URL(history.replaceState.mock.calls[0][2]);
  expect(url.pathname).toBe("/pluss-minus-null-stress/");
  expect(url.search).toBe("");
  expect(url.hash).toBe("#/logg-inn?retur=%2Ftorsdagsbanken%3Fnytt%3D1");
});
it.each([
  "#error=access_denied&error_code=otp_expired&error_description=private-text",
  "?error=access_denied&error_description=private-text",
  "#access_token=private-token&refresh_token=private-refresh",
  "?code=",
])("invalid or expired callback is scrubbed safely: %s", (suffix) => {
  const { result, history } = capture(
    "https://association.github.io/pluss-minus-null-stress/" + suffix,
  );
  expect(result).toEqual({ error: true });
  expect(String(history.replaceState.mock.calls[0][2])).not.toMatch(
    /private|error_description|access_token|[?&]code=/,
  );
});
it.each([
  "https://other.invalid",
  "//other.invalid",
  "/\\other.invalid",
  "/min-side#access_token=bad",
  "/\nother",
])("unsafe return destination defaults to account: %s", (path) =>
  expect(safeAuthDestination(path)).toBe("/min-side"),
);
it("ordinary HashRouter navigation never triggers a callback or URL replacement", () => {
  const { result, history } = capture(
    "https://association.github.io/pluss-minus-null-stress/#/arrangementer",
  );
  expect(result).toBeNull();
  expect(history.replaceState).not.toHaveBeenCalled();
});
it("StrictMode duplicate initialization exchanges a one-use code only once", async () => {
  const client = {
    auth: {
      exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
    },
  };
  const complete = callbackCompletion({ code: "one-use-code" });
  await expect(
    Promise.all([complete(client), complete(client)]),
  ).resolves.toEqual([null, null]);
  expect(client.auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
});
it("failed/missing-verifier exchange produces a safe retry message, never provider content", async () => {
  const client = {
    auth: {
      exchangeCodeForSession: vi
        .fn()
        .mockRejectedValue(new Error("private-code and verifier")),
    },
  };
  const error = await callbackCompletion({ code: "one-use-code" })(client);
  expect(error?.message).toContain("ugyldig, utløpt");
  expect(error?.message).not.toMatch(/private-code|verifier/);
});
it("expired or reused server code is reported without exposing the Auth response", async () => {
  const client = {
    auth: {
      exchangeCodeForSession: vi.fn().mockResolvedValue({
        error: {
          code: "flow_state_expired",
          message: "private-provider-response",
        },
      }),
    },
  };
  const error = await callbackCompletion({ code: "one-use-code" })(client);
  expect(error?.message).toContain("ugyldig, utløpt");
  expect(error?.message).not.toContain("private-provider-response");
});
