#!/usr/bin/env python3
"""
Script pour détecter les doublons dans le CSV artisans
Cherche les doublons sur: Adresse Mail, Numéro Téléphone, Nom Prenom
"""

import csv
from pathlib import Path
from collections import defaultdict

# Chemin du fichier CSV
csv_file = Path(__file__).parent.parent / "data" / "SUIVI INTERVENTION GMBS  - BASE de DONNÉE SST ARTISANS.csv"

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

print("=" * 80)
print("DÉTECTION DES DOUBLONS")
print("=" * 80)

# Colonnes à vérifier
columns_to_check = ['Nom Prénom', 'Adresse Mail', 'Numéro Téléphone']

# Fonction pour trouver les doublons
def find_duplicates(rows, column):
    duplicates_dict = defaultdict(list)

    for idx, row in enumerate(rows):
        value = row.get(column, '').strip()
        if value and value != 'nan':  # Ignorer les valeurs vides
            duplicates_dict[value].append((idx, row))

    # Garder seulement les doublons (valeurs avec plus d'une occurrence)
    return {k: v for k, v in duplicates_dict.items() if len(v) > 1}

# Chercher les doublons pour chaque colonne
for col in columns_to_check:
    duplicates = find_duplicates(cleaned_rows, col)

    if duplicates:
        print(f"\n[DOUBLONS] SUR '{col}': {sum(len(v) for v in duplicates.values())} enregistrements trouvés")
        print("-" * 80)

        for value, occurrences in sorted(duplicates.items()):
            print(f"\n  '{value}' ({len(occurrences)} occurrences):")
            for idx, row in occurrences:
                nom = row.get('Nom Prénom', '?')
                raison = row.get('Raison Social', '?')
                print(f"     Row {idx + 2}: {nom} | {raison}")
    else:
        print(f"\n[OK] Aucun doublon trouvé sur '{col}'")

print("\n" + "=" * 80)
print("RÉSUMÉ")
print("=" * 80)
print(f"Total enregistrements: {len(cleaned_rows)}")
for col in columns_to_check:
    dup_count = sum(len(v) for v in find_duplicates(cleaned_rows, col).values())
    print(f"Doublons {col}: {dup_count}")
print("=" * 80)
