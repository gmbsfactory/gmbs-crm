# Guide de Test - Système de Photos de Profil Artisans

## 📋 État Actuel

✅ **Code implémenté** :
- Edge Function `process-avatar` avec Sharp WASM
- Migration SQL pour métadonnées (`20250115120000_add_avatar_metadata.sql`)
- Composant `Avatar` avec optimisation Next.js Image
- Intégration dans la page artisans (liste + grille)
- Pagination serveur (100 par batch)

✅ **Prêt à tester** : Tout le code est en place, il faut maintenant :
1. Appliquer les migrations
2. Déployer les Edge Functions
3. Tester le pipeline complet

---

## 🚀 Étape 1 : Appliquer les Migrations

### 1.1 Vérifier que Supabase est démarré

```bash
# Vérifier le statut
supabase status

# Si pas démarré, démarrer
supabase start
```

### 1.2 Appliquer les migrations

```bash
# Réinitialiser la base (applique toutes les migrations)
supabase db reset
```

**Vérification** : La commande doit se terminer sans erreur. Vous devriez voir :
- ✅ `Applying migration 20250115000000_update_document_kinds.sql...`
- ✅ `Applying migration 20250115120000_add_avatar_metadata.sql...`

### 1.3 Vérifier que les colonnes existent

```bash
# Se connecter à la base
supabase db connect

# Vérifier les colonnes
\d artisan_attachments
```

Vous devriez voir les nouvelles colonnes :
- `content_hash`
- `derived_sizes`
- `mime_preferred`

**⚠️ Si vous voyez une erreur dans la console du navigateur** :
- Erreur mentionnant `content_hash`, `derived_sizes`, ou `mime_preferred`
- Cela signifie que la migration n'a pas été appliquée
- **Solution** : Relancer `supabase db reset` et vérifier qu'il n'y a pas d'erreur

---

## 🔧 Étape 2 : Déployer les Edge Functions

### 2.1 Vérifier que les fonctions sont présentes

```bash
# Lister les fonctions
ls supabase/functions/

# Vous devriez voir :
# - documents/
# - process-avatar/  ← Nouvelle fonction
# - artisans-v2/
# - etc.
```

### 2.2 Déployer en local (pour développement)

Les Edge Functions sont automatiquement disponibles en local quand Supabase est démarré. Pas besoin de déployer manuellement en local.

**Pour la production** (plus tard) :
```bash
# Déployer toutes les fonctions
supabase functions deploy

# Ou déployer seulement process-avatar
supabase functions deploy process-avatar
```

---

## 🧪 Étape 3 : Tester le Pipeline Complet

### 3.1 Prérequis

1. **Démarrer l'application Next.js** :
```bash
npm run dev
```

2. **Ouvrir l'application** : http://localhost:3000

3. **Se connecter** avec un compte utilisateur

### 3.2 Test 1 : Upload d'une Photo de Profil

1. **Aller sur la page Artisans** : `/artisans`

2. **Ouvrir un artisan** (clic sur "Voir Détails" ou "Modifier")

3. **Aller dans l'onglet Documents** (si disponible dans le modal)

4. **Uploader une photo de profil** :
   - Cliquer sur "Ajouter"
   - Sélectionner le type : **"Photo de profil"**
   - Choisir une image (JPEG, PNG, WebP)
   - Cliquer sur "Importer"

5. **Vérifier dans les logs** :
```bash
# Dans un autre terminal, suivre les logs Supabase
supabase functions logs process-avatar --follow
```

Vous devriez voir :
- `Process Avatar request started`
- `Sharp WASM initialized` (première fois uniquement)
- `Image processed successfully: 40px webp (... bytes)`
- `Image processed successfully: 80px webp (... bytes)`
- `Image processed successfully: 160px webp (... bytes)`
- `Avatar processing completed`

### 3.3 Test 2 : Vérifier les Métadonnées en Base

```bash
# Se connecter à la base
supabase db connect

# Vérifier les métadonnées
SELECT 
  id,
  artisan_id,
  kind,
  content_hash,
  derived_sizes,
  mime_preferred,
  url
FROM artisan_attachments
WHERE kind = 'photo_profil'
ORDER BY created_at DESC
LIMIT 1;
```

