import { useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";
import { db, demo } from "../lib/api";
import { useAuth } from "../lib/auth";
import { emailSchema } from "../lib/schemas";
import { Field, Submit } from "../components/ui";
import { emailAuthError } from "../lib/auth-errors";
import { developmentPasswordEnabled } from "../lib/auth-options";
import PasswordSignIn from "../components/PasswordSignIn";
import GoogleSignIn from "../components/GoogleSignIn";
import {
  rememberAuthDestination,
  safeAuthDestination,
} from "../lib/auth-callback";
export default function Auth() {
  const [params] = useSearchParams();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const passwordEnabled = developmentPasswordEnabled();
  const [method, setMethod] = useState<"password" | "link">(() =>
    passwordEnabled ? "password" : "link",
  );
  const passwordMode = passwordEnabled && method === "password";
  const { session, loading, authError } = useAuth();
  const form = useForm<{ email: string }>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });
  const send = useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      rememberAuthDestination(params.get("retur") ?? "/min-side");
      const { error } = await db().auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => setSent(true),
  });
  const verify = useMutation({
    mutationFn: async () => {
      const { error } = await db().auth.verifyOtp({
        email: form.getValues("email"),
        token: code,
        type: "email",
      });
      if (error) throw error;
    },
  });
  const back = params.get("retur");
  const destination = safeAuthDestination(back);
  if (!loading && session && !authError)
    return <Navigate to={destination} replace />;
  return (
    <div className="container auth-page">
      <div className="auth-decoration" aria-hidden="true">
        <span>+</span>
        <span>−</span>
        <span>0</span>
      </div>
      <section className="panel auth-card">
        <div className="auth-icon">
          <Mail />
        </div>
        <div className="eyebrow">MER SOSIALT, MINDRE STRESS</div>
        <h1>
          {!passwordMode && sent
            ? "Sjekk innboksen din"
            : "Hei, matematikkstudent!"}
        </h1>
        <p>
          {!passwordMode && sent
            ? "Bruk lenken i e-posten, eller skriv inn engangskoden hvis e-postmalen inneholder en kode."
            : "Logg inn eller opprett konto med Google. Så er du klar for det sosiale."}
        </p>
        {!demo && <GoogleSignIn destination={destination} />}
        <details
          className="auth-alternatives"
          open={passwordEnabled || sent || demo}
        >
          <summary>Andre innloggingsmåter</summary>
          <div className="auth-alternatives-content">
            {!demo && passwordEnabled && (
              <div
                className="segmented"
                role="group"
                aria-label="Innloggingsmetode"
                style={{ marginBottom: 20 }}
              >
                <button
                  type="button"
                  aria-pressed={passwordMode}
                  className={passwordMode ? "selected" : ""}
                  onClick={() => setMethod("password")}
                >
                  Passord (utvikling)
                </button>
                <button
                  type="button"
                  aria-pressed={!passwordMode}
                  className={!passwordMode ? "selected" : ""}
                  onClick={() => setMethod("link")}
                >
                  Innloggingslenke
                </button>
              </div>
            )}
            {!passwordMode && send.error && (
              <div className="error" role="alert">
                {emailAuthError(send.error)}
              </div>
            )}
            {!passwordMode && verify.error && (
              <div className="error" role="alert">
                {emailAuthError(verify.error, true)}
              </div>
            )}
            {demo ? (
              <div className="notice">
                Innlogging krever Supabase. Se README for oppsett. Dette er en
                skrivebeskyttet demovisning.
              </div>
            ) : passwordMode ? (
              <PasswordSignIn />
            ) : !sent ? (
              <form
                key="request-link"
                className="form-stack"
                onSubmit={form.handleSubmit((v) => send.mutate(v))}
              >
                <Field
                  label="E-postadresse"
                  error={form.formState.errors.email?.message}
                >
                  <input
                    type="email"
                    autoComplete="email"
                    {...form.register("email")}
                    placeholder="deg@student.matnat.uio.no"
                  />
                </Field>
                <Submit pending={send.isPending}>Send innloggingslenke</Submit>
              </form>
            ) : (
              <form
                key="verify-code"
                className="form-stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  verify.mutate();
                }}
              >
                <Field label="Engangskode (hvis mottatt)">
                  <input
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                    minLength={6}
                    maxLength={10}
                  />
                </Field>
                <Submit pending={verify.isPending}>Bekreft kode</Submit>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    setSent(false);
                    send.reset();
                    verify.reset();
                    setCode("");
                  }}
                >
                  Bruk en annen e-postadresse
                </button>
                <button
                  className="text-button"
                  type="button"
                  disabled={send.isPending}
                  onClick={() =>
                    send.mutate({ email: form.getValues("email") })
                  }
                >
                  Send lenken på nytt
                </button>
              </form>
            )}
          </div>
        </details>
        <p className="small-text">
          <ShieldCheck size={15} /> Kontoen er separat fra medlemskap.{" "}
          <Link to="/personvern">Les om personvern</Link>.
        </p>
        <Link to="/" className="text-button">
          <ArrowLeft size={16} />
          Tilbake til forsiden
        </Link>
      </section>
    </div>
  );
}
