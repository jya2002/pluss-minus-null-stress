import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request, supabase } from "./api";
import type { Role } from "./types";
import { completeAuthCallback } from "./auth-callback";
const AuthContext = createContext<{
  session: Session | null;
  loading: boolean;
  role: Role;
  roleError: Error | null;
  authError: Error | null;
}>({
  session: null,
  loading: true,
  role: "student",
  roleError: null,
  authError: null,
});
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const previousUser = useRef<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!!supabase);
  const [authError, setAuthError] = useState<Error | null>(null);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const unavailable = () => {
      if (!active) return;
      setLoading(false);
      setAuthError(
        new Error(
          "Innloggingen kunne ikke gjenopprettes. Åpne Logg inn og prøv Google, eller last siden på nytt.",
        ),
      );
    };
    void completeAuthCallback(supabase)
      .then(async (callbackError) => {
        const { data, error } = await supabase!.auth.getSession();
        if (active) {
          if (error) {
            unavailable();
            return;
          }
          setSession(data.session);
          if (callbackError) setAuthError(callbackError);
          setLoading(false);
        }
      })
      .catch(unavailable);
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      const id = next?.user.id ?? null;
      if (previousUser.current !== id) {
        queryClient.clear();
        previousUser.current = id;
      }
      setSession(next);
      if (next) setAuthError(null);
      setLoading(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);
  const role = useQuery({
    queryKey: ["role", session?.user.id],
    queryFn: () =>
      request<{ role: Role }>(
        supabase!
          .from("user_roles")
          .select("role")
          .eq("user_id", session!.user.id)
          .single(),
      ),
    enabled: !!session,
  });
  return (
    <AuthContext.Provider
      value={{
        session,
        loading: loading || (!!session && role.isPending),
        role: role.data?.role ?? "student",
        roleError: role.error,
        authError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  return useContext(AuthContext);
}
