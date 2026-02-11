# 🔍 Guide de Vérification des Documents Importés

Ce guide explique comment vérifier que les documents sont bien importés et uploadés dans Supabase Storage.

## 📋 Méthodes de Vérification

### 1. Vérification Rapide (Recommandée)

Vérifie un échantillon de documents récents et teste leur accessibilité :

```bash
npm run drive:verify-storage
```

Par défaut, vérifie 10 documents récents. Pour vérifier plus :

```bash
npm run drive:verify-storage -- --sample=50
```

### 2. Vérification d'une Intervention Spécifique

Pour vérifier tous les documents d'une intervention :

```bash
npm run drive:verify-storage -- --intervention --id=<intervention_id>
```

Exemple :
```bash
npm run drive:verify-storage -- --intervention --id=123e4567-e89b-12d3-a456-426614174000
```

### 3. Vérification d'un Artisan Spécifique

Pour vérifier tous les documents d'un artisan :

```bash
npm run drive:verify-storage -- --artisan --id=<artisan_id>
```

### 4. Vérification via SQL (Supabase Dashboard)

Connectez-vous au Supabase Dashboard et exécutez ces requêtes :

#### Documents récemment importés (24h)
```sql
SELECT 
  ia.id,
  ia.filename,
  ia.kind,
  ia.url,
  ia.file_size,
  ia.created_at,
  i.id_inter,
  CASE 
    WHEN ia.url LIKE '%drive.google.com%' THEN 'Google Drive'
    WHEN ia.url LIKE '%storage/v1/object/public/documents%' THEN 'Supabase Storage'
    ELSE 'Autre'
  END as source_stockage
FROM public.intervention_attachments ia
JOIN public.interventions i ON ia.intervention_id = i.id
WHERE ia.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY ia.created_at DESC
LIMIT 50;
```

#### Documents avec URL Google Drive (à réimporter)
```sql
SELECT 
  COUNT(*) as total_google_drive,
  COUNT(DISTINCT intervention_id) as interventions_affectees
FROM public.intervention_attachments
WHERE url LIKE '%drive.google.com%';
```

#### Documents dans Supabase Storage
```sql
SELECT 
  COUNT(*) as total_storage,
  COUNT(DISTINCT intervention_id) as interventions_avec_documents,
  SUM(file_size) / 1024 / 1024 as taille_totale_mb
FROM public.intervention_attachments
WHERE url LIKE '%storage/v1/object/public/documents%';
```

### 5. Vérification Manuelle dans le CRM

1. **Ouvrez une intervention** dans le CRM
2. **Section Documents** : Les documents importés devraient apparaître
3. **Cliquez sur un document** : Il devrait s'ouvrir dans un nouvel onglet
4. **Vérifiez l'URL** : Elle doit pointer vers Supabase Storage, pas Google Drive

## ✅ Ce que le Script Vérifie

Le script `verify-storage-upload.js` vérifie :

1. ✅ **Présence en base de données** : Les documents sont bien enregistrés dans `intervention_attachments` ou `artisan_attachments`

2. ✅ **URL Supabase Storage** : Les URLs pointent vers Supabase Storage (pas Google Drive)
   - Format attendu : `http://127.0.0.1:54321/storage/v1/object/public/documents/...`
   - Ou : `https://<project>.supabase.co/storage/v1/object/public/documents/...`

3. ✅ **Accessibilité HTTP** : Les fichiers sont accessibles via HTTP (test HEAD request)
   - Code de statut 200 = ✅ Accessible
   - Autre code ou erreur = ❌ Problème

4. ✅ **Présence dans Storage** : Les fichiers existent réellement dans le bucket `documents`
   - Vérifie via l'API Supabase Storage
   - Nécessite `SUPABASE_SERVICE_ROLE_KEY`

## 📊 Interprétation des Résultats

### ✅ Tout est OK
```
Documents dans Supabase Storage: 10 (100.0%)
Documents accessibles: 10 (100.0%)
Documents avec URL Google Drive: 0 (0.0%)
Problèmes détectés: 0 (0.0%)
```

### ⚠️ Documents avec URL Google Drive
```
Documents avec URL Google Drive: 5 (50.0%)
```
**Action** : Relancez l'import pour télécharger ces fichiers dans Storage :
```bash
npm run drive:import-all-documents
```

### ❌ Fichiers non accessibles
```
Documents accessibles: 7 (70.0%)
Problèmes détectés: 3 (30.0%)
```
**Actions possibles** :
1. Vérifiez que le bucket `documents` est public dans Supabase Dashboard
2. Vérifiez que l'URL Supabase est correcte dans `.env.local`
3. Vérifiez votre connexion réseau

## 🔧 Dépannage

### Problème : "Client Supabase non initialisé"
**Solution** : Vérifiez que ces variables sont définies dans `.env.local` :
```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<votre_service_role_key>
```

### Problème : "Fichier non accessible"
**Solutions** :
1. Vérifiez que le bucket `documents` est public :
   ```sql
   -- Dans Supabase Dashboard > Storage > documents > Settings
   -- Vérifiez que "Public bucket" est activé
   ```

2. Vérifiez l'URL dans `.env.local` :
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
   ```

### Problème : "Fichier non trouvé dans Storage"
**Solution** : Le fichier n'a peut-être pas été uploadé correctement. Relancez l'import :
```bash
npm run drive:import-all-documents -- --force-extraction
```

## 📝 Exemples de Sortie

### Exemple 1 : Tout fonctionne
```
🔍 VÉRIFICATION DES DOCUMENTS DANS SUPABASE STORAGE
═══════════════════════════════════════════════════════════

📊 Analyse d'un échantillon de 10 documents récents...

✅ 10 document(s) récent(s) trouvé(s)

📄 Document 1/10: facture.pdf
   Type: factureGMBS
   URL: http://127.0.0.1:54321/storage/v1/object/public/documents/intervention/...
   ✅ URL Supabase Storage
   ✅ Fichier accessible (200, 245.67 KB)
   ✅ Fichier présent dans Storage

═══════════════════════════════════════════════════════════
📊 STATISTIQUES GLOBALES
═══════════════════════════════════════════════════════════

Total de documents vérifiés: 10
Documents dans Supabase Storage: 10 (100.0%)
Documents accessibles: 10 (100.0%)
Documents avec URL Google Drive: 0 (0.0%)
Problèmes détectés: 0 (0.0%)

✅ Vérification terminée !
```

### Exemple 2 : Problèmes détectés
```
⚠️  Problèmes détectés:

   1. document1.pdf: URL Google Drive (pas dans Storage)
   2. document2.pdf: Non accessible: 404
   3. document3.pdf: Fichier non trouvé dans Storage

💡 Recommandation:
   Certains documents ont encore des URLs Google Drive.
   Relancez l'import pour télécharger ces fichiers dans Supabase Storage.
```

## 🚀 Workflow Recommandé

1. **Après l'import** :
   ```bash
   npm run drive:verify-storage -- --sample=50
   ```

2. **Si des problèmes sont détectés** :
   ```bash
   # Relancer l'import pour corriger
   npm run drive:import-all-documents
   ```

3. **Vérifier à nouveau** :
   ```bash
   npm run drive:verify-storage -- --sample=50
   ```

4. **Vérifier une intervention spécifique** :
   ```bash
   npm run drive:verify-storage -- --intervention --id=<id>
   ```

