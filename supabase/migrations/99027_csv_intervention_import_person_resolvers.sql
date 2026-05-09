-- CSV intervention import : résolution set-based des locataires / propriétaires.
--
-- Remplace les .in() HTTP du worker TS qui déclenchaient HTTP 414 (URI too long)
-- côté Kong/PostgREST (cf. docs/architecture/imports-async.md ADR-2).
-- Les paramètres sont passés en POST body, plus aucune limite d'URL.
--
-- Sécurité : security invoker → la RLS de tenants/owner s'applique
-- exactement comme avec les SELECT directs.

create or replace function public.csv_intervention_import_resolve_tenants(
  p_telephones  text[] default '{}',
  p_telephones2 text[] default '{}',
  p_emails      text[] default '{}',
  p_names       text[] default '{}'
) returns setof public.tenants
language sql
stable
security invoker
set search_path = public
as $$
  select t.*
  from public.tenants t
  where (cardinality(p_telephones)  > 0 and t.telephone        = any(p_telephones))
     or (cardinality(p_telephones2) > 0 and t.telephone2       = any(p_telephones2))
     or (cardinality(p_emails)      > 0 and t.email            = any(p_emails))
     or (cardinality(p_names)       > 0 and t.plain_nom_client = any(p_names));
$$;

create or replace function public.csv_intervention_import_resolve_owners(
  p_telephones  text[] default '{}',
  p_telephones2 text[] default '{}',
  p_emails      text[] default '{}',
  p_names       text[] default '{}'
) returns setof public.owner
language sql
stable
security invoker
set search_path = public
as $$
  select o.*
  from public.owner o
  where (cardinality(p_telephones)  > 0 and o.telephone             = any(p_telephones))
     or (cardinality(p_telephones2) > 0 and o.telephone2            = any(p_telephones2))
     or (cardinality(p_emails)      > 0 and o.email                 = any(p_emails))
     or (cardinality(p_names)       > 0 and o.plain_nom_facturation = any(p_names));
$$;

grant execute on function public.csv_intervention_import_resolve_tenants(text[], text[], text[], text[]) to authenticated;
grant execute on function public.csv_intervention_import_resolve_owners(text[], text[], text[], text[]) to authenticated;
