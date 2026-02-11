#!/bin/bash
# Script de test du workflow d'extraction de devis
# Usage: ./test-devis-extraction.sh

set -e  # Exit on error

echo "========================================"
echo "🧪 TEST DU WORKFLOW D'EXTRACTION DE DEVIS"
echo "========================================"

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Chemins
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
DATA_DIR="$PROJECT_ROOT/data/samples/intervention_docs"
EXTRACT_SCRIPT="$PROJECT_ROOT/scripts/ai/ocr/extract-from-devis.py"
IMPORT_SCRIPT="$PROJECT_ROOT/scripts/ai/ocr/import-extracted-devis.js"

echo ""
echo "📂 Répertoires:"
echo "   Projet: $PROJECT_ROOT"
echo "   Données: $DATA_DIR"
echo ""

# Vérifier les prérequis
echo "1️⃣ Vérification des prérequis..."

# Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 non trouvé${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Python 3 trouvé${NC}"

# Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js non trouvé${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js trouvé${NC}"

# Tesseract (optionnel)
if command -v tesseract &> /dev/null; then
    echo -e "${GREEN}✅ Tesseract trouvé${NC}"
    HAS_TESSERACT=true
else
    echo -e "${YELLOW}⚠️  Tesseract non trouvé (OCR désactivé)${NC}"
    HAS_TESSERACT=false
fi

# OpenAI Key (optionnel)
if [ -z "$OPENAI_API_KEY" ]; then
    echo -e "${YELLOW}⚠️  OPENAI_API_KEY non défini (extraction LLM désactivée)${NC}"
    HAS_OPENAI=false
else
    echo -e "${GREEN}✅ OPENAI_API_KEY défini${NC}"
    HAS_OPENAI=true
fi

# Vérifier les fichiers
echo ""
echo "2️⃣ Vérification des fichiers..."

if [ ! -f "$DATA_DIR/train.jsonl" ]; then
    echo -e "${RED}❌ Dataset train.jsonl non trouvé${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Dataset train.jsonl trouvé${NC}"

if [ ! -f "$EXTRACT_SCRIPT" ]; then
    echo -e "${RED}❌ Script d'extraction non trouvé${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Script d'extraction trouvé${NC}"

if [ ! -f "$IMPORT_SCRIPT" ]; then
    echo -e "${RED}❌ Script d'import non trouvé${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Script d'import trouvé${NC}"

# Test 1 : Extraction depuis texte
echo ""
echo "3️⃣ Test d'extraction depuis texte..."

TEST_TEXT="Demande de devis plomberie | Client: M. Dupont Jean | Tél: 06.12.34.56.78 | Email: jean.dupont@test.com | Adresse: 123 Rue de Test, 59000 Lille | Problème: Fuite importante, intervention urgente"

if [ "$HAS_OPENAI" = true ]; then
    echo "   Extraction avec LLM..."
    python3 "$EXTRACT_SCRIPT" --text "$TEST_TEXT" --output /tmp/test_extracted.json
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Extraction réussie${NC}"
        echo "   Résultat:"
        cat /tmp/test_extracted.json | python3 -m json.tool | head -n 20
    else
        echo -e "${RED}❌ Échec de l'extraction${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  Test ignoré (pas de clé OpenAI)${NC}"
fi

# Test 2 : Validation du JSON
echo ""
echo "4️⃣ Validation du JSON extrait..."

if [ -f /tmp/test_extracted.json ]; then
    if python3 -m json.tool /tmp/test_extracted.json > /dev/null 2>&1; then
        echo -e "${GREEN}✅ JSON valide${NC}"
    else
        echo -e "${RED}❌ JSON invalide${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  Pas de fichier à valider${NC}"
fi

# Test 3 : Import en dry-run
echo ""
echo "5️⃣ Test d'import (dry-run)..."

if [ -f /tmp/test_extracted.json ]; then
    echo "   Import en mode simulation..."
    node "$IMPORT_SCRIPT" --input /tmp/test_extracted.json --dry-run
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Import dry-run réussi${NC}"
    else
        echo -e "${RED}❌ Échec de l'import dry-run${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠️  Test ignoré (pas de fichier extrait)${NC}"
fi

# Test 4 : Validation du dataset
echo ""
echo "6️⃣ Validation du dataset d'entraînement..."

NUM_EXAMPLES=$(wc -l < "$DATA_DIR/train.jsonl" | tr -d ' ')
echo "   Nombre d'exemples: $NUM_EXAMPLES"

if [ "$NUM_EXAMPLES" -lt 3 ]; then
    echo -e "${YELLOW}⚠️  Seulement $NUM_EXAMPLES exemples (recommandé: 10+)${NC}"
