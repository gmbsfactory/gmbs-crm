-- ========================================
-- 99074 : recherche d'intervention par montant
-- ========================================
-- Contexte : le champ de recherche de la liste des interventions repose sur
-- `interventions_search_mv.search_vector` + des replis ILIKE, qui ne portent que
-- sur des colonnes textuelles. Les montants vivent dans `intervention_payments`
-- (acomptes SST / client) et `intervention_costs` (SST, inter, matériel) : ils
-- étaient donc introuvables — saisir « 387,78 » ne remontait rien.
--
-- Choix : ne PAS indexer les montants dans le search_vector. Un montant noyé
-- dans l'index plein-texte rendrait toute recherche numérique très bruyante
-- (« 120 » matcherait des centaines d'interventions). On branche à la place ce
-- RPC dédié, qui fait un filtre EXACT sur le montant, à côté du plein-texte :
-- une saisie à deux décimales (« 387,78 ») le déclenche automatiquement, et
-- l'Edge Function fusionne les deux jeux de résultats.
--
-- La PORTÉE (quelles colonnes de montant interroger) est résolue côté TypeScript
-- dans `src/lib/api/interventions/search-qualifiers.ts` — donc testable
-- unitairement — et transmise ici en simples tableaux. Ce RPC reste volontairement
-- « bête » : il ne connaît aucun libellé métier, seulement des listes de types.
--
-- Fraîcheur : `intervention_payments` et `intervention_costs` sont lus en direct
-- (pas via la MV), pour qu'un montant saisi à l'instant soit immédiatement
-- retrouvable — c'est le cas d'usage principal (rapprochement d'un virement
-- bancaire). La MV ne sert qu'à fournir les colonnes d'affichage, et applique
-- déjà `is_active = true`.

DROP FUNCTION IF EXISTS search_interventions_by_amount(numeric, text[], text[], int, int);

CREATE OR REPLACE FUNCTION search_interventions_by_amount(
  p_amount numeric,
  -- Valeurs de `intervention_payments.payment_type` à interroger.
  -- Tableau vide ou NULL = ne pas interroger les paiements.
  p_payment_types text[] DEFAULT ARRAY['acompte_sst', 'acompte_client'],
  -- Valeurs de `intervention_costs.cost_type` à interroger.
  p_cost_types text[] DEFAULT ARRAY['sst', 'intervention', 'materiel'],
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
-- Forme de retour STRICTEMENT identique à `search_interventions` : l'Edge
-- Function réutilise le même post-traitement (extraction des ids, requête
-- détaillée, réordonnancement) sans branchement supplémentaire.
RETURNS TABLE (
  id uuid,
  id_inter text,
  contexte_intervention text,
  adresse text,
  ville text,
  agence_label text,
  artisan_plain_nom text,
  statut_label text,
  statut_color text,
  date_formatted text,
  rank real
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    isv.id,
    isv.id_inter,
    isv.contexte_intervention,
    isv.adresse,
    isv.ville,
    isv.agence_label,
    isv.artisan_plain_nom,
    isv.statut_label,
    isv.statut_color,
    isv.date_formatted,
    1.0::real AS rank
  FROM interventions_search_mv isv
  WHERE
    EXISTS (
      SELECT 1
      FROM public.intervention_payments p
      WHERE p.intervention_id = isv.id
        AND p.payment_type = ANY(COALESCE(p_payment_types, ARRAY[]::text[]))
        -- `amount` est numeric(12,2) : l'arrondi rend la comparaison robuste à
        -- un p_amount transmis avec davantage de décimales.
        AND round(p.amount, 2) = round(p_amount, 2)
    )
    OR EXISTS (
      SELECT 1
      FROM public.intervention_costs c
      WHERE c.intervention_id = isv.id
        AND c.cost_type = ANY(COALESCE(p_cost_types, ARRAY[]::text[]))
        AND round(c.amount, 2) = round(p_amount, 2)
    )
  ORDER BY isv.date DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

COMMENT ON FUNCTION search_interventions_by_amount IS
  'Recherche d''interventions par montant EXACT, sur les acomptes '
  '(intervention_payments) et/ou les coûts (intervention_costs). La portée est '
  'passée en paramètre : elle est résolue côté TypeScript depuis la saisie '
  'utilisateur (« 387,78 » = tous les montants, « sst:387 » = coût SST seul). '
  'Les montants sont lus en direct (fraîcheur) ; la MV ne fournit que les '
  'colonnes d''affichage et le filtre is_active. Voir migration 99074.';

-- Support du filtre : sans ces index, chaque recherche par montant scanne
-- intégralement les tables de montants.
CREATE INDEX IF NOT EXISTS idx_intervention_payments_amount_lookup
  ON public.intervention_payments (round(amount, 2), payment_type, intervention_id);

CREATE INDEX IF NOT EXISTS idx_intervention_costs_amount_lookup
  ON public.intervention_costs (round(amount, 2), cost_type, intervention_id);

GRANT EXECUTE ON FUNCTION search_interventions_by_amount(numeric, text[], text[], int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION search_interventions_by_amount(numeric, text[], text[], int, int) TO service_role;
