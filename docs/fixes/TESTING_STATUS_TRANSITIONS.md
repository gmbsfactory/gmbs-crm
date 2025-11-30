# Guide de test : Transitions de statut avec chaîne complète

## 📋 Vue d'ensemble

Ce document explique comment tester que les transitions de statut créent bien toute la chaîne intermédiaire automatiquement.

## 🎯 Objectif des tests

Vérifier que lorsqu'une intervention passe de `DEMANDE` à `INTER_TERMINEE`, toutes les transitions intermédiaires sont créées :

```
DEMANDE → DEVIS_ENVOYE → VISITE_TECHNIQUE → ACCEPTE → INTER_EN_COURS → INTER_TERMINEE
```

## 🧪 Méthodes de test

### Méthode 1 : Test SQL direct (✅ Recommandé pour debug)

**Fichiers de test :**
- `supabase/samples/sql/test_fix_status_chain.sql`
- `supabase/samples/sql/test_intervention_statut_transition.sql`

**Commande :**
Exécutez le fichier SQL dans votre éditeur de base de données préféré (Supabase Studio, pgAdmin, etc.)

**Avantages :**
- ✅ Rapide à exécuter
- ✅ Facile à débugger
- ✅ Voit directement les données en DB

**Inconvénients :**
- ❌ Nécessite remplacer manuellement les IDs
- ❌ Ne teste pas l'API TypeScript

---

### Méthode 2 : Test via script Node.js - Logique API (✅ Recommandé)

**Fichier :** `scripts/test-api/test-status-transition-api.mjs`

**Commande :**
```bash
npm run test:status-transition
```

**Ce que fait le script :**
1. ✅ Crée une intervention de test avec `DEMANDE`
2. ✅ **Simule `interventionsApi.update()`** :
   - Appelle `AutomaticTransitionService.executeTransition()` (répliqué en JS)
   - Crée les transitions une par une via `log_status_transition_from_api`
   - Fait un UPDATE de l'intervention
3. ✅ Vérifie que 6 transitions sont créées
4. ✅ Valide que la chaîne est complète
5. ✅ Nettoie automatiquement

**Avantages :**
- ✅ Teste la **même logique que l'API réelle**
- ✅ Vérifie que `AutomaticTransitionService` fonctionne correctement
- ✅ Automatique et propre

---

### Méthode 2bis : Test via script Node.js - Fonction SQL

**Fichier :** `scripts/test-api/test-status-transition-simple.mjs`

**Commande :**
```bash
npm run test:status-transition:sql
```

**Ce que fait le script :**
1. ✅ Crée une intervention de test
2. ✅ Appelle la fonction SQL `update_intervention_status_with_chain`
3. ✅ Vérifie les transitions
4. ✅ Nettoie automatiquement

**Avantages :**
- ✅ Teste la fonction SQL directement
- ✅ Plus rapide (une seule requête SQL)
- ✅ Utile pour tester les updates SQL directs

**Note :** Ce test utilise la fonction SQL directement, pas la logique TypeScript de l'API.

**Ce que fait le script :**
1. ✅ Crée une intervention de test avec `DEMANDE`
2. ✅ Appelle la fonction SQL `update_intervention_status_with_chain`
3. ✅ Vérifie que 6 transitions sont créées
4. ✅ Valide que la chaîne est complète
5. ✅ Nettoie automatiquement

**Avantages :**
- ✅ Automatique (pas besoin de remplacer les IDs)
- ✅ Nettoyage automatique
- ✅ Idéal pour intégration continue
- ✅ Résultat clair (succès/échec)

**Inconvénients :**
- ❌ Ne teste pas le service TypeScript

---

### Méthode 3 : Test alternatif (avec package dédié)

**Fichier :** `scripts/test-api/test-status-transition.js`

**Commande :**
```bash
npm run test:status-transition:sql
```

**Ce que fait le script :**
1. ✅ Installe les dépendances dans `scripts/test-api/`
2. ✅ Crée une intervention de test
3. ✅ Appelle la fonction SQL
4. ✅ Vérifie les transitions
5. ✅ Nettoie automatiquement

**Avantages :**
- ✅ Isolé (propre package.json)
- ✅ Facile à intégrer en CI/CD

**Inconvénients :**
- ❌ Installation séparée nécessaire

---

### Méthode 4 : Vérifier une intervention existante (✅ Pour debugging)

**Fichier :** `supabase/samples/sql/test_status_transition_implementation.sql`

**Utilisation :**
```sql
-- Remplacez 'H1' par votre id_inter
WHERE i.id_inter = 'H1'
```

**Ce que fait le script :**
- ✅ Affiche toutes les transitions de l'intervention
- ✅ Montre la chaîne visuelle
- ✅ Vérifie chaque statut un par un

**Avantages :**
- ✅ Parfait pour débugger une intervention spécifique
- ✅ Voit la chaîne complète d'une vraie intervention

---

### Méthode 5 : Voir la chaîne d'une intervention (✅ Pour visualisation)

**Fichier :** `supabase/samples/sql/get_intervention_details.sql`

**Utilisation :**
```sql
-- Remplacez '4281' par votre id_inter
WHERE i.id_inter = '4281'
```

