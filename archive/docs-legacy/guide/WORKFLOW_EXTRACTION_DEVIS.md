# 📄 Workflow d'extraction automatique de devis

## 🎯 Vue d'ensemble

Ce guide décrit le processus complet pour extraire automatiquement les données d'une demande de devis (image ou PDF) et les insérer dans le CRM.

```
┌─────────────┐      ┌──────────┐      ┌─────────┐      ┌──────────┐
│ Image/PDF   │ ──▶  │   OCR    │ ──▶  │   LLM   │ ──▶  │   CRM    │
│  de devis   │      │ (Texte)  │      │ (JSON)  │      │ (API V2) │
└─────────────┘      └──────────┘      └─────────┘      └──────────┘
```

## 📋 Prérequis

### 1. Dépendances Python

```bash
pip install openai pillow pytesseract
```

### 2. Tesseract OCR

**Windows:**
```bash
# Télécharger depuis : https://github.com/UB-Mannheim/tesseract/wiki
# Installer et ajouter au PATH
```

**Linux:**
```bash
sudo apt-get install tesseract-ocr tesseract-ocr-fra
```

**macOS:**
```bash
brew install tesseract tesseract-lang
```

### 3. Clé API OpenAI

```bash
export OPENAI_API_KEY="sk-..."
```

## 🚀 Workflow complet

### Étape 1 : Préparer le dataset d'entraînement

Le dataset sert d'exemples pour le LLM (few-shot learning).

**Fichiers:**
- `data/samples/intervention_docs/train.jsonl` : Format recommandé
- `data/samples/intervention_docs/train_improved.csv` : Format CSV enrichi

**Structure d'un exemple:**

```json
{
  "document_path": "demande_devis/exemple.jpeg",
  "ocr_text": "Texte brut extrait du document...",
  "extracted_data": {
    "metier": "Plomberie",
    "tenant": {
      "firstname": "Jean",
      "lastname": "Dupont",
      "email": "jean.dupont@email.com",
      "telephone": "0612345678",
      "adresse": "19 rue de l'amiral courbet",
      "ville": "Lille",
      "code_postal": "59000"
    },
    "owner": null,
    "intervention": {
      "adresse": "19 rue de l'amiral courbet",
      "ville": "Lille",
      "code_postal": "59000",
      "contexte": "Fuite sous évier, intervention urgente",
      "date_souhaitee": "2024-03-15",
      "urgence": true
    },
    "agence": "Lille Centre"
  }
}
```

**Recommandations:**
- ✅ Minimum 5-10 exemples pour commencer
- ✅ Idéal : 50-100 exemples variés
- ✅ Couvrir différents métiers, formats, cas limites
- ✅ Inclure cas avec/sans propriétaire, avec/sans urgence

### Étape 2 : Extraire les données d'un devis

#### Option A : Depuis une image

```bash
cd scripts/data-processing
python extract-from-devis.py --image ../../data/devis/nouveau_devis.jpg --output extracted.json
```

**Ce qui se passe:**
1. 🔍 **OCR** : Tesseract extrait le texte de l'image
2. 🤖 **LLM** : GPT-4 structure les données en JSON
3. 💾 **Sauvegarde** : Résultat dans `extracted.json`

#### Option B : Depuis du texte déjà extrait

```bash
python extract-from-devis.py --text "Demande de devis plomberie, M. Dupont..." --output extracted.json
```

#### Option C : Batch (plusieurs devis)

```bash
python extract-from-devis.py --batch ../../data/devis/ --output batch_extracted.json
```

**Résultat (`extracted.json`):**

```json
[
  {
    "image": "data/devis/nouveau_devis.jpg",
    "extracted": {
      "metier": "Plomberie",
      "tenant": {...},
      "owner": {...},
      "intervention": {...},
      "agence": null
    }
  }
]
```

### Étape 3 : Valider et corriger (optionnel)

Avant d'importer, vérifiez les données extraites :

```bash
cat extracted.json | python -m json.tool
```

