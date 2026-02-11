# Initialisation des objectifs par défaut en production

## Problème

La table `gestionnaire_targets` est vide en production alors qu'elle contient des données en local. Cela est dû au fait que le fichier `seed_default_performance.sql` utilise des UUIDs fixes qui ne correspondent pas aux utilisateurs en production.

## Solution

Deux options sont disponibles pour initialiser les objectifs par défaut :

### Option 1 : Migration automatique (recommandé)

La migration `00047_seed_default_targets.sql` sera automatiquement exécutée lors du prochain déploiement des migrations. Elle insère automatiquement des objectifs par défaut pour tous les gestionnaires existants.

**Valeurs par défaut :**
- **Semaine (week)** : 1 500€ de marge, 40% de performance
- **Mois (month)** : 5 000€ de marge, 40% de performance
- **Année (year)** : 58 000€ de marge, 40% de performance

### Option 2 : Script manuel

Si vous souhaitez initialiser les données immédiatement sans attendre le déploiement :

#### Via Supabase Dashboard

1. Connectez-vous au [Supabase Dashboard](https://app.supabase.com)
2. Sélectionnez votre projet
3. Allez dans **SQL Editor**
4. Copiez le contenu de `supabase/seeds/init_default_targets.sql`
5. Exécutez le script

#### Via ligne de commande

```bash
# Avec psql directement
psql $DATABASE_URL -f supabase/seeds/init_default_targets.sql

# Ou avec Supabase CLI (si configuré)
supabase db execute --file supabase/seeds/init_default_targets.sql
```

#### Via l'API Supabase

Vous pouvez également créer une Edge Function ou utiliser l'API Supabase pour exécuter le script.

## Vérification

Après l'exécution, vérifiez que les données ont été créées :

```sql
-- Compter le nombre d'objectifs créés
SELECT COUNT(*) FROM public.gestionnaire_targets;

-- Voir les objectifs par gestionnaire
SELECT 
  u.username,
  u.firstname,
  u.lastname,
  gt.period_type,
  gt.margin_target,
  gt.performance_target
FROM public.gestionnaire_targets gt
JOIN public.users u ON gt.user_id = u.id
ORDER BY u.username, gt.period_type;
```

## Notes importantes

- Le script utilise `ON CONFLICT DO NOTHING`, donc il est sûr de l'exécuter plusieurs fois
- Seuls les gestionnaires (non-admin) recevront des objectifs par défaut
- Les objectifs existants ne seront pas modifiés
- Le script trouve automatiquement l'utilisateur admin pour définir le champ `created_by`

## Personnalisation

Si vous souhaitez modifier les valeurs par défaut, éditez le script `init_default_targets.sql` et changez les valeurs dans la section `INSERT INTO` :

```sql
INSERT INTO public.gestionnaire_targets (user_id, period_type, margin_target, performance_target, created_by)
VALUES
  (gestionnaire_record.id, 'week', 1500.00, 40.00, admin_user_id),  -- Modifier ici
  (gestionnaire_record.id, 'month', 5000.00, 40.00, admin_user_id),  -- Modifier ici
  (gestionnaire_record.id, 'year', 58000.00, 40.00, admin_user_id)  -- Modifier ici
```

