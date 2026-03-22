-- Migration: RPC get_public_tables
-- Utilisée par le script de livraison deliver-prod.js pour valider
-- la couverture des tables avant cleanup/import.

CREATE OR REPLACE FUNCTION public.get_public_tables()
RETURNS TABLE(table_name text)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT t.table_name::text
  FROM information_schema.tables t
  WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
  ORDER BY t.table_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_tables() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_public_tables() TO authenticated;
