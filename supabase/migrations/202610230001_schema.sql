-- All dates are instants (timestamptz); the interface renders Europe/Oslo.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
 id uuid primary key references auth.users on delete cascade,
 display_name text not null default 'Student' check (char_length(display_name) between 1 and 80),
 study_programme text check (char_length(study_programme) <= 120),
 study_year integer check (study_year between 1 and 10),
 avatar_path text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_roles (
 user_id uuid primary key references public.profiles on delete cascade,
 role text not null default 'student' check (role in ('student','board','admin'))
);
create function private.is_staff() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.user_roles where user_id = auth.uid() and role in ('board','admin'));
$$;
create function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.user_roles where user_id = auth.uid() and role = 'admin');
$$;
create table public.memberships (
 user_id uuid primary key references public.profiles on delete cascade,
 status text not null default 'pending' check (status in ('pending','approved','rejected','inactive')),
 joined_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.access_groups (id uuid primary key default gen_random_uuid(), name text not null unique check (char_length(name) between 1 and 80));
create table public.group_members (group_id uuid references public.access_groups on delete cascade, user_id uuid references public.profiles on delete cascade, primary key(group_id,user_id));
create table public.event_categories (name text primary key);
insert into public.event_categories values ('Quiz'),('Vors'),('Spillkveld'),('Karaoke'),('Filmkveld'),('Hyttetur'),('Sosialt'),('Faglig-sosialt'),('Andre aktiviteter');
create table public.events (
 id uuid primary key default gen_random_uuid(), title text not null check(char_length(title) between 3 and 160),
 subtitle text not null default '' check(char_length(subtitle)<=240), description text not null default '' check(char_length(description)<=10000),
 starts_at timestamptz not null, ends_at timestamptz not null, location text not null default 'Annonseres snart' check(char_length(location)<=240),
 map_url text check(map_url ~ '^https://'), image_path text,
 category text not null references public.event_categories, capacity integer not null check(capacity between 1 and 10000),
 deadline timestamptz not null, registration_open boolean not null default true, waitlist_enabled boolean not null default true,
 price_nok integer not null default 0 check(price_nok>=0), organizer text not null default 'Pluss Minus Null Stress',
 min_age integer check(min_age between 0 and 100), accessibility text not null default 'Kontakt styret for tilrettelegging.',
 external_url text check(external_url ~ '^https://'), status text not null default 'draft' check(status in ('draft','published','cancelled')),
 registration_mode text not null default 'individual' check(registration_mode in ('individual','team')),
 max_team_size integer not null default 6 check(max_team_size between 1 and 30),
 audience text not null default 'everyone' check(audience in ('everyone','members','groups')),
 alcohol_info text, alcohol_approved boolean not null default false,
 is_demo boolean not null default false, created_by uuid references public.profiles on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(ends_at>starts_at), check(deadline<=starts_at), check(alcohol_info is null or alcohol_approved)
);
create index events_starts_idx on public.events(starts_at);
create table public.event_access_groups (event_id uuid references public.events on delete cascade, group_id uuid references public.access_groups on delete cascade, primary key(event_id,group_id));
create table public.event_teams (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events on delete cascade,
 name text not null check(char_length(name) between 2 and 80), captain_id uuid references public.profiles on delete set null,
 created_at timestamptz not null default now(), unique(event_id,name), unique(id,event_id)
);
create table public.event_registrations (
 id uuid primary key default gen_random_uuid(), event_id uuid not null references public.events on delete cascade,
 user_id uuid not null references public.profiles on delete cascade,
 status text not null check(status in ('confirmed','waitlisted','cancelled')),
 team_id uuid, dietary text check(char_length(dietary)<=500), dietary_consent_at timestamptz, attended boolean not null default false,
 created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default now(),
 unique(event_id,user_id), foreign key(team_id,event_id) references public.event_teams(id,event_id), check(dietary is null or dietary_consent_at is not null)
);
create index registrations_queue_idx on public.event_registrations(event_id,status,created_at,id);
create index registrations_user_idx on public.event_registrations(user_id);
-- Team membership and waitlist order derive from registrations; no duplicated state tables.
create table public.suggestions (
 id uuid primary key default gen_random_uuid(), author_id uuid references public.profiles on delete set null,
 title text not null check(char_length(title) between 3 and 160), description text not null check(char_length(description) between 10 and 3000),
 category text not null references public.event_categories, preferred_date date, budget_nok integer check(budget_nok between 0 and 1000000),
 image_path text, anonymous boolean not null default false,
 status text not null default 'proposed' check(status in ('proposed','reviewing','planned','completed','rejected')),
 hidden boolean not null default false, created_at timestamptz not null default now()
);
create table public.suggestion_votes (
 suggestion_id uuid references public.suggestions on delete cascade, user_id uuid references public.profiles on delete cascade,
 created_at timestamptz not null default now(), primary key(suggestion_id,user_id)
);
create table public.polls (
 id uuid primary key default gen_random_uuid(), question text not null check(char_length(question) between 5 and 200),
 opens_at timestamptz not null, closes_at timestamptz not null, hide_results boolean not null default true,
 audience text not null default 'everyone' check(audience in ('everyone','members')),
 published boolean not null default false, created_at timestamptz not null default now(), check(closes_at>opens_at)
);
create table public.poll_options (
 id uuid primary key default gen_random_uuid(), poll_id uuid not null references public.polls on delete cascade,
 label text not null check(char_length(label) between 1 and 120), unique(id,poll_id), unique(poll_id,label)
);
create table public.poll_votes (
 poll_id uuid references public.polls on delete cascade, user_id uuid references public.profiles on delete cascade,
 option_id uuid not null, created_at timestamptz not null default now(), primary key(poll_id,user_id),
 foreign key(option_id,poll_id) references public.poll_options(id,poll_id) on delete cascade
);
create table public.announcements (
 id uuid primary key default gen_random_uuid(), title text not null check(char_length(title) between 3 and 160),
 body text not null check(char_length(body) between 1 and 5000), published boolean not null default false,
 is_demo boolean not null default false, created_at timestamptz not null default now()
);
create table public.site_settings (
 id boolean primary key default true check(id), about text not null default 'En sosial møteplass for matematikkstudenter ved Universitetet i Oslo.',
 contact_email text not null default '', instagram_url text not null default '', facebook_url text not null default '',
 membership_approval boolean not null default true,
 check(contact_email = '' or contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
 check(instagram_url = '' or instagram_url ~ '^https://'), check(facebook_url = '' or facebook_url ~ '^https://')
);
insert into public.site_settings(id) values(true);
create table public.notification_preferences (
 user_id uuid primary key references public.profiles on delete cascade,
 email_events boolean not null default true, email_announcements boolean not null default false
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles on delete cascade,
 event_id uuid references public.events on delete cascade, kind text not null check(kind in ('registration','promotion','cancellation','update','reminder','announcement')),
 subject text not null, body text not null, read_at timestamptz, created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications(user_id,created_at desc);
create unique index notification_reminder_once on public.notifications(user_id,event_id) where kind='reminder';
create table private.email_outbox (
 id uuid primary key references public.notifications on delete cascade, state text not null default 'pending' check(state in ('pending','sending','sent','failed','skipped')),
 attempts integer not null default 0, locked_at timestamptz, delivered_at timestamptz, last_error text
);
create table public.contact_submissions (
 id uuid primary key default gen_random_uuid(), user_id uuid references public.profiles on delete cascade,
 subject text not null check(char_length(subject) between 3 and 160), message text not null check(char_length(message) between 10 and 4000),
 resolved boolean not null default false, created_at timestamptz not null default now()
);
create table public.audit_logs (
 id bigint generated always as identity primary key, actor_id uuid references public.profiles on delete set null,
 action text not null, entity text not null, entity_id text, created_at timestamptz not null default now()
);
create table private.rate_limits (user_id uuid references public.profiles on delete cascade, action text, bucket timestamptz not null, count integer not null, primary key(user_id,action));

create function private.on_signup() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id) values(new.id);
 insert into public.user_roles(user_id) values(new.id);
 insert into public.notification_preferences(user_id) values(new.id);
 return new;
end; $$;
create trigger on_signup after insert on auth.users for each row execute function private.on_signup();

create function private.touch() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at=now(); return new; end; $$;
create trigger touch_profile before update on public.profiles for each row execute function private.touch();
create trigger touch_event before update on public.events for each row execute function private.touch();
create trigger touch_membership before update on public.memberships for each row execute function private.touch();

-- Explicit table policies; privileged mutations go through checked RPCs.
do $$ declare t text; begin
 foreach t in array array['profiles','user_roles','memberships','access_groups','group_members','event_categories','events','event_access_groups','event_teams','event_registrations','suggestions','suggestion_votes','polls','poll_options','poll_votes','announcements','site_settings','notification_preferences','notifications','contact_submissions','audit_logs'] loop
 execute format('alter table public.%I enable row level security',t);
 end loop;
end $$;
alter table private.email_outbox enable row level security;
alter table private.rate_limits enable row level security;
create policy profile_read on public.profiles for select to authenticated using(id=auth.uid() or private.is_staff());
create policy profile_edit on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy roles_read on public.user_roles for select to authenticated using(user_id=auth.uid() or private.is_admin());
create policy memberships_read on public.memberships for select to authenticated using(user_id=auth.uid() or private.is_staff());
create policy groups_read on public.access_groups for select to authenticated using(private.is_staff());
create policy group_members_read on public.group_members for select to authenticated using(user_id=auth.uid() or private.is_staff());
create policy categories_read on public.event_categories for select using(true);
create policy events_read on public.events for select using(status in ('published','cancelled') or private.is_staff());
create policy events_create on public.events for insert to authenticated with check(private.is_staff() and created_by=auth.uid());
create policy events_edit on public.events for update to authenticated using(private.is_staff()) with check(private.is_staff());
create policy event_groups_read on public.event_access_groups for select to authenticated using(private.is_staff());
create policy teams_staff on public.event_teams for select to authenticated using(private.is_staff());
create policy registrations_read on public.event_registrations for select to authenticated using(user_id=auth.uid() or private.is_staff());
create policy suggestions_private on public.suggestions for select to authenticated using(author_id=auth.uid() or private.is_staff());
create policy suggestion_votes_own on public.suggestion_votes for select to authenticated using(user_id=auth.uid());
create policy polls_read on public.polls for select using(published or private.is_staff());
create policy polls_create on public.polls for insert to authenticated with check(private.is_staff());
create policy polls_edit on public.polls for update to authenticated using(private.is_staff()) with check(private.is_staff());
create policy options_read on public.poll_options for select using(exists(select 1 from public.polls p where p.id=poll_id and (p.published or private.is_staff())));
create policy own_poll_votes on public.poll_votes for select to authenticated using(user_id=auth.uid());
create policy announcements_read on public.announcements for select using(published or private.is_staff());
create policy announcements_staff on public.announcements for all to authenticated using(private.is_staff()) with check(private.is_staff());
create policy settings_read on public.site_settings for select using(true);
create policy settings_edit on public.site_settings for update to authenticated using(private.is_staff()) with check(private.is_staff());
create policy prefs_own on public.notification_preferences for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy notifications_own on public.notifications for select to authenticated using(user_id=auth.uid());
create policy contacts_read on public.contact_submissions for select to authenticated using(user_id=auth.uid() or private.is_staff());
create policy contacts_resolve on public.contact_submissions for update to authenticated using(private.is_staff()) with check(private.is_staff());
create policy audit_staff on public.audit_logs for select to authenticated using(private.is_staff());

revoke all on all tables in schema public from anon, authenticated;
grant select on public.events,public.event_categories,public.polls,public.poll_options,public.announcements,public.site_settings to anon,authenticated;
grant select on public.profiles,public.user_roles,public.memberships,public.access_groups,public.group_members,public.event_access_groups,public.event_teams,public.event_registrations,public.suggestions,public.suggestion_votes,public.poll_votes,public.notification_preferences,public.notifications,public.contact_submissions,public.audit_logs to authenticated;
grant update(display_name,study_programme,study_year,avatar_path) on public.profiles to authenticated;
grant insert,update on public.events,public.polls to authenticated;
grant insert,update,delete on public.announcements to authenticated;
grant update on public.site_settings to authenticated;
grant update(email_events,email_announcements) on public.notification_preferences to authenticated;
grant update(resolved) on public.contact_submissions to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_staff(),private.is_admin() to anon, authenticated;
grant usage on schema private to anon;
