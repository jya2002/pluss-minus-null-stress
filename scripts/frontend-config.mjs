// Shared build-time validation. Never include configuration values in errors.
export function validateFrontendConfig(mode, env, baseOverride) {
  for (const [name, value] of Object.entries(env)) {
    if (!name.startsWith("VITE_") || !value) continue;
    const safePasswordFlag =
      name === "VITE_ENABLE_DEV_PASSWORD_LOGIN" &&
      ["true", "false"].includes(value);
    if (
      (!safePasswordFlag &&
        /SECRET|SERVICE_ROLE|PRIVATE_KEY|PASSWORD|ACCESS_TOKEN|RESEND_API_KEY/i.test(
          name,
        )) ||
      /sb_secret_|GOCSPX-|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(value)
    )
      throw new Error(
        "Server credentials are forbidden in public VITE_ variables. Remove and rotate any exposed secret.",
      );
    // Check every public value, not just the expected public-key variable.
    for (const token of value.matchAll(
      /[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g,
    )) {
      try {
        if (
          JSON.parse(Buffer.from(token[1], "base64url").toString()).role ===
          "service_role"
        )
          throw new Error("privileged");
      } catch (error) {
        if (error.message === "privileged")
          throw new Error(
            "A service-role JWT is forbidden in public frontend variables.",
            { cause: error },
          );
      }
    }
  }
  const demo = env.VITE_DEMO_MODE === "true";
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  if (key && !key.startsWith("sb_publishable_")) {
    try {
      if (
        key.split(".").length !== 3 ||
        JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString())
          .role !== "anon"
      )
        throw new Error();
    } catch {
      throw new Error(
        "Only a publishable key or legacy anon key is allowed in the frontend.",
      );
    }
  }
  if (env.VITE_SUPABASE_URL) {
    try {
      const url = new URL(env.VITE_SUPABASE_URL);
      const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
      if (
        url.username ||
        url.password ||
        url.pathname !== "/" ||
        url.search ||
        url.hash ||
        (url.protocol !== "https:" &&
          !(mode !== "production" && local && url.protocol === "http:"))
      )
        throw new Error();
    } catch {
      throw new Error(
        "Use the Supabase project root URL; production requires HTTPS and no credentials or subpath.",
      );
    }
  }
  if (mode === "production" && !demo && (!env.VITE_SUPABASE_URL || !key))
    throw new Error(
      "Production requires Supabase URL and public key. Use explicit VITE_DEMO_MODE=true only for an intentional demo build.",
    );
  const base =
    baseOverride || (mode === "production" ? "/pluss-minus-null-stress/" : "/");
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(base))
    throw new Error("Use a local absolute base path with a trailing slash.");
  return { base };
}
