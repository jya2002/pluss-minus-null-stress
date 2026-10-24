import { useMutation } from "@tanstack/react-query";
import { db } from "../lib/api";
import { rememberAuthDestination } from "../lib/auth-callback";
import googleLogo from "../assets/google-g.png";

export default function GoogleSignIn({ destination }: { destination: string }) {
  const login = useMutation({
    retry: false,
    mutationFn: async () => {
      rememberAuthDestination(destination);
      // The SDK creates the PKCE verifier. Google consent and OAuth state are
      // handled by Supabase; no Google secret or provider token is managed here.
      const { error } = await db().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${window.location.pathname}`,
          scopes: "openid email profile",
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) throw new Error("Google sign-in unavailable");
    },
  });
  return (
    <>
      <button
        type="button"
        className="google-sign-in"
        disabled={login.isPending}
        aria-busy={login.isPending}
        onClick={() => login.mutate()}
      >
        <img src={googleLogo} width="20" height="20" alt="" />
        <span>
          {login.isPending ? "Åpner Google …" : "Fortsett med Google"}
        </span>
      </button>
      {login.error && (
        <div className="error" role="alert">
          Google-innloggingen kunne ikke startes. Prøv igjen, eller kontakt
          styret hvis problemet fortsetter.
        </div>
      )}
    </>
  );
}
