create function private.require_user() returns uuid language plpgsql stable set search_path = '' as $$
begin if auth.uid() is null then raise exception 'Logg inn først.' using errcode='42501'; end if; return auth.uid(); end; $$;
create function private.rate_limit(p_action text,p_limit integer) returns void language plpgsql security definer set search_path = '' as $$
declare n integer; begin
 perform private.require_user();
 insert into private.rate_limits as r(user_id,action,bucket,count) values(auth.uid(),p_action,date_trunc('hour',now()),1)
 on conflict(user_id,action) do update set bucket=excluded.bucket,count=case when r.bucket=excluded.bucket then r.count+1 else 1 end returning count into n;
 if n>p_limit then raise exception 'For mange forsøk. Prøv igjen senere.'; end if;
end; $$;
create function private.eligible(p_event uuid,p_user uuid) returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.events e where e.id=p_event and (
 e.audience='everyone' or (e.audience='members' and exists(select 1 from public.memberships m where m.user_id=p_user and m.status='approved'))
 or (e.audience='groups' and exists(select 1 from public.event_access_groups eg join public.group_members gm using(group_id) where eg.event_id=e.id and gm.user_id=p_user))));
$$;
create function private.notify(p_user uuid,p_event uuid,p_kind text,p_subject text,p_body text) returns void language plpgsql security definer set search_path = '' as $$
declare n uuid; begin
 insert into public.notifications(user_id,event_id,kind,subject,body) values(p_user,p_event,p_kind,p_subject,p_body) on conflict do nothing returning id into n;
 if n is not null then insert into private.email_outbox(id) values(n); end if;
end; $$;
create function private.promote(p_event uuid) returns void language plpgsql security definer set search_path = '' as $$
declare e public.events; r public.event_registrations; places integer; begin
 select * into e from public.events where id=p_event for update;
 if e.status<>'published' or not e.registration_open or e.deadline<now() or e.starts_at<=now() then return; end if;
 select e.capacity-count(*) into places from public.event_registrations where event_id=e.id and status='confirmed';
 for r in select * from public.event_registrations where event_id=e.id and status='waitlisted' order by created_at,id for update loop
 exit when places<=0;
 if not private.eligible(e.id,r.user_id) then continue; end if;
 -- A team slot is checked again during promotion. Full teams become individual entries.
 if r.team_id is not null and (select count(*) from public.event_registrations where team_id=r.team_id and status='confirmed')>=e.max_team_size then
 update public.event_registrations set team_id=null where id=r.id;
 end if;
 update public.event_registrations set status='confirmed',updated_at=now() where id=r.id;
 perform private.notify(r.user_id,e.id,'promotion','Du har fått plass: '||e.title,'Du er flyttet fra ventelisten. Se Min side for oppdatert påmelding.');
 places=places-1;
 end loop;
end; $$;

create function public.register_event(p_event uuid,p_dietary text default '',p_team uuid default null,p_team_name text default null,p_dietary_consent boolean default false) returns text language plpgsql security definer set search_path = '' as $$
declare u uuid; e public.events; n integer; s text; team uuid=p_team; begin
 u=private.require_user(); perform private.rate_limit('register',40);
 select * into e from public.events where id=p_event for update;
 if not found or e.status<>'published' or not e.registration_open or e.starts_at<=now() or now()>e.deadline then raise exception 'Påmeldingen er stengt.'; end if;
 if not private.eligible(e.id,u) then raise exception 'Du har ikke tilgang til dette arrangementet.' using errcode='42501'; end if;
 if exists(select 1 from public.event_registrations where event_id=e.id and user_id=u and status<>'cancelled') then raise exception 'Du er allerede påmeldt.' using errcode='23505'; end if;
 if char_length(p_dietary)>500 then raise exception 'Kosthensyn er for langt.'; end if;
 if nullif(trim(p_dietary),'') is not null and not p_dietary_consent then raise exception 'Bekreft samtykke for å lagre kosthensyn, eller la feltet stå tomt.'; end if;
 if e.registration_mode<>'team' and (p_team is not null or p_team_name is not null) then raise exception 'Arrangementet har individuell påmelding.'; end if;
 if p_team is not null and p_team_name is not null then raise exception 'Velg ett lag.'; end if;
 if p_team_name is not null then
 insert into public.event_teams(event_id,name,captain_id) values(e.id,trim(p_team_name),u) returning id into team;
 end if;
 if team is not null then
 if not exists(select 1 from public.event_teams where id=team and event_id=e.id) then raise exception 'Laget finnes ikke.'; end if;
 if (select count(*) from public.event_registrations where team_id=team and status<>'cancelled')>=e.max_team_size then raise exception 'Laget er fullt.'; end if;
 end if;
 perform private.promote(e.id);
 select count(*) into n from public.event_registrations where event_id=e.id and status='confirmed';
 s=case when n<e.capacity then 'confirmed' else 'waitlisted' end;
 if s='waitlisted' and not e.waitlist_enabled then raise exception 'Arrangementet er fullt.'; end if;
 insert into public.event_registrations(event_id,user_id,status,team_id,dietary,dietary_consent_at) values(e.id,u,s,team,nullif(trim(p_dietary),''),case when nullif(trim(p_dietary),'') is not null and p_dietary_consent then now() else null end)
 on conflict(event_id,user_id) do update set status=excluded.status,team_id=excluded.team_id,dietary=excluded.dietary,dietary_consent_at=excluded.dietary_consent_at,attended=false,created_at=clock_timestamp(),updated_at=now();
 perform private.notify(u,e.id,'registration',case when s='confirmed' then 'Påmeldt: ' else 'På venteliste: ' end||e.title,'Status er lagret. Du kan se og avbestille på Min side.');
 return s;