**Résultat attendu** :
- `content_hash` : Hash SHA-256 (64 caractères hex)
- `derived_sizes` : JSON avec `{"40": "url", "80": "url", "160": "url"}`
- `mime_preferred` : `image/webp` ou `image/jpeg`

### 3.4 Test 3 : Vérifier les Fichiers dans Storage

1. **Ouvrir Supabase Studio** : http://localhost:54323

2. **Aller dans Storage** → `documents`

3. **Naviguer vers** : `avatars/{artisan_id}/`

4. **Vérifier les fichiers** :
   - `avatar_{hash}_40.webp` (petit fichier ~2-5 KB)
   - `avatar_{hash}_80.webp` (fichier moyen ~5-10 KB)
   - `avatar_{hash}_160.webp` (fichier plus grand ~10-20 KB)

**⚠️ Important** : Les fichiers doivent être **beaucoup plus petits** que l'original. Si les tailles sont similaires, le traitement n'a pas fonctionné.

### 3.5 Test 4 : Vérifier l'Affichage dans la Liste

1. **Retourner sur la page Artisans** : `/artisans`

2. **Vérifier l'avatar** :
   - L'avatar doit s'afficher avec la photo (pas seulement les initiales)
   - Si vous zoomez (Ctrl/Cmd +), l'image doit être nette (pas pixelisée)
   - Les initiales doivent être visibles par-dessus la photo (blanc avec ombre)

3. **Tester le fallback** :
   - Ouvrir les DevTools (F12)
   - Aller dans l'onglet Network
   - Bloquer l'image (clic droit → Block request URL)
   - Recharger la page
   - L'avatar doit basculer sur les initiales avec gradient

### 3.6 Test 5 : Vérifier la Pagination

1. **Sur la page Artisans**, vérifier que :
   - Seuls les premiers 100 artisans sont chargés
   - Un bouton "Charger plus" apparaît en bas (si plus de 100 artisans)
   - Les avatars se chargent au fur et à mesure du scroll

2. **Vérifier les performances** :
   - Ouvrir les DevTools → Performance
   - Enregistrer pendant le scroll
   - Vérifier que le FPS reste stable (> 30 FPS)

---

## 🔍 Vérifications Détaillées

### Vérifier que Sharp WASM fonctionne

**Test manuel de la fonction** :

```bash
# Créer un script de test
cat > test-process-avatar.sh << 'EOF'
#!/bin/bash

# Récupérer les variables d'environnement
source .env.local 2>/dev/null || true

# URL de la fonction
FUNCTIONS_URL="${SUPABASE_URL:-http://127.0.0.1:54321}/functions/v1"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"

# Créer un artisan de test d'abord (via API ou manuellement)
# Puis uploader une photo via l'interface
# Ensuite tester process-avatar directement :

curl -X POST "${FUNCTIONS_URL}/process-avatar" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "artisan_id": "VOTRE_ARTISAN_ID",
    "attachment_id": "VOTRE_ATTACHMENT_ID",
    "image_url": "URL_DE_L_IMAGE_ORIGINALE",
    "mime_type": "image/jpeg"
  }'
EOF

chmod +x test-process-avatar.sh
```

### Vérifier les Tailles de Fichiers

```sql
-- Comparer la taille de l'original vs les dérivés
SELECT 
  a.id,
  a.filename,
  a.file_size as original_size,
  a.derived_sizes->>'40' as url_40px,
  a.derived_sizes->>'80' as url_80px,
  a.derived_sizes->>'160' as url_160px
FROM artisan_attachments a
WHERE a.kind = 'photo_profil'
ORDER BY a.created_at DESC
LIMIT 5;
```

**Résultat attendu** :
- Original : ~500 KB - 2 MB (selon la photo)
- 40px : ~2-5 KB
- 80px : ~5-10 KB
- 160px : ~10-20 KB

---

## 🐛 Dépannage

### Problème : Les dérivés sont identiques à l'original

