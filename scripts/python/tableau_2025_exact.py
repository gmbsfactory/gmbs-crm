#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Tableau des résultats 2025 - Version EXACTE selon la méthode de référence
Utilise uniquement le fichier source avec pandas to_numeric
"""

import pandas as pd
from datetime import datetime
import calendar

def calculate_2025_results_exact(source_file):
    """Calcule les résultats 2025 exactement comme la méthode de référence"""
    print("Lecture du fichier source...")
    
    # Lire le CSV
    df = pd.read_csv(source_file, encoding='utf-8')
    
    print(f"  Lignes totales dans le fichier: {len(df):,}")
    
    # Créer une copie pour travailler
    df2 = df.copy()
    
    # (1) Conversion en date avec errors='coerce' et format DD/MM/YYYY
    print("Conversion des dates...")
    df2['Date'] = pd.to_datetime(df2['Date '], format='%d/%m/%Y', errors='coerce')
    
    # Compter les dates invalides
    dates_invalides = df2['Date'].isna().sum()
    print(f"  Dates invalides (exclues): {dates_invalides:,}")
    
    # (2) Nettoyage et conversion coûts en numérique avec errors='coerce'
    print("Nettoyage et conversion des coûts en numérique...")
    
    # Nettoyer les nombres français (espaces = séparateurs de milliers, virgules = décimales)
    def clean_french_number(value):
        if pd.isna(value):
            return value
        value_str = str(value).strip()
        # Remplacer TOUS les types d'espaces (y compris espaces insécables Unicode)
        import re
        value_str = re.sub(r'\s+', '', value_str)  # Supprime tous les espaces Unicode
        # Remplacer virgules par points
        value_str = value_str.replace(',', '.')
        return value_str
    
    df2['COUT INTER'] = df2['COUT INTER'].apply(clean_french_number)
    df2['COUT SST'] = df2['COUT SST'].apply(clean_french_number)
    
    # Maintenant convertir en numérique
    df2['COUT INTER'] = pd.to_numeric(df2['COUT INTER'], errors='coerce')
    df2['COUT SST'] = pd.to_numeric(df2['COUT SST'], errors='coerce')
    
    # Compter les valeurs non numériques
    cout_inter_nan = df2['COUT INTER'].isna().sum()
    cout_sst_nan = df2['COUT SST'].isna().sum()
    print(f"  COUT INTER non numériques (convertis en NaN): {cout_inter_nan:,}")
    print(f"  COUT SST non numériques (convertis en NaN): {cout_sst_nan:,}")
    
    # (3) Filtre : uniquement l'année 2025
    print("Filtrage pour l'année 2025...")
    df_2025 = df2[df2['Date'].dt.year == 2025].copy()
    
    print(f"  Lignes valides pour 2025: {len(df_2025):,}")
    
    # (4) Validation SST (exclure les valeurs aberrantes)
    print("\nValidation des coûts SST...")
    
    def is_sst_valid(sst, inter):
        if pd.isna(sst) or sst <= 10000:
            return True
        if pd.isna(inter) or inter == 0:
            return False
        ratio = inter / sst if sst > 0 else 0
        return 0.001 <= ratio <= 2.0
    
    # Créer une colonne pour SST validé
    df_2025['COUT SST VALID'] = df_2025.apply(
        lambda row: row['COUT SST'] if is_sst_valid(row['COUT SST'], row['COUT INTER']) else 0,
        axis=1
    )
    
    sst_excluded = (df_2025['COUT SST'] != df_2025['COUT SST VALID']).sum()
    sst_excluded_amount = (df_2025['COUT SST'] - df_2025['COUT SST VALID']).sum()
    print(f"  SST aberrants exclus: {sst_excluded} lignes ({sst_excluded_amount:,.2f} EUR)")
    
    # (5) Calculs finaux
    print("\nCalculs finaux...")
    
    # Nombre d'interventions
    nb_inter = len(df_2025)
    
    # Somme COUT INTER (NaN sont ignorés automatiquement)
    ca_inter = df_2025['COUT INTER'].sum()
    
    # Somme COUT SST validé (NaN sont ignorés automatiquement)
    ca_sst = df_2025['COUT SST VALID'].sum()
    
    # Marge
    marge = ca_inter - ca_sst
    
    # Calculs par mois
    df_2025['Month'] = df_2025['Date'].dt.month
    monthly_data = df_2025.groupby('Month').agg({
        'COUT INTER': 'sum',
        'COUT SST VALID': 'sum'
    }).reset_index()
    monthly_data.rename(columns={'COUT SST VALID': 'COUT SST'}, inplace=True)
    monthly_data['MARGE'] = monthly_data['COUT INTER'] - monthly_data['COUT SST']
    monthly_data['COUNT'] = df_2025.groupby('Month').size().values
    
    return {
        'total': {
            'intervention': float(ca_inter),
            'sst': float(ca_sst),
            'marge': float(marge),
            'count': int(nb_inter)
        },
        'monthly': monthly_data
    }

if __name__ == '__main__':
    source_file = '/Users/andrebertea/Projects/GMBS/gmbs-crm/SUIVI INTERVENTION GMBS  - SUIVI INTER GMBS 2025.csv'
    
    print("\n" + "="*100)
    print("TABLEAU DES RÉSULTATS 2025 - VERSION EXACTE")
    print("Marge = COUT INTER - COUT SST")
    print("(Méthode de référence avec pandas to_numeric)")
    print("="*100)
    
    results = calculate_2025_results_exact(source_file)
    
    # Afficher le tableau mensuel
    print(f"\n{'─'*100}")
    print(f"{'MOIS':<15} {'COUT INTER':>20} {'COUT SST':>20} {'MARGE':>20} {'NB INTER':>15}")
    print(f"{'─'*100}")
    
    total_intervention = 0.0
    total_sst = 0.0
    total_marge = 0.0
    total_count = 0
    
    for _, row in results['monthly'].iterrows():
        month_num = int(row['Month'])
        month_name = calendar.month_name[month_num]
        
        cout_inter = float(row['COUT INTER'])
        cout_sst = float(row['COUT SST'])
        marge = float(row['MARGE'])
        count = int(row['COUNT'])
        
        total_intervention += cout_inter
        total_sst += cout_sst
        total_marge += marge
        total_count += count
        
        print(f"{month_name:<15} {cout_inter:>20,.2f} EUR {cout_sst:>20,.2f} EUR {marge:>20,.2f} EUR {count:>15,}")
    
    print(f"{'─'*100}")
    print(f"{'TOTAL 2025':<15} {total_intervention:>20,.2f} EUR {total_sst:>20,.2f} EUR {total_marge:>20,.2f} EUR {total_count:>15,}")
    print(f"{'─'*100}")
    
    # Comparaison avec les valeurs de référence
    print(f"\n{'='*100}")
    print("COMPARAISON AVEC LES VALEURS DE RÉFÉRENCE")
    print(f"{'='*100}")
    print(f"  Nombre d'interventions:")
    print(f"    Référence: 8 015")
    print(f"    Calculé:   {results['total']['count']:,}")
    print(f"    Écart:     {abs(results['total']['count'] - 8015):,}")
    
    print(f"\n  CA réel (COUT INTER):")
    print(f"    Référence: 1 194 289,59 €")
    print(f"    Calculé:   {results['total']['intervention']:,.2f} €")
    print(f"    Écart:     {abs(results['total']['intervention'] - 1194289.59):,.2f} €")
    
    print(f"\n  COUT SST réel:")
    print(f"    Référence: 711 852,90 €")
    print(f"    Calculé:   {results['total']['sst']:,.2f} €")
    print(f"    Écart:     {abs(results['total']['sst'] - 711852.90):,.2f} €")
    
    print(f"\n  Marge réelle:")
    print(f"    Référence: 482 436,69 €")
    print(f"    Calculé:   {results['total']['marge']:,.2f} €")
    print(f"    Écart:     {abs(results['total']['marge'] - 482436.69):,.2f} €")
    
    if abs(results['total']['count'] - 8015) <= 5 and \
       abs(results['total']['intervention'] - 1194289.59) < 1000 and \
       abs(results['total']['sst'] - 711852.90) < 1000:
        print(f"\n✅ RÉSULTATS CORRESPONDENT À LA RÉFÉRENCE !")
    else:
        print(f"\n⚠️  Écarts détectés - vérification nécessaire")
    
    print("="*100)

