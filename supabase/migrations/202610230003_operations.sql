-- Storage buckets are public only for deliberately shared visual assets. No dietary or participant data belongs here.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('event-images','event-images',true,4194304,array['image/jpeg','image/png','image/webp']),
 ('avatars','avatars',true,4194304,array['image/jpeg','image/png','image/webp']),
 ('suggestion-images','suggestion-images',true,4194304,array['image/jpeg','image/png','image/webp']);
create policy asset_read on storage.objects for select using(bucket_id in ('event-images','avatars','suggestion-images'));
create policy asset_insert on storage.objects for insert to authenticated with check(
 (storage.foldername(name))[1]=auth.uid()::text and
 ((bucket_id='event-images' and private.is_staff()) or bucket_id in ('avatars','suggestion-images'))
 and lower(storage.extension(name)) in ('jpg','jpeg','png','webp')
);
create policy asset_delete on storage.objects for delete to authenticated using(
 (bucket_id in ('avatars','suggestion-images') and (storage.foldername(name))[1]=auth.uid()::text)
 or (bucket_id='event-images' and private.is_staff())
);

create function private.audit_change() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into public.audit_logs(actor_id,action,entity,entity_id) values(auth.uid(),TG_OP,TG_TABLE_NAME,case when TG_OP='DELETE' then old.id::text else new.id::text end);return coalesce(new,old);end; $$;
create trigger audit_poll after update on public.polls for each row execute function private.audit_change();
create trigger audit_announcement after insert or update or delete on public.announcements for each row execute function private.audit_change();
-- Optional announcement emails are queued on the transition to published.
create function private.announcement_published() returns trigger language plpgsql security definer set search_path = '' as $$
declare u record; begin
 if new.published and not new.is_demo and (TG_OP='INSERT' or not old.published) then
 for u in select user_id from public.notification_preferences where email_announcements loop
 perform private.notify(u.user_id,null,'announcement',new.title,new.body);
 end loop;
 end if; return new;
end; $$;
create trigger announcement_published after insert or update on public.announcements for each row execute function private.announcement_published();

create function public.run_maintenance() returns void language plpgsql security definer set search_path = '' as $$
declare r record; begin
 if current_setting('request.jwt.claim.role',true)<>'service_role' and session_user<>'postgres' then raise exception 'Service only.' using errcode='42501'; end if;
 update public.event_registrations r set dietary=null,dietary_consent_at=null from public.events e where r.event_id=e.id and e.ends_at<now()-interval '7 days' and r.dietary is not null;
 delete from public.event_registrations r using public.events e where r.event_id=e.id and e.ends_at<now()-interval '180 days';
 delete from public.contact_submissions where created_at<now()-interval '90 days';
 delete from public.notifications where created_at<now()-interval '180 days';
 delete from public.audit_logs where created_at<now()-interval '365 days';
 delete from private.rate_limits where bucket<now()-interval '2 days';
 for r in select e.id,e.title,er.user_id from public.events e join public.event_registrations er on er.event_id=e.id and er.status='confirmed'
 where e.status='published' and e.starts_at between now() and now()+interval '24 hours'
 and not exists(select 1 from public.notifications n where n.event_id=e.id and n.user_id=er.user_id and n.kind='reminder') loop
 perform private.notify(r.user_id,r.id,'reminder','Snart: '||r.title,'Arrangementet nærmer seg. Se oppdatert tid og sted på arrangementssiden.');
 end loop;
end; $$;
-- A single transactional claim prevents workers from sending the same batch.
create function public.claim_emails() returns table(id uuid,email text,subject text,body text) language plpgsql security definer set search_path = '' as $$
begin
 return query with candidates as (
 select o.id from private.email_outbox o where (o.state in ('pending','failed') or (o.state='sending' and o.locked_at<now()-interval '10 minutes')) and o.attempts<5
 order by o.id for update skip locked limit 25
 ), claimed as (
 update private.email_outbox o set state='sending',attempts=attempts+1,locked_at=now() from candidates c where o.id=c.id returning o.id
 ) select n.id,u.email::text,n.subject,n.body from claimed c join public.notifications n on n.id=c.id join auth.users u on u.id=n.user_id;
end; $$;
create function public.email_preference(p_id uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select case when n.kind='announcement' then p.email_announcements else p.email_events end
 from public.notifications n join public.notification_preferences p on p.user_id=n.user_id where n.id=p_id;
$$;
create function public.finish_email(p_id uuid,p_state text,p_error text default null) returns void language plpgsql security definer set search_path = '' as $$
begin
 if p_state not in ('sent','failed','skipped') then raise exception 'Invalid state'; end if;
 update private.email_outbox set state=p_state,delivered_at=case when p_state='sent' then now() else null end,last_error=p_error where id=p_id and state='sending';
end; $$;
revoke all on function public.run_maintenance(),public.claim_emails(),public.email_preference(uuid),public.finish_email(uuid,text,text) from public,anon,authenticated;
grant execute on function public.run_maintenance(),public.claim_emails(),public.email_preference(uuid),public.finish_email(uuid,text,text) to service_role;
grant all on all tables in schema public,private to service_role;
grant usage on schema private to service_role;
grant usage,select on all sequences in schema public to service_role;
-- New functions default to private unless explicitly granted by a future migration.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema private revoke execute on functions from public;
