# Flux de Gestion de la Photo de Profil des Artisans

## Vue d'ensemble

La photo de profil des artisans est stockée dans la base de données via le système de documents (`artisan_attachments`) et traitée automatiquement pour générer des dérivés optimisés (40px, 80px, 160px) en formats WebP/JPEG via Sharp WASM. Les métadonnées (hash, URLs des dérivés) sont stockées pour un affichage performant avec cache optimal.

## 1. Upload de la Photo de Profil

### Stockage dans la BDD

- **Table** : `artisan_attachments` (via le système de documents)
- **Kind** : `photo_profil`
- **Contrainte** : Un seul document avec `kind = 'photo_profil'` par artisan (unicité garantie)
- **Métadonnées** :
  - `content_hash` : Hash SHA-256 du contenu pour déduplication et versioning
  - `derived_sizes` : JSONB contenant les URLs des dérivés `{"40": "url", "80": "url", "160": "url"}`
  - `mime_preferred` : Format MIME préféré (`image/webp` ou `image/jpeg`)

### Processus d'upload

1. **Sélection du kind** : L'utilisateur sélectionne `photo_profil` dans le menu déroulant des types de documents
2. **Upload** : Le fichier image est uploadé via `DocumentManager` vers Supabase Storage
3. **Détection automatique** : Le système détecte qu'il s'agit d'une `photo_profil` pour un artisan
4. **Suppression de l'ancienne** : Si une `photo_profil` existe déjà pour cet artisan, elle est automatiquement supprimée avant l'upload de la nouvelle
5. **Enregistrement** : La nouvelle photo est enregistrée avec `kind = 'photo_profil'` dans `artisan_attachments`
6. **Traitement asynchrone** : La fonction Edge `process-avatar` est appelée en arrière-plan pour :
   - Normaliser l'image avec Sharp WASM : rotation EXIF automatique, conversion sRGB, suppression métadonnées
   - Générer des dérivés carrés optimisés : 40px, 80px, 160px (crop center)
   - Conversion de format : WebP (qualité 85) ou JPEG (qualité 90) selon support
   - Calculer le hash SHA-256 du contenu original
   - Uploader les dérivés vers `avatars/{artisan_id}/avatar_{hash}_{size}.webp`
   - Mettre à jour les métadonnées dans `artisan_attachments`

### Code concerné

```typescript
// src/components/documents/DocumentManager.tsx
// Si c'est une photo_profil pour un artisan, supprimer l'ancienne avant d'uploader
if (entityType === "artisan" && normalizedKind === "photo_profil") {
  // Recherche et suppression de l'ancienne photo_profil
}

// supabase/functions/documents/index.ts
// Après l'upload, déclencher le traitement d'image
if (body.entity_type === 'artisan' && canonicalKind === 'photo_profil') {
  // Appel asynchrone à process-avatar
}
```

## 2. Traitement d'Images (process-avatar)

### Edge Function : `supabase/functions/process-avatar/index.ts`

**Fonctionnalités** :
- Télécharge l'image originale depuis Supabase Storage
- Traite l'image avec Sharp WASM :
  - Rotation automatique basée sur EXIF
  - Redimensionnement en carré avec crop center
  - Conversion sRGB et suppression métadonnées
  - Conversion WebP (qualité 85) ou JPEG (qualité 90)
- Calcule le hash SHA-256 du contenu original
- Génère des dérivés carrés optimisés pour chaque taille (40px, 80px, 160px)
- Upload les dérivés vers `documents/avatars/{artisan_id}/avatar_{hash}_{size}.webp`
- Met à jour les métadonnées dans `artisan_attachments` :
  - `content_hash` : Hash du contenu original
  - `derived_sizes` : URLs des dérivés générés (vraiment redimensionnés)
  - `mime_preferred` : Format préféré (`image/webp` ou `image/jpeg`)

**Technologie** : Sharp WASM (`sharp-wasm@0.31.0`) pour traitement d'images dans Deno Edge Functions

**Headers cache** :
- `Cache-Control: public, max-age=31536000, immutable` (fichiers versionnés par hash)
- `Vary: Accept` (négociation de format)

## 3. Récupération de la Photo depuis la BDD

### Requête des données

Lors du chargement des artisans, les attachments sont inclus dans la requête avec les métadonnées :

```typescript
// src/lib/supabase-api-v2.ts - artisansApiV2.getAll()
// src/lib/api/v2/artisansApi.ts - artisansApi.getById()
artisan_attachments (
  id,
  kind,
  url,
  filename,
  mime_type,
  content_hash,
  derived_sizes,
  mime_preferred
)
```

