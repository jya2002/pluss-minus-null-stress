-- Function-only correction. Does not cast votes, change permissions or run jobs.
-- A transaction can begin before closing and wait for the poll's row lock.
-- Check wall-clock time after acquiring that lock, not transaction-start now().
create or replace function public.vote_poll(p_poll uuid,p_option uuid) returns void language plpgsql security definer set search_path = '' as $$
declare p public.polls; begin
 perform private.rate_limit('poll_vote',60);
 select * into p from public.polls where id=p_poll for share;
 if not found or not p.published or clock_timestamp()<p.opens_at or clock_timestamp()>=p.closes_at then raise exception 'Avstemningen er stengt.'; end if;
 if p.audience='members' and not exists(select 1 from public.memberships where user_id=auth.uid() and status='approved') then raise exception 'Kun godkjente medlemmer kan stemme.' using errcode='42501'; end if;
 insert into public.poll_votes(poll_id,user_id,option_id) values(p.id,auth.uid(),p_option);
end; $$;
