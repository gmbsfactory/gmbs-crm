-- Migration : Optimisation des jointures interventions (6 novembre 2025)
-- Objectif : Réduire le temps de chargement de 2.2s à ~500ms

-- ============================================
-- INDEX POUR JOINTURES ARTISANS
-- ============================================

-- Index sur intervention_artisans.intervention_id (jointure principale)
CREATE INDEX IF NOT EXISTS idx_intervention_artisans_intervention_id 
ON intervention_artisans(intervention_id);

-- Index composite pour récupérer l'artisan principal rapidement
CREATE INDEX IF NOT EXISTS idx_intervention_artisans_intervention_primary 
ON intervention_artisans(intervention_id, is_primary) 
WHERE is_primary = true;

-- Index sur artisan_id pour la jointure avec artisans
CREATE INDEX IF NOT EXISTS idx_intervention_artisans_artisan_id 
ON intervention_artisans(artisan_id);

-- ============================================
-- INDEX POUR JOINTURES COÛTS
-- ============================================

-- Index sur intervention_costs.intervention_id (jointure principale)
CREATE INDEX IF NOT EXISTS idx_intervention_costs_intervention_id 
ON intervention_costs(intervention_id);

-- Index composite pour récupérer les coûts par type rapidement
CREATE INDEX IF NOT EXISTS idx_intervention_costs_intervention_type 
ON intervention_costs(intervention_id, cost_type);

-- ============================================
-- INDEX POUR FILTRES FRÉQUENTS
-- ============================================

-- Index sur interventions.date (tri par défaut DESC)
CREATE INDEX IF NOT EXISTS idx_interventions_date_desc 
ON interventions(date DESC, id DESC) 
WHERE is_active = true;

-- Index sur interventions.statut_id (filtre fréquent)
CREATE INDEX IF NOT EXISTS idx_interventions_statut_active 
ON interventions(statut_id, date DESC) 
WHERE is_active = true;

-- Index sur interventions.assigned_user_id (filtre fréquent)
CREATE INDEX IF NOT EXISTS idx_interventions_assigned_user_active 
ON interventions(assigned_user_id, date DESC) 
WHERE is_active = true;

-- Index sur interventions.agence_id (filtre fréquent)
CREATE INDEX IF NOT EXISTS idx_interventions_agence_active 
ON interventions(agence_id, date DESC) 
WHERE is_active = true;

-- Index sur interventions.metier_id (filtre fréquent)
CREATE INDEX IF NOT EXISTS idx_interventions_metier_active 
ON interventions(metier_id, date DESC) 
WHERE is_active = true;

-- ============================================
-- INDEX POUR RECHERCHE FULL-TEXT
-- ============================================

-- Index GIN pour recherche rapide sur texte (désactivé temporairement - nécessite vérification des noms de colonnes)
-- CREATE INDEX IF NOT EXISTS idx_interventions_search_text 
-- ON interventions USING gin(
--   to_tsvector('french', 
--     coalesce(client_nom, '') || ' ' || 
--     coalesce(client_prenom, '') || ' ' || 
--     coalesce(adresse, '') || ' ' ||
--     coalesce(ville, '')
--   )
-- ) WHERE is_active = true;

-- ============================================
-- VACUUM ET ANALYZE
-- ============================================

-- Mettre à jour les statistiques pour l'optimiseur de requêtes
ANALYZE interventions;
ANALYZE intervention_artisans;
ANALYZE intervention_costs;

-- Commentaires pour documentation
COMMENT ON INDEX idx_intervention_artisans_intervention_id IS 
  'Optimise la jointure intervention_artisans → interventions (load-all)';

COMMENT ON INDEX idx_intervention_costs_intervention_id IS 
  'Optimise la jointure intervention_costs → interventions (load-all)';

COMMENT ON INDEX idx_interventions_date_desc IS 
  'Optimise le tri par défaut (date DESC, id DESC) avec filtre is_active';

-- COMMENT ON INDEX idx_interventions_search_text IS 
--   'Optimise la recherche full-text sur client/adresse (GIN index)';

