# Documentation des Formules - Admin Dashboard

Ce document présente l'ensemble des formules et calculs utilisés dans le tableau de bord administrateur. Chaque section détaille les indicateurs clés de performance (KPI) avec leur méthode de calcul et le code SQL associé.

---

## Table des matières

1. [KPIs Principaux](#1-kpis-principaux)
2. [Performance des Gestionnaires](#2-performance-des-gestionnaires)
3. [Performance des Agences](#3-performance-des-agences)
4. [Performance par Métier](#4-performance-par-métier)
5. [Cycles Moyens](#5-cycles-moyens)
6. [Données Sparkline (Séries Temporelles)](#6-données-sparkline-séries-temporelles)
7. [Volume par Statut](#7-volume-par-statut)
8. [Entonnoir de Conversion](#8-entonnoir-de-conversion)
9. [Répartition par Statut](#9-répartition-par-statut)

---

### À propos du champ date (`interventions.date`)

Dans toutes les formules et requêtes décrites dans ce document, **le champ utilisé pour limiter la période d'analyse est `interventions.date`**.  
Ce champ correspond **à la date de création de l'intervention** dans le système.

> **Important :**  
> Sauf mention contraire, tous les calculs de volume ou de performance sont basés sur les interventions dont la date de création (`interventions.date`) est comprise entre `p_period_start` et `p_period_end`.  
> Il ne s'agit pas de la date de transition d'un statut ou d'une autre date du cycle de vie de l'intervention.

Cela garantit que les résultats du dashboard sont toujours cohérents et comparables, indépendamment des parcours ou du temps de traitement des interventions.



## 1. KPIs Principaux

Les indicateurs principaux du dashboard fournissent une vue d'ensemble de l'activité sur une période donnée.

### 1.1. Nombre d'Interventions Demandées

**Description :** Compte le nombre total d'interventions créées dans la période sélectionnée, quels que soient leur statut final.

**Formule :**
```
Nombre d'interventions demandées = COUNT(interventions)
  où date >= période_début
  ET date <= période_fin
  ET is_active = true
```

**Code SQL :**
```sql
SELECT COUNT(*)
INTO v_nb_interventions_demandees
FROM interventions i
WHERE i.date >= p_period_start
  AND i.date <= p_period_end
  AND i.is_active = true
  AND (array_length(p_agence_ids, 1) IS NULL OR i.agence_id = ANY(p_agence_ids))
  AND (array_length(p_gestionnaire_ids, 1) IS NULL OR i.assigned_user_id = ANY(p_gestionnaire_ids))
  AND (array_length(p_metier_ids, 1) IS NULL OR i.metier_id = ANY(p_metier_ids));
```

### 1.2. Nombre d'Interventions Terminées

**Description :** Compte uniquement les interventions ayant atteint le statut `INTER_TERMINEE` parmi celles créées dans la période.

**Formule :**
```
Nombre d'interventions terminées = COUNT(interventions)
  où date >= période_début
  ET date <= période_fin
  ET statut = 'INTER_TERMINEE'
  ET is_active = true
```

**Code SQL :**
```sql
SELECT COUNT(*)
INTO v_nb_interventions_terminees
FROM interventions i
JOIN intervention_statuses ist ON i.statut_id = ist.id
WHERE i.date >= p_period_start
  AND i.date <= p_period_end
  AND i.is_active = true
  AND ist.code = 'INTER_TERMINEE'
  AND (array_length(p_agence_ids, 1) IS NULL OR i.agence_id = ANY(p_agence_ids))
  AND (array_length(p_gestionnaire_ids, 1) IS NULL OR i.assigned_user_id = ANY(p_gestionnaire_ids))
  AND (array_length(p_metier_ids, 1) IS NULL OR i.metier_id = ANY(p_metier_ids));
```

### 1.3. Chiffre d'Affaires Total (CA)

**Description :** Somme des montants de type `intervention` pour toutes les interventions terminées dans la période.

**Formule :**
```
CA Total = Σ(intervention_costs.amount)
  où cost_type = 'intervention'
  ET intervention.statut = 'INTER_TERMINEE'
  ET intervention.date dans la période
```

**Code SQL :**
```sql
SELECT COALESCE(SUM(CASE WHEN cost.cost_type = 'intervention' THEN cost.amount ELSE 0 END), 0)
INTO v_ca_total
FROM interventions i
JOIN intervention_statuses ist ON i.statut_id = ist.id
JOIN intervention_costs cost ON i.id = cost.intervention_id
WHERE i.date >= p_period_start
  AND i.date <= p_period_end
  AND i.is_active = true
  AND ist.code = 'INTER_TERMINEE'
  AND (array_length(p_agence_ids, 1) IS NULL OR i.agence_id = ANY(p_agence_ids))
  AND (array_length(p_gestionnaire_ids, 1) IS NULL OR i.assigned_user_id = ANY(p_gestionnaire_ids))
  AND (array_length(p_metier_ids, 1) IS NULL OR i.metier_id = ANY(p_metier_ids));
```

### 1.4. Coûts Totaux

**Description :** Somme des coûts de type `sst` (sous-traitance) et `materiel` pour toutes les interventions terminées.

**Formule :**
```
Coûts Totaux = Σ(coûts SST) + Σ(coûts Matériel)
  où cost_type IN ('sst', 'materiel')
  ET intervention.statut = 'INTER_TERMINEE'
  ET intervention.date dans la période
```

**Code SQL :**
```sql
SELECT COALESCE(
  SUM(CASE WHEN cost.cost_type = 'sst' THEN cost.amount ELSE 0 END)
  + SUM(CASE WHEN cost.cost_type = 'materiel' THEN cost.amount ELSE 0 END),
  0
)
INTO v_couts_total
FROM interventions i
JOIN intervention_statuses ist ON i.statut_id = ist.id
JOIN intervention_costs cost ON i.id = cost.intervention_id
WHERE i.date >= p_period_start
  AND i.date <= p_period_end
  AND i.is_active = true
  AND ist.code = 'INTER_TERMINEE'
  AND (array_length(p_agence_ids, 1) IS NULL OR i.agence_id = ANY(p_agence_ids))
  AND (array_length(p_gestionnaire_ids, 1) IS NULL OR i.assigned_user_id = ANY(p_gestionnaire_ids))
  AND (array_length(p_metier_ids, 1) IS NULL OR i.metier_id = ANY(p_metier_ids));
```

### 1.5. Marge Totale

**Description :** Différence entre le chiffre d'affaires et les coûts totaux.

**Formule :**
```
Marge Totale = CA Total - Coûts Totaux
```

**Code SQL :**
```sql
v_marge_total := v_ca_total - v_couts_total;
```

### 1.6. Taux de Transformation

**Description :** Pourcentage d'interventions terminées par rapport aux interventions demandées. Indicateur de l'efficacité du processus de traitement.

**Formule :**
```
Taux de Transformation (%) = (Interventions Terminées / Interventions Demandées) × 100
```

**Code SQL :**
```sql
v_taux_transformation := CASE
  WHEN v_nb_interventions_demandees > 0
  THEN ROUND((v_nb_interventions_terminees::NUMERIC / v_nb_interventions_demandees::NUMERIC) * 100, 2)
  ELSE 0
END;
```

### 1.7. Taux de Marge

**Description :** Pourcentage de marge par rapport au chiffre d'affaires. Indicateur de rentabilité.

**Formule :**
```
Taux de Marge (%) = (Marge Totale / CA Total) × 100
```

**Code SQL :**
```sql
v_taux_marge := CASE
  WHEN v_ca_total > 0
  THEN ROUND((v_marge_total / v_ca_total) * 100, 2)
  ELSE 0
END;
```

### 1.8. CA Moyen par Intervention

**Description :** Chiffre d'affaires moyen généré par intervention terminée.

**Formule :**
```
CA Moyen = CA Total / Nombre d'Interventions Terminées
```

**Code SQL :**
```sql
v_ca_moyen := CASE
  WHEN v_nb_interventions_terminees > 0
  THEN ROUND(v_ca_total / v_nb_interventions_terminees, 2)
  ELSE 0
END;
```

---

## 2. Performance des Gestionnaires

Cette section analyse la performance individuelle de chaque gestionnaire sur la période sélectionnée.

### 2.1. Nombre d'Interventions Prises

**Description :** Nombre d'interventions assignées à un gestionnaire dans la période.

**Formule :**
```
Interventions Prises = COUNT(DISTINCT interventions)
  où assigned_user_id = gestionnaire_id
  ET date dans la période
```

**Code SQL :**
```sql
COUNT(DISTINCT ip.id) AS nb_interventions_prises
FROM users u
JOIN interventions_periode ip ON u.id = ip.assigned_user_id
```

### 2.2. Nombre d'Interventions Terminées par Gestionnaire

**Description :** Nombre d'interventions terminées parmi celles assignées au gestionnaire.

**Formule :**
```
Interventions Terminées = COUNT(DISTINCT interventions)
  où assigned_user_id = gestionnaire_id
  ET statut = 'INTER_TERMINEE'
  ET date dans la période
```

**Code SQL :**
```sql
COUNT(DISTINCT it.id) AS nb_interventions_terminees
FROM users u
JOIN interventions_periode ip ON u.id = ip.assigned_user_id
LEFT JOIN interventions_terminees it ON ip.id = it.id
```

### 2.3. Taux de Completion

**Description :** Pourcentage d'interventions terminées par rapport aux interventions prises.

**Formule :**
```
Taux de Completion (%) = (Interventions Terminées / Interventions Prises) × 100
```

**Code SQL :**
```sql
CASE
  WHEN COUNT(DISTINCT ip.id) > 0
  THEN ROUND((COUNT(DISTINCT it.id)::NUMERIC / COUNT(DISTINCT ip.id)::NUMERIC) * 100, 2)
  ELSE 0
END AS taux_completion
```

### 2.4. CA Total par Gestionnaire

**Description :** Chiffre d'affaires généré par les interventions terminées d'un gestionnaire.

**Formule :**
```
CA Gestionnaire = Σ(intervention_costs.amount)
  où cost_type = 'intervention'
  ET intervention.assigned_user_id = gestionnaire_id
  ET intervention.statut = 'INTER_TERMINEE'
```

**Code SQL :**
```sql
COALESCE(SUM(CASE WHEN cost.cost_type = 'intervention' THEN cost.amount ELSE 0 END), 0) AS ca_total
FROM users u
JOIN interventions_periode ip ON u.id = ip.assigned_user_id
LEFT JOIN interventions_terminees it ON ip.id = it.id
LEFT JOIN intervention_costs cost ON it.id = cost.intervention_id
```

### 2.5. Coûts Totaux par Gestionnaire

**Description :** Coûts totaux (SST + Matériel) des interventions terminées d'un gestionnaire.

**Formule :**
```
Coûts Gestionnaire = Σ(coûts SST) + Σ(coûts Matériel)
  où cost_type IN ('sst', 'materiel')
  ET intervention.assigned_user_id = gestionnaire_id
  ET intervention.statut = 'INTER_TERMINEE'
```

**Code SQL :**
```sql
COALESCE(
  SUM(CASE WHEN cost.cost_type = 'sst' THEN cost.amount ELSE 0 END)
  + SUM(CASE WHEN cost.cost_type = 'materiel' THEN cost.amount ELSE 0 END),
  0
) AS couts_total
```

### 2.6. Marge Totale par Gestionnaire

**Description :** Marge générée par les interventions d'un gestionnaire.

**Formule :**
```
Marge Gestionnaire = CA Gestionnaire - Coûts Gestionnaire
```

**Code SQL :**
```sql
ca_total - couts_total AS marge_total
```

### 2.7. Taux de Marge par Gestionnaire

**Description :** Pourcentage de marge par rapport au CA pour un gestionnaire.

**Formule :**
```
Taux de Marge Gestionnaire (%) = (Marge Gestionnaire / CA Gestionnaire) × 100
```

**Code SQL :**
```sql
CASE
  WHEN ca_total > 0 THEN ROUND(((ca_total - couts_total) / ca_total) * 100, 2)
  ELSE 0
END AS taux_marge
```

---

## 3. Performance des Agences

Cette section analyse la performance de chaque agence sur la période sélectionnée.

### 3.1. Nombre d'Interventions Demandées par Agence

**Description :** Nombre d'interventions créées dans une agence sur la période.

**Formule :**
```
Interventions Demandées = COUNT(DISTINCT interventions)
  où agence_id = agence_id
  ET date dans la période
```

**Code SQL :**
```sql
COUNT(DISTINCT ip.id) AS nb_interventions_demandees
FROM agencies a
LEFT JOIN interventions_periode ip ON a.id = ip.agence_id
```

### 3.2. Nombre d'Interventions Terminées par Agence

**Description :** Nombre d'interventions terminées dans une agence.

**Formule :**
```
Interventions Terminées = COUNT(DISTINCT interventions)
  où agence_id = agence_id
  ET statut = 'INTER_TERMINEE'
  ET date dans la période
```

**Code SQL :**
```sql
COUNT(DISTINCT it.id) AS nb_interventions_terminees
FROM agencies a
LEFT JOIN interventions_periode ip ON a.id = ip.agence_id
LEFT JOIN interventions_terminees it ON ip.id = it.id
```

### 3.3. Taux de Completion par Agence

**Description :** Pourcentage d'interventions terminées par rapport aux interventions demandées dans une agence.

**Formule :**
```
Taux de Completion Agence (%) = (Interventions Terminées / Interventions Demandées) × 100
```

**Code SQL :**
```sql
CASE
  WHEN COUNT(DISTINCT ip.id) > 0
  THEN ROUND((COUNT(DISTINCT it.id)::NUMERIC / COUNT(DISTINCT ip.id)::NUMERIC) * 100, 2)
  ELSE 0
END AS taux_completion
```

### 3.4. CA Total par Agence

**Description :** Chiffre d'affaires généré par les interventions terminées d'une agence.

**Formule :**
```
CA Agence = Σ(intervention_costs.amount)
  où cost_type = 'intervention'
  ET intervention.agence_id = agence_id
  ET intervention.statut = 'INTER_TERMINEE'
```

**Code SQL :**
```sql
COALESCE(SUM(CASE WHEN cost.cost_type = 'intervention' THEN cost.amount ELSE 0 END), 0) AS ca_total
FROM agencies a
LEFT JOIN interventions_periode ip ON a.id = ip.agence_id
LEFT JOIN interventions_terminees it ON ip.id = it.id
LEFT JOIN intervention_costs cost ON it.id = cost.intervention_id
```

### 3.5. Nombre de Gestionnaires Actifs par Agence

**Description :** Nombre de gestionnaires ayant au moins une intervention dans l'agence.

**Formule :**
```
Gestionnaires Actifs = COUNT(DISTINCT users)
  où user.role = 'gestionnaire'
  ET intervention.agence_id = agence_id
```

**Code SQL :**
```sql
(SELECT COUNT(DISTINCT u.id)
 FROM users u
 JOIN user_roles ur ON u.id = ur.user_id
 JOIN roles r ON ur.role_id = r.id
 JOIN interventions i ON i.assigned_user_id = u.id
 WHERE i.agence_id = a.id
   AND r.name = 'gestionnaire'
) AS nb_gestionnaires_actifs
```

---

## 4. Performance par Métier

Cette section analyse la performance par type de métier (plomberie, électricité, etc.).

### 4.1. Nombre d'Interventions Demandées par Métier

**Description :** Nombre d'interventions créées pour un métier donné.

**Formule :**
```
Interventions Demandées = COUNT(DISTINCT interventions)
  où metier_id = metier_id
  ET date dans la période
```

**Code SQL :**
```sql
COUNT(DISTINCT ip.id) AS nb_interventions_demandees
FROM metiers m
LEFT JOIN interventions_periode ip ON m.id = ip.metier_id
```

### 4.2. Pourcentage du Volume Total

**Description :** Pourcentage que représente un métier dans le volume total d'interventions.

**Formule :**
```
Pourcentage Volume (%) = (Interventions Métier / Total Interventions) × 100
```

**Code SQL :**
```sql
CASE
  WHEN v_total_volume > 0
  THEN ROUND((COUNT(DISTINCT ip.id)::NUMERIC / v_total_volume::NUMERIC) * 100, 2)
  ELSE 0
END AS pourcentage_volume
```

### 4.3. Taux de Completion par Métier

**Description :** Pourcentage d'interventions terminées par rapport aux interventions demandées pour un métier.

**Formule :**
```
Taux de Completion Métier (%) = (Interventions Terminées / Interventions Demandées) × 100
```

**Code SQL :**
```sql
CASE
  WHEN COUNT(DISTINCT ip.id) > 0
  THEN ROUND((COUNT(DISTINCT it.id)::NUMERIC / COUNT(DISTINCT ip.id)::NUMERIC) * 100, 2)
  ELSE 0
END AS taux_completion
```

### 4.4. CA Total par Métier

**Description :** Chiffre d'affaires généré par les interventions terminées d'un métier.

**Formule :**
```
CA Métier = Σ(intervention_costs.amount)
  où cost_type = 'intervention'
  ET intervention.metier_id = metier_id
  ET intervention.statut = 'INTER_TERMINEE'
```

**Code SQL :**
```sql
COALESCE(SUM(CASE WHEN cost.cost_type = 'intervention' THEN cost.amount ELSE 0 END), 0) AS ca_total
FROM metiers m
LEFT JOIN interventions_periode ip ON m.id = ip.metier_id
LEFT JOIN interventions_terminees it ON ip.id = it.id
LEFT JOIN intervention_costs cost ON it.id = cost.intervention_id
```

---

## 5. Cycles Moyens

Cette section calcule les durées moyennes des différents cycles de traitement des interventions.

### 5.1. Cycle Total Moyen

**Description :** Durée moyenne en jours entre la création d'une intervention (statut `DEMANDE`) et sa finalisation (statut `INTER_TERMINEE`).

**Formule :**
```
Cycle Total Moyen (jours) = AVG(date_terminee - date_demande)
  pour toutes les interventions terminées
```

**Code SQL :**
```sql
-- Extraction des dates de transition
SELECT
  it.id AS intervention_id,
  MIN(CASE WHEN ist.to_status_code = 'DEMANDE' THEN ist.transition_date END) AS date_demande,
  MAX(CASE WHEN ist.to_status_code = 'INTER_TERMINEE' THEN ist.transition_date END) AS date_terminee
FROM interventions_terminees it
JOIN intervention_status_transitions ist ON it.id = ist.intervention_id
GROUP BY it.id

-- Calcul du cycle en jours
CASE
  WHEN date_demande IS NOT NULL AND date_terminee IS NOT NULL
  THEN EXTRACT(EPOCH FROM (date_terminee - date_demande)) / 86400.0
  ELSE NULL
END AS cycle_total_jours

-- Moyenne
COALESCE(ROUND(AVG(cycle_total_jours), 2), 0) AS cycle_moyen_total_jours
```

### 5.2. Cycle Demande → Prise Moyen

**Description :** Durée moyenne en jours entre la création d'une intervention et son acceptation (passage au statut `ACCEPTE`).

**Formule :**
```
Cycle Demande → Prise (jours) = AVG(date_accepte - date_demande)
```

**Code SQL :**
```sql
MIN(CASE WHEN ist.to_status_code = 'ACCEPTE' THEN ist.transition_date END) AS date_accepte

CASE
  WHEN date_demande IS NOT NULL AND date_accepte IS NOT NULL
  THEN EXTRACT(EPOCH FROM (date_accepte - date_demande)) / 86400.0
  ELSE NULL
END AS cycle_demande_prise_jours

COALESCE(ROUND(AVG(cycle_demande_prise_jours), 2), 0) AS cycle_demande_prise_jours
```

### 5.3. Cycle Prise → Terminée Moyen

**Description :** Durée moyenne en jours entre l'acceptation d'une intervention et sa finalisation.

**Formule :**
```
Cycle Prise → Terminée (jours) = AVG(date_terminee - date_accepte)
```

**Code SQL :**
```sql
CASE
  WHEN date_accepte IS NOT NULL AND date_terminee IS NOT NULL
  THEN EXTRACT(EPOCH FROM (date_terminee - date_accepte)) / 86400.0
  ELSE NULL
END AS cycle_prise_terminee_jours

COALESCE(ROUND(AVG(cycle_prise_terminee_jours), 2), 0) AS cycle_prise_terminee_jours
```

**Note :** La fonction `EXTRACT(EPOCH FROM ...)` retourne la différence en secondes. La division par `86400.0` (nombre de secondes dans une journée) convertit le résultat en jours.

---

## 6. Données Sparkline (Séries Temporelles)

Cette section génère les données quotidiennes pour les graphiques de tendance (sparklines).

### 6.1. Série de Dates

**Description :** Génération d'une série de dates couvrant toute la période sélectionnée, jour par jour.

**Formule :**
```
Série de Dates = generate_series(date_début, date_fin, '1 day')
```

**Code SQL :**
```sql
WITH date_series AS (
  SELECT generate_series(
    DATE_TRUNC('day', p_period_start),
    DATE_TRUNC('day', p_period_end),
    '1 day'::interval
  )::date AS date_jour
)
```

### 6.2. Interventions Demandées par Jour

**Description :** Nombre d'interventions créées chaque jour de la période.

**Formule :**
```
Interventions Demandées (jour) = COUNT(interventions)
  où DATE_TRUNC('day', date) = date_jour
```

**Code SQL :**
```sql
SELECT
  DATE_TRUNC('day', i.date)::date AS date_jour,
  COUNT(*) AS nb_demandees
FROM interventions i
WHERE i.date >= p_period_start
  AND i.date <= p_period_end
  AND i.is_active = true
GROUP BY DATE_TRUNC('day', i.date)::date
```

### 6.3. Interventions Terminées par Jour

**Description :** Nombre d'interventions terminées chaque jour (basé sur la date de création).

**Formule :**
```
Interventions Terminées (jour) = COUNT(interventions)
  où DATE_TRUNC('day', date) = date_jour
  ET statut = 'INTER_TERMINEE'
```

**Code SQL :**
```sql
COUNT(*) FILTER (WHERE ist.code = 'INTER_TERMINEE') AS nb_terminees
FROM interventions i
JOIN intervention_statuses ist ON i.statut_id = ist.id
WHERE i.date >= p_period_start
  AND i.date <= p_period_end
  AND i.is_active = true
GROUP BY DATE_TRUNC('day', i.date)::date
```

### 6.4. CA Quotidien

**Description :** Chiffre d'affaires généré chaque jour par les interventions terminées.

**Formule :**
```
CA Jour = Σ(intervention_costs.amount)
  où cost_type = 'intervention'
  ET intervention.statut = 'INTER_TERMINEE'
  ET DATE_TRUNC('day', intervention.date) = date_jour
```

**Code SQL :**
```sql
COALESCE(
  SUM(CASE 
    WHEN ist.code = 'INTER_TERMINEE' AND cost.cost_type = 'intervention' 
    THEN cost.amount 
    ELSE 0 
  END),
  0
) AS ca_jour
```

### 6.5. Marge Quotidienne

**Description :** Marge générée chaque jour (CA - Coûts).

**Formule :**
```
Marge Jour = CA Jour - Coûts Jour
```

**Code SQL :**
```sql
COALESCE(ipj.ca_jour, 0) - COALESCE(ipj.couts_jour, 0) AS marge_jour
```

---

## 7. Volume par Statut

Cette section fournit la répartition quotidienne des interventions par statut pour les graphiques en barres empilées.

### 7.1. Volume par Jour et par Statut

**Description :** Compte le nombre d'interventions pour chaque statut chaque jour de la période.

**Formule :**
```
Volume (statut, jour) = COUNT(interventions)
  où DATE_TRUNC('day', date) = date_jour
  ET statut = status_code
```

**Code SQL :**
```sql
SELECT
  DATE_TRUNC('day', i.date)::date AS date_jour,
  ist.code AS status_code,
  COUNT(*) AS count
FROM interventions i
JOIN intervention_statuses ist ON i.statut_id = ist.id
WHERE i.date >= p_period_start
  AND i.date <= p_period_end
  AND i.is_active = true
  AND ist.code IN ('DEMANDE', 'DEVIS_ENVOYE', 'ACCEPTE', 'INTER_EN_COURS', 'INTER_TERMINEE')
GROUP BY DATE_TRUNC('day', i.date)::date, ist.code
```

### 7.2. Agrégation par Statut

**Description :** Regroupe les données par jour avec un compteur pour chaque statut.

**Formule :**
```
Pour chaque jour :
  - demande = COUNT où status_code = 'DEMANDE'
  - devis_envoye = COUNT où status_code = 'DEVIS_ENVOYE'
  - accepte = COUNT où status_code = 'ACCEPTE'
  - en_cours = COUNT où status_code = 'INTER_EN_COURS'
  - termine = COUNT où status_code = 'INTER_TERMINEE'
```

**Code SQL :**
```sql
SELECT
  ds.date_jour,
  COALESCE(SUM(CASE WHEN ipjs.status_code = 'DEMANDE' THEN ipjs.count ELSE 0 END), 0) AS demande,
  COALESCE(SUM(CASE WHEN ipjs.status_code = 'DEVIS_ENVOYE' THEN ipjs.count ELSE 0 END), 0) AS devis_envoye,
  COALESCE(SUM(CASE WHEN ipjs.status_code = 'ACCEPTE' THEN ipjs.count ELSE 0 END), 0) AS accepte,
  COALESCE(SUM(CASE WHEN ipjs.status_code = 'INTER_EN_COURS' THEN ipjs.count ELSE 0 END), 0) AS en_cours,
  COALESCE(SUM(CASE WHEN ipjs.status_code = 'INTER_TERMINEE' THEN ipjs.count ELSE 0 END), 0) AS termine
FROM date_series ds
LEFT JOIN interventions_par_jour_et_statut ipjs ON ds.date_jour = ipjs.date_jour
GROUP BY ds.date_jour
```

---

## 8. Entonnoir de Conversion

Cette section calcule le funnel de conversion montrant combien d'interventions ont atteint chaque étape du processus.

### 8.1. Principe de l'Entonnoir

**Description :** L'entonnoir de conversion compte progressivement combien d'interventions ont atteint **au moins** chaque statut dans la séquence :
1. DEMANDE
2. DEVIS_ENVOYE
3. ACCEPTE
4. INTER_EN_COURS
5. INTER_TERMINEE

**Formule :**
```
Pour chaque statut :
  Count = Nombre d'interventions ayant atteint AU MOINS ce statut
```

### 8.2. Base des Interventions

**Description :** Toutes les interventions créées dans la période constituent la base de calcul.

**Code SQL :**
```sql
WITH base_interventions AS (
  SELECT DISTINCT i.id as intervention_id
  FROM interventions i
  WHERE i.date >= p_period_start
    AND i.date <= p_period_end
    AND i.is_active = true
    AND (array_length(p_agence_ids, 1) IS NULL OR i.agence_id = ANY(p_agence_ids))
    AND (array_length(p_metier_ids, 1) IS NULL OR i.metier_id = ANY(p_metier_ids))
    AND (array_length(p_gestionnaire_ids, 1) IS NULL OR i.assigned_user_id = ANY(p_gestionnaire_ids))
)
```

### 8.3. Rang des Statuts

**Description :** Attribution d'un rang numérique à chaque statut pour déterminer la progression.

**Code SQL :**
```sql
status_ranks AS (
  SELECT 1 as rank, 'DEMANDE' as status_code UNION ALL
  SELECT 2, 'DEVIS_ENVOYE' UNION ALL
  SELECT 3, 'ACCEPTE' UNION ALL
  SELECT 4, 'INTER_EN_COURS' UNION ALL
  SELECT 5, 'INTER_TERMINEE'
)
```

### 8.4. Statut Maximum Atteint

**Description :** Pour chaque intervention, déterminer le rang le plus élevé atteint.

**Formule :**
```
Max Rank = MAX(rank)
  où intervention a atteint le statut correspondant
```

**Code SQL :**
```sql
last_status_reached AS (
  SELECT
    bi.intervention_id,
    COALESCE(MAX(sr.rank), 1) as max_rank
  FROM base_interventions bi
  LEFT JOIN intervention_status_transitions ist
    ON ist.intervention_id = bi.intervention_id
    AND ist.to_status_code IN ('DEMANDE', 'DEVIS_ENVOYE', 'ACCEPTE', 'INTER_EN_COURS', 'INTER_TERMINEE')
  LEFT JOIN status_ranks sr ON sr.status_code = ist.to_status_code
  GROUP BY bi.intervention_id
)
```

### 8.5. Comptage Cumulatif

**Description :** Compter combien d'interventions ont atteint au moins chaque niveau.

**Formule :**
```
Pour chaque statut de rang N :
  Count = COUNT(interventions où max_rank >= N)
```

**Code SQL :**
```sql
SELECT 1 as rank, 'DEMANDE' as status_code, COUNT(*)::integer as count
FROM base_interventions
UNION ALL
SELECT 2, 'DEVIS_ENVOYE', COUNT(*)::integer
FROM last_status_reached WHERE max_rank >= 2
UNION ALL
SELECT 3, 'ACCEPTE', COUNT(*)::integer
FROM last_status_reached WHERE max_rank >= 3
UNION ALL
SELECT 4, 'INTER_EN_COURS', COUNT(*)::integer
FROM last_status_reached WHERE max_rank >= 4
UNION ALL
SELECT 5, 'INTER_TERMINEE', COUNT(*)::integer
FROM last_status_reached WHERE max_rank >= 5
```

---

## 9. Répartition par Statut

Cette section fournit la répartition actuelle des interventions par statut (snapshot à un instant T).

### 9.1. Principe

**Description :** Contrairement à l'entonnoir de conversion qui suit la progression, cette section compte le statut **actuel** de chaque intervention créée dans la période.

**Formule :**
```
Pour chaque statut :
  Count = COUNT(interventions)
    où statut_id = statut_id
    ET date dans la période
```

### 9.2. Code SQL

```sql
SELECT
  ist.code AS status_code,
  ist.label AS status_label,
  COUNT(*)::integer as count
FROM interventions i
JOIN intervention_statuses ist ON ist.id = i.statut_id
WHERE i.date >= p_period_start
  AND i.date <= p_period_end
  AND i.is_active = true
  AND (array_length(p_agence_ids, 1) IS NULL OR i.agence_id = ANY(p_agence_ids))
  AND (array_length(p_metier_ids, 1) IS NULL OR i.metier_id = ANY(p_metier_ids))
  AND (array_length(p_gestionnaire_ids, 1) IS NULL OR i.assigned_user_id = ANY(p_gestionnaire_ids))
GROUP BY i.statut_id, ist.code, ist.label
ORDER BY count DESC
```

**Note :** Cette répartition diffère de l'entonnoir car elle montre l'état actuel des interventions, tandis que l'entonnoir montre la progression maximale atteinte.

---

## Notes Techniques

### Filtres Appliqués

Toutes les fonctions acceptent des paramètres de filtrage optionnels :
- **Agences** : `p_agence_ids` - Filtre par une ou plusieurs agences
- **Gestionnaires** : `p_gestionnaire_ids` - Filtre par un ou plusieurs gestionnaires
- **Métiers** : `p_metier_ids` - Filtre par un ou plusieurs métiers

Ces filtres sont appliqués de manière cohérente à travers toutes les fonctions pour garantir la cohérence des données.

### Période de Calcul

La période est définie par :
- `p_period_start` : Date/heure de début (inclusive)
- `p_period_end` : Date/heure de fin (inclusive)

**Important :** Les interventions sont sélectionnées sur la base de leur date de création (`interventions.date`), pas sur la date de transition de statut.

### Interventions Actives

Seules les interventions avec `is_active = true` sont prises en compte dans tous les calculs.

### Types de Coûts

Le système distingue trois types de coûts dans `intervention_costs` :
- **`intervention`** : Montant facturé au client (utilisé pour le CA)
- **`sst`** : Coûts de sous-traitance
- **`materiel`** : Coûts de matériel

Les coûts totaux sont calculés comme : `sst + materiel`

### Arrondis

Les pourcentages et montants sont arrondis à 2 décimales pour l'affichage :
```sql
ROUND(valeur, 2)
```

Les durées en jours sont également arrondies à 2 décimales.

### Gestion des Valeurs Nulles

Tous les calculs utilisent `COALESCE()` pour gérer les valeurs nulles et retourner `0` par défaut, évitant ainsi les erreurs de division par zéro.

---

## Conclusion

Ce document présente l'ensemble des formules et calculs utilisés dans le tableau de bord administrateur. Chaque indicateur est calculé de manière cohérente et prend en compte les filtres appliqués (agences, gestionnaires, métiers) pour fournir une vue précise et personnalisée des performances.

Pour toute question ou clarification, veuillez consulter le code source des fonctions SQL dans le fichier de migration `00018_admin_dashboard_v3_refactor.sql`.

