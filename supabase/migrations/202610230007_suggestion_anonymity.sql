-- Definition-only privacy correction; no records, permissions or jobs change.
-- Personal upload paths begin with the owner's UUID. Never return that path
-- for an anonymously displayed suggestion, including existing suggestions.
-- Anonymous suggestions currently cannot display an image.
create or replace function public.suggestion_feed() returns table(id uuid,title text,description text,category text,preferred_date date,budget_nok integer,image_path text,author_name text,status text,created_at timestamptz,votes bigint,my_vote boolean) language sql stable security definer set search_path = '' as $$
 select s.id,s.title,s.description,s.category,s.preferred_date,s.budget_nok,
 case when s.anonymous then null::text else s.image_path end,
 case when s.anonymous then 'Anonym student' else coalesce(p.display_name,'Tidligere student') end,
 s.status,s.created_at,(select count(*) from public.suggestion_votes v where v.suggestion_id=s.id),
 exists(select 1 from public.suggestion_votes v where v.suggestion_id=s.id and v.user_id=auth.uid())
 from public.suggestions s left join public.profiles p on s.author_id=p.id where not s.hidden;
$$;
