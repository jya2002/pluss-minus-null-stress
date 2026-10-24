import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { service } from "../_shared/client.ts";
import { createAccountDeleteHandler } from "./handler.ts";

Deno.serve(
  createAccountDeleteHandler({
    allowedOrigin: () => Deno.env.get("ALLOWED_ORIGIN"),
    service,
    prepare: async (token: string) => {
      const user = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        },
      );
      return await user.rpc("prepare_account_deletion");
    },
  }),
);
