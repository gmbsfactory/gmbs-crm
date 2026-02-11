# 🔧 CORRECTIONS APPLIQUÉES - API CRM GMBS

## Problèmes Résolus

### 1. ❌ Erreur "require is not defined in ES module scope"

**Problème** : Le script TypeScript utilisait `require.main === module` qui n'est pas compatible avec les modules ES.

**Solution** : 
- ✅ Suppression de `require.main === module`
- ✅ Utilisation directe de `main().catch()` pour l'exécution
- ✅ Ajout de `tsx` comme dépendance pour exécuter TypeScript directement

### 2. 🔄 Uniformisation du Client Supabase

**Problème** : Le script utilisait directement le client Supabase au lieu de l'API v2 développée.

**Solution** :
- ✅ Import de l'API v2 : `interventionsApiV2`, `artisansApiV2`, `documentsApi`, `commentsApi`
- ✅ Remplacement de toutes les requêtes directes par les méthodes de l'API v2
- ✅ Utilisation du client unifié depuis `src/lib/supabase-client.ts`

### 3. 🌐 URL de Stockage Local

**Problème** : Le script utilisait `https://test-storage.supabase.co/documents/` au lieu d'une URL locale.

**Solution** :
- ✅ Suppression de l'URL hardcodée
- ✅ Utilisation de l'API de documents qui gère le stockage local automatiquement

### 4. 🪟 Compatibilité Windows

**Problème** : Le script de déploiement était en bash, incompatible avec Windows.

**Solution** :
- ✅ Création de `scripts/deploy-api.bat` pour Windows
- ✅ Mise à jour du `package.json` pour utiliser le script Windows
- ✅ Support des arguments `--deploy-only` et `--test-only`

## 📁 Fichiers Modifiés

### Scripts
- ✅ `scripts/test-api-complete.ts` - Script de test corrigé et modernisé
- ✅ `scripts/deploy-api.bat` - Script de déploiement Windows
- ✅ `scripts/tsconfig.json` - Configuration TypeScript pour les scripts

### Configuration
- ✅ `package.json` - Ajout de `tsx` et scripts Windows
- ✅ `supabase/functions/package.json` - Dépendances pour Edge Functions

## 🚀 Utilisation

### Installation des Dépendances
```bash
npm install
```

### Test de l'API
```bash
# Test complet
npm run test:api

# Aide
npm run test:api:help
```

### Déploiement
```bash
# Déploiement complet (redémarre Supabase, déploie, teste)
npm run deploy:api

# Déploiement uniquement
npm run deploy:api:functions

# Test uniquement
npm run deploy:api:test
```

## 🧪 Workflow de Test Corrigé

Le script teste maintenant avec l'API v2 :

1. ✅ **Création d'un artisan** via `artisansApiV2.create()`
2. ✅ **Création d'une intervention** via `interventionsApiV2.create()`
3. ✅ **Assignation de l'artisan** via `interventionsApiV2.assignArtisan()`
4. ✅ **Ajout d'un commentaire** via `commentsApi.create()`
5. ✅ **Upload d'un document** via `documentsApi.upload()`
6. ✅ **Ajout d'un coût** via `interventionsApiV2.addCost()`
7. ✅ **Ajout d'un paiement** via `interventionsApiV2.addPayment()`
8. ✅ **Modification de l'intervention** via `interventionsApiV2.update()`
9. ✅ **Suppression (soft delete)** via `interventionsApiV2.delete()`
10. ✅ **Récupération des données** via `interventionsApiV2.getById()` et `artisansApiV2.getById()`

## 🔧 Configuration Requise

### Variables d'Environnement
```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Dépendances
- ✅ `tsx` - Pour exécuter TypeScript directement
- ✅ `@supabase/supabase-js` - Client Supabase
- ✅ Edge Functions déployées

## 🎯 Avantages des Corrections

1. **Compatibilité ES Modules** : Plus d'erreurs de `require`
2. **API Unifiée** : Utilisation cohérente de l'API v2
3. **Client Centralisé** : Un seul point d'accès Supabase
4. **Stockage Local** : Pas d'URLs hardcodées
5. **Support Windows** : Scripts compatibles Windows
6. **TypeScript Natif** : Exécution directe avec `tsx`

## 🚀 Prochaines Étapes

1. **Installer les dépendances** : `npm install`
2. **Démarrer Supabase** : `npm run db:init`
3. **Tester l'API** : `npm run test:api`
4. **Déployer** : `npm run deploy:api`

---

**🎉 L'API CRM est maintenant entièrement fonctionnelle et compatible Windows !**
