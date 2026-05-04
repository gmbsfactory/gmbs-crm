# Spec — Podium mensuel avec rafraîchissement hebdo et débordement

**Statut :** Validé
**Date :** 2026-04-14
**Contexte :** GMBS-CRM, dashboard Podium gestionnaires (`#17`)

---

## 1. Objectif

Le podium agrège les performances des gestionnaires sur un **"mois podium"**,
qui ne correspond **pas** exactement au mois calendaire : il commence et se
termine sur un **vendredi 16h**, pour rester aligné avec le rythme des
rafraîchissements hebdomadaires.

Entre deux vendredis 16h, les valeurs affichées sont **figées** (snapshots
uniquement, jamais de live).

Au passage d'un mois podium à l'autre, le podium repart **immédiatement à zéro**.

---

## 2. Définition formelle

### 2.1 Ancre de mois

Pour un mois calendaire `M` (ex: avril 2026), on définit :

> `anchor(M)` = **le premier vendredi 16h qui tombe le 1er de M ou après**.

Exemples pour 2026 :
- `anchor(mars)` = vendredi 6 mars 16h (1er mars = dimanche)
- `anchor(avril)` = vendredi 3 avril 16h (1er avril = mercredi)
- `anchor(mai)` = vendredi 1er mai 16h (1er mai = vendredi)
- `anchor(juin)` = vendredi 5 juin 16h (1er juin = lundi)

### 2.2 Période podium courante

Soit `now` l'instant courant.

- **`period_start`** = la dernière ancre ≤ `now`.
- **`period_end`** = le dernier vendredi 16h ≤ `now` (toujours ≥ `period_start`).
- **Période fermante** = la prochaine ancre > `now` = `anchor(M_suivant)`. Elle
  n'est pas stockée, mais elle définit l'instant du prochain reset.

### 2.3 Reset

À l'instant `anchor(M+1)` exactement :
1. Un snapshot final du mois M est calculé et archivé dans `podium_periods`.
2. `period_start` bascule sur `anchor(M+1)`.
3. `period_end` bascule sur `anchor(M+1)` également → podium vide jusqu'au
   vendredi suivant.

---

## 3. Exemple complet : avril 2026

| Date / heure | `period_start` | `period_end` | Ce qu'affiche le podium |
|---|---|---|---|
| 2 avril (jeu) | 6 mars 16h | 27 mars 16h | Cumul mars, snapshot du 27 mars |
| 3 avril 15h59 (ven) | 6 mars 16h | 27 mars 16h | Idem, encore en "mois mars" |
| **3 avril 16h00** | **3 avril 16h** | **3 avril 16h** | **Reset → podium vide** |
| 4 avril (sam) | 3 avril 16h | 3 avril 16h | Vide |
| 10 avril 16h (ven) | 3 avril 16h | 10 avril 16h | 1 semaine d'avril |
| 17 avril 16h | 3 avril 16h | 17 avril 16h | 2 semaines |
| 24 avril 16h | 3 avril 16h | 24 avril 16h | 3 semaines |
| 30 avril (jeu) | 3 avril 16h | 24 avril 16h | Idem, pas de nouveau snapshot |
| 1er mai 15h59 (ven) | 3 avril 16h | 24 avril 16h | **Avril quasi complet** (encore visible) |
| **1er mai 16h00** | **1er mai 16h** | **1er mai 16h** | **Reset → mai vide** |

**Points clés :**
- Le "mois d'avril podium" dure exactement `[3 avril 16h, 1er mai 16h)` = 4 semaines.
- Aucune intervention n'est perdue : celles terminées entre le 24 et le 30 avril
  sont incluses dans le snapshot final pris au 1er mai 16h juste avant le reset.
- Juste après le reset (1er mai 16h01), l'utilisateur voit un podium vide.
  Le snapshot final d'avril reste accessible via `podium_periods` (historique).

---

## 4. Cas limites

### 4.1 Mois qui commence un vendredi

- 1er M = vendredi → `anchor(M) = 1er M à 16h`.
- 1er M 15h59 : encore dans le mois précédent (affichage de son dernier snapshot).
- 1er M 16h00 : reset immédiat, période = `[1er M 16h, 1er M 16h]`.

### 4.2 Mois avec 5 vendredis dans la période

Ex: si `anchor(M)` = 2e vendredi et `anchor(M+1)` = 2e vendredi du mois suivant
(configuration rare mais possible), la période contient 5 snapshots hebdo.
Aucun cas particulier dans le calcul — la règle tient naturellement.

### 4.3 Démarrage à froid (premier déploiement)

Au premier déploiement, si `now` est entre deux vendredis, la période courante
est correctement calculée par la règle `period_start = dernière ancre ≤ now`.
Aucun état initial n'est requis autre que l'appel à `refresh_current_podium_period()`.

---

## 5. Données affichées

Pour chaque gestionnaire, sur la fenêtre `[period_start, period_end]` :

| Métrique | Définition |
|---|---|
| **Marge** | Somme `paiements - coûts` des interventions dont la **transition vers `INTER_TERMINEE`** a eu lieu dans la fenêtre. |
| **Nb Inter Terminée** | Nombre d'interventions qui (a) ont **transitionné vers `INTER_TERMINEE`** dans la fenêtre **ET** (b) avaient `status_code = 'INTER_TERMINEE'` **au moment du snapshot hebdo**. Pas de recalcul en temps réel — **figé au snapshot**. |
| ~~CA~~ | Supprimé. Le toggle UI est remplacé par Marge ↔ Nb Inter Terminée. |