end; $$;
create function public.cancel_registration(p_event uuid,p_user uuid default null) returns void language plpgsql security definer set search_path = '' as $$
declare u uuid=coalesce(p_user,auth.uid()); e public.events; begin
 perform private.require_user();
 if u<>auth.uid() and not private.is_staff() then raise exception 'Ingen tilgang.' using errcode='42501'; end if;
 select * into e from public.events where id=p_event for update;
 update public.event_registrations set status='cancelled',team_id=null,dietary=null,dietary_consent_at=null,updated_at=now() where event_id=e.id and user_id=u and status<>'cancelled';
 if not found then raise exception 'Ingen aktiv påmelding.'; end if;
 perform private.notify(u,e.id,'cancellation','Avbestilt: '||e.title,'Påmeldingen din er avbestilt.');
 perform private.promote(e.id);
end; $$;

create function public.event_summary(p_event uuid default null) returns table(event_id uuid,confirmed bigint,waitlisted bigint) language sql stable security definer set search_path = '' as $$
 select e.id,count(r.id) filter(where r.status='confirmed'),count(r.id) filter(where r.status='waitlisted')
 from public.events e left join public.event_registrations r on r.event_id=e.id
 where (p_event is null or e.id=p_event) and (e.status in ('published','cancelled') or private.is_staff()) group by e.id;
$$;
create function public.list_teams(p_event uuid) returns table(id uuid,name text,members bigint) language plpgsql stable security definer set search_path = '' as $$
begin
 perform private.require_user();
 if not exists(select 1 from public.events where events.id=p_event and (status='published' or private.is_staff())) then return; end if;
 return query select t.id,t.name,count(r.id) from public.event_teams t left join public.event_registrations r on r.team_id=t.id and r.status<>'cancelled' where t.event_id=p_event group by t.id;
end; $$;
create function private.event_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.capacity<(select count(*) from public.event_registrations where event_id=new.id and status='confirmed') then raise exception 'Kapasiteten kan ikke være lavere enn antall påmeldte.'; end if;
 if exists(select 1 from public.event_registrations where event_id=new.id and status<>'cancelled' and team_id is not null group by team_id having count(*)>new.max_team_size) then raise exception 'Lagstørrelsen er for liten for eksisterende lag.'; end if;
 if new.registration_mode<>'team' and exists(select 1 from public.event_registrations where event_id=new.id and status<>'cancelled' and team_id is not null) then raise exception 'Fjern lagtilordningene før du endrer påmeldingsmodus.'; end if;
 return new;
