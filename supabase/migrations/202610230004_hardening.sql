-- Single-level keys make deletion via the Storage API complete and predictable.
create function private.upload_quota(p_bucket text) returns boolean language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then return false; end if;
 -- Account-level lock serializes concurrent uploads when evaluating the quota.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_bucket,0));
 return (select count(*) from storage.objects where bucket_id=p_bucket and (storage.foldername(name))[1]=auth.uid()::text)<case when p_bucket='event-images' then 100 else 20 end;
end; $$;
revoke all on function private.upload_quota(text) from public,anon;
grant execute on function private.upload_quota(text) to authenticated;
drop policy asset_insert on storage.objects;
create policy asset_insert on storage.objects for insert to authenticated with check(
 name ~ ('^'||auth.uid()::text||'/[a-f0-9-]{36}\.(jpg|jpeg|png|webp)$')
 and bucket_id in ('avatars','suggestion-images')
 and private.upload_quota(bucket_id)
);
-- Bound automatic retries to the email provider's idempotency window (24h).
alter table private.email_outbox add column first_attempt_at timestamptz;
create or replace function public.claim_emails() returns table(id uuid,email text,subject text,body text) language plpgsql security definer set search_path = '' as $$
begin
 return query with candidates as (
 select o.id from private.email_outbox o where (o.state in ('pending','failed') or (o.state='sending' and o.locked_at<now()-interval '10 minutes')) and o.attempts<5
 and (o.first_attempt_at is null or o.first_attempt_at>now()-interval '23 hours')
 order by o.id for update skip locked limit 25
 ), claimed as (
 update private.email_outbox o set state='sending',attempts=attempts+1,locked_at=now(),first_attempt_at=coalesce(o.first_attempt_at,now()) from candidates c where o.id=c.id returning o.id
 ) select n.id,u.email::text,n.subject,n.body from claimed c join public.notifications n on n.id=c.id join auth.users u on u.id=n.user_id;
end; $$;
create function public.prepare_account_deletion() returns boolean language plpgsql security definer set search_path = '' as $$
declare u uuid=private.require_user(); begin
 perform pg_advisory_xact_lock(70667001);
 if exists(select 1 from public.user_roles where user_id=u and role='admin') and (select count(*) from public.user_roles where role='admin')<=1 then raise exception 'Overfør administratorrollen før kontoen slettes.'; end if;
 return true;
end; $$;
revoke all on function public.prepare_account_deletion() from public,anon;
grant execute on function public.prepare_account_deletion() to authenticated;
-- Supplementary indexes for RLS/FK lookups.
create index memberships_status_idx on public.memberships(status);
create index group_members_user_idx on public.group_members(user_id);
create index event_groups_group_idx on public.event_access_groups(group_id);
create index teams_captain_idx on public.event_teams(captain_id);
create index registrations_team_idx on public.event_registrations(team_id);
create index suggestions_author_idx on public.suggestions(author_id);
create index suggestions_status_idx on public.suggestions(status,created_at);
create index suggestion_votes_user_idx on public.suggestion_votes(user_id);
create index poll_votes_user_idx on public.poll_votes(user_id);
create index poll_votes_option_idx on public.poll_votes(option_id);
create index contacts_user_idx on public.contact_submissions(user_id);
create index audit_actor_idx on public.audit_logs(actor_id);
