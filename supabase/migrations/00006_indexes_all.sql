-- ========================================
-- All Indexes Consolidated
-- ========================================

-- ========================================
-- USERS INDEXES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_code_gestionnaire ON public.users(code_gestionnaire);
CREATE INDEX IF NOT EXISTS idx_users_email_smtp ON public.users(email_smtp_user) WHERE email_smtp_user IS NOT NULL;

-- ========================================
-- ARTISANS INDEXES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_artisans_gestionnaire_id ON public.artisans(gestionnaire_id);
CREATE INDEX IF NOT EXISTS idx_artisans_email ON public.artisans(email);
CREATE INDEX IF NOT EXISTS idx_artisans_statut_id ON public.artisans(statut_id);
CREATE INDEX IF NOT EXISTS idx_artisans_is_active ON public.artisans(is_active);

-- ========================================
-- INTERVENTIONS INDEXES - Basic
-- ========================================

CREATE INDEX IF NOT EXISTS idx_interventions_id_inter ON public.interventions(id_inter);
CREATE INDEX IF NOT EXISTS idx_interventions_agence_id ON public.interventions(agence_id);
CREATE INDEX IF NOT EXISTS idx_interventions_tenant_id ON public.interventions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_interventions_owner_id ON public.interventions(owner_id);
CREATE INDEX IF NOT EXISTS idx_interventions_assigned_user_id ON public.interventions(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_interventions_statut_id ON public.interventions(statut_id);
CREATE INDEX IF NOT EXISTS idx_interventions_metier_id ON public.interventions(metier_id);
CREATE INDEX IF NOT EXISTS idx_interventions_date ON public.interventions(date);
CREATE INDEX IF NOT EXISTS idx_interventions_is_active ON public.interventions(is_active);
CREATE INDEX IF NOT EXISTS idx_interventions_updated_by ON public.interventions(updated_by);
CREATE INDEX IF NOT EXISTS idx_interventions_reference_agence ON public.interventions(reference_agence);
CREATE INDEX IF NOT EXISTS idx_interventions_location ON public.interventions(latitude, longitude) 
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ========================================
-- INTERVENTIONS INDEXES - Filtered (Performance)
-- ========================================

CREATE INDEX IF NOT EXISTS idx_interventions_statut_active 
ON public.interventions(statut_id, date DESC) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_interventions_assigned_user_active 
ON public.interventions(assigned_user_id, date DESC) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_interventions_agence_active 
ON public.interventions(agence_id, date DESC) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_interventions_metier_active 
ON public.interventions(metier_id, date DESC) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_interventions_date_desc 
ON public.interventions(date DESC, id DESC) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_interventions_created_at 
ON public.interventions(created_at DESC) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_interventions_date_prevue 
ON public.interventions(date_prevue DESC NULLS LAST) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_interventions_due_date 
ON public.interventions(due_date DESC NULLS LAST) 
WHERE is_active = true;

-- ========================================
-- INTERVENTIONS INDEXES - Composite
-- ========================================

CREATE INDEX IF NOT EXISTS idx_interventions_statut_date 
ON public.interventions(statut_id, date DESC) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_interventions_user_date 
ON public.interventions(assigned_user_id, date DESC) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_interventions_agence_date 
ON public.interventions(agence_id, date DESC) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_interventions_date_id_desc
ON public.interventions(date DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_interventions_assigned_status_date_id_desc
ON public.interventions(assigned_user_id, statut_id, date DESC, id DESC);

-- ========================================
-- INTERVENTIONS INDEXES - Full Text Search
-- ========================================

CREATE INDEX IF NOT EXISTS idx_interventions_contexte_trgm 
ON public.interventions 
USING gin (contexte_intervention gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_interventions_code_postal 
ON public.interventions(code_postal) 
WHERE code_postal IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_interventions_ville_trgm 
ON public.interventions 
USING gin (ville gin_trgm_ops);

-- ========================================
-- INTERVENTION_ARTISANS INDEXES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_intervention_artisans_intervention_id 
ON public.intervention_artisans(intervention_id);

CREATE INDEX IF NOT EXISTS idx_intervention_artisans_intervention_primary 
ON public.intervention_artisans(intervention_id, is_primary) 
WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS idx_intervention_artisans_artisan_id 
ON public.intervention_artisans(artisan_id);

-- ========================================
-- INTERVENTION_COSTS INDEXES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_intervention_costs_intervention_id 
ON public.intervention_costs(intervention_id);

CREATE INDEX IF NOT EXISTS idx_intervention_costs_intervention_type 
ON public.intervention_costs(intervention_id, cost_type);

-- ========================================
-- TASKS INDEXES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_tasks_creator_id ON public.tasks(creator_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status_id ON public.tasks(status_id);
CREATE INDEX IF NOT EXISTS idx_tasks_intervention_id ON public.tasks(intervention_id);
CREATE INDEX IF NOT EXISTS idx_tasks_artisan_id ON public.tasks(artisan_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);

-- ========================================
-- COMMENTS INDEXES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_comments_entity ON public.comments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_comments_author_id ON public.comments(author_id);

-- ========================================
-- BILLING INDEXES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_orders_status_created ON public.orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_user_created ON public.usage_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created ON public.chat_messages(session_id, created_at);

-- ========================================
-- ANALYZE TABLES
-- ========================================

ANALYZE public.interventions;
ANALYZE public.intervention_artisans;
ANALYZE public.intervention_costs;
ANALYZE public.artisans;

-- ========================================
-- INDEX COMMENTS
-- ========================================

COMMENT ON INDEX idx_interventions_statut_active IS 'Optimise le filtrage par statut avec is_active';
COMMENT ON INDEX idx_interventions_assigned_user_active IS 'Optimise le filtrage par utilisateur avec is_active';
COMMENT ON INDEX idx_interventions_agence_active IS 'Optimise le filtrage par agence avec is_active';
COMMENT ON INDEX idx_interventions_date_desc IS 'Optimise le tri par date DESC avec is_active';
COMMENT ON INDEX idx_intervention_artisans_intervention_id IS 'Optimise la jointure intervention_artisans → interventions';
COMMENT ON INDEX idx_intervention_costs_intervention_id IS 'Optimise la jointure intervention_costs → interventions';