end; $$;
create trigger event_guard before update on public.events for each row execute function private.event_guard();
create function private.event_changed() returns trigger language plpgsql security definer set search_path = '' as $$
declare r record; begin
 insert into public.audit_logs(actor_id,action,entity,entity_id) values(auth.uid(),TG_OP,'events',new.id::text);
 if TG_OP='UPDATE' then
 if (new.title,new.starts_at,new.ends_at,new.location,new.description,new.status,new.price_nok,new.accessibility,new.deadline) is distinct from (old.title,old.starts_at,old.ends_at,old.location,old.description,old.status,old.price_nok,old.accessibility,old.deadline) then
 for r in select user_id from public.event_registrations where event_id=new.id and status<>'cancelled' loop
 perform private.notify(r.user_id,new.id,case when new.status='cancelled' then 'cancellation' else 'update' end,'Oppdatert: '||new.title,'Arrangementet er endret. Se arrangementssiden før du møter opp.');
 end loop;
 end if;
 if new.capacity>old.capacity or (new.status='published' and old.status<>'published') then perform private.promote(new.id); end if;
 end if;
 return new;
end; $$;
create trigger event_changed after insert or update on public.events for each row execute function private.event_changed();

create function public.submit_suggestion(p_title text,p_description text,p_category text,p_date date default null,p_budget integer default null,p_anonymous boolean default false,p_image text default null) returns uuid language plpgsql security definer set search_path = '' as $$
declare n uuid; begin
 perform private.rate_limit('suggest',8);
 if p_image is not null and p_image not like auth.uid()::text||'/%' then raise exception 'Ugyldig bilde.'; end if;
 insert into public.suggestions(author_id,title,description,category,preferred_date,budget_nok,anonymous,image_path) values(auth.uid(),trim(p_title),trim(p_description),p_category,p_date,p_budget,p_anonymous,p_image) returning id into n; return n;
end; $$;
create function public.suggestion_feed() returns table(id uuid,title text,description text,category text,preferred_date date,budget_nok integer,image_path text,author_name text,status text,created_at timestamptz,votes bigint,my_vote boolean) language sql stable security definer set search_path = '' as $$
 select s.id,s.title,s.description,s.category,s.preferred_date,s.budget_nok,s.image_path,
 case when s.anonymous then 'Anonym student' else coalesce(p.display_name,'Tidligere student') end,
 s.status,s.created_at,(select count(*) from public.suggestion_votes v where v.suggestion_id=s.id),
 exists(select 1 from public.suggestion_votes v where v.suggestion_id=s.id and v.user_id=auth.uid())
 from public.suggestions s left join public.profiles p on s.author_id=p.id where not s.hidden;
$$;
create function public.vote_suggestion(p_suggestion uuid,p_vote boolean) returns void language plpgsql security definer set search_path = '' as $$
begin
 perform private.rate_limit('suggestion_vote',120);
 perform 1 from public.suggestions where id=p_suggestion and not hidden and status in ('proposed','reviewing') for share;
 if not found then raise exception 'Forslaget er stengt for stemmer.'; end if;
 if p_vote then insert into public.suggestion_votes(suggestion_id,user_id) values(p_suggestion,auth.uid()) on conflict do nothing;
 else delete from public.suggestion_votes where suggestion_id=p_suggestion and user_id=auth.uid(); end if;
end; $$;
create function public.moderate_suggestion(p_id uuid,p_status text,p_hidden boolean) returns void language plpgsql security definer set search_path = '' as $$
begin if not private.is_staff() then raise exception 'Ingen tilgang.' using errcode='42501'; end if;
 update public.suggestions set status=p_status,hidden=p_hidden where id=p_id;
 insert into public.audit_logs(actor_id,action,entity,entity_id) values(auth.uid(),'moderate','suggestions',p_id::text);
end; $$;

create function public.vote_poll(p_poll uuid,p_option uuid) returns void language plpgsql security definer set search_path = '' as $$
declare p public.polls; begin
 perform private.rate_limit('poll_vote',60);
 select * into p from public.polls where id=p_poll for share;
 if not found or not p.published or now()<p.opens_at or now()>=p.closes_at then raise exception 'Avstemningen er stengt.'; end if;
 if p.audience='members' and not exists(select 1 from public.memberships where user_id=auth.uid() and status='approved') then raise exception 'Kun godkjente medlemmer kan stemme.' using errcode='42501'; end if;
 insert into public.poll_votes(poll_id,user_id,option_id) values(p.id,auth.uid(),p_option);
