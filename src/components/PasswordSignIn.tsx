import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { db } from "../lib/api";
import { passwordLoginSchema } from "../lib/schemas";
import type { PasswordLoginInput } from "../lib/schemas";
import { Field, Submit, useToast } from "./ui";

type AuthDiagnostic = { code: string | null; status: number | null };
function authDiagnostic(error: unknown): AuthDiagnostic {
  // Copy only structured error metadata, never the error object, message,
  // credentials, request/response body, or tokens.
  if (!error || typeof error !== "object") return { code: null, status: null };
  const code = "code" in error ? error.code : undefined;
  const status = "status" in error ? error.status : undefined;
  return {
    code:
      typeof code === "string" && /^[a-z][a-z0-9_]{0,79}$/.test(code)
        ? code
        : null,
    status:
      typeof status === "number" &&
      Number.isInteger(status) &&
      status >= 100 &&
      status <= 599
        ? status
        : null,
  };
}

function loginError(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error
      ? error.code
      : undefined;
  if (code === "email_not_confirmed")
    return "Testbrukerens e-post er ikke bekreftet. Bekreft testbrukeren i Supabase Dashboard.";
  if (code === "over_request_rate_limit")
    return "For mange innloggingsforsøk. Vent litt før du prøver igjen.";
  // Do not disclose account existence or echo server-provided credential details.
  return "Innlogging mislyktes. Kontroller e-post og passord, og prøv igjen.";
}

export default function PasswordSignIn() {
  const toast = useToast();
  const [diagnostic, setDiagnostic] = useState<AuthDiagnostic | null>(null);
  const form = useForm<PasswordLoginInput>({
    resolver: zodResolver(passwordLoginSchema),
    defaultValues: { email: "", password: "" },
  });
  const login = useMutation({
    gcTime: 0,
    mutationFn: async (credentials: PasswordLoginInput) => {
      setDiagnostic(null);
      const { error } = await db().auth.signInWithPassword(credentials);
      if (error) throw error;
    },
    onSuccess: () => {
      form.resetField("password");
      // AuthProvider receives the real Supabase session and loads the server role.
      // No local session, email confirmation, or role is fabricated here.
    },
    onError: (error) => {
      if (import.meta.env.DEV) setDiagnostic(authDiagnostic(error));
      toast(loginError(error), true);
    },
  });
  return (
    <form
      className="form-stack"
      onSubmit={form.handleSubmit((values) => login.mutate(values))}
    >
      <Field label="E-postadresse" error={form.formState.errors.email?.message}>
        <input
          type="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          {...form.register("email")}
        />
      </Field>
      <Field label="Passord" error={form.formState.errors.password?.message}>
        <input
          type="password"
          autoComplete="current-password"
          required
          {...form.register("password")}
        />
      </Field>
      <Submit pending={login.isPending}>Logg inn med passord</Submit>
      {import.meta.env.DEV && diagnostic && (
        <div
          className="notice"
          role="status"
          aria-label="Supabase Auth-diagnostikk"
        >
          <div>
            <strong>
              Supabase Auth · HTTP {diagnostic.status ?? "ukjent"}
            </strong>
            <p>
              Feilkode: <code>{diagnostic.code ?? "ikke oppgitt"}</code>
            </p>
            <small>
              Kun utvikling. Ingen passord, token eller responsinnhold logges.
            </small>
          </div>
        </div>
      )}
      <p className="small-text">
        Kun utvikling: Bruk en bekreftet testkonto opprettet i Supabase
        Dashboard. Det sendes ingen innloggingsmail fra dette skjemaet.
      </p>
    </form>
  );
}
