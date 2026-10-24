-- READ ONLY. Use SQL Editor in development project gawhbppuhnixqvhnnpnn.
-- No user data, secrets, mutations, scheduling or fixture creation.
begin read only;
with expected(signature,body_md5,anonymous_execute) as (values
 ('public.suggestion_feed()','ebb88f8ef60c2ad984dc9fd7220617fd',true),
 ('public.vote_poll(uuid,uuid)','731119f4a75291faa45d9c3a0e865dae',false)
)
select e.signature,
 p.oid is not null as function_exists,
 coalesce(md5(btrim(regexp_replace(replace(p.prosrc,chr(13),''),'[[:space:]]+',' ','g')))=e.body_md5,false) as migration_body_matches,
 coalesce(p.prosecdef,false) as security_definer,
 coalesce(p.proconfig @> array['search_path=""'],false) as search_path_locked,
 coalesce(has_function_privilege('authenticated',p.oid,'EXECUTE') and
   has_function_privilege('anon',p.oid,'EXECUTE')=e.anonymous_execute,false) as permissions_expected
from expected e left join pg_proc p on p.oid=to_regprocedure(e.signature)
order by e.signature;

select
 (select count(*)=6 and bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname in ('memberships','suggestions','suggestion_votes','polls','poll_options','poll_votes')) as relevant_rls_enabled,
 not has_table_privilege('authenticated','public.memberships','INSERT,UPDATE,DELETE') as no_direct_membership_writes,
 not has_table_privilege('authenticated','public.suggestion_votes','INSERT,UPDATE,DELETE') as no_direct_suggestion_vote_writes,
 not has_table_privilege('authenticated','public.poll_votes','INSERT,UPDATE,DELETE') as no_direct_poll_vote_writes,
 coalesce((select pg_get_expr(polqual,polrelid) like '%suggestion-images%' and
   pg_get_expr(polqual,polrelid) like '%auth.uid()%' and pg_get_expr(polqual,polrelid) like '%private.is_staff()%'
   from pg_policy where polrelid='storage.objects'::regclass and polname='asset_read'),false) as suggestion_listing_owner_check_present;
rollback;