end; $$;
create function public.poll_results(p_poll uuid) returns table(option_id uuid,votes bigint) language plpgsql stable security definer set search_path = '' as $$
declare p public.polls; begin
 select * into p from public.polls where id=p_poll;
 if not found or (not p.published and not private.is_staff()) or (p.hide_results and now()<p.closes_at and not private.is_staff()) then return; end if;
 return query select o.id,count(v.user_id) from public.poll_options o left join public.poll_votes v on v.option_id=o.id where o.poll_id=p_poll group by o.id;
end; $$;
create function public.create_poll(p_question text,p_opens timestamptz,p_closes timestamptz,p_options text[],p_hide boolean default true,p_audience text default 'everyone') returns uuid language plpgsql security definer set search_path = '' as $$
declare n uuid; option text; begin
 if not private.is_staff() then raise exception 'Ingen tilgang.' using errcode='42501'; end if;
 if cardinality(p_options) not between 2 and 12 then raise exception 'Velg mellom 2 og 12 alternativer.'; end if;
 insert into public.polls(question,opens_at,closes_at,hide_results,audience,published) values(p_question,p_opens,p_closes,p_hide,p_audience,true) returning id into n;
 foreach option in array p_options loop insert into public.poll_options(poll_id,label) values(n,trim(option)); end loop;
 insert into public.audit_logs(actor_id,action,entity,entity_id) values(auth.uid(),'create','polls',n::text);
 return n;
end; $$;

create function public.apply_membership() returns void language plpgsql security definer set search_path = '' as $$
begin perform private.rate_limit('membership',5);
 if exists(select 1 from public.memberships where user_id=auth.uid() and status in ('pending','approved')) then raise exception 'Du har allerede en søknad eller et medlemskap.'; end if;
 insert into public.memberships(user_id,status) values(auth.uid(),case when (select membership_approval from public.site_settings) then 'pending' else 'approved' end)
 on conflict(user_id) do update set status=excluded.status,joined_at=now();
end; $$;
create function public.manage_member(p_user uuid,p_status text) returns void language plpgsql security definer set search_path = '' as $$
begin if not private.is_staff() then raise exception 'Ingen tilgang.' using errcode='42501'; end if;
 update public.memberships set status=p_status where user_id=p_user;
 insert into public.audit_logs(actor_id,action,entity,entity_id) values(auth.uid(),'membership:'||p_status,'memberships',p_user::text);
end; $$;
create function public.set_role(p_user uuid,p_role text) returns void language plpgsql security definer set search_path = '' as $$
begin
 perform pg_advisory_xact_lock(70667001);
 if not private.is_admin() or p_user=auth.uid() then raise exception 'Kun administrator kan endre andres roller.' using errcode='42501'; end if;
 update public.user_roles set role=p_role where user_id=p_user;
 insert into public.audit_logs(actor_id,action,entity,entity_id) values(auth.uid(),'role:'||p_role,'user_roles',p_user::text);
end; $$;
create function public.manage_group(p_name text,p_user uuid,p_remove boolean default false,p_event uuid default null) returns void language plpgsql security definer set search_path = '' as $$
declare g uuid; begin
 if not private.is_staff() then raise exception 'Ingen tilgang.' using errcode='42501'; end if;
 insert into public.access_groups(name) values(trim(p_name)) on conflict(name) do update set name=excluded.name returning id into g;
 if p_user is not null then
 if p_remove then delete from public.group_members where group_id=g and user_id=p_user;
 else insert into public.group_members values(g,p_user) on conflict do nothing; end if;
 end if;
 if p_event is not null then
 if p_remove then delete from public.event_access_groups where event_id=p_event and group_id=g;
 else insert into public.event_access_groups values(p_event,g) on conflict do nothing; end if;
 end if;
end; $$;
create function public.assign_team(p_registration uuid,p_team uuid) returns void language plpgsql security definer set search_path = '' as $$
declare r public.event_registrations; e public.events; begin
 if not private.is_staff() then raise exception 'Ingen tilgang.' using errcode='42501'; end if;
 select * into r from public.event_registrations where id=p_registration;
 select * into e from public.events where id=r.event_id for update;
 if e.registration_mode<>'team' or r.status='cancelled' then raise exception 'Ugyldig lagtilordning.'; end if;
 if p_team is not null and (not exists(select 1 from public.event_teams where id=p_team and event_id=e.id) or (select count(*) from public.event_registrations where team_id=p_team and status<>'cancelled' and id<>r.id)>=e.max_team_size) then raise exception 'Laget er fullt eller finnes ikke.'; end if;
 update public.event_registrations set team_id=p_team where id=p_registration;
