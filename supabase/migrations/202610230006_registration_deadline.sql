-- Non-destructive function correction. Does not execute registrations, send
-- email, change permissions, or activate scheduled jobs. Apply separately to
-- existing projects; never rerun the initial setup.
-- now() is fixed at transaction start. A request may wait for an event row lock
-- across the deadline, so eligibility must use wall-clock time after the lock.
create or replace function private.promote(p_event uuid) returns void language plpgsql security definer set search_path = '' as $$
declare e public.events; r public.event_registrations; places integer; begin
 select * into e from public.events where id=p_event for update;
 if e.status<>'published' or not e.registration_open or e.deadline<=clock_timestamp() or e.starts_at<=clock_timestamp() then return; end if;
 select e.capacity-count(*) into places from public.event_registrations where event_id=e.id and status='confirmed';
 for r in select * from public.event_registrations where event_id=e.id and status='waitlisted' order by created_at,id for update loop
 exit when places<=0;
 if not private.eligible(e.id,r.user_id) then continue; end if;
 if r.team_id is not null and (select count(*) from public.event_registrations where team_id=r.team_id and status='confirmed')>=e.max_team_size then
 update public.event_registrations set team_id=null where id=r.id;
 end if;
 update public.event_registrations set status='confirmed',updated_at=now() where id=r.id;
 perform private.notify(r.user_id,e.id,'promotion','Du har fått plass: '||e.title,'Du er flyttet fra ventelisten. Se Min side for oppdatert påmelding.');
 places=places-1;
 end loop;
end; $$;

create or replace function public.register_event(p_event uuid,p_dietary text default '',p_team uuid default null,p_team_name text default null,p_dietary_consent boolean default false) returns text language plpgsql security definer set search_path = '' as $$
declare u uuid; e public.events; n integer; s text; team uuid=p_team; begin
 u=private.require_user(); perform private.rate_limit('register',40);
 select * into e from public.events where id=p_event for update;
 if not found or e.status<>'published' or not e.registration_open or e.starts_at<=clock_timestamp() or clock_timestamp()>=e.deadline then raise exception 'Påmeldingen er stengt.'; end if;
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
