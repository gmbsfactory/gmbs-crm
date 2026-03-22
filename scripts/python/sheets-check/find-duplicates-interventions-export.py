#!/usr/bin/env python3
"""
Script pour détecter les doublons dans le CSV interventions
Exporte les résultats en CSV
"""

import csv
from pathlib import Path
from collections import defaultdict

# Chemin du fichier CSV
csv_file = Path(__file__).parent.parent / "data" / "SUIVI INTERVENTION GMBS  - SUIVI INTER GMBS 2026.csv"

# Lire le CSV
rows = []
with open(csv_file, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

# Nettoyer les noms de colonnes (strip les espaces)
cleaned_rows = []
for row in rows:
    cleaned_row = {k.strip(): v.strip() if v else '' for k, v in row.items()}
    cleaned_rows.append(cleaned_row)

# Colonne à vérifier
column = 'ID'

# Fonction pour trouver les doublons
def find_duplicates(rows, column):
    duplicates_dict = defaultdict(list)

    for idx, row in enumerate(rows):
        value = row.get(column, '').strip()
        if value and value != 'nan':  # Ignorer les valeurs vides
            duplicates_dict[value].append((idx, row))

    # Garder seulement les doublons (valeurs avec plus d'une occurrence)
    return {k: v for k, v in duplicates_dict.items() if len(v) > 1}

# Chercher les doublons
duplicates = find_duplicates(cleaned_rows, column)

# Exporter en CSV
output_file = Path(__file__).parent.parent / "data" / "doublons_interventions.csv"

with open(output_file, 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow(['ID', 'Row Number', 'Date', 'Agence', 'Statut', 'Artisan', 'Adresse', 'Contexte', 'Nb Occurrences'])

    for id_value, occurrences in sorted(duplicates.items()):
        nb_occ = len(occurrences)
        for idx, row in occurrences:
            date = row.get('Date', '')
            agence = row.get('  Agence', '')
            statut = row.get(' Statut ', '')
            artisan = row.get('Artisan', '')
            adresse = row.get('Adresse', '')[:50]
            contexte = row.get('Contexte d\'intervention ', '')[:50]
            writer.writerow([id_value, idx + 2, date, agence, statut, artisan, adresse, contexte, nb_occ])

print(f"[OK] Export termine: {output_file}")
print(f"Total doublons: {sum(len(v) for v in duplicates.values())}")
print(f"Nombre d'IDs dupliques: {len(duplicates)}")
