type Result<T> = { data: T; error: unknown };
export type DeletionService = {
  auth: {
    getUser(
      token: string,
    ): Promise<
      Result<{ user: { id: string; last_sign_in_at?: string } | null }>
    >;
    admin: { deleteUser(id: string): Promise<{ error: unknown }> };
  };
  storage: {
    from(bucket: string): {
      list(
        prefix: string,
        options: { limit: number },
      ): Promise<Result<{ name: string }[] | null>>;
      remove(paths: string[]): Promise<{ error: unknown }>;
    };
  };
};
export type DeletionDependencies = {
  allowedOrigin: () => string | undefined;
  service: () => DeletionService;
  prepare: (token: string) => Promise<{ error: unknown }>;
  now?: () => number;
};
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function createAccountDeleteHandler(deps: DeletionDependencies) {
  return async (req: Request): Promise<Response> => {
    const origin = deps.allowedOrigin();
    const allowed = !!origin && req.headers.get("origin") === origin;
    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Vary: "Origin",
      "Access-Control-Allow-Origin": allowed ? origin! : "null",
      "Access-Control-Allow-Headers":
        "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
    const reply = (body: unknown, status: number) =>
      new Response(JSON.stringify(body), { status, headers });
    if (req.method === "OPTIONS")
      return allowed
        ? new Response(null, { status: 204, headers })
        : reply({ error: "Origin denied" }, 403);
    if (req.method !== "POST")
      return reply({ error: "Method not allowed" }, 405);
    if (!allowed) return reply({ error: "Origin denied" }, 403);
    const token = /^Bearer ([^\s]+)$/i.exec(
      req.headers.get("authorization") ?? "",
    )?.[1];
    if (!token) return reply({ error: "Unauthorized" }, 401);
    try {
      const admin = deps.service();
      // Auth verifies signature and expiry before any payload claim is used.
      const { data, error } = await admin.auth.getUser(token);
      if (error || !data.user || !uuid.test(data.user.id))
        return reply({ error: "Unauthorized" }, 401);
      let iat: unknown, amr: unknown;
      try {
        const claims = JSON.parse(
          atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
        );
        iat = claims.iat;
        amr = claims.amr;
      } catch {
        return reply({ error: "Invalid token" }, 401);
      }
      const now = (deps.now ?? Date.now)(),
        signedIn = Date.parse(data.user.last_sign_in_at ?? "");
      // A freshly refreshed JWT is not a fresh login. AMR belongs to this
      // verified session; last_sign_in_at alone can change on another device.
      const recentlyAuthenticated =
        Array.isArray(amr) &&
        amr.some(
          (entry) =>
            entry &&
            typeof entry === "object" &&
            [
              "password",
              "otp",
              "magiclink",
              "email/signup",
              "oauth",
              "totp",
              "sso/saml",
            ].includes(entry.method) &&
            Number.isInteger(entry.timestamp) &&
            entry.timestamp > 0 &&
            entry.timestamp * 1000 <= now + 30000 &&
            now - entry.timestamp * 1000 <= 900000,
        );
      if (
        !recentlyAuthenticated ||
        typeof iat !== "number" ||
        !Number.isInteger(iat) ||
        iat <= 0 ||
        iat * 1000 > now + 30000 ||
        now - iat * 1000 > 900000 ||
        !Number.isFinite(signedIn) ||
        signedIn > now + 30000 ||
        now - signedIn > 900000
      )
        return reply({ error: "Logg inn på nytt før sletting." }, 401);
      if (
        !req.headers
          .get("content-type")
          ?.toLowerCase()
          .startsWith("application/json")
      )
        return reply({ error: "Invalid request" }, 400);
      const reader = req.body?.getReader();
      let length = 0;
      const chunks: Uint8Array[] = [];
      if (reader)
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.length;
          if (length > 1024) {
            await reader.cancel();
            return reply({ error: "Invalid request" }, 413);
          }
          chunks.push(value);
        }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      let body: unknown;
      try {
        body = JSON.parse(new TextDecoder().decode(bytes));
      } catch {
        return reply({ error: "Invalid request" }, 400);
      }
      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body) ||
        Object.keys(body).length !== 1 ||
        !("confirmation" in body) ||
        body.confirmation !== "SLETT"
      )
        return reply(
          { error: "Confirmation required; only self deletion is supported" },
          400,
        );
      const uid = data.user.id;
      if ((await deps.prepare(token)).error)
        return reply(
          { error: "Overfør eventuell siste administratorrolle før sletting." },
          409,
        );
      // Only personal buckets and single-level UUID keys. Association event
      // images survive deletion. All removal uses Storage API, never SQL rows.
      for (const bucket of ["avatars", "suggestion-images"]) {
        const store = admin.storage.from(bucket);
        let empty = false;
        for (let batch = 0; batch < 20; batch++) {
          const { data: files, error: listError } = await store.list(uid, {
            limit: 100,
          });
          if (listError || !Array.isArray(files))
            return reply({ error: "Storage cleanup failed" }, 503);
          if (files.length === 0) {
            empty = true;
            break;
          }
          if (
            files.some(
              (file) =>
                !uuid.test(file.name.replace(/\.(jpg|jpeg|png|webp)$/i, "")) ||
                !/\.(jpg|jpeg|png|webp)$/i.test(file.name),
            )
          )
            return reply(
              { error: "Storage cleanup requires manual review" },
              409,
            );
          if (
            (await store.remove(files.map((file) => `${uid}/${file.name}`)))
              .error
          )
            return reply({ error: "Storage cleanup failed" }, 503);
        }
        if (!empty)
          return reply(
            {
              error:
                "Storage cleanup limit reached; retry or contact the board",
            },
            503,
          );
      }
      // The SQL delete trigger repeats the last-admin guard under its lock.
      const { error: deleteError } = await admin.auth.admin.deleteUser(uid);
      return deleteError
        ? reply(
            {
              error:
                "Sletting mislyktes. Overfør eventuell siste administratorrolle først.",
            },
            409,
          )
        : reply({ deleted: true }, 200);
    } catch {
      return reply({ error: "Deletion temporarily unavailable" }, 503);
    }
  };
}
