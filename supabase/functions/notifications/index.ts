import { json, service } from "../_shared/client.ts";
Deno.serve(async (req) => {
  const secret = Deno.env.get("NOTIFICATION_WORKER_SECRET");
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return json({ error: "Unauthorized" }, 401);
  const admin = service();
  const { error: maintenanceError } = await admin.rpc("run_maintenance");
  if (maintenanceError) return json({ error: "Maintenance failed" }, 503);
  const apiKey = Deno.env.get("RESEND_API_KEY"),
    from = Deno.env.get("EMAIL_FROM"),
    appUrl = Deno.env.get("APP_URL");
  // Dev fallback: keep the outbox pending. No PII in logs and no false delivery claims.
  if (!apiKey || !from || !appUrl)
    return json({
      mode: "development",
      email_sent: 0,
      message:
        "Email provider not configured; in-app notifications remain available.",
    });
  const { data, error } = await admin.rpc("claim_emails");
  if (error) return json({ error: "Claim failed" }, 503);
  let accepted = 0,
    failed = 0;
  for (const item of data ?? []) {
    const { data: enabled, error: preferenceError } = await admin.rpc(
      "email_preference",
      { p_id: item.id },
    );
    if (preferenceError) {
      failed++;
      await admin.rpc("finish_email", {
        p_id: item.id,
        p_state: "failed",
        p_error: "Preference lookup failed",
      });
      continue;
    }
    if (!enabled) {
      await admin.rpc("finish_email", { p_id: item.id, p_state: "skipped" });
      continue;
    }
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `pmns-${item.id}`,
        },
        body: JSON.stringify({
          from,
          to: [item.email],
          subject: item.subject,
          text: `${item.body}\n\nSe Min side: ${appUrl}#/min-side\nVarslingsvalg kan endres på Min side.`,
        }),
        signal: AbortSignal.timeout(4000),
      });
      const state = response.ok ? "sent" : "failed";
      if (response.ok) accepted++;
      else failed++;
      await admin.rpc("finish_email", {
        p_id: item.id,
        p_state: state,
        p_error: response.ok ? null : `Provider HTTP ${response.status}`,
      });
    } catch {
      failed++;
      await admin.rpc("finish_email", {
        p_id: item.id,
        p_state: "failed",
        p_error: "Provider unavailable",
      });
    }
  }
  return json({
    mode: "provider",
    provider_accepted: accepted,
    failed,
    message:
      "Provider acceptance is not inbox delivery. Verify delivery in the provider dashboard.",
  });
});
