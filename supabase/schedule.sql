-- Run manually in the Supabase SQL editor AFTER deployment and board approval.
-- Enable pg_cron and pg_net in Dashboard > Database > Extensions first.
-- Store pmns_project_url and pmns_worker_secret through the Vault dashboard.
-- pmns_worker_secret must match the NOTIFICATION_WORKER_SECRET Edge secret.
-- This intentionally contains no secret values and is not part of automatic migrations.
select cron.schedule('pmns-notifications','*/15 * * * *', $$
 select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name='pmns_project_url') || '/functions/v1/notifications',
  headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='pmns_worker_secret')),
  body := '{}'::jsonb,
  timeout_milliseconds := 10000
 );
$$);
-- Monitor cron.job_run_details AND net._http_response: HTTP scheduling success alone
-- does not establish function success or inbox delivery.
