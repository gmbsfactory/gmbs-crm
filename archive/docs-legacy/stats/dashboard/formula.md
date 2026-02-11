# Documentation des Formules - Dashboard Gestionnaire

Ce document présente l'ensemble des formules et calculs utilisés dans le tableau de bord gestionnaire. Chaque section détaille les indicateurs et leur méthode de calcul.

---

## Table des matières

1. [Contexte et Champ de Date](#1-contexte-et-champ-de-date)
2. [Mes Interventions (par Statut)](#2-mes-interventions-par-statut)
3. [Mes Artisans](#3-mes-artisans)
4. [Trend Spot (Indicateurs de Performance)](#4-trend-spot-indicateurs-de-performance)
5. [Podium des Gestionnaires](#5-podium-des-gestionnaires)
6. [Tableau Hebdomadaire/Mensuel/Annuel](#6-tableau-hebdomadairemensuelannuel)

---

## 1. Contexte et Champ de Date

### À propos du champ date (`interventions.date`)

Dans toutes les formules et requêtes décrites dans ce document, **le champ utilisé pour limiter la période d'analyse est `interventions.date`**.
Ce champ correspond **à la date de création de l'intervention** dans le système.

> **Important :**
> Sauf mention contraire, tous les calculs de volume ou de performance sont basés sur les interventions dont la date de création (`interventions.date`) est comprise dans la période sélectionnée.
> Il ne s'agit pas de la date de transition d'un statut ou d'une autre date du cycle de vie de l'intervention.

### Filtrage par Gestionnaire

Toutes les requêtes du dashboard gestionnaire sont filtrées par :
```
assigned_user_id = gestionnaire_id
```

Cela signifie que seules les interventions **assignées à l'utilisateur connecté** (ou au gestionnaire sélectionné si admin) sont prises en compte.

### Interventions Actives

Seules les interventions avec `is_active = true` sont comptabilisées.

---

## 2. Mes Interventions (par Statut)

Cette section affiche le nombre d'interventions réparties par statut pour le gestionnaire sur la période sélectionnée.

### 2.1. Principe de Base

**Description :** Compte le nombre d'interventions assignées au gestionnaire pour chaque statut distinct.

**Formule :**
```
Pour chaque statut :
  Count = COUNT(interventions)
    où assigned_user_id = gestionnaire_id
    ET statut_id = statut
    ET date >= période_début
    ET date <= période_fin
    ET is_active = true
```

**Code SQL :**
```sql
SELECT
  ist.code AS status_code,
  ist.label AS status_label,
  COUNT(*) AS count
FROM interventions i
JOIN intervention_statuses ist ON ist.id = i.statut_id
WHERE i.assigned_user_id = :userId
  AND i.date >= :startDate
  AND i.date <= :endDate
  AND i.is_active = true
GROUP BY ist.id, ist.code, ist.label
ORDER BY count DESC
```

### 2.2. Détail par Statut

Les statuts principaux suivis sont :

- **`DEMANDE`** : Interventions demandées mais pas encore traitées
- **`DEVIS_ENVOYE`** : Devis envoyés en attente de validation
- **`ACCEPTE`** : Devis acceptés, intervention à planifier
- **`INTER_EN_COURS`** : Interventions en cours de réalisation
- **`INTER_TERMINEE`** : Interventions terminées et facturées
- **`ATT_ACOMPTE`** : En attente d'acompte
- **`ANNULEE`**, **`REFUSEE`**, etc. : Autres statuts de fin

### 2.3. Statistiques Agrégées

**Total Général :**
```
Total Interventions = Σ(count de tous les statuts)
```

**Taux de Completion :**
```
Taux de Completion (%) = (Interventions TERMINÉES / Total Interventions) × 100
```

---

## 3. Mes Artisans

Cette section affiche les artisans avec lesquels le gestionnaire travaille, ainsi que des statistiques sur leur activité.

### 3.1. Liste des Artisans Actifs

**Description :** Identifie tous les artisans associés aux interventions du gestionnaire.

**Formule :**
```
Artisans Actifs = SELECT DISTINCT artisan_id
  FROM interventions
  WHERE assigned_user_id = gestionnaire_id
    ET date dans la période
    ET artisan_id IS NOT NULL
```

**Code SQL :**
```sql
SELECT DISTINCT
  a.id,
  a.nom,
  a.prenom,
  a.entreprise,
  a.telephone,
  COUNT(i.id) AS nb_interventions
FROM artisans a
JOIN interventions i ON i.artisan_id = a.id
WHERE i.assigned_user_id = :userId
  AND i.date >= :startDate
  AND i.date <= :endDate
  AND i.is_active = true
GROUP BY a.id, a.nom, a.prenom, a.entreprise, a.telephone
ORDER BY nb_interventions DESC
```

### 3.2. Nombre d'Interventions par Artisan

**Description :** Compte le nombre d'interventions réalisées par chaque artisan pour le gestionnaire.

**Formule :**
```
Interventions Artisan = COUNT(interventions)
  où artisan_id = artisan_id
  ET assigned_user_id = gestionnaire_id
  ET date dans la période
```

### 3.3. Statut de l'Artisan

**Description :** Affiche le statut actuel de l'artisan (actif, inactif, etc.) basé sur la table `artisan_statuses`.

**Code SQL :**
```sql
SELECT
  a.id,
  a.nom,
  ast.code AS status_code,
  ast.label AS status_label
FROM artisans a
LEFT JOIN artisan_statuses ast ON a.statut_id = ast.id
WHERE a.id IN (liste des artisans actifs)
```

### 3.4. Nouveaux Artisans

**Description :** Compte les nouveaux artisans créés dans la période (basé sur `artisans.created_at`).

**Formule :**
```
Nouveaux Artisans = COUNT(artisans)
  où created_at >= période_début
  ET created_at <= période_fin
  ET artisan apparaît dans une intervention du gestionnaire
```

**Code SQL :**
```sql
SELECT COUNT(DISTINCT a.id) AS nouveaux_artisans
FROM artisans a
JOIN interventions i ON i.artisan_id = a.id
WHERE i.assigned_user_id = :userId
  AND a.created_at >= :startDate
  AND a.created_at <= :endDate
  AND i.is_active = true
```

---

## 4. Trend Spot (Indicateurs de Performance)

Cette section affiche les indicateurs clés de performance du gestionnaire, souvent présentés sous forme de jauge ou de graphique (speedometer).

### 4.1. Marge Moyenne (%)

**Description :** Pourcentage moyen de marge sur les interventions terminées du gestionnaire.

**Formule :**
```
Marge Moyenne (%) = (Σ Marge / Σ CA) × 100

Où :
  Marge = CA - (Coûts SST + Coûts Matériel)
  CA = Σ(intervention_costs.amount) où cost_type = 'intervention'
  Coûts = Σ(intervention_costs.amount) où cost_type IN ('sst', 'materiel')
```

**Code SQL :**
```sql
WITH interventions_terminees AS (
  SELECT i.id
  FROM interventions i
  JOIN intervention_statuses ist ON ist.id = i.statut_id
  WHERE i.assigned_user_id = :userId
    AND i.date >= :startDate
    AND i.date <= :endDate
    AND ist.code = 'INTER_TERMINEE'
    AND i.is_active = true
),
financials AS (
  SELECT
    COALESCE(SUM(CASE WHEN ic.cost_type = 'intervention' THEN ic.amount ELSE 0 END), 0) AS total_ca,
    COALESCE(SUM(CASE WHEN ic.cost_type IN ('sst', 'materiel') THEN ic.amount ELSE 0 END), 0) AS total_couts
  FROM interventions_terminees it
  LEFT JOIN intervention_costs ic ON ic.intervention_id = it.id
)
SELECT
  CASE
    WHEN total_ca > 0 THEN ROUND(((total_ca - total_couts) / total_ca) * 100, 2)
    ELSE 0
  END AS marge_moyenne_pct
FROM financials
```

### 4.2. Chiffre d'Affaires Total

**Description :** Somme du CA généré par les interventions terminées du gestionnaire.

**Formule :**
```
CA Total = Σ(intervention_costs.amount)
  où cost_type = 'intervention'
  ET intervention.assigned_user_id = gestionnaire_id
  ET intervention.statut = 'INTER_TERMINEE'
  ET intervention.date dans la période
```

**Code SQL :** (Voir section financials ci-dessus, colonne `total_ca`)

### 4.3. Marge Totale

**Description :** Différence entre le CA et les coûts.

**Formule :**
```
Marge Totale = CA Total - Coûts Totaux
```

**Code SQL :**
```sql
SELECT (total_ca - total_couts) AS marge_totale
FROM financials
```

### 4.4. Nombre de Retards

**Description :** Nombre d'interventions en retard (date prévue dépassée) pour le gestionnaire.

**Formule :**
```
Retards = COUNT(interventions)
  où assigned_user_id = gestionnaire_id
  ET date_prevue < date_actuelle
  ET statut NOT IN ('INTER_TERMINEE', 'ANNULEE', 'REFUSEE')
  ET is_active = true
```

**Code SQL :**
```sql
SELECT COUNT(*) AS nb_retards
FROM interventions i
JOIN intervention_statuses ist ON ist.id = i.statut_id
WHERE i.assigned_user_id = :userId
  AND i.date_prevue < NOW()
  AND ist.code NOT IN ('INTER_TERMINEE', 'ANNULEE', 'REFUSEE')
  AND i.is_active = true
```

**Note :** Le code couleur du trend spot varie selon le nombre de retards :
- 0 retard : vert (`rgb(34, 197, 94)`)
- 10+ retards : rouge (`rgb(239, 68, 68)`)
- Interpolation linéaire entre les deux

---

## 5. Podium des Gestionnaires

Cette section classe les gestionnaires selon leur performance (marge générée) sur une période donnée. Visible uniquement pour les administrateurs.

### 5.1. Classement par Marge

**Description :** Classe tous les gestionnaires par ordre décroissant de marge totale générée.

**Formule :**
```
Pour chaque gestionnaire :
  Marge Totale = Σ(CA - Coûts)
    pour toutes les interventions terminées
    dans la période

Classement = ORDER BY Marge Totale DESC
```

**Code SQL :**
```sql
WITH interventions_periode AS (
  SELECT i.id, i.assigned_user_id, i.date
  FROM interventions i
  WHERE i.is_active = true
    AND i.date >= :period_start
    AND i.date < :period_end
    AND i.assigned_user_id IS NOT NULL
),
transitions_terminees AS (
  SELECT DISTINCT ist.intervention_id, ist.transition_date
  FROM intervention_status_transitions ist
  INNER JOIN interventions_periode ip ON ip.id = ist.intervention_id
  WHERE ist.to_status_code = 'INTER_TERMINEE'
    AND ist.transition_date >= :period_start
    AND ist.transition_date <= :period_end
    AND (ist.from_status_code IS NULL OR ist.from_status_code != ist.to_status_code)
),
financial_interventions AS (
  SELECT DISTINCT intervention_id FROM transitions_terminees
),
paiements_agreges AS (
  SELECT ic.intervention_id, SUM(ic.amount) AS total_paiements
  FROM financial_interventions fi
  JOIN intervention_costs ic ON ic.intervention_id = fi.intervention_id
  WHERE ic.cost_type = 'intervention'
  GROUP BY ic.intervention_id
),
couts_agreges AS (
  SELECT ic.intervention_id, SUM(ic.amount) AS total_couts
  FROM financial_interventions fi
  JOIN intervention_costs ic ON ic.intervention_id = fi.intervention_id
  WHERE ic.cost_type IN ('sst', 'materiel')
  GROUP BY ic.intervention_id
),
gestionnaire_stats AS (
  SELECT
    ip.assigned_user_id AS gestionnaire_id,
    COUNT(DISTINCT fi.intervention_id) AS total_interventions,
    COALESCE(SUM(p.total_paiements), 0) AS total_paiements,
    COALESCE(SUM(c.total_couts), 0) AS total_couts,
    COALESCE(SUM(p.total_paiements), 0) - COALESCE(SUM(c.total_couts), 0) AS marge
  FROM interventions_periode ip
  INNER JOIN financial_interventions fi ON fi.intervention_id = ip.id
  LEFT JOIN paiements_agreges p ON p.intervention_id = ip.id
  LEFT JOIN couts_agreges c ON c.intervention_id = ip.id
  GROUP BY ip.assigned_user_id
  HAVING COUNT(DISTINCT fi.intervention_id) > 0
)
SELECT
  gestionnaire_id AS user_id,
  ROUND(marge, 2) AS total_margin,
  ROUND(total_paiements, 2) AS total_revenue,
  total_interventions,
  CASE
    WHEN total_paiements > 0
    THEN ROUND((marge / total_paiements) * 100, 2)
    ELSE 0
  END AS average_margin_percentage
FROM gestionnaire_stats
ORDER BY marge DESC
```

### 5.2. Indicateurs Affichés

Pour chaque gestionnaire dans le classement :

- **Position** : Rang dans le classement (1er, 2ème, 3ème, etc.)
- **Nom du Gestionnaire** : Prénom + Nom
- **Marge Totale** : Montant total de la marge générée (€)
- **CA Total** : Chiffre d'affaires total généré (€)
- **Nombre d'Interventions Terminées** : Compteur
- **Taux de Marge Moyen** : `(Marge / CA) × 100` (%)

### 5.3. Période du Podium

Le podium peut être calculé sur différentes périodes :
- Semaine en cours
- Mois en cours
- Année en cours
- Période personnalisée

---

## 6. Tableau Hebdomadaire/Mensuel/Annuel

Cette section présente un tableau détaillé des interventions et artisans sur une période donnée, découpée par jour (semaine), par semaine (mois), ou par mois (année).

### 6.1. Vue Hebdomadaire (Lundi - Vendredi)

**Description :** Affiche les statistiques pour chaque jour ouvré de la semaine.

#### 6.1.1. Calcul de la Période

**Formule :**
```
Lundi = Premier jour de la semaine (day = 1)
Mardi = Lundi + 1 jour
Mercredi = Lundi + 2 jours
Jeudi = Lundi + 3 jours
Vendredi = Lundi + 4 jours
```

**Code SQL :**
```sql
-- Trouver le lundi de la semaine
SELECT
  CASE
    WHEN EXTRACT(DOW FROM NOW()) = 0 THEN NOW() - INTERVAL '6 days'  -- Dimanche
    ELSE NOW() - INTERVAL '1 day' * (EXTRACT(DOW FROM NOW()) - 1)    -- Autre jour
  END AS monday
```

#### 6.1.2. Devis Envoyés par Jour

**Description :** Nombre de devis envoyés chaque jour de la semaine.

**Formule :**
```
Pour chaque jour (lundi à vendredi) :
  Devis Envoyés = COUNT(interventions)
    où statut = 'DEVIS_ENVOYE'
    ET date = jour
    ET assigned_user_id = gestionnaire_id
```

**Code SQL :**
```sql
SELECT
  EXTRACT(DOW FROM i.date) AS day_of_week,
  COUNT(*) AS devis_envoyes
FROM interventions i
JOIN intervention_statuses ist ON ist.id = i.statut_id
WHERE i.assigned_user_id = :userId
  AND i.date >= :monday
  AND i.date < :saturday
  AND ist.code = 'DEVIS_ENVOYE'
  AND i.is_active = true
GROUP BY EXTRACT(DOW FROM i.date)
```

#### 6.1.3. Interventions En Cours par Jour

**Description :** Nombre d'interventions en cours chaque jour.

**Formule :**
```
Pour chaque jour :
  En Cours = COUNT(interventions)
    où statut = 'INTER_EN_COURS'
    ET date = jour
```

#### 6.1.4. Interventions Facturées par Jour

**Description :** Nombre d'interventions terminées et facturées chaque jour.

**Formule :**
```
Pour chaque jour :
  Facturées = COUNT(interventions)
    où statut = 'INTER_TERMINEE'
    ET date = jour
```

#### 6.1.5. Nouveaux Artisans par Jour

**Description :** Nombre de nouveaux artisans créés chaque jour de la semaine.

**Formule :**
```
Pour chaque jour :
  Nouveaux Artisans = COUNT(DISTINCT artisan_id)
    où artisan.created_at >= début_jour
    ET artisan.created_at < fin_jour
    ET artisan apparaît dans une intervention du gestionnaire
```

**Code SQL :**
```sql
SELECT
  EXTRACT(DOW FROM a.created_at) AS day_of_week,
  COUNT(DISTINCT a.id) AS nouveaux_artisans
FROM artisans a
JOIN interventions i ON i.artisan_id = a.id
WHERE i.assigned_user_id = :userId
  AND a.created_at >= :monday
  AND a.created_at < :saturday
  AND i.is_active = true
GROUP BY EXTRACT(DOW FROM a.created_at)
```

#### 6.1.6. Totaux Hebdomadaires

**Description :** Somme de chaque catégorie sur toute la semaine.

**Formule :**
```
Total Devis Envoyés = Σ(devis lundi à vendredi)
Total En Cours = Σ(en cours lundi à vendredi)
Total Facturées = Σ(facturées lundi à vendredi)
Total Nouveaux Artisans = Σ(nouveaux artisans lundi à vendredi)
```

---

### 6.2. Vue Mensuelle (Semaines 1-5)

**Description :** Affiche les statistiques pour chaque semaine du mois (du lundi au vendredi).

#### 6.2.1. Calcul des Semaines

**Formule :**
```
Mois Début = Premier jour du mois
Mois Fin = Dernier jour du mois

Pour chaque semaine complète dans le mois :
  Semaine Début = Lundi de la semaine
  Semaine Fin = Vendredi de la semaine

  Si Semaine Début <= Mois Fin :
    Ajouter la semaine au tableau
```

**Code SQL :**
```sql
-- Générer les semaines du mois
WITH RECURSIVE weeks AS (
  SELECT
    DATE_TRUNC('week', DATE_TRUNC('month', :date)) AS week_start
  UNION ALL
  SELECT
    week_start + INTERVAL '1 week'
  FROM weeks
  WHERE week_start + INTERVAL '1 week' <= DATE_TRUNC('month', :date) + INTERVAL '1 month' - INTERVAL '1 day'
)
SELECT week_start, week_start + INTERVAL '4 days' AS week_end
FROM weeks
```

#### 6.2.2. Statistiques par Semaine

Les mêmes catégories que la vue hebdomadaire sont calculées, mais agrégées par semaine :

- **Semaine 1** : Devis envoyés, En cours, Facturées, Nouveaux Artisans
- **Semaine 2** : idem
- **Semaine 3** : idem
- **Semaine 4** : idem
- **Semaine 5** : idem (si le mois contient 5 semaines)

**Formule :**
```
Pour chaque semaine N :
  Devis Envoyés = COUNT(interventions)
    où statut = 'DEVIS_ENVOYE'
    ET date >= semaine_N_debut
    ET date <= semaine_N_fin
```

#### 6.2.3. Total Mensuel

**Description :** Somme de toutes les semaines du mois.

---

### 6.3. Vue Annuelle (Mois 1-12)

**Description :** Affiche les statistiques pour chaque mois de l'année.

#### 6.3.1. Calcul des Mois

**Formule :**
```
Année = Année sélectionnée
Pour chaque mois (Janvier à Décembre) :
  Mois Début = Premier jour du mois
  Mois Fin = Dernier jour du mois
```

**Code SQL :**
```sql
-- Générer les mois de l'année
SELECT
  generate_series(
    DATE_TRUNC('year', :date),
    DATE_TRUNC('year', :date) + INTERVAL '11 months',
    INTERVAL '1 month'
  ) AS month_start
```

#### 6.3.2. Statistiques par Mois

Les mêmes catégories sont calculées pour chaque mois :

- **Janvier** : Devis envoyés, En cours, Facturées, Nouveaux Artisans
- **Février** : idem
- ... jusqu'à **Décembre**

**Formule :**
```
Pour chaque mois M :
  Devis Envoyés = COUNT(interventions)
    où statut = 'DEVIS_ENVOYE'
    ET EXTRACT(MONTH FROM date) = M
    ET EXTRACT(YEAR FROM date) = année_sélectionnée
```

**Code SQL :**
```sql
SELECT
  EXTRACT(MONTH FROM i.date) AS month,
  COUNT(*) AS devis_envoyes
FROM interventions i
JOIN intervention_statuses ist ON ist.id = i.statut_id
WHERE i.assigned_user_id = :userId
  AND EXTRACT(YEAR FROM i.date) = :year
  AND ist.code = 'DEVIS_ENVOYE'
  AND i.is_active = true
GROUP BY EXTRACT(MONTH FROM i.date)
ORDER BY month
```

#### 6.3.3. Total Annuel

**Description :** Somme de tous les mois de l'année.

---

## Notes Techniques

### Filtres Appliqués

Toutes les requêtes du dashboard gestionnaire appliquent automatiquement :

1. **Filtre Utilisateur** : `assigned_user_id = gestionnaire_id`
2. **Filtre Période** : `date >= période_début AND date <= période_fin`
3. **Filtre Actif** : `is_active = true`

### Période de Calcul

La période peut être :
- **Semaine** : Du lundi au vendredi de la semaine sélectionnée
- **Mois** : Du 1er au dernier jour du mois sélectionné
- **Année** : Du 1er janvier au 31 décembre de l'année sélectionnée

**Important :** Les interventions sont sélectionnées sur la base de leur **date de création** (`interventions.date`), pas sur la date de transition de statut.

### Types de Coûts

Le système distingue trois types de coûts dans `intervention_costs` :

- **`intervention`** : Montant facturé au client (utilisé pour le CA)
- **`sst`** : Coûts de sous-traitance
- **`materiel`** : Coûts de matériel

**Formule de Marge :**
```
Marge = CA - (Coûts SST + Coûts Matériel)
Taux de Marge (%) = (Marge / CA) × 100
```

### Arrondis

Les pourcentages et montants sont arrondis à 2 décimales :
```sql
ROUND(valeur, 2)
```

### Gestion des Valeurs Nulles

Tous les calculs utilisent `COALESCE()` pour gérer les valeurs nulles et retourner `0` par défaut, évitant ainsi les erreurs de division par zéro.

**Exemple :**
```sql
COALESCE(SUM(amount), 0) AS total
```

### Performance et Optimisation

- Les requêtes utilisent des `JOIN` optimisés pour minimiser les accès disque
- Les filtres sur `assigned_user_id` et `date` utilisent des index pour accélérer les recherches
- Les agrégations (`COUNT`, `SUM`) sont effectuées au niveau de la base de données pour réduire le volume de données transférées

---

## Conclusion

Ce document présente l'ensemble des formules et calculs utilisés dans le tableau de bord gestionnaire. Chaque indicateur est calculé de manière cohérente et prend en compte les filtres appliqués (utilisateur, période) pour fournir une vue précise et personnalisée des performances du gestionnaire.

Les données sont agrégées selon trois niveaux de granularité :
1. **Semaine** : Détail jour par jour (lundi à vendredi)
2. **Mois** : Détail semaine par semaine (semaines 1 à 5)
3. **Année** : Détail mois par mois (janvier à décembre)

Pour toute question ou clarification, veuillez consulter :
- Le code source des hooks : [useDashboardStats.ts](src/hooks/useDashboardStats.ts)
- Le code source de l'API : [interventionsApi.ts](src/lib/api/v2/interventionsApi.ts)
- La page du dashboard : [app/dashboard/page.tsx](app/dashboard/page.tsx)
