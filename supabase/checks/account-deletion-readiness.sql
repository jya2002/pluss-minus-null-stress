-- READ ONLY: run in SQL Editor in development project gawhbppuhnixqvhnnpnn.
-- Returns metadata/booleans only. No user rows, secrets, cron or mutations.
begin read only;
with expected(signature,body_md5,authenticated_execute) as (values
 ('public.prepare_account_deletion()','c9d474d3d8d09ea49fc8f0ee8c8c84ed',true),
 ('private.before_profile_delete()','4873b39b8fe011d50ec708e3bc236fe5',false),
 ('public.set_role(uuid,text)','e7175251bd10013aff744600bd75fa75',true)
)
select e.signature,
 p.oid is not null as function_exists,
 coalesce(md5(btrim(regexp_replace(replace(p.prosrc,chr(13),''),'[[:space:]]+',' ','g')))=e.body_md5,false) as reviewed_guard_matches,
 coalesce(p.prosecdef,false) as security_definer,
 coalesce(p.proconfig @> array['search_path=""'],false) as search_path_locked,
 coalesce(not has_function_privilege('anon',p.oid,'EXECUTE') and
  has_function_privilege('authenticated',p.oid,'EXECUTE')=e.authenticated_execute,false) as permissions_expected
from expected e left join pg_proc p on p.oid=to_regprocedure(e.signature)
order by e.signature;

select
 exists(select 1 from pg_trigger where tgrelid='public.profiles'::regclass and tgname='before_profile_delete'
  and tgfoid=to_regprocedure('private.before_profile_delete()') and tgenabled in ('O','A')) as delete_guard_trigger_enabled,
 exists(select 1 from pg_constraint where conrelid='public.profiles'::regclass and confrelid='auth.users'::regclass and contype='f' and confdeltype='c') as auth_profile_cascade,
 exists(select 1 from pg_constraint where conrelid='private.email_outbox'::regclass and confrelid='public.notifications'::regclass and contype='f' and confdeltype='c') as outbox_cascade,
 not has_table_privilege('authenticated','public.profiles','DELETE') as students_cannot_delete_profiles_directly,
 not has_table_privilege('authenticated','public.user_roles','INSERT,UPDATE,DELETE') as students_cannot_change_roles_directly,
 (select count(*)=2 and bool_and(public and file_size_limit=4194304) from storage.buckets where id in ('avatars','suggestion-images')) as personal_buckets_expected;
rollback;
