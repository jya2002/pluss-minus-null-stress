-- Definition/grants only. Does not delete any event or Storage object.
-- Existing projects must apply this separately after approval.
create function public.delete_draft_event(p_event uuid, p_title text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.require_user();
  target public.events;
begin
  -- Hold the caller's real role until commit; user metadata is never trusted.
  perform 1 from public.user_roles
    where user_id = actor and role = 'admin' for share;
  if not found then
    raise exception 'Bare administratorer kan slette arrangementer.' using errcode = '42501';
  end if;

  -- Registration/publication updates and FK inserts serialize with this lock.
  -- All dependency checks run after acquiring it, in the same transaction.
  select * into target from public.events where id = p_event for update;
  if not found then
    raise exception 'Arrangementet finnes ikke. Last oversikten på nytt.' using errcode = 'P0002';
  end if;
  if target.status <> 'draft' then
    raise exception 'Bare upubliserte utkast kan slettes. Bruk avlysning eller endre publiseringsstatus først.' using errcode = '22023';
  end if;
  if p_title is distinct from target.title then
    raise exception 'Skriv arrangementets eksakte tittel. Tittelen kan ha blitt endret.' using errcode = '22023';
  end if;
  -- Never rely on ON DELETE CASCADE to silently remove participant/history data.
  -- Include cancelled registrations, empty teams and configured group links.
  -- Audit rows have a text entity_id, are deliberately retained, and do not
  -- prevent deletion. Future event FKs must be added to these checks and tests.
  if exists(select 1 from public.event_registrations where event_id = target.id)
    or exists(select 1 from public.event_teams where event_id = target.id)
    or exists(select 1 from public.notifications where event_id = target.id)
    or exists(select 1 from public.event_access_groups where event_id = target.id)
  then
    raise exception 'Utkastet har påmeldinger, lag, varsler eller gruppetilknytninger og kan ikke slettes. Behold historikken og bruk avlysning ved behov.' using errcode = '23503';
  end if;

  insert into public.audit_logs(actor_id, action, entity, entity_id)
    values(actor, 'DELETE', 'events', target.id::text);
  delete from public.events where id = target.id;
  if not found then
    raise exception 'Slettingen kunne ikke fullføres. Last oversikten på nytt.' using errcode = '40001';
  end if;
  -- No Storage deletion: image_path may also be used by a duplicated event.
  return target.id;
end;
$$;

revoke all on function public.delete_draft_event(uuid,text) from public,anon,authenticated;
grant execute on function public.delete_draft_event(uuid,text) to authenticated;
-- No event DELETE grant or DELETE RLS policy is introduced.
