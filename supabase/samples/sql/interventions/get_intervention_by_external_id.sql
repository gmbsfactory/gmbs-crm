-- Requête SQL pour récupérer les données complètes d'une intervention
-- Paramètre: intervention_id_inter (ID externe de l'intervention - texte)

-- Version avec sous-requêtes (plus lisible)
SELECT 
    -- Informations de base de l'intervention
    i.id as intervention_id,
    i.id_inter as intervention_external_id,
    i.date as intervention_date,
    i.adresse as intervention_adresse,
    i.ville as intervention_ville,
    i.code_postal as intervention_code_postal,
    i.contexte_intervention,
    i.consigne_intervention,
    
    -- Statut de l'intervention
    ist.label as statut_nom,
    ist.color as statut_color,
    
    -- Métier
    m.label as metier_nom,
    
    -- Gestionnaire assigné
    u.first_name as gestionnaire_prenom,
    u.last_name as gestionnaire_nom,
    CONCAT(u.first_name, ' ', u.last_name) as gestionnaire_nom_complet,
    u.email as gestionnaire_email,
    
    -- Artisan principal (SST)
    a.prenom as artisan_prenom,
    a.nom as artisan_nom,
    a.plain_nom as artisan_plain_nom,
    a.email as artisan_email,
    a.telephone as artisan_telephone,
    
    -- Statut de l'artisan
    ast.label as artisan_statut_nom,
    ast.color as artisan_statut_color,
    
    -- Coûts de l'intervention
    (
        SELECT SUM(ic.amount) 
        FROM intervention_costs ic 
        WHERE ic.intervention_id = i.id 
        AND ic.cost_type = 'marge'
    ) as cout_total,
    
    (
        SELECT ic.amount 
        FROM intervention_costs ic 
        WHERE ic.intervention_id = i.id 
        AND ic.cost_type = 'sst'
        LIMIT 1
    ) as cout_sst,
    
    (
        SELECT ic.amount 
        FROM intervention_costs ic 
        WHERE ic.intervention_id = i.id 
        AND ic.cost_type = 'materiel'
        LIMIT 1
    ) as cout_materiel,
    
    (
        SELECT ic.amount 
        FROM intervention_costs ic 
        WHERE ic.intervention_id = i.id 
        AND ic.cost_type = 'intervention'
        LIMIT 1
    ) as cout_intervention,
    
    -- Informations du locataire (tenant)
    t.firstname as tenant_prenom,
    t.lastname as tenant_nom,
    CONCAT(t.firstname, ' ', t.lastname) as tenant_nom_complet,
    t.email as tenant_email,
    t.telephone as tenant_telephone,
    
    -- Informations du propriétaire (owner)
    o.owner_firstname as owner_prenom,
    o.owner_lastname as owner_nom,
    CONCAT(o.owner_firstname, ' ', o.owner_lastname) as owner_nom_complet,
    o.email as owner_email,
    o.telephone as owner_telephone,
    
    -- Agence
    ag.label as agence_nom,
    
    -- Timestamps
    i.created_at as intervention_created_at,
    i.updated_at as intervention_updated_at

FROM interventions i
    -- Jointures pour les données de référence
    LEFT JOIN intervention_statuses ist ON i.statut_id = ist.id
    LEFT JOIN metiers m ON i.metier_id = m.id
    LEFT JOIN users u ON i.assigned_user_id = u.id
    LEFT JOIN agencies ag ON i.agence_id = ag.id
    LEFT JOIN tenants t ON i.tenant_id = t.id
    LEFT JOIN owner o ON i.owner_id = o.id
    
    -- Jointure pour l'artisan principal (SST)
    LEFT JOIN intervention_artisans ia ON i.id = ia.intervention_id AND ia.is_primary = true
    LEFT JOIN artisans a ON ia.artisan_id = a.id
    LEFT JOIN artisan_statuses ast ON a.statut_id = ast.id

WHERE i.id_inter = $1::text  -- Paramètre: ID externe de l'intervention (texte)
  AND i.is_active = true;

-- ========================================
-- VERSION ALTERNATIVE avec CTE (Common Table Expression)
-- Plus performante pour les requêtes complexes
-- ========================================

WITH intervention_data AS (
    SELECT 
        i.id,
        i.id_inter,
        i.date,
        i.adresse,
        i.ville,
        i.code_postal,
        i.contexte_intervention,
        i.consigne_intervention,
        i.statut_id,
        i.metier_id,
        i.assigned_user_id,
        i.agence_id,
        i.tenant_id,
        i.owner_id,
        i.created_at,
        i.updated_at
    FROM interventions i
    WHERE i.id_inter = $1::text AND i.is_active = true
),
costs_summary AS (
    SELECT 
        intervention_id,
        SUM(CASE WHEN cost_type = 'marge' THEN amount ELSE 0 END) as cout_total,
        SUM(CASE WHEN cost_type = 'sst' THEN amount ELSE 0 END) as cout_sst,
        SUM(CASE WHEN cost_type = 'materiel' THEN amount ELSE 0 END) as cout_materiel,
        SUM(CASE WHEN cost_type = 'intervention' THEN amount ELSE 0 END) as cout_intervention
    FROM intervention_costs
    WHERE intervention_id IN (SELECT id FROM intervention_data)
    GROUP BY intervention_id
)
SELECT 
    -- Informations de base
    id.id as intervention_id,
    id.id_inter as intervention_external_id,
    id.date as intervention_date,
    id.adresse as intervention_adresse,
    id.ville as intervention_ville,
    id.code_postal as intervention_code_postal,
    id.contexte_intervention,
    id.consigne_intervention,
    
    -- Statut
    ist.label as statut_nom,
    ist.color as statut_color,
    
    -- Métier
    m.label as metier_nom,
    
    -- Gestionnaire
    u.first_name as gestionnaire_prenom,
    u.last_name as gestionnaire_nom,
    CONCAT(u.first_name, ' ', u.last_name) as gestionnaire_nom_complet,
    u.email as gestionnaire_email,
    
    -- Artisan principal
    a.prenom as artisan_prenom,
    a.nom as artisan_nom,
    a.plain_nom as artisan_plain_nom,
    a.email as artisan_email,
    a.telephone as artisan_telephone,
    
    -- Statut artisan
    ast.label as artisan_statut_nom,
    ast.color as artisan_statut_color,
    
    -- Coûts
    COALESCE(cs.cout_total, 0) as cout_total,
    COALESCE(cs.cout_sst, 0) as cout_sst,
    COALESCE(cs.cout_materiel, 0) as cout_materiel,
    COALESCE(cs.cout_intervention, 0) as cout_intervention,
    
    -- Locataire
    t.firstname as tenant_prenom,
    t.lastname as tenant_nom,
    CONCAT(t.firstname, ' ', t.lastname) as tenant_nom_complet,
    t.email as tenant_email,
    t.telephone as tenant_telephone,
    
    -- Propriétaire
    o.owner_firstname as owner_prenom,
    o.owner_lastname as owner_nom,
    CONCAT(o.owner_firstname, ' ', o.owner_lastname) as owner_nom_complet,
    o.email as owner_email,
    o.telephone as owner_telephone,
    
    -- Agence
    ag.label as agence_nom,
    
    -- Timestamps
    id.created_at as intervention_created_at,
    id.updated_at as intervention_updated_at

FROM intervention_data id
    LEFT JOIN intervention_statuses ist ON id.statut_id = ist.id
    LEFT JOIN metiers m ON id.metier_id = m.id
    LEFT JOIN users u ON id.assigned_user_id = u.id
    LEFT JOIN agencies ag ON id.agence_id = ag.id
    LEFT JOIN tenants t ON id.tenant_id = t.id
    LEFT JOIN owner o ON id.owner_id = o.id
    LEFT JOIN intervention_artisans ia ON id.id = ia.intervention_id AND ia.is_primary = true
    LEFT JOIN artisans a ON ia.artisan_id = a.id
    LEFT JOIN artisan_statuses ast ON a.statut_id = ast.id
    LEFT JOIN costs_summary cs ON id.id = cs.intervention_id;

-- ========================================
-- VERSION SIMPLIFIÉE (juste les données demandées)
-- ========================================

SELECT 
    a.plain_nom as artisan_plain_nom,
    COALESCE(SUM(ic.amount), 0) as cout_intervention,
    ist.label as statut_nom,
    CONCAT(u.first_name, ' ', u.last_name) as gestionnaire_nom
FROM interventions i
    LEFT JOIN intervention_artisans ia ON i.id = ia.intervention_id AND ia.is_primary = true
    LEFT JOIN artisans a ON ia.artisan_id = a.id
    LEFT JOIN intervention_costs ic ON i.id = ic.intervention_id
    LEFT JOIN intervention_statuses ist ON i.statut_id = ist.id
    LEFT JOIN users u ON i.assigned_user_id = u.id
WHERE i.id_inter = $1::text AND i.is_active = true
GROUP BY a.plain_nom, ist.label, u.first_name, u.last_name;

-- ========================================
-- EXEMPLES D'UTILISATION
-- ========================================

-- Exemple 1: Recherche par ID externe (texte)
-- SELECT * FROM interventions WHERE id_inter = '4281';

-- Exemple 2: Utiliser la requête simplifiée avec un paramètre
-- SELECT artisan_plain_nom, cout_intervention, statut_nom, gestionnaire_nom
-- FROM (
--     SELECT 
--         a.plain_nom as artisan_plain_nom,
--         COALESCE(SUM(ic.amount), 0) as cout_intervention,
--         ist.label as statut_nom,
--         CONCAT(u.first_name, ' ', u.last_name) as gestionnaire_nom
--     FROM interventions i
--         LEFT JOIN intervention_artisans ia ON i.id = ia.intervention_id AND ia.is_primary = true
--         LEFT JOIN artisans a ON ia.artisan_id = a.id
--         LEFT JOIN intervention_costs ic ON i.id = ic.intervention_id
--         LEFT JOIN intervention_statuses ist ON i.statut_id = ist.id
--         LEFT JOIN users u ON i.assigned_user_id = u.id
--     WHERE i.id_inter = '4281' AND i.is_active = true
--     GROUP BY a.plain_nom, ist.label, u.first_name, u.last_name
-- ) as result;

-- Exemple 3: Recherche directe avec valeur fixe (pour test)
SELECT 
    a.plain_nom as artisan_plain_nom,
    COALESCE(SUM(ic.amount), 0) as cout_intervention,
    ist.label as statut_nom,
    CONCAT(u.first_name, ' ', u.last_name) as gestionnaire_nom
FROM interventions i
    LEFT JOIN intervention_artisans ia ON i.id = ia.intervention_id AND ia.is_primary = true
    LEFT JOIN artisans a ON ia.artisan_id = a.id
    LEFT JOIN intervention_costs ic ON i.id = ic.intervention_id
    LEFT JOIN intervention_statuses ist ON i.statut_id = ist.id
    LEFT JOIN users u ON i.assigned_user_id = u.id
WHERE i.id_inter = '4281' AND i.is_active = true
GROUP BY a.plain_nom, ist.label, u.first_name, u.last_name;