**Points à vérifier:**
- ✅ Métier correct
- ✅ Téléphone bien formaté (0612345678, pas d'espaces)
- ✅ Email en minuscules
- ✅ Adresse complète
- ✅ Code postal valide
- ✅ Urgence correctement détectée

**Correction manuelle:**

Éditez `extracted.json` si nécessaire pour corriger des erreurs d'extraction.

### Étape 4 : Importer dans le CRM

```bash
cd ../..
node scripts/data-processing/import-extracted-devis.js --input scripts/data-processing/extracted.json
```

**Ce qui se passe:**

1. 🔍 **Résolution métier** : Trouve ou crée le métier dans `metiers`
2. 👤 **Gestion tenant** : Cherche par email/tel ou crée nouveau tenant
3. 🏠 **Gestion propriétaire** : Cherche ou crée propriétaire (si présent)
4. 🏢 **Résolution agence** : Trouve ou crée l'agence
5. 📋 **Statut** : Définit "Urgent" si urgence détectée, sinon "Nouveau"
6. ✅ **Création intervention** : Insère dans la base via `interventionsApi.create()`

**Mode dry-run (simulation):**

```bash
node scripts/data-processing/import-extracted-devis.js --input extracted.json --dry-run
```

Permet de tester sans rien insérer en base.

### Étape 5 : Vérifier dans le CRM

1. Ouvrez l'interface CRM : `http://localhost:3000/interventions`
2. Filtrez par statut "Nouveau" ou "Urgent"
3. Vérifiez que l'intervention est correctement créée
4. Complétez manuellement si nécessaire (artisan, dates, etc.)

## 📊 Workflow automatisé (production)

Pour un système de production, automatisez avec un webhook ou un cron job :

```bash
#!/bin/bash
# auto-import-devis.sh

DEVIS_FOLDER="/data/devis_entrants"
PROCESSED_FOLDER="/data/devis_traites"
LOG_FILE="/var/log/crm-import.log"

# Surveiller le dossier
inotifywait -m -e create "$DEVIS_FOLDER" --format '%f' | while read filename
do
  echo "[$(date)] Nouveau devis détecté: $filename" >> "$LOG_FILE"
  
  # Extraction
  python3 scripts/data-processing/extract-from-devis.py \
    --image "$DEVIS_FOLDER/$filename" \
    --output "/tmp/extracted_$$.json" \
    2>&1 >> "$LOG_FILE"
  
  if [ $? -eq 0 ]; then
    # Import
    node scripts/data-processing/import-extracted-devis.js \
      --input "/tmp/extracted_$$.json" \
      2>&1 >> "$LOG_FILE"
    
    if [ $? -eq 0 ]; then
      echo "[$(date)] ✅ Import réussi: $filename" >> "$LOG_FILE"
      mv "$DEVIS_FOLDER/$filename" "$PROCESSED_FOLDER/"
    else
      echo "[$(date)] ❌ Échec import: $filename" >> "$LOG_FILE"
    fi
  else
    echo "[$(date)] ❌ Échec extraction: $filename" >> "$LOG_FILE"
  fi
  
  rm -f "/tmp/extracted_$$.json"
done
```

## 🔧 Configuration avancée

### 1. Utiliser un autre modèle LLM

```bash
# GPT-3.5 (plus rapide, moins cher)
python extract-from-devis.py --image devis.jpg --model gpt-3.5-turbo

# GPT-4 (plus précis, recommandé)
python extract-from-devis.py --image devis.jpg --model gpt-4
```

### 2. Mode sans LLM (regex seulement)

```bash
python extract-from-devis.py --text "..." --no-llm
```

⚠️ Moins précis, mais gratuit et sans API.

### 3. Améliorer la qualité OCR

```python
# Pré-traitement d'image avant OCR
from PIL import Image, ImageEnhance, ImageFilter

def preprocess_image(image_path):
    img = Image.open(image_path)
    
    # Convertir en niveaux de gris
    img = img.convert('L')
    
    # Augmenter le contraste
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(2)
    
    # Réduire le bruit
    img = img.filter(ImageFilter.MedianFilter())
    
    # Redimensionner si trop petit
    if img.width < 1000:
        ratio = 1000 / img.width
        img = img.resize((1000, int(img.height * ratio)))
    
    return img

# Utiliser dans extract-from-devis.py
preprocessed = preprocess_image("devis.jpg")
ocr_text = pytesseract.image_to_string(preprocessed, lang='fra')
```

### 4. Fine-tuning d'un modèle (production)

Si vous avez 100+ exemples, envisagez le fine-tuning :

```bash
# Préparer le dataset
python scripts/prepare-finetuning-data.py --input train.jsonl --output training.jsonl

# Fine-tuner (OpenAI)
openai api fine_tunes.create \
  -t training.jsonl \
  -m gpt-3.5-turbo \
  --suffix "crm-devis-extractor"

# Utiliser le modèle fine-tuné
python extract-from-devis.py --image devis.jpg --model ft:gpt-3.5-turbo:your-org:crm-devis-extractor
```

## 📈 Métriques et monitoring

### Suivre la qualité d'extraction

```javascript
// Ajouter dans import-extracted-devis.js
const metrics = {
  total: 0,
  success: 0,
  failed: 0,
  missingFields: {},
  avgConfidence: 0,
};

// Tracker les champs manquants
if (!intervention.tenant_id) metrics.missingFields.tenant++;
if (!intervention.metier_id) metrics.missingFields.metier++;

// Log des métriques
console.log('\n📊 MÉTRIQUES:');
console.log(`Taux de réussite: ${(metrics.success / metrics.total * 100).toFixed(1)}%`);
console.log(`Champs manquants: ${JSON.stringify(metrics.missingFields)}`);
```

### Dashboard de monitoring

Créez une vue dans le CRM pour suivre :
- Nombre de devis auto-importés par jour
- Taux d'erreur
- Champs les plus souvent manquants
- Temps moyen de traitement

## 🐛 Dépannage

### Problème : OCR de mauvaise qualité

**Symptômes:** Texte incompréhensible, beaucoup de caractères manquants

**Solutions:**
1. Améliorer la résolution de l'image (min 300 DPI)
2. Convertir en niveaux de gris
3. Augmenter le contraste
4. Essayer un autre OCR (AWS Textract, Google Cloud Vision)

### Problème : LLM n'extrait pas correctement

**Symptômes:** Champs manquants, mauvais métier, données confuses

**Solutions:**
1. Ajouter plus d'exemples dans `train.jsonl` (similar au cas problématique)
2. Améliorer le prompt système
3. Utiliser GPT-4 au lieu de GPT-3.5
4. Vérifier que le texte OCR est correct

### Problème : Import échoue

**Symptômes:** Erreur lors de l'insertion en base

**Solutions:**
1. Vérifier que l'API V2 fonctionne
2. Tester en `--dry-run` d'abord
3. Vérifier les contraintes de la base (email unique, etc.)
4. Consulter les logs : `tail -f /var/log/crm-import.log`

### Problème : Métier non reconnu

**Symptômes:** Métier mal catégorisé

**Solutions:**
1. Ajouter le métier dans `metiers` table
2. Enrichir le prompt avec liste des métiers valides
3. Ajouter des synonymes dans le dataset

## 📚 Ressources

- [Dataset d'entraînement](../../data/samples/intervention_docs/README.md)
- [Script d'extraction](../../scripts/data-processing/extract-from-devis.py)
- [Script d'import](../../scripts/data-processing/import-extracted-devis.js)
- [API V2 Documentation](../API_CRM_COMPLETE.md)
- [OpenAI Best Practices](https://platform.openai.com/docs/guides/prompt-engineering)

## 🎓 Bonnes pratiques

1. ✅ **Commencer petit** : 5-10 exemples, tester, itérer
2. ✅ **Valider manuellement** : Vérifier les 20 premières extractions
3. ✅ **Mode dry-run** : Toujours tester avant d'importer en masse
4. ✅ **Logging** : Logger tout pour déboguer facilement
5. ✅ **Métriques** : Suivre la qualité d'extraction
6. ✅ **Feedback loop** : Ajouter les cas problématiques au dataset
7. ✅ **Backup** : Sauvegarder la base avant imports massifs

## 🚦 Statut du workflow

| Étape | Statut | Notes |
|-------|--------|-------|
| Dataset initial | ✅ | 5 exemples créés |
| Script extraction | ✅ | Tesseract + GPT-4 |
| Script import | ✅ | API V2 intégrée |
| Documentation | ✅ | Ce document |
| Tests unitaires | ⏳ | À faire |
| Déploiement prod | ⏳ | À configurer |

---

**Dernière mise à jour** : 2025-10-18  
**Auteur** : Équipe GMBS CRM









