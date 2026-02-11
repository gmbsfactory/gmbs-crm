# Guide d'Implémentation - Traitement d'Images pour Avatars

## Problème Actuel

La fonction `processImage` dans `supabase/functions/process-avatar/index.ts` retourne actuellement l'image originale sans aucun traitement. Cela signifie que :

- ❌ Pas de normalisation EXIF (rotation automatique)
- ❌ Pas de redimensionnement (les "dérivés" sont identiques à l'original)
- ❌ Pas de conversion de format (WebP/JPEG)
- ❌ Les métadonnées `derived_sizes` contiennent des URLs vers des fichiers identiques

## Solutions Recommandées

### Option 1 : Sharp WASM (Recommandé)

**Avantages** :
- Même API que Sharp natif (très populaire)
- Performant et bien maintenu
- Support complet : EXIF, redimensionnement, conversion WebP/JPEG
- Fonctionne dans Deno Edge Functions

**Implémentation** :

```typescript
// Dans supabase/functions/process-avatar/index.ts
import sharp from 'https://esm.sh/sharp-wasm@0.31.0';

async function processImage(
  imageBuffer: Uint8Array,
  size: AvatarSize,
  format: 'webp' | 'jpeg' = 'webp'
): Promise<Uint8Array> {
  // Initialiser Sharp WASM
  await sharp();
  
  // Traiter l'image
  const processed = await sharp(imageBuffer)
    .rotate() // Rotation automatique basée sur EXIF
    .resize(size, size, {
      fit: 'cover', // Crop en carré
      position: 'center'
    })
    .toColorspace('srgb') // Convertir en sRGB
    .toFormat(format === 'webp' ? 'webp' : 'jpeg', {
      quality: format === 'webp' ? 85 : 90,
      mozjpeg: format === 'jpeg' // Optimisation JPEG
    })
    .removeAlpha() // Supprimer canal alpha si présent
    .toBuffer();
  
  return new Uint8Array(processed);
}
```

**Installation** :
- Aucune installation nécessaire, import via ESM
- Taille du bundle WASM : ~2MB (acceptable pour Edge Functions)

**Ressources** :
- Documentation : https://github.com/lovell/sharp-wasm
- Exemples : https://github.com/lovell/sharp-wasm/tree/main/examples

### Option 2 : Service Externe (Cloudflare Images, Imgix, etc.)

**Avantages** :
- Pas de bundle à charger
- Très performant (CDN intégré)
- Pas de limite de CPU/mémoire côté Edge Function

**Implémentation avec Cloudflare Images** :

```typescript
async function processImage(
  imageBuffer: Uint8Array,
  size: AvatarSize,
  format: 'webp' | 'jpeg' = 'webp'
): Promise<Uint8Array> {
  // 1. Upload l'image originale vers Cloudflare Images
  const uploadResponse = await fetch('https://api.cloudflare.com/client/v4/accounts/{account_id}/images/v1', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('CLOUDFLARE_API_TOKEN')!}`,
    },
    body: imageBuffer
  });
  
  const { result } = await uploadResponse.json();
  const imageId = result.id;
  
  // 2. Générer l'URL du dérivé avec transformations
  const variantUrl = `https://imagedelivery.net/{account_hash}/${imageId}/avatar-${size}${format === 'webp' ? '-webp' : ''}`;
  
  // 3. Télécharger le dérivé généré
  const variantResponse = await fetch(variantUrl);
  const variantBuffer = await variantResponse.arrayBuffer();
  
  return new Uint8Array(variantBuffer);
}
```

**Coûts** :
- Cloudflare Images : Gratuit jusqu'à 100k images/mois
- Imgix : Payant selon usage

### Option 3 : Service Interne (Worker dédié)

**Avantages** :
- Contrôle total sur le traitement
- Pas de dépendance externe
- Peut utiliser Sharp natif dans un environnement Node.js

**Architecture** :
```
Edge Function (documents) 
  → Queue (Supabase Queue ou Redis)
    → Worker Node.js avec Sharp natif
      → Upload dérivés vers Storage
      → Mise à jour métadonnées
```

## Recommandation

**Pour le développement immédiat** : Option 1 (Sharp WASM)
- Facile à implémenter
- Pas de dépendance externe
- Performant pour les besoins d'avatars

**Pour la production à grande échelle** : Option 2 (Service externe)
- Meilleure performance
- Pas de limite de CPU/mémoire
- CDN intégré

## Plan d'Action

1. **Court terme** : Implémenter Sharp WASM dans `processImage`
2. **Moyen terme** : Tester les performances avec charge réelle
3. **Long terme** : Évaluer migration vers service externe si nécessaire

## Tests à Effectuer

Après implémentation, vérifier :

- ✅ Les dérivés sont bien redimensionnés (40px, 80px, 160px)
- ✅ Les fichiers sont bien en WebP (ou JPEG selon support)
- ✅ La rotation EXIF est appliquée automatiquement
- ✅ Les métadonnées sont supprimées
- ✅ Les `derived_sizes` contiennent les bonnes URLs
- ✅ Les performances sont acceptables (< 2s par traitement)

