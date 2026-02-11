# ✅ Solution - Visualisation des documents dans le CRM

## 🔍 Problème identifié

Les documents étaient uploadés mais **invisibles** dans le CRM via l'icône œil 👁️.

### Causes :
1. **URLs factices** : Les documents n'étaient pas réellement uploadés vers Supabase Storage
2. **URL interne Docker** : L'URL générée (`http://kong:8000/...`) n'était pas accessible depuis le navigateur

## ✅ Solutions appliquées

### 1. Création du bucket Supabase Storage
- ✅ Migration `20251028_create_documents_bucket.sql` créée
- ✅ Bucket `documents` configuré (public, 50 MB max)
- ✅ Politiques RLS configurées

### 2. Correction de la fonction d'upload
- ✅ Upload réel vers Supabase Storage (au lieu d'URL factice)
- ✅ Décodage base64 → buffer
- ✅ **Fix URL** : Remplacement `http://kong:8000` → `http://127.0.0.1:54321`

### 3. Structure de stockage
```
Storage (bucket documents):
  └── intervention/
      └── {intervention_id}/
          └── intervention_{id}_{kind}_{timestamp}.{ext}
  └── artisan/
      └── {artisan_id}/
          └── artisan_{id}_{kind}_{timestamp}.{ext}

Base de données (intervention_attachments):
  - url: http://127.0.0.1:54321/storage/v1/object/public/documents/...
  - mime_type: image/jpeg, application/pdf, etc.
  - filename: nom original du fichier
  - file_size: taille en octets
```

## 🧪 Tests effectués

### ✅ Test 1 : Création du bucket
```bash
npm run test-storage
# Résultat : ✅ Bucket créé et public
```

### ✅ Test 2 : Upload de document
```bash
node scripts/test-document-upload.js
# Résultat : ✅ Document uploadé avec URL correcte
```

### ✅ Test 3 : Accessibilité de l'URL
```bash
curl -I http://127.0.0.1:54321/storage/v1/object/public/documents/...
# Résultat : HTTP 200 OK ✅
```

## 🚀 Pour tester dans votre CRM

1. **Redémarrez votre application Next.js** (si elle tourne)
2. **Ouvrez une intervention**
3. **Section Documents** : Cliquez sur "+ Ajouter"
4. **Uploadez une image** (JPEG, PNG, etc.)
5. **Cliquez sur l'icône œil 👁️** → L'image devrait s'afficher !

## 📊 URLs de test

- **Supabase Studio** : http://127.0.0.1:54323
  - Allez dans **Storage** → **documents** pour voir les fichiers

- **Test Document** : 
  - http://127.0.0.1:54321/storage/v1/object/public/documents/intervention/00000000-0000-0000-0000-000000000001/intervention_00000000-0000-0000-0000-000000000001_photos_1761692671230.png

## 🔧 Pour la production

Dans votre environnement de production, vous devrez définir :

```bash
# .env.production
SUPABASE_PUBLIC_URL=https://votre-projet.supabase.co
```

La fonction Edge remplacera automatiquement l'URL interne par celle-ci.

## 📝 Fichiers modifiés

1. ✅ `supabase/migrations/20251028_create_documents_bucket.sql`
2. ✅ `supabase/functions/documents/index.ts` (ligne 444-454)
3. ✅ `supabase/migrations/20251025_create_intervention_reminders.sql` (fix syntaxe)

## 🎯 Résultat

✅ Documents uploadés vers Supabase Storage  
✅ URLs accessibles depuis le navigateur  
✅ Preview fonctionnel avec l'icône œil 👁️  
✅ Support images (JPEG, PNG, GIF, WebP) + PDF  

