# Spec — Podium mensuel cumulé avec rafraîchissement hebdo

**Statut :** Draft — en attente de validation
**Date :** 2026-04-14
**Contexte :** GMBS-CRM, dashboard Podium gestionnaires (`#17`)

---

## 1. Objectif

Le podium agrège les performances des gestionnaires sur **le mois en cours**, mais
ne se recalcule pas en continu : il est figé entre deux **rafraîchissements
hebdomadaires** qui ont lieu chaque vendredi à 16h.

Au passage d'un mois à l'autre, le podium repart à zéro : la fenêtre cumulée du
nouveau mois commence le 1er du mois.

---

## 2. Définition de la fenêtre `[period_start, period_end]`

Soit `now` l'instant courant.

- **`period_start`** = `00:00` du **1er jour du mois calendaire courant**.
- **`period_end`** = le **dernier vendredi 16h** ≤ `now`, **borné** au mois courant.

> "Borné au mois courant" = si le dernier vendredi 16h ≤ `now` est dans le
> mois précédent, alors `period_end = period_start` (podium vide en attendant
> le premier rafraîchissement du nouveau mois).

### Conséquence directe

Le podium n'est mis à jour qu'aux instants suivants :
1. **Vendredi 16h** : `period_end` avance d'une semaine (cumul de la semaine ajouté).
2. **1er du mois à 00:00** : `period_start` passe au nouveau mois, `period_end`
   se replie sur `period_start` (podium remis à zéro jusqu'au prochain vendredi).

Entre deux rafraîchissements, la fenêtre est **figée** : un job qui se termine
le mardi n'apparaît dans le podium que le vendredi suivant à 16h.

---

## 3. Cas limites

### 3.1 Premier vendredi du mois

- Mois M débute un mardi (1er M).
- Mardi 1er → vendredi 4 à 15h59 : `period_start = 1er`, `period_end = 1er`
  (podium vide, message "En attente du premier rafraîchissement").
- Vendredi 4 à 16h : `period_end = vendredi 4 16h`. Le podium affiche les
  interventions terminées entre le 1er 00h et le vendredi 4 16h.

### 3.2 Mois à 5 vendredis

Pas de cas particulier. Chaque vendredi 16h ≤ `now` dans le mois courant
incrémente `period_end`.

### 3.3 Transition de mois en milieu de semaine

- Mois M se termine un mercredi (dernier jour M = mercredi).
- Vendredi de la semaine précédente (dans M) à 16h : dernier rafraîchissement
  de M, `period_end = ce vendredi 16h`.
- Mercredi 23h59 → jeudi 1er M+1 00h : `period_start` bascule au 1er M+1,
  `period_end` = `period_start` (podium M+1 vide).
- Vendredi suivant 16h : premier rafraîchissement de M+1.

> **Conséquence acceptée :** les interventions terminées entre le dernier
> vendredi 16h de M et la fin de M ne sont **jamais affichées** dans le podium
> de M (elles arrivent trop tard dans le mois). Elles ne sont pas non plus dans
> M+1 (elles sont hors période). **À valider — voir Q1.**

### 3.4 Mois qui commence un vendredi

- 1er M = vendredi.
- Vendredi 1er à 00h : `period_start = 1er 00h`, `period_end = 1er 00h` (vide).
- Vendredi 1er à 16h : `period_end = 1er 16h`. Premier rafraîchissement.

---

## 4. Données affichées

Pour chaque gestionnaire, sur la fenêtre `[period_start, period_end]` :

| Métrique | Définition |
|---|---|
| **Marge** | Somme `paiements - coûts` des interventions dont la **transition vers `INTER_TERMINEE`** a eu lieu dans la fenêtre. |
| **CA** *(supprimé)* | — |
| **Nb Inter** | Nombre d'interventions qui (a) ont **transitionné vers `INTER_TERMINEE`** dans la fenêtre **ET** (b) ont **actuellement** `status_code = 'INTER_TERMINEE'` (ie. pas re-rouvertes depuis). |

> **Important sur `Nb Inter`** : double critère. La transition dans la période
> ne suffit pas — l'intervention doit toujours être en `INTER_TERMINEE` au
> moment du calcul. Si elle a été ré-ouverte (transition vers un autre statut
> après), elle ne compte pas.

---

## 5. Implémentation

### 5.1 SQL — `get_current_podium_period()`

Réécriture complète de la fonction (migration `00048`). Pseudo-code :

```sql
v_now           := now();
v_month_start   := date_trunc('month', v_now);
v_last_friday   := -- dernier vendredi 16h ≤ v_now
  CASE
    WHEN dow(v_now) = 5 AND hour(v_now) >= 16
      THEN date_trunc('day', v_now) + interval '16 hours'
    ELSE date_trunc('day', v_now)
         - interval '1 day' * ((dow(v_now) + 2) % 7)
         + interval '16 hours'
         - CASE WHEN dow(v_now) = 5 THEN interval '7 days' ELSE interval '0' END
  END;

v_period_start := v_month_start;
v_period_end   := GREATEST(v_month_start, v_last_friday);
```

### 5.2 SQL — `get_podium_ranking_by_period()`

Migration nouvelle (`00062_podium_count_current_status.sql`) :
- Ajouter une CTE `currently_terminees` qui filtre `transitions_terminees`
  sur `EXISTS (SELECT 1 FROM interventions WHERE id = ... AND status_code = 'INTER_TERMINEE')`.
- `total_interventions` = `COUNT(DISTINCT intervention_id)` sur cette CTE.
- **Marge / CA inchangés** : restent basés sur `transitions_terminees` (toutes
  les transitions dans la période, même si re-rouvertes ensuite).

### 5.3 Cron

Job actuel `0 16 * * 5` reste valide **mais insuffisant** : il faut aussi un
rafraîchissement au **1er du mois à 00h** pour que `period_start` bascule.

Ajouter :
```sql
SELECT cron.schedule(
  'refresh-podium-period-month',
  '0 0 1 * *',  -- 1er du mois à minuit UTC
  $$SELECT public.refresh_current_podium_period()$$
);
```

### 5.4 Frontend

- `usePodiumPeriod` : pas de changement (continue à poller `get_current_podium_period`).
- `gestionnaire-ranking-podium.tsx` : retirer le toggle CA, garder le toggle
  Marge ↔ Nb Inter (déjà fait dans le commit précédent).
- `PodiumCard` / `BottomCard` : déjà adaptés.

---

## 6. Tests requis

| Niveau | Cas |
|---|---|
| Unit SQL | `get_current_podium_period` : 1er du mois lundi, 1er du mois vendredi 14h, 1er du mois vendredi 17h, milieu de mois vendredi 16h, milieu de mois mardi, dernier jour du mois mercredi |
| Unit SQL | `get_podium_ranking_by_period` : intervention terminée puis re-rouverte (doit compter dans marge mais pas dans Nb Inter) |
| Intégration | Hook `usePodiumPeriod` : changement de mois détecté dans l'heure |

---

## 7. Questions ouvertes — à valider

**Q1.** Cas 3.3 : interventions terminées entre le dernier vendredi de M et
la fin de M sont perdues. Acceptable, ou faut-il un rafraîchissement
supplémentaire le dernier jour du mois à 23h59 ?

**Q2.** "Dernier vendredi 16h ≤ now borné au mois courant" — confirme : si on
est lundi 5 mai et que le 1er mai était un jeudi, le podium est-il vide
jusqu'au vendredi 9 mai 16h ? Ou veut-on que `period_end = now` en attendant
le premier vendredi (podium "live" pour la première semaine) ?

**Q3.** `Nb Inter` doit-il filtrer sur le statut **actuel** au moment de la
requête (donc change entre deux rafraîchissements si une intervention est
re-rouverte) ? Ou être figé au moment du rafraîchissement hebdo (snapshot) ?

**Q4.** Le toggle CA est-il définitivement supprimé, ou conservé en plus de
"Nb Inter" (3 options : Marge / CA / Nb Inter) ?
