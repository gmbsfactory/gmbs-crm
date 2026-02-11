# Optimisation du scroll infini des interventions

## Objectif

- Remplacer la pagination `offset/limit` par un keyset basé sur `(date, id)`.
- Réduire le volume de données transférées et limiter les requêtes coûteuses.
- Préparer la navigation descendante/ascendante fluide (~6 000 lignes).

## API Supabase

- La fonction edge `interventions-v2` accepte désormais `cursor = { date, id, direction }` et renvoie `cursorNext`, `cursorPrev`, `hasMore`, `hasPrev`.
- Pagination ordonnée par `date DESC, id DESC` avec clause composite dans `or(...)` pour les déplacements.
- Cache TTL 120 s sur `count(*)` (clé = filtres sérialisés).
- Sélection par défaut réduite aux colonnes essentielles (relations lourdes exclues).
- Indices recommandés :
  ```sql
  CREATE INDEX IF NOT EXISTS idx_interventions_date_id_desc
    ON public.interventions (date DESC, id DESC);
  CREATE INDEX IF NOT EXISTS idx_interventions_assigned_status_date_id_desc
    ON public.interventions (assigned_user_id, statut_id, date DESC, id DESC);
  ```

## Client (`src/lib/supabase-api-v2`)

- `getAll` interroge l’edge function, transporte les curseurs et gère `416`.
- Les comptes (`getInterventionTotalCount`, `getInterventionCounts`) réutilisent `applyInterventionFilters`.
- `PaginatedResponse` étend la pagination avec `cursorNext`, `cursorPrev`, `hasPrev`, `direction`.

## Hook `useInterventions`

- Gestion via refs `cursorRef`, `prevCursorRef`, fenêtre glissante limitée à `MAX_CACHED_ITEMS` (par défaut 400).
- Cache `sessionStorage` : clé = `paramsKey + cursor + direction`.
- `loadMore(direction?: "forward" | "backward")` et `refresh` orchestrent les requêtes.
- Sur erreur `416`, `hasMore` passe à `false` jusqu’à un chargement arrière.

## Page `app/interventions/page.tsx`

- Les vues fournissent `visibleProperties` comme `fields` pour l’API.
- Instrumentation légère : `console.debug('[interventions] load', { cursor, count, duration, scope, historySize })`.
- `TableView` précharge en bas (`forward`) et en haut (`backward`).
- Registre in‑memory des curseurs par combinaison vue/filtres pour le diagnostic.

## Tests recommandés

1. **Happy path** : chargement initial 50, défilement jusqu’au bas → préfetch `forward` (pas de 416).
2. **Filtres statut + user** : vérifier la continuité des curseurs et le respect des filtres.
3. **Changement de vue / tri** : reset complet, nouveau `cursor`.
4. **Retour arrière** : scroller vers le haut déclenche `loadMore('backward')`.
5. **cache sessionStorage** : rechargement de la page → restitution immédiate du dernier lot.

## Notes

- Garder `applyInterventionFilters` en synchro si de nouveaux filtres apparaissent.
- Ajuster `SCROLL_CONFIG.MAX_CACHED_ITEMS` via env (`NEXT_PUBLIC_MAX_CACHED_ITEMS`).
- Supprimer l’ancien index `20251024_add_intervention_indexes.sql` seulement si doublon confirmé.
