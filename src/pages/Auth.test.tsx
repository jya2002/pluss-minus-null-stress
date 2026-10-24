import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../components/ui";
import { developmentPasswordEnabled } from "../lib/auth-options";
import Auth from "./Auth";

const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signInWithOAuth: vi.fn(),
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
}));
vi.mock("../lib/api", () => ({ demo: false, db: () => ({ auth }) }));
vi.mock("../lib/auth", () => ({
  useAuth: () => ({
    session: null,
    loading: false,
    role: "student",
    roleError: null,
  }),
}));

function renderAuth(path = "/logg-inn") {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { mutations: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <ToastProvider>
          <Auth />
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("DEV", true);
  vi.stubEnv("VITE_ENABLE_DEV_PASSWORD_LOGIN", "true");
  sessionStorage.clear();
});
afterEach(() => vi.unstubAllEnvs());

describe("development-only password sign-in", () => {
  it("shows persistent Norwegian email errors without raw provider text", async () => {
    auth.signInWithOtp.mockResolvedValue({
      error: {
        code: "over_email_send_rate_limit",
        message: "private-provider-response",
      },
    });
    renderAuth();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Innloggingslenke" }));
    await user.type(
      screen.getByLabelText("E-postadresse", { exact: true }),
      "student@example.test",
    );
    await user.click(
      screen.getByRole("button", { name: "Send innloggingslenke" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "For mange forsøk.",
    );
    expect(document.body).not.toHaveTextContent("private-provider-response");
    expect(
      screen.queryByRole("heading", { name: "Sjekk innboksen din" }),
    ).not.toBeInTheDocument();
  });
  it("shows an expired OTP error and clears it when changing email", async () => {
    auth.signInWithOtp.mockResolvedValue({ error: null });
    auth.verifyOtp.mockResolvedValue({
      error: { code: "otp_expired", message: "private-token-response" },
    });
    renderAuth();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Innloggingslenke" }));
    await user.type(
      screen.getByLabelText("E-postadresse", { exact: true }),
      "student@example.test",
    );
    await user.click(
      screen.getByRole("button", { name: "Send innloggingslenke" }),
    );
    await user.type(
      await screen.findByLabelText("Engangskode (hvis mottatt)"),
      "123456",
    );
    await user.click(screen.getByRole("button", { name: "Bekreft kode" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "ugyldig eller utløpt",
    );
    expect(document.body).not.toHaveTextContent("private-token-response");
    await user.click(
      screen.getByRole("button", { name: "Bruk en annen e-postadresse" }),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it.each([
    { dev: false, flag: "true" },
    { dev: false, flag: "false" },
    { dev: true, flag: "false" },
    { dev: true, flag: "" },
  ])(
    "keeps the password form disabled with DEV=$dev and flag=$flag",
    async ({ dev, flag }) => {
      vi.stubEnv("DEV", dev);
      vi.stubEnv("VITE_ENABLE_DEV_PASSWORD_LOGIN", flag);
      expect(developmentPasswordEnabled()).toBe(false);
      renderAuth();
      expect(
        screen.queryByLabelText("Passord", { exact: true }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Fortsett med Google" }),
      ).toBeVisible();
      await userEvent.setup().click(screen.getByText("Andre innloggingsmåter"));
      expect(
        screen.getByRole("button", { name: "Send innloggingslenke" }),
      ).toBeInTheDocument();
    },
  );

  it("signs in through Supabase password auth without requesting email or changing the password", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    renderAuth();
    const user = userEvent.setup();
    const password = screen.getByLabelText("Passord", { exact: true });
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("autocomplete", "current-password");
    await user.type(
      screen.getByLabelText("E-postadresse", { exact: true }),
      "student@example.test",
    );
    // Spaces must be preserved: never normalize a password as if it were an email.
    await user.type(password, " Local-only-test-123! ");
    await user.click(
      screen.getByRole("button", { name: "Logg inn med passord" }),
    );
    await waitFor(() =>
      expect(auth.signInWithPassword).toHaveBeenCalledWith({
        email: "student@example.test",
        password: " Local-only-test-123! ",
      }),
    );
    await waitFor(() => expect(password).toHaveValue(""));
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("reports invalid credentials without leaking raw error details or falling back to email", async () => {
    auth.signInWithPassword.mockResolvedValue({
      error: {
        code: "invalid_credentials",
        status: 400,
        message: "Sensitive server details",
      },
    });
    renderAuth();
    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText("E-postadresse", { exact: true }),
      "student@example.test",
    );
    await user.type(
      screen.getByLabelText("Passord", { exact: true }),
      "wrong-password",
    );
    await user.click(
      screen.getByRole("button", { name: "Logg inn med passord" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Innlogging mislyktes. Kontroller e-post og passord",
    );
    expect(
      screen.queryByText("Sensitive server details"),
    ).not.toBeInTheDocument();
    const diagnostic = screen.getByRole("status", {
      name: "Supabase Auth-diagnostikk",
    });
    expect(diagnostic).toHaveTextContent("HTTP 400");
    expect(diagnostic).toHaveTextContent("invalid_credentials");
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it("keeps unconfirmed users blocked and points to the per-user Dashboard action", async () => {
    auth.signInWithPassword.mockResolvedValue({
      error: { code: "email_not_confirmed", status: 400 },
    });
    renderAuth();
    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText("E-postadresse", { exact: true }),
      "student@example.test",
    );
    await user.type(
      screen.getByLabelText("Passord", { exact: true }),
      "local-test-password",
    );
    await user.click(
      screen.getByRole("button", { name: "Logg inn med passord" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Testbrukerens e-post er ikke bekreftet",
    );
    expect(
      screen.getByRole("status", { name: "Supabase Auth-diagnostikk" }),
    ).toHaveTextContent("email_not_confirmed");
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it("retains the magic-link flow only when explicitly selected in development", async () => {
    auth.signInWithOtp.mockResolvedValue({ error: null });
    renderAuth();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Innloggingslenke" }));
    await user.type(
      screen.getByLabelText("E-postadresse", { exact: true }),
      "student@example.test",
    );
    await user.click(
      screen.getByRole("button", { name: "Send innloggingslenke" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Sjekk innboksen din" }),
    ).toBeInTheDocument();
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("exposes only valid diagnostic metadata and never raw error or credential fields", async () => {
    auth.signInWithPassword.mockResolvedValue({
      error: {
        code: "unsafe/code?private=data",
        status: "400",
        message: "private-error-message",
        password: "private-password",
        access_token: "private-access-token",
      },
    });
    renderAuth();
    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText("E-postadresse", { exact: true }),
      "student@example.test",
    );
    await user.type(
      screen.getByLabelText("Passord", { exact: true }),
      "local-password",
    );
    await user.click(
      screen.getByRole("button", { name: "Logg inn med passord" }),
    );
    const diagnostic = await screen.findByRole("status", {
      name: "Supabase Auth-diagnostikk",
    });
    expect(diagnostic).toHaveTextContent("HTTP ukjent");
    expect(diagnostic).toHaveTextContent("ikke oppgitt");
    expect(document.body).not.toHaveTextContent(
      /private-(error-message|password|access-token)|unsafe\/code/,
    );
  });
});

describe("Google OAuth", () => {
  it("is primary in production and delegates PKCE to Supabase with minimal scopes", async () => {
    vi.stubEnv("DEV", false);
    auth.signInWithOAuth.mockResolvedValue({ error: null });
    renderAuth("/logg-inn?retur=%2Ftorsdagsbanken");
    const user = userEvent.setup();
    expect(
      document.querySelector("details.auth-alternatives"),
    ).not.toHaveAttribute("open");
    expect(
      screen.queryByLabelText("Passord", { exact: true }),
    ).not.toBeInTheDocument();
    await user.tab();
    expect(
      screen.getByRole("button", { name: "Fortsett med Google" }),
    ).toHaveFocus();
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: window.location.origin + window.location.pathname,
          scopes: "openid email profile",
          queryParams: { prompt: "select_account" },
        },
      }),
    );
    expect(JSON.parse(sessionStorage.getItem("pmns.auth.return")!).path).toBe(
      "/torsdagsbanken",
    );
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });
  it.each(["response", "rejection"])(
    "shows only a safe retry message on startup %s errors",
    async (mode) => {
      if (mode === "response")
        auth.signInWithOAuth.mockResolvedValue({
          error: {
            message: "private-provider-response",
            access_token: "private-token",
          },
        });
      else
        auth.signInWithOAuth.mockRejectedValue(
          new Error("private-provider-response"),
        );
      renderAuth();
      await userEvent
        .setup()
        .click(screen.getByRole("button", { name: "Fortsett med Google" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Google-innloggingen kunne ikke startes",
      );
      expect(document.body).not.toHaveTextContent(
        /private-provider-response|private-token/,
      );
      expect(
        screen.getByRole("button", { name: "Fortsett med Google" }),
      ).toBeEnabled();
      expect(auth.signInWithOtp).not.toHaveBeenCalled();
    },
  );
  it("blocks repeated clicks while starting OAuth and sanitizes external return paths", async () => {
    let finish!: (value: { error: null }) => void;
    auth.signInWithOAuth.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderAuth("/logg-inn?retur=https%3A%2F%2Funtrusted.invalid");
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Fortsett med Google" }),
    );
    const pending = screen.getByRole("button", { name: "Åpner Google …" });
    expect(pending).toBeDisabled();
    await user.click(pending);
    expect(auth.signInWithOAuth).toHaveBeenCalledTimes(1);
    expect(JSON.parse(sessionStorage.getItem("pmns.auth.return")!).path).toBe(
      "/min-side",
    );
    finish({ error: null });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Fortsett med Google" }),
      ).toBeEnabled(),
    );
  });
});