### Mapping vers l'Artisan

La fonction `mapArtisanRecord()` extrait les métadonnées de la photo de profil :

```typescript
// src/lib/supabase-api-v2.ts - mapArtisanRecord()
const photoProfilAttachment = attachments.find(
      (att: any) => att?.kind === "photo_profil" && att?.url && att.url.trim() !== ""
    );

const photoProfilMetadata = photoProfilAttachment ? {
  hash: photoProfilAttachment.content_hash || null,
  sizes: photoProfilAttachment.derived_sizes || {},
  mime_preferred: photoProfilAttachment.mime_preferred || 'image/jpeg',
  baseUrl: photoProfilAttachment.url || null
} : null;

const photoProfilBaseUrl = photoProfilMetadata?.baseUrl || null;
```

### Mapping vers le Contact

Dans `app/artisans/page.tsx`, la fonction `mapArtisanToContact()` utilise les métadonnées :

```typescript
// app/artisans/page.tsx - mapArtisanToContact()
const photoProfilUrl = artisan.photoProfilBaseUrl || null
const photoProfilMetadata = artisan.photoProfilMetadata || null

// Contact {
//   photoProfilUrl: "https://..." | null
//   photoProfilMetadata: { hash, sizes, mime_preferred, baseUrl } | null
//   artisanInitials: "AB"
// }
```

## 4. Affichage dans l'Interface

### Composant Avatar

Le nouveau composant `Avatar` (`src/components/artisans/Avatar.tsx`) remplace `ArtisanBadge` :

```typescript
// src/components/artisans/Avatar.tsx
<Avatar
  photoProfilMetadata={contact.photoProfilMetadata}
  initials={contact.artisanInitials || "??"}
  name={contact.name}
  size={40}
  priority={index < 3}
/>
```

**Fonctionnalités** :
- Utilise `next/image` pour l'optimisation automatique
- `srcSet` pour les différentes résolutions (40px 1x, 80px 2x)
- Sélection automatique du dérivé approprié selon la taille demandée
- Fallback initials + gradient déterministe si pas de photo ou erreur
- Gestion `onError` sans boucle infinie
- `loading="lazy"` et `decoding="async"` pour performance
- `fetchpriority="high"` pour les 2-3 premières images

### Comportement d'affichage

- **Si photo existe avec dérivés** :
  - Utilise le dérivé de la taille appropriée (40px, 80px, 160px)
  - Format WebP si disponible, sinon JPEG
  - Initiales blanches avec ombre de texte par-dessus pour lisibilité
  
- **Si photo existe sans dérivés** :
  - Utilise l'URL de base originale
  - Fallback sur initiales si erreur de chargement
  
- **Si pas de photo** :
  - Gradient coloré déterministe basé sur les initiales
  - Initiales avec couleur primaire

### Emplacements d'affichage

1. **Vue Liste** : Avatar dans la colonne "Artisan" du tableau (40px)
2. **Vue Grille** : Avatar dans l'en-tête de chaque carte d'artisan (40px)
3. **Modal Artisan** : Avatar dans le header du modal à côté du nom de l'artisan (48px)

## 5. Performance & Optimisation

### Pagination serveur

- Les artisans sont chargés par batches de 100 via `useArtisans({ limit: 100 })`
- Infinite scroll ou bouton "Charger plus" pour charger les batches suivants
- Optimise les performances pour les grandes listes (6000+ artisans)

### Cache CDN

- Fichiers versionnés par hash → cache immutable (1 an)
- Headers `Cache-Control: public, max-age=31536000, immutable`
- `Vary: Accept` pour négociation de format

### Optimisations frontend

- Lazy loading des images (`loading="lazy"`)
- Décodage asynchrone (`decoding="async"`)
- Priorité élevée pour les premières images (`fetchpriority="high"`)
- `srcSet` pour sélection automatique de la résolution

## 6. Gestion des Erreurs

### Détection d'erreur de chargement

Le composant `Avatar` gère les erreurs automatiquement :

```typescript
<Image
  src={imageUrl}
  onError={() => {
    setImageError(true)
  }}
  />
```

### Fallback automatique

Si la photo ne charge pas :
- `imageError` passe à `true`
- L'avatar bascule automatiquement sur l'affichage avec initiales et gradient déterministe
- Pas de boucle infinie grâce à la gestion d'état

## Schéma du Flux

