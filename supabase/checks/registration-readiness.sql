-- READ ONLY. Run in the SQL Editor of project gawhbppuhnixqvhnnpnn.
-- No function calls that register users/events, no DDL, no scheduler changes.
-- Returns function names and booleans; no user data, keys, job commands or tokens.
begin read only;

-- Body fingerprints from 202610230006_registration_deadline.sql, with
-- whitespace normalized. This checks actual definitions, not migration history.
with expected(signature, body_md5, students_may_execute) as (values
 ('private.promote(uuid)', '7c2229c8971b9f98749e75c640cb4af0', false),
 ('public.register_event(uuid,text,uuid,text,boolean)', 'f8931cd2e6219042b98e7009d84eb67a', true)
)
select
 e.signature,
 p.oid is not null as function_exists,
 coalesce(md5(btrim(regexp_replace(replace(p.prosrc, chr(13), ''), '[[:space:]]+', ' ', 'g'))) = e.body_md5, false) as migration_body_matches,
 coalesce(p.prosecdef, false) as security_definer,
 coalesce(p.proconfig @> array['search_path=""'], false) as search_path_locked,
 coalesce(not has_function_privilege('anon',p.oid,'EXECUTE') and
   has_function_privilege('authenticated',p.oid,'EXECUTE') = e.students_may_execute, false) as permissions_expected
from expected e left join pg_proc p on p.oid=to_regprocedure(e.signature)
order by e.signature;

select
 (select count(*)=6 and bool_and(c.relrowsecurity)
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname in
  ('profiles','user_roles','events','event_registrations','notifications','notification_preferences')) as relevant_rls_enabled,
 case when to_regclass('cron.job') is null then true else
  ((xpath('/table/row/active_jobs/text()', query_to_xml(
   $q$select count(*) as active_jobs from cron.job where active and
    (jobname ilike 'pmns%' or command ilike '%/functions/v1/notifications%'
     or command ilike '%run_maintenance%' or command ilike '%claim_emails%')$q$,
   false,false,'')))[1]::text::integer=0)
 end as known_pmns_jobs_inactive;

rollback;
