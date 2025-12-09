-- ========================================
-- MIGRATION 00021: Rafraîchissement des vues matérialisées de recherche
-- ========================================
-- Cette migration force le rafraîchissement des vues créées par 00020
-- pour s'assurer qu'elles contiennent les données actuelles.
-- ========================================

-- Note: On n'utilise PAS CONCURRENTLY car c'est le premier refresh
-- après création et les index uniques peuvent ne pas encore être prêts

-- Rafraîchir la vue interventions (doit être faite en premier car global_search_mv en dépend)
REFRESH MATERIALIZED VIEW interventions_search_mv;

-- Rafraîchir la vue artisans (doit être faite en premier car global_search_mv en dépend)
REFRESH MATERIALIZED VIEW artisans_search_mv;

-- Rafraîchir la vue globale (UNION des deux précédentes)
REFRESH MATERIALIZED VIEW global_search_mv;

-- ========================================
-- Vérification : Compter les lignes dans chaque vue
-- ========================================
-- Ces requêtes ne font rien mais servent de documentation/vérification
-- SELECT COUNT(*) as interventions_count FROM interventions_search_mv;
-- SELECT COUNT(*) as artisans_count FROM artisans_search_mv;
-- SELECT COUNT(*) as global_count FROM global_search_mv;

-- ========================================
-- FIN DE LA MIGRATION
-- ========================================