end; $$;
create function public.mark_attendance(p_registration uuid,p_attended boolean) returns void language plpgsql security definer set search_path = '' as $$
begin if not private.is_staff() then raise exception 'Ingen tilgang.' using errcode='42501'; end if;
 update public.event_registrations set attended=p_attended where id=p_registration and status='confirmed'; end; $$;
create function public.send_event_announcement(p_event uuid,p_body text) returns void language plpgsql security definer set search_path = '' as $$
declare r record; t text; begin
 if not private.is_staff() then raise exception 'Ingen tilgang.' using errcode='42501'; end if;
 perform private.rate_limit('event_announcement',10);
 if char_length(p_body) not between 5 and 3000 then raise exception 'Meldingen må ha 5–3000 tegn.'; end if;
 select title into t from public.events where id=p_event;
 for r in select user_id from public.event_registrations where event_id=p_event and status<>'cancelled' loop
 perform private.notify(r.user_id,p_event,'update',t,p_body); end loop;
end; $$;
create function public.submit_contact(p_subject text,p_message text) returns void language plpgsql security definer set search_path = '' as $$
begin perform private.rate_limit('contact',5); insert into public.contact_submissions(user_id,subject,message) values(auth.uid(),p_subject,p_message); end; $$;
create function public.read_notification(p_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin perform private.require_user(); update public.notifications set read_at=now() where id=p_id and user_id=auth.uid(); end; $$;
create function public.export_my_data() returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare u uuid=private.require_user(); result jsonb; piece jsonb; t text; begin
 result=jsonb_build_object('email',(select email from auth.users where id=u),'profile',(select to_jsonb(p) from public.profiles p where id=u),'role',(select to_jsonb(r) from public.user_roles r where user_id=u));
 foreach t in array array['memberships','event_registrations','suggestion_votes','poll_votes','notifications','notification_preferences','contact_submissions','group_members'] loop
 execute format('select coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from public.%I x where user_id=$1',t) into piece using u;
 result=jsonb_set(result,array[t],piece);
 end loop;
 result=result||jsonb_build_object('suggestions',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.suggestions s where author_id=u),'teams',(select coalesce(jsonb_agg(to_jsonb(et)),'[]') from public.event_teams et where captain_id=u),'audit_logs',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from public.audit_logs a where actor_id=u));
 return result;
end; $$;

-- Delete cascades also release capacity; serialize against registration transactions.
create function private.before_profile_delete() returns trigger language plpgsql security definer set search_path = '' as $$
declare e record; begin
 perform pg_advisory_xact_lock(70667001);
 if exists(select 1 from public.user_roles where user_id=old.id and role='admin') and (select count(*) from public.user_roles where role='admin')<=1 then raise exception 'Overfør administratorrollen før kontoen slettes.'; end if;
 for e in select event_id from public.event_registrations where user_id=old.id and status<>'cancelled' order by event_id loop
 perform 1 from public.events where id=e.event_id for update;
 delete from public.event_registrations where event_id=e.event_id and user_id=old.id;
 perform private.promote(e.event_id);
 end loop;
 return old;
end; $$;
create trigger before_profile_delete before delete on public.profiles for each row execute function private.before_profile_delete();

revoke all on all functions in schema public from public,anon,authenticated;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.is_staff(),private.is_admin() to anon,authenticated;
grant execute on function public.event_summary(uuid),public.suggestion_feed(),public.poll_results(uuid) to anon,authenticated;
grant execute on function public.register_event(uuid,text,uuid,text,boolean), public.cancel_registration(uuid,uuid),public.list_teams(uuid), public.submit_suggestion(text,text,text,date,integer,boolean,text),public.vote_suggestion(uuid,boolean),public.moderate_suggestion(uuid,text,boolean),public.vote_poll(uuid,uuid),public.create_poll(text,timestamptz,timestamptz,text[],boolean,text),public.apply_membership(),public.manage_member(uuid,text),public.set_role(uuid,text),public.manage_group(text,uuid,boolean,uuid),public.assign_team(uuid,uuid),public.mark_attendance(uuid,boolean),public.send_event_announcement(uuid,text),public.submit_contact(text,text),public.read_notification(uuid),public.export_my_data() to authenticated;
