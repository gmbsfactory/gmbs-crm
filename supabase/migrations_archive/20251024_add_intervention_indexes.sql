-- Migration: Ajout d'index pour optimiser les requêtes interventions
-- Date: 2024-10-24
-- Description: Index sur les colonnes fréquemment filtrées/triées pour améliorer les performances

-- ============================================
-- EXTENSIONS REQUISES
-- ============================================

-- Activer l'extension pg_trgm pour la recherche texte floue
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- INDEX POUR FILTRES
-- ============================================

-- Index sur statut_id (filtrage par statut)
CREATE INDEX IF NOT EXISTS idx_interventions_statut_id 
ON public.interventions(statut_id) 
WHERE is_active = true;

-- Index sur assigned_user_id (filtrage par utilisateur assigné)
CREATE INDEX IF NOT EXISTS idx_interventions_assigned_user_id 
ON public.interventions(assigned_user_id) 
WHERE is_active = true;

-- Index sur agence_id (filtrage par agence)
CREATE INDEX IF NOT EXISTS idx_interventions_agence_id 
ON public.interventions(agence_id) 
WHERE is_active = true;

-- Index sur metier_id (filtrage par métier)
CREATE INDEX IF NOT EXISTS idx_interventions_metier_id 
ON public.interventions(metier_id) 
WHERE is_active = true;

-- ============================================
-- INDEX POUR TRI
-- ============================================

-- Index sur date (colonne principale pour tri par date d'intervention)
CREATE INDEX IF NOT EXISTS idx_interventions_date 
ON public.interventions(date DESC) 
WHERE is_active = true;

-- Index sur created_at (tri par date de création)
CREATE INDEX IF NOT EXISTS idx_interventions_created_at 
ON public.interventions(created_at DESC) 
WHERE is_active = true;

-- Index sur date_prevue (tri par date prévue)
CREATE INDEX IF NOT EXISTS idx_interventions_date_prevue 
ON public.interventions(date_prevue DESC NULLS LAST) 
WHERE is_active = true;

-- Index sur due_date (tri par date limite)
CREATE INDEX IF NOT EXISTS idx_interventions_due_date 
ON public.interventions(due_date DESC NULLS LAST) 
WHERE is_active = true;

-- ============================================
-- INDEX COMPOSÉS (pour requêtes combinées)
-- ============================================

-- Index composé pour filtrage statut + tri par date
CREATE INDEX IF NOT EXISTS idx_interventions_statut_date 
ON public.interventions(statut_id, date DESC) 
WHERE is_active = true;

-- Index composé pour filtrage user + tri par date
CREATE INDEX IF NOT EXISTS idx_interventions_user_date 
ON public.interventions(assigned_user_id, date DESC) 
WHERE is_active = true;

-- Index composé pour filtrage agence + tri par date
CREATE INDEX IF NOT EXISTS idx_interventions_agence_date 
ON public.interventions(agence_id, date DESC) 
WHERE is_active = true;

-- ============================================
-- INDEX POUR RECHERCHE
-- ============================================

-- Index pour recherche texte sur contexte_intervention
CREATE INDEX IF NOT EXISTS idx_interventions_contexte_trgm 
ON public.interventions 
USING gin (contexte_intervention gin_trgm_ops);

-- Index pour recherche par id_inter
CREATE INDEX IF NOT EXISTS idx_interventions_id_inter 
ON public.interventions(id_inter);

-- Index pour recherche par code postal
CREATE INDEX IF NOT EXISTS idx_interventions_code_postal 
ON public.interventions(code_postal) 
WHERE code_postal IS NOT NULL;

-- Index pour recherche par ville
CREATE INDEX IF NOT EXISTS idx_interventions_ville_trgm 
ON public.interventions 
USING gin (ville gin_trgm_ops);

-- ============================================
-- COMMENTAIRES
-- ============================================

COMMENT ON INDEX idx_interventions_statut_id IS 'Optimise le filtrage par statut';
COMMENT ON INDEX idx_interventions_assigned_user_id IS 'Optimise le filtrage par utilisateur';
COMMENT ON INDEX idx_interventions_agence_id IS 'Optimise le filtrage par agence';
COMMENT ON INDEX idx_interventions_date IS 'Optimise le tri par date d''intervention';
COMMENT ON INDEX idx_interventions_created_at IS 'Optimise le tri par date de création';
COMMENT ON INDEX idx_interventions_statut_date IS 'Optimise les requêtes filtrées par statut et triées par date';

-- ============================================
-- STATISTIQUES
-- ============================================

-- Forcer la mise à jour des statistiques pour l'optimiseur
ANALYZE public.interventions;

-- ============================================
-- ROLLBACK (Documentation)
-- ============================================

-- Pour annuler cette migration :
-- DROP INDEX IF EXISTS idx_interventions_statut_id;
-- DROP INDEX IF EXISTS idx_interventions_assigned_user_id;
-- DROP INDEX IF EXISTS idx_interventions_agence_id;
-- DROP INDEX IF EXISTS idx_interventions_metier_id;
-- DROP INDEX IF EXISTS idx_interventions_date;
-- DROP INDEX IF EXISTS idx_interventions_created_at;
-- DROP INDEX IF EXISTS idx_interventions_date_prevue;
-- DROP INDEX IF EXISTS idx_interventions_due_date;
-- DROP INDEX IF EXISTS idx_interventions_statut_date;
-- DROP INDEX IF EXISTS idx_interventions_user_date;
-- DROP INDEX IF EXISTS idx_interventions_agence_date;
-- DROP INDEX IF EXISTS idx_interventions_contexte_trgm;
-- DROP INDEX IF EXISTS idx_interventions_id_inter;
-- DROP INDEX IF EXISTS idx_interventions_code_postal;
-- DROP INDEX IF EXISTS idx_interventions_ville_trgm;

