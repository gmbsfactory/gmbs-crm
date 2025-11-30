# Tests de l'API Interventions v2

## Test des Transitions Automatiques

Le script `test-automatic-transitions-api-v2.ts` teste le système de transitions automatiques de statuts pour les interventions.

### Qu'est-ce qui est testé ?

Le système crée automatiquement une **chaîne complète de transitions** lorsqu'une intervention passe directement d'un statut à un autre. Par exemple, si vous créez une intervention avec le statut `TERMINE`, le système créera automatiquement toutes les transitions intermédiaires :

```
NULL → DEMANDE → DEVIS_ENVOYE → VISITE_TECHNIQUE → ACCEPTE → EN_COURS → TERMINE
```

### Scénarios testés

1. **Test 1 : CREATE avec statut final**
   - Création d'une intervention directement avec le statut `TERMINE`
   - Vérifie que toute la chaîne de transitions est créée

2. **Test 2 : UPDATE avec changement de statut**
   - Création d'une intervention avec `DEMANDE`
   - Mise à jour vers `TERMINE`
   - Vérifie que les transitions intermédiaires sont créées

3. **Test 3 : UPSERT UPDATE**
   - Création d'une intervention existante avec `DEMANDE`
   - Upsert vers `TERMINE`
   - Vérifie la gestion des transitions lors d'un upsert

4. **Test 4 : UPSERT INSERT**
   - Upsert d'une nouvelle intervention directement avec `TERMINE`
   - Vérifie que les transitions sont créées lors d'un upsert-insert

### Comment exécuter le test

```bash
npm run test:automatic-transitions:api-v2
```

### Prérequis

- Le fichier `.env.local` doit être configuré avec les bonnes variables d'environnement Supabase
- Une agence active doit exister dans la base de données
- Les statuts suivants doivent exister dans `intervention_statuses` :
  - `DEMANDE`
  - `DEVIS_ENVOYE`
  - `VISITE_TECHNIQUE`
  - `ACCEPTE`
  - `EN_COURS`
  - `TERMINE`

### Configuration de la chaîne

La chaîne de transitions est configurée dans `src/config/intervention-status-chains.ts`.

Si vous modifiez la chaîne, pensez à mettre à jour la constante `EXPECTED_FULL_CHAIN` dans le fichier de test.

### Structure du code

- **Service de transitions** : `src/lib/interventions/automatic-transition-service.ts`
- **Calculateur de chaîne** : `src/lib/interventions/status-chain-calculator.ts`
- **Configuration** : `src/config/intervention-status-chains.ts`
- **Intégration API** : `src/lib/api/v2/interventionsApi.ts`

### Résultat attendu

Si tout fonctionne correctement, vous verrez :

```
╔════════════════════════════════════════════════════════════╗
║  ✅ TOUS LES TESTS RÉUSSIS !                                  ║
╚════════════════════════════════════════════════════════════╝
```

### Debugging

Le test affiche les transitions créées pour chaque scénario. Exemple :

```
Transitions créées:
1. NULL → DEMANDE (intermédiaire)
2. DEMANDE → DEVIS_ENVOYE (intermédiaire)
3. DEVIS_ENVOYE → VISITE_TECHNIQUE (intermédiaire)
4. VISITE_TECHNIQUE → ACCEPTE (intermédiaire)
5. ACCEPTE → EN_COURS (intermédiaire)
6. EN_COURS → TERMINE (final)
```

Les transitions sont marquées comme `(intermédiaire)` ou `(final)` via les métadonnées.

### Nettoyage

Le test nettoie automatiquement toutes les interventions et transitions créées après chaque test.