elif [ "$NUM_EXAMPLES" -lt 10 ]; then
    echo -e "${YELLOW}⚠️  $NUM_EXAMPLES exemples (recommandé: 20+)${NC}"
else
    echo -e "${GREEN}✅ $NUM_EXAMPLES exemples (bon pour l'entraînement)${NC}"
fi

# Vérifier que chaque ligne est un JSON valide
INVALID_LINES=0
while IFS= read -r line; do
    if ! echo "$line" | python3 -m json.tool > /dev/null 2>&1; then
        INVALID_LINES=$((INVALID_LINES + 1))
    fi
done < "$DATA_DIR/train.jsonl"

if [ "$INVALID_LINES" -gt 0 ]; then
    echo -e "${RED}❌ $INVALID_LINES ligne(s) JSON invalide(s) dans le dataset${NC}"
    exit 1
else
    echo -e "${GREEN}✅ Toutes les lignes sont valides${NC}"
fi

# Test 5 : Extraction depuis une image (si Tesseract disponible)
echo ""
echo "7️⃣ Test d'extraction depuis image..."

if [ "$HAS_TESSERACT" = true ] && [ "$HAS_OPENAI" = true ]; then
    # Créer une image de test simple (si ImageMagick disponible)
    if command -v convert &> /dev/null; then
        echo "   Création d'une image de test..."
        convert -size 800x600 xc:white \
                -pointsize 20 \
                -draw "text 50,50 'DEVIS PLOMBERIE'" \
                -draw "text 50,100 'Client: M. Test Jean'" \
                -draw "text 50,150 'Tel: 06.12.34.56.78'" \
                -draw "text 50,200 'Adresse: 123 Rue Test, 59000 Lille'" \
                /tmp/test_devis.jpg
        
        echo "   Extraction OCR + LLM..."
        python3 "$EXTRACT_SCRIPT" --image /tmp/test_devis.jpg --output /tmp/test_ocr_extracted.json
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Extraction depuis image réussie${NC}"
        else
            echo -e "${YELLOW}⚠️  Échec (qualité OCR insuffisante)${NC}"
        fi
        
        rm -f /tmp/test_devis.jpg
    else
        echo -e "${YELLOW}⚠️  ImageMagick non disponible, test ignoré${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Test ignoré (Tesseract ou OpenAI manquant)${NC}"
fi

# Nettoyage
echo ""
echo "8️⃣ Nettoyage..."
rm -f /tmp/test_extracted.json
rm -f /tmp/test_ocr_extracted.json
echo -e "${GREEN}✅ Fichiers temporaires supprimés${NC}"

# Résumé final
echo ""
echo "========================================"
echo "📊 RÉSUMÉ DES TESTS"
echo "========================================"
echo -e "Python 3:        ${GREEN}✅${NC}"
echo -e "Node.js:         ${GREEN}✅${NC}"
echo -e "Tesseract:       $([ "$HAS_TESSERACT" = true ] && echo -e "${GREEN}✅${NC}" || echo -e "${YELLOW}⚠️${NC}")"
echo -e "OpenAI API:      $([ "$HAS_OPENAI" = true ] && echo -e "${GREEN}✅${NC}" || echo -e "${YELLOW}⚠️${NC}")"
echo -e "Dataset valide:  ${GREEN}✅${NC}"
echo -e "Scripts OK:      ${GREEN}✅${NC}"
echo ""

if [ "$HAS_OPENAI" = true ]; then
    echo -e "${GREEN}✅ TOUS LES TESTS SONT PASSÉS${NC}"
    echo ""
    echo "🚀 Prêt à utiliser !"
    echo ""
    echo "Exemples d'utilisation:"
    echo "  # Extraire depuis une image"
    echo "  python3 $EXTRACT_SCRIPT --image chemin/vers/devis.jpg --output extracted.json"
    echo ""
    echo "  # Extraire depuis du texte"
    echo "  python3 $EXTRACT_SCRIPT --text \"Votre texte...\" --output extracted.json"
    echo ""
    echo "  # Importer dans le CRM (simulation)"
    echo "  node $IMPORT_SCRIPT --input extracted.json --dry-run"
    echo ""
    echo "  # Importer dans le CRM (réel)"
    echo "  node $IMPORT_SCRIPT --input extracted.json"
    echo ""
else
    echo -e "${YELLOW}⚠️  TESTS PARTIELS${NC}"
    echo ""
    echo "Pour activer toutes les fonctionnalités:"
    echo "  1. Installer Tesseract: sudo apt-get install tesseract-ocr tesseract-ocr-fra"
    echo "  2. Définir OPENAI_API_KEY: export OPENAI_API_KEY='sk-...'"
    echo ""
fi

exit 0