> **Important** : `Nb Inter Terminée` est un **snapshot figé**. Entre deux vendredis, si
> une intervention est re-rouverte (ex: passée à `INTER_LITIGE`), la valeur
> affichée ne change pas. Elle sera recalculée au prochain snapshot hebdo et
> disparaîtra alors du compte.

---

## 6. Implémentation

### 6.1 SQL — `get_current_podium_period()`

Réécriture complète (remplace la fonction de la migration `00048`). Pseudo-code :

```sql
-- Calcule anchor(M) = premier vendredi 16h >= 1er de M
CREATE OR REPLACE FUNCTION public.compute_month_anchor(p_month_start date)
RETURNS timestamptz AS $$
DECLARE
  v_dow int := EXTRACT(DOW FROM p_month_start); -- 0=dim, 5=ven
  v_days_to_friday int;
BEGIN
  -- Nombre de jours à ajouter pour atteindre le premier vendredi >= p_month_start
  v_days_to_friday := (5 - v_dow + 7) % 7;
  RETURN (p_month_start + (v_days_to_friday || ' days')::interval + interval '16 hours')
         AT TIME ZONE 'UTC';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.get_current_podium_period()
RETURNS jsonb AS $$
DECLARE
  v_now timestamptz := now();
  v_anchor_current timestamptz;
  v_anchor_next timestamptz;
  v_period_start timestamptz;
  v_period_end timestamptz;
BEGIN
  -- Tester d'abord si l'ancre du mois courant est déjà passée
  v_anchor_current := compute_month_anchor(date_trunc('month', v_now)::date);

  IF v_now >= v_anchor_current THEN
    v_period_start := v_anchor_current;
  ELSE
    -- Pas encore atteint l'ancre du mois courant : on est dans la période du mois précédent
    v_period_start := compute_month_anchor((date_trunc('month', v_now) - interval '1 month')::date);
  END IF;

  -- period_end = dernier vendredi 16h <= now (et >= period_start)
  v_period_end := GREATEST(
    v_period_start,
    -- Dernier vendredi 16h <= now
    date_trunc('day', v_now)
      - ((EXTRACT(DOW FROM v_now)::int + 2) % 7 || ' days')::interval
      + interval '16 hours'
      - CASE WHEN EXTRACT(DOW FROM v_now) = 5 AND EXTRACT(HOUR FROM v_now) < 16
             THEN interval '7 days' ELSE interval '0' END
  );

  RETURN jsonb_build_object(
    'period_start', v_period_start,
    'period_end', v_period_end,
    'is_active', true
  );
END;
$$ LANGUAGE plpgsql STABLE;
```

### 6.2 SQL — `get_podium_ranking_by_period()`

Migration `00062_podium_count_current_status.sql`.

Changement : la métrique `total_interventions` doit compter uniquement les
interventions actuellement en `INTER_TERMINEE`. On ajoute un filtre dans la
CTE `gestionnaire_stats` :

```sql
-- Avant: COUNT(DISTINCT tt.intervention_id)
-- Après:
COUNT(DISTINCT tt.intervention_id) FILTER (
  WHERE EXISTS (
    SELECT 1 FROM public.interventions i
    WHERE i.id = tt.intervention_id
      AND i.status_code = 'INTER_TERMINEE'
  )
) AS total_interventions
```

Le calcul de Marge / CA reste inchangé : basé sur toutes les transitions dans
la période, même si l'intervention a été re-rouverte ensuite.

### 6.3 Cron

Le cron actuel (`0 16 * * 5`) reste valide : il déclenche un rafraîchissement
hebdomadaire qui, par construction, détectera aussi les ancres de début de mois
(puisque toute ancre est un vendredi 16h).

**Aucun nouveau cron requis.** 🎉

### 6.4 Frontend

- `usePodiumPeriod` : aucun changement.
- `gestionnaire-ranking-podium.tsx` : déjà modifié (toggle Marge ↔ Nb Inter Terminée).
- `PodiumCard` / `BottomCard` : déjà modifiés.

---

## 7. Tests requis

| Niveau | Cas |
|---|---|
| Unit SQL | `compute_month_anchor` : 1er = dim / lun / ven / sam |
| Unit SQL | `get_current_podium_period` à `now` = mi-mois, veille d'ancre 15h59, jour d'ancre 16h01, 1er du mois = vendredi 16h01 |
| Unit SQL | `get_podium_ranking_by_period` : intervention terminée puis re-rouverte → compte dans Marge, pas dans Nb Inter Terminée |
| Intégration | Hook `usePodiumPeriod` détecte le changement d'ancre dans l'heure suivant le cron |

---

## 8. Migrations à créer

1. `00062_podium_monthly_overflow.sql`
   - `compute_month_anchor(date)` IMMUTABLE
   - Réécrit `get_current_podium_period()`
   - Réécrit `get_podium_ranking_by_period()` (filtre `Nb Inter Terminée` sur statut actuel)
   - `NOTIFY pgrst, 'reload schema'`

## 9. Historique des décisions

- **Q1 (perte de fin de mois)** : résolu par le débordement — plus de perte.
- **Q2 (live vs snapshot)** : snapshots hebdo uniquement, jamais de live.
- **Q3 (Nb Inter Terminée temps réel vs snapshot)** : snapshot hebdo uniquement.
- **Q4 (toggle CA)** : supprimé, remplacé par Nb Inter Terminée.