**Résultat :**
```
chaine_statuts: 🆕 DEMANDE → DEVIS_ENVOYE → VISITE_TECHNIQUE → ACCEPTE → INTER_EN_COURS → INTER_TERMINEE
nb_transitions: 6
```

**Avantages :**
- ✅ Vue claire et visuelle
- ✅ Inclut tous les détails de l'intervention
- ✅ Parfait pour présentation/documentation

---

## 🚀 Quick Start

### Test rapide (1 minute)

```bash
# 1. Installer les dépendances
cd scripts/test-api
npm install

# 2. Lancer le test
cd ../..
npm run test:status-transition
```

**Résultat attendu :**
```
✅ TEST RÉUSSI - Chaîne complète créée correctement
```

### Test SQL (2 minutes)

1. Ouvrir `supabase/samples/sql/test_fix_status_chain.sql`
2. Exécuter l'étape 1 (création intervention)
3. Noter l'ID retourné (ex: `TEST_FIX_20250129143022`)
4. Remplacer `YOUR_TEST_ID` partout par cet ID
5. Exécuter les étapes 3, 4, 5
6. Vérifier que 6 transitions sont créées
7. Exécuter l'étape 6 (nettoyage)

---

## 📊 Résultats attendus

### ✅ Succès

**Transitions créées :** 6

**Chaîne complète :**
1. `NULL → DEMANDE` (création initiale)
2. `DEMANDE → DEVIS_ENVOYE`
3. `DEVIS_ENVOYE → VISITE_TECHNIQUE`
4. `VISITE_TECHNIQUE → ACCEPTE`
5. `ACCEPTE → INTER_EN_COURS`
6. `INTER_EN_COURS → INTER_TERMINEE`

**Source :** `api`

**Créé par :** `update_intervention_status_with_chain` ou `AutomaticTransitionService`

### ❌ Échec

**Symptôme :** Seulement 1 transition créée

**Transitions :**
1. `DEMANDE → INTER_TERMINEE`

**Source :** `trigger`

**Cause :** Utilisation d'un `UPDATE` SQL direct au lieu de la fonction

**Solution :** Utiliser `update_intervention_status_with_chain()`

---

## 🔍 Troubleshooting

### Test échoué : Fonction non trouvée

**Erreur :**
```
function update_intervention_status_with_chain does not exist
```

**Solution :**
```bash
npm run db:reset
```

Ou appliquez manuellement la migration `00019_status_update_with_chain.sql`

### Test échoué : Chaîne incomplète

**Symptôme :** Seulement 1-2 transitions au lieu de 6

**Vérification :**
```sql
SELECT * FROM intervention_status_transitions 
WHERE intervention_id = 'votre-uuid'
ORDER BY transition_date ASC;
```

**Causes possibles :**
1. ❌ Fonction SQL non appliquée → Appliquer la migration
2. ❌ Utilisation de `UPDATE` direct → Utiliser la fonction
3. ❌ Codes de statut incorrects → Vérifier `INTER_EN_COURS` et `INTER_TERMINEE`

### Variables d'environnement manquantes

**Erreur :**
```
NEXT_PUBLIC_SUPABASE_URL: ❌
```

**Solution :**
Vérifiez que `.env.local` existe et contient :
```env
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-cle-anon
```

---

## 📚 Référence rapide

| Méthode | Commande | Temps | Automatique | Teste API | Dépendances |
|---------|----------|-------|-------------|-----------|-------------|
| SQL direct | Éditeur SQL | 2 min | ❌ | ❌ | ❌ |
| Node.js API | `npm run test:status-transition` | 10 sec | ✅ | ✅ | @supabase/supabase-js |
| Node.js SQL | `npm run test:status-transition:sql` | 10 sec | ✅ | ❌ | @supabase/supabase-js |
| Vérif existante | Éditeur SQL | 1 min | ❌ | N/A | ❌ |
| Visualisation | Éditeur SQL | 30 sec | ❌ | N/A | ❌ |

---

## 📁 Fichiers modifiés/créés

### Fichiers SQL modifiés
- ✅ `supabase/samples/sql/test_intervention_statut_transition.sql` - Test principal mis à jour
- ✅ `supabase/samples/sql/test_fix_status_chain.sql` - Test de fix mis à jour
- ✅ `supabase/samples/sql/test_status_transition_implementation.sql` - Vérification améliorée
- ✅ `supabase/samples/sql/get_intervention_details.sql` - Ajout chaîne de statut

### Nouveaux scripts de test
- ✅ `scripts/test-api/test-status-transition-api.mjs` - **Test principal (logique API) ⭐**
- ✅ `scripts/test-api/test-status-transition-simple.mjs` - Test fonction SQL
- ✅ `scripts/test-api/README.md` - Documentation

### Migration SQL
- ✅ `supabase/migrations/00019_status_update_with_chain.sql` - Fonction SQL

### Configuration
- ✅ `src/config/intervention-status-chains.ts` - Codes DB corrigés
- ✅ `src/config/interventions.ts` - Types étendus

### Documentation
- ✅ `docs/fixes/fix_status_chain_codes.md` - Explication du fix
- ✅ `docs/guides/status_transitions_guide.md` - Guide d'utilisation
- ✅ `docs/fixes/TESTING_STATUS_TRANSITIONS.md` - Ce document

