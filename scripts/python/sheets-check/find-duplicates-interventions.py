#!/usr/bin/env python3
"""
Script pour détecter les doublons dans le CSV interventions
Filtre les interventions après le 01/01/2026, trie par date, et cherche les doublons sur: ID
"""

import csv
from pathlib import Path
from collections import defaultdict
from datetime import datetime

# Chemin du fichier CSV
csv_file = Path(__file__).parent.parent.parent.parent / "data" / "SUIVI INTERVENTION GMBS  - SUIVI INTER GMBS 2026.csv"

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

# Parser une date (supporte DD/MM/YYYY et DD-MM-YYYY)
def parse_date(date_str):
    for fmt in ('%d/%m/%Y', '%d-%m-%Y', '%Y-%m-%d'):
        try:
            return datetime.strptime(date_str, fmt)
        except (ValueError, TypeError):
            continue
    return None

# Filtrer: uniquement les interventions après le 01/01/2026
cutoff = datetime(2026, 1, 1)
filtered_rows = []
for row in cleaned_rows:
    dt = parse_date(row.get('Date', ''))
    if dt and dt >= cutoff:
        row['_parsed_date'] = dt
        filtered_rows.append(row)

# Trier par date
filtered_rows.sort(key=lambda r: r['_parsed_date'])

print("=" * 80)
print("DETECTION DES DOUBLONS - INTERVENTIONS (après 01/01/2026)")
print("=" * 80)

# Colonne à vérifier
column = 'ID'

# Fonction pour trouver les doublons
def find_duplicates(rows, column):
    duplicates_dict = defaultdict(list)

    for idx, row in enumerate(rows):
        value = row.get(column, '').strip()
        if value and value != 'nan':
            duplicates_dict[value].append((idx, row))

    return {k: v for k, v in duplicates_dict.items() if len(v) > 1}

# Chercher les doublons
duplicates = find_duplicates(filtered_rows, column)

if duplicates:
    print(f"\n[DOUBLONS] SUR '{column}': {sum(len(v) for v in duplicates.values())} enregistrements trouvés")
    print("-" * 80)

    for value, occurrences in sorted(duplicates.items()):
        print(f"\n  ID: '{value}' ({len(occurrences)} occurrences):")
        for idx, row in occurrences:
            date = row.get('Date', '?')
            agence = row.get('Agence', '?')
            statut = row.get('Statut', '?')
            artisan = row.get('Artisan', '?')
            adresse = row.get('Adresse', '?')[:40] + "..." if len(row.get('Adresse', '')) > 40 else row.get('Adresse', '?')
            print(f"     Row {idx + 1}: {date} | {agence} | {statut} | Artisan: {artisan}")
            print(f"              Adresse: {adresse}")
else:
    print(f"\n[OK] Aucun doublon trouvé sur '{column}'")

print("\n" + "=" * 80)
print("RESUME")
print("=" * 80)
print(f"Total enregistrements (après 01/01/2026): {len(filtered_rows)}")
dup_count = sum(len(v) for v in duplicates.values())
print(f"Doublons ID: {dup_count}")
print("=" * 80)