```
┌─────────────────────────────────────────────────────────────┐
│ 1. UPLOAD                                                   │
│    ┌──────────────┐                                         │
│    │ DocumentManager                                        │
│    │ - Sélection kind: "photo_profil"                      │
│    │ - Upload fichier vers Storage                          │
│    │ - Suppression ancienne photo_profil (si existe)        │
│    └──────────────┘                                         │
│           │                                                  │
│           ▼                                                  │
│    ┌──────────────┐                                         │
│    │ artisan_attachments                                    │
│    │ - kind: "photo_profil"                                 │
│    │ - url: "https://..."                                   │
│    │ - artisan_id: "xxx"                                    │
│    └──────────────┘                                         │
│           │                                                  │
│           ▼                                                  │
│    ┌──────────────┐                                         │
│    │ process-avatar (async)                                  │
│    │ - Normalise image                                      │
│    │ - Génère dérivés 40/80/160px                           │
│    │ - Calcule hash SHA-256                                 │
│    │ - Upload dérivés                                       │
│    │ - Met à jour métadonnées                               │
│    └──────────────┘                                         │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. RÉCUPÉRATION                                             │
│    ┌──────────────┐                                         │
│    │ useArtisans()                                          │
│    │ - Charge artisans + attachments + métadonnées          │
│    └──────────────┘                                         │
│           │                                                  │
│           ▼                                                  │
│    ┌──────────────┐                                         │
│    │ mapArtisanRecord()                                     │
│    │ - Extrait photoProfilMetadata                          │
│    │   { hash, sizes: {40, 80, 160}, mime_preferred }       │
│    │ - Extrait photoProfilBaseUrl                           │
│    └──────────────┘                                         │
│           │                                                  │
│           ▼                                                  │
│    ┌──────────────┐                                         │
│    │ mapArtisanToContact()                                 │
│    │ - Utilise photoProfilMetadata                          │
│    │ - Calcule initiales (fallback)                         │
│    └──────────────┘                                         │
│           │                                                  │
│           ▼                                                  │
│    ┌──────────────┐                                         │
│    │ Contact {                                              │
│    │   photoProfilUrl: "https://..." | null                 │
│    │   photoProfilMetadata: { hash, sizes, ... } | null     │
│    │   artisanInitials: "AB"                                │
│    │ }                                                       │
│    └──────────────┘                                         │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. AFFICHAGE                                                │
│    ┌──────────────┐                                         │
│    │ Avatar                                                 │
│    │ - Si photoProfilMetadata existe :                      │
│    │   → Utilise dérivé approprié (40/80/160px)            │
│    │   → Format WebP prioritaire                           │
│    │   → srcSet pour résolutions multiples                 │
│    │   → Initiales blanches par-dessus                     │
│    │ - Sinon :                                              │
│    │   → Gradient déterministe                             │
│    │   → Initiales colorées                                │
│    └──────────────┘                                         │
│           │                                                  │
│           ▼                                                  │
│    ┌──────────────┐                                         │
│    │ Vue Liste / Vue Grille                                │
│    │ Avatar affiché avec photo ou initiales                │
│    │ Pagination serveur (batches de 100)                   │
│    └──────────────┘                                         │
└─────────────────────────────────────────────────────────────┘
```

## Points Clés

✅ **Unicité** : Une seule `photo_profil` par artisan (ancienne supprimée automatiquement)

✅ **Traitement automatique** : Génération de dérivés optimisés (40/80/160px) en WebP/JPEG

✅ **Métadonnées** : Hash SHA-256, URLs des dérivés, format préféré stockés en BDD

✅ **Cache optimal** : Fichiers versionnés par hash → cache immutable (1 an)

✅ **Fallback robuste** : Si pas de photo ou erreur → initiales avec gradient déterministe

✅ **Performance** : Pagination serveur (100 par batch), lazy loading, srcSet, optimisations Next.js Image

✅ **UX** : Initiales toujours visibles (blanches sur photo, colorées sur gradient)

## Structure de Stockage

```
Supabase Storage (bucket: documents)
  └── avatars/
      └── {artisan_id}/
          ├── avatar_{hash}_40.webp
          ├── avatar_{hash}_80.webp
          ├── avatar_{hash}_160.webp
          └── avatar_{hash}_40.jpg (fallback si WebP non supporté)
```

## Format des Métadonnées

```typescript
{
  content_hash: "a1b2c3d4e5f6...", // SHA-256
  derived_sizes: {
    "40": "https://.../avatar_{hash}_40.webp",
    "80": "https://.../avatar_{hash}_80.webp",
    "160": "https://.../avatar_{hash}_160.webp"
  },
  mime_preferred: "image/webp" | "image/jpeg"
}
```
