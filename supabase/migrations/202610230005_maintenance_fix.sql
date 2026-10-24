-- Non-destructive correction found by the expanded retention test.
-- Rename the PL/pgSQL loop variable so it cannot shadow SQL table aliases.
-- This defines the function only; it does not run maintenance or activate cron.
create or replace function public.run_maintenance() returns void language plpgsql security definer set search_path = '' as $$
declare reminder record; begin
 if current_setting('request.jwt.claim.role',true)<>'service_role' and session_user<>'postgres' then raise exception 'Service only.' using errcode='42501'; end if;
 update public.event_registrations r set dietary=null,dietary_consent_at=null from public.events e where r.event_id=e.id and e.ends_at<now()-interval '7 days' and r.dietary is not null;
 delete from public.event_registrations r using public.events e where r.event_id=e.id and e.ends_at<now()-interval '180 days';
 delete from public.contact_submissions where created_at<now()-interval '90 days';
 delete from public.notifications where created_at<now()-interval '180 days';
 delete from public.audit_logs where created_at<now()-interval '365 days';
 delete from private.rate_limits where bucket<now()-interval '2 days';
 for reminder in select e.id,e.title,er.user_id from public.events e join public.event_registrations er on er.event_id=e.id and er.status='confirmed'
 where e.status='published' and e.starts_at between now() and now()+interval '24 hours'
 and not exists(select 1 from public.notifications n where n.event_id=e.id and n.user_id=er.user_id and n.kind='reminder') loop
 perform private.notify(reminder.user_id,reminder.id,'reminder','Snart: '||reminder.title,'Arrangementet nærmer seg. Se oppdatert tid og sted på arrangementssiden.');
 end loop;
end; $$;
revoke all on function public.run_maintenance() from public,anon,authenticated;
grant execute on function public.run_maintenance() to service_role;