**Symptôme** : Les fichiers `avatar_{hash}_40.webp` font la même taille que l'original.

**Cause** : Sharp WASM n'a pas fonctionné (erreur silencieuse ou non chargé).

**Solution** :
1. Vérifier les logs : `supabase functions logs process-avatar`
2. Chercher les erreurs Sharp WASM
3. Vérifier que l'import fonctionne : `import sharp from 'https://esm.sh/sharp-wasm@0.31.0'`

### Problème : L'avatar ne s'affiche pas

**Symptôme** : Seules les initiales s'affichent, pas la photo.

**Vérifications** :
1. Ouvrir DevTools → Console → Chercher les erreurs d'images
2. Vérifier que `photoProfilMetadata` est présent dans les données
3. Vérifier que les URLs dans `derived_sizes` sont accessibles

**Solution** :
- Vérifier la config Next.js Image (`next.config.mjs`)
- Vérifier que le domaine Supabase est dans `remotePatterns`

### Problème : Erreur "Invalid src prop" dans Next.js Image

**Cause** : Le domaine Supabase n'est pas autorisé dans `next.config.mjs`.

**Solution** : Vérifier que `images.remotePatterns` contient bien les domaines Supabase (déjà fait dans le code).

### Problème : La fonction process-avatar ne se déclenche pas

**Vérifications** :
1. Vérifier les logs de `documents` : `supabase functions logs documents`
2. Chercher "Error calling process-avatar"
3. Vérifier que l'URL de la fonction est correcte

**Solution** :
- Vérifier `SUPABASE_URL` dans les variables d'environnement
- Vérifier que `process-avatar` est bien déployée

---

## ✅ Checklist de Validation

Avant de considérer que tout fonctionne :

- [ ] Les migrations s'appliquent sans erreur
- [ ] Les colonnes `content_hash`, `derived_sizes`, `mime_preferred` existent
- [ ] L'upload d'une photo de profil fonctionne
- [ ] Les logs montrent "Sharp WASM initialized"
- [ ] Les logs montrent "Image processed successfully" pour chaque taille
- [ ] Les fichiers dans Storage sont bien redimensionnés (tailles différentes)
- [ ] Les métadonnées en BDD contiennent les URLs des dérivés
- [ ] L'avatar s'affiche correctement dans la liste
- [ ] L'avatar s'affiche correctement dans la grille
- [ ] Le fallback fonctionne si l'image ne charge pas
- [ ] La pagination fonctionne (chargement par batches de 100)
- [ ] Les performances sont bonnes (FPS stable)

---

## 📊 Métriques à Surveiller

### Temps de Traitement

Dans les logs `process-avatar`, noter :
- **Premier appel** : ~3-5 secondes (chargement Sharp WASM + traitement)
- **Appels suivants** : ~1-2 secondes (traitement seul)

### Taille des Dérivés

Comparer avec l'original :
- **Réduction attendue** : 90-95% pour 40px, 80-90% pour 80px, 70-85% pour 160px

### Performance Frontend

- **Temps de chargement initial** : < 2s pour 100 avatars
- **FPS pendant scroll** : > 30 FPS
- **Mémoire utilisée** : Stable, pas de fuite

---

## 🎯 Prochaines Étapes (Optionnel)

Une fois que tout fonctionne :

1. **Optimiser les qualités** : Ajuster les paramètres `quality` dans `processImage` si nécessaire
2. **Ajouter un modal de visualisation** : Clic sur avatar → modal avec image 160px ou 512px
3. **Monitoring** : Ajouter des métriques pour suivre les performances
4. **Cache warming** : Pré-générer les dérivés pour les artisans fréquemment consultés

---

## 📝 Notes Importantes

- **Sharp WASM** : Le premier appel sera plus lent (~3-5s) à cause du chargement du WASM (~2MB)
- **Fallback** : Si Sharp WASM échoue, l'original est utilisé (pas d'erreur bloquante)
- **Cache** : Les fichiers sont versionnés par hash, donc cache immutable (1 an)
- **Production** : N'oubliez pas de déployer les Edge Functions avec `supabase functions deploy`

