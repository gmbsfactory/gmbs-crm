#!/usr/bin/env python3
"""
Tableau des resultats 2025 filtre sur le statut "Inter terminee".
Reprend la logique de nettoyage/validation de tableau_2025_exact.py.
"""

import calendar
import re
import pandas as pd


SOURCE_FILE = "SUIVI INTERVENTION GMBS  - SUIVI INTER GMBS 2025.csv"
STATUT_VALUE = "Inter terminée"


def clean_french_number(value):
    if pd.isna(value):
        return value
    value_str = str(value).strip()
    value_str = re.sub(r"\s+", "", value_str)
    value_str = value_str.replace(",", ".")
    return value_str


def is_sst_valid(sst, inter):
    if pd.isna(sst) or sst <= 10000:
        return True
    if pd.isna(inter) or inter == 0:
        return False
    ratio = inter / sst if sst > 0 else 0
    return 0.001 <= ratio <= 2.0


def compute_table_for_status(source_file=SOURCE_FILE, statut_value=STATUT_VALUE):
    df = pd.read_csv(source_file, encoding="utf-8")
    df["Date"] = pd.to_datetime(df["Date "], format="%d/%m/%Y", errors="coerce")

    for col in ["COUT INTER", "COUT SST"]:
        df[col] = pd.to_numeric(df[col].apply(clean_french_number), errors="coerce")

    df_2025 = df[df["Date"].dt.year == 2025].copy()
    df_2025["STATUT_CLEAN"] = df_2025[" Statut "].astype(str).str.strip()
    df_2025 = df_2025[df_2025["STATUT_CLEAN"] == statut_value].copy()

    df_2025["COUT SST VALID"] = df_2025.apply(
        lambda row: row["COUT SST"]
        if is_sst_valid(row["COUT SST"], row["COUT INTER"])
        else 0,
        axis=1,
    )

    monthly = df_2025.copy()
    monthly["Month"] = monthly["Date"].dt.month
    monthly_data = (
        monthly.groupby("Month")
        .agg({"COUT INTER": "sum", "COUT SST VALID": "sum"})
        .reset_index()
    )
    monthly_data.rename(columns={"COUT SST VALID": "COUT SST"}, inplace=True)
    monthly_data["MARGE"] = monthly_data["COUT INTER"] - monthly_data["COUT SST"]
    monthly_data["COUNT"] = monthly.groupby("Month").size().values

    totals = {
        "inter": float(df_2025["COUT INTER"].sum()),
        "sst": float(df_2025["COUT SST VALID"].sum()),
        "marge": float(df_2025["COUT INTER"].sum() - df_2025["COUT SST VALID"].sum()),
        "count": int(len(df_2025)),
    }
    return monthly_data, totals


def print_table(monthly_data, totals):
    print("\nTableau 2025 - Statut Inter terminee")
    print("─" * 100)
    print(f"{'MOIS':<15} {'COUT INTER':>18} {'COUT SST':>18} {'MARGE':>18} {'NB INTER':>12}")
    print("─" * 100)
    for _, row in monthly_data.sort_values("Month").iterrows():
        month_name = calendar.month_name[int(row["Month"])]
        ci = float(row["COUT INTER"])
        cs = float(row["COUT SST"])
        marge = float(row["MARGE"])
        count = int(row["COUNT"])
        print(
            f"{month_name:<15} {ci:>18,.2f} EUR {cs:>18,.2f} EUR {marge:>18,.2f} EUR {count:>12,}"
        )
    print("─" * 100)
    print(
        f"{'TOTAL 2025':<15} {totals['inter']:>18,.2f} EUR {totals['sst']:>18,.2f} EUR {totals['marge']:>18,.2f} EUR {totals['count']:>12,}"
    )
    print("─" * 100)


if __name__ == "__main__":
    monthly_data, totals = compute_table_for_status()
    print_table(monthly_data, totals)
