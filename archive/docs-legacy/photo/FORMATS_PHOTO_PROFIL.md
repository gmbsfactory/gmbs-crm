# Formats de Fichiers Acceptés pour les Photos de Profil

## ✅ Formats Supportés

Pour qu'une photo de profil s'affiche correctement, vous devez utiliser un **fichier image** dans l'un des formats suivants :

### Formats Recommandés (meilleure qualité/taille)

1. **JPEG / JPG** (`image/jpeg`)
   - ✅ Supporté par tous les navigateurs
   - ✅ Bonne compression
   - ✅ Idéal pour les photos
   - **Extensions** : `.jpg`, `.jpeg`

2. **PNG** (`image/png`)
   - ✅ Supporté par tous les navigateurs
   - ✅ Support de la transparence
   - ✅ Idéal pour les logos et images avec transparence
   - **Extensions** : `.png`

3. **WebP** (`image/webp`)
   - ✅ Meilleure compression que JPEG/PNG
   - ✅ Supporté par les navigateurs modernes
   - ✅ Format recommandé pour le web
   - **Extensions** : `.webp`

### Formats Alternatifs

4. **GIF** (`image/gif`)
   - ✅ Supporté par tous les navigateurs
   - ⚠️ Limité à 256 couleurs
   - **Extensions** : `.gif`

5. **AVIF** (`image/avif`)
   - ✅ Très bonne compression
   - ⚠️ Support limité aux navigateurs récents
   - **Extensions** : `.avif`

## ❌ Formats NON Supportés

### PDF (`application/pdf`)
- ❌ **Ne fonctionne PAS** pour les photos de profil
- ❌ Le système vérifie explicitement que le MIME type commence par `image/`
- ❌ Sharp WASM (utilisé pour le traitement) ne peut pas traiter les PDFs
- ✅ Utilisez plutôt : Convertir le PDF en image (JPEG/PNG) avant l'upload

### Autres formats non supportés
- ❌ Documents Word (`.doc`, `.docx`)
- ❌ Documents Excel (`.xls`, `.xlsx`)
- ❌ Fichiers texte (`.txt`)
- ❌ Autres formats non-image

## 🔍 Comment le Système Détecte les Images

Le système vérifie automatiquement le type MIME du fichier :

```typescript
// Dans supabase/functions/documents/index.ts
const isImage = body.mime_type?.startsWith('image/');
```

**Si le MIME type ne commence pas par `image/`** :
- Le fichier sera uploadé mais **ne sera pas traité** par `process-avatar`
- Aucun dérivé (40px, 80px, 160px) ne sera généré
- L'avatar ne s'affichera pas (seulement les initiales)

## 📋 Liste Complète des MIME Types Acceptés

| Format | MIME Type | Extension | Supporté |
|--------|-----------|-----------|----------|
| JPEG | `image/jpeg` | `.jpg`, `.jpeg` | ✅ Oui |
| PNG | `image/png` | `.png` | ✅ Oui |
| WebP | `image/webp` | `.webp` | ✅ Oui |
| GIF | `image/gif` | `.gif` | ✅ Oui |
| AVIF | `image/avif` | `.avif` | ✅ Oui |
| SVG | `image/svg+xml` | `.svg` | ⚠️ Supporté mais non recommandé (vecteur) |
| TIFF | `image/tiff` | `.tiff`, `.tif` | ✅ Oui |
| BMP | `image/bmp` | `.bmp` | ✅ Oui |
| PDF | `application/pdf` | `.pdf` | ❌ **NON** |
| Word | `application/msword` | `.doc` | ❌ **NON** |
| Excel | `application/vnd.ms-excel` | `.xls` | ❌ **NON** |

## 🛠️ Que Faire si Vous Avez un PDF ?

### Option 1 : Convertir en Image (Recommandé)

1. **Ouvrir le PDF** dans un visualiseur (Preview sur Mac, Adobe Reader, etc.)
2. **Exporter ou prendre une capture d'écran** en JPEG ou PNG
3. **Uploader l'image** au lieu du PDF

### Option 2 : Utiliser un Outil en Ligne

- [PDF to JPG Converter](https://www.ilovepdf.com/pdf-to-jpg)
- [SmallPDF](https://smallpdf.com/pdf-to-jpg)
- [Adobe Acrobat Online](https://www.adobe.com/acrobat/online/pdf-to-jpg.html)

### Option 3 : Utiliser une Commande (Mac/Linux)

```bash
# Convertir la première page d'un PDF en JPEG
convert input.pdf[0] output.jpg

# Ou avec sips (macOS)
sips -s format jpeg input.pdf --out output.jpg
```

## ⚙️ Traitement Automatique

Une fois qu'une image est uploadée :

1. ✅ **Vérification** : Le système vérifie que c'est bien une image (`image/*`)
2. ✅ **Traitement** : Sharp WASM génère automatiquement 3 tailles :
   - 40px (pour la liste)
   - 80px (pour la grille, 2x)
   - 160px (pour les vues détaillées)
3. ✅ **Conversion** : Les images sont converties en WebP (meilleure compression) avec fallback JPEG
4. ✅ **Optimisation** : Rotation EXIF automatique, suppression métadonnées, conversion sRGB

## 💡 Recommandations

### Pour les Photos de Profil

- **Format recommandé** : JPEG ou PNG
- **Taille recommandée** : 400x400px minimum (le système redimensionnera automatiquement)
- **Poids recommandé** : < 2 MB (le système optimisera automatiquement)
- **Ratio** : Carré (1:1) pour un meilleur rendu

### Exemples de Bonnes Pratiques

✅ **Bon** :
- Photo prise avec un smartphone (JPEG)
- Image exportée depuis Photoshop/Illustrator (PNG/JPEG)
- Capture d'écran convertie en JPEG

❌ **Mauvais** :
- PDF directement uploadé
- Document Word avec image intégrée
- Fichier trop lourd (> 10 MB)

## 🔍 Vérifier le Type MIME d'un Fichier

### Dans le Terminal (Mac/Linux)

```bash
file --mime-type photo.jpg
# Résultat : photo.jpg: image/jpeg
```

### Dans le Navigateur

```javascript
// Dans la console du navigateur
const file = document.querySelector('input[type="file"]').files[0];
console.log('MIME type:', file.type);
console.log('Nom:', file.name);
```

## 📝 Résumé

- ✅ **Utilisez** : JPEG, PNG, WebP, GIF
- ❌ **N'utilisez PAS** : PDF, Word, Excel, ou tout autre format non-image
- 🔄 **Si vous avez un PDF** : Convertissez-le en image avant l'upload

