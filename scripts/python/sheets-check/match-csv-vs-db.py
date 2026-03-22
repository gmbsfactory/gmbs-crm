#!/usr/bin/env python3
"""
Compare les IDs du CSV interventions avec ceux en base de données.
Trouve les orphelins dans chaque sens pour la période >= 01/01/2026.

Usage:
    python match-csv-vs-db.py
    python match-csv-vs-db.py --date-start=01/01/2026 --date-end=01/04/2026

Variables d'environnement requises (ou fichier .env.local à la racine):
    NEXT_PUBLIC_SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
"""

import csv
import sys
import os
import requests
from pathlib import Path
from datetime import datetime

# ── Config ────────────────────────────────────────────────────────────────────

CSV_FILE = Path(__file__).parent.parent.parent.parent / "data" / "SUIVI INTERVENTION GMBS  - SUIVI INTER GMBS 2026.csv"
ENV_FILE = Path(__file__).parent.parent.parent.parent / ".env.local"

DEFAULT_DATE_START = "01/01/2026"
DEFAULT_DATE_END   = None  # Pas de limite par défaut

# ── Charger les variables d'environnement depuis .env.local ──────────────────

def load_env(env_path):
    if not env_path.exists():
        return
    with open(env_path, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, _, value = line.partition('=')
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key not in os.environ:
                os.environ[key] = value

load_env(ENV_FILE)

SUPABASE_URL = os.environ.get('NEXT_PUBLIC_SUPABASE_URL') or os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

# ── Parse args ────────────────────────────────────────────────────────────────

date_start_str = DEFAULT_DATE_START
date_end_str   = DEFAULT_DATE_END

for arg in sys.argv[1:]:
    if arg.startswith('--date-start='):
        date_start_str = arg.split('=', 1)[1]
    elif arg.startswith('--date-end='):
        date_end_str = arg.split('=', 1)[1]

# ── Helpers ───────────────────────────────────────────────────────────────────

def parse_date(s):
    for fmt in ('%d/%m/%Y', '%d-%m-%Y', '%Y-%m-%d'):
        try:
            return datetime.strptime(s.strip(), fmt)
        except (ValueError, TypeError, AttributeError):
            continue
    return None

date_start = parse_date(date_start_str) if date_start_str else None
date_end   = parse_date(date_end_str)   if date_end_str   else None

# ── Lire le CSV ───────────────────────────────────────────────────────────────

print("=" * 70)
print("MATCHING CSV vs DB — INTERVENTIONS")
print("=" * 70)
print(f"Fichier CSV : {CSV_FILE.name}")
print(f"Période     : {date_start_str or '∞'} → {date_end_str or '∞'}")
print()

if not CSV_FILE.exists():
    print(f"❌ Fichier CSV introuvable : {CSV_FILE}")
    sys.exit(1)

csv_ids = set()
csv_rows_total = 0
csv_rows_no_date = 0
csv_rows_no_id = 0

with open(CSV_FILE, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        cleaned = {k.strip(): (v.strip() if v else '') for k, v in row.items()}
        csv_rows_total += 1

        id_val = cleaned.get('ID', '').strip().split()[0] if cleaned.get('ID', '').strip() else ''
        date_val = cleaned.get('Date', '').strip()

        dt = parse_date(date_val)
        if not dt:
            csv_rows_no_date += 1
            continue
        if date_start and dt < date_start:
            continue
        if date_end and dt > date_end:
            continue

        if not id_val or id_val == 'nan':
            csv_rows_no_id += 1
            continue

        csv_ids.add(id_val)

print(f"CSV total lignes          : {csv_rows_total}")
print(f"CSV dates non parsables   : {csv_rows_no_date}")
print(f"CSV sans ID               : {csv_rows_no_id}")
print(f"CSV IDs uniques (filtrés) : {len(csv_ids)}")
print()

# ── Lire la DB ────────────────────────────────────────────────────────────────

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Variables manquantes : NEXT_PUBLIC_SUPABASE_URL et/ou SUPABASE_SERVICE_ROLE_KEY")
    print("   Vérifiez votre fichier .env.local")
    sys.exit(1)

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

db_ids = set()
db_rows = []
page_size = 1000
offset = 0

# Construire les filtres de date pour la DB (format ISO)
date_filter_start = date_start.strftime('%Y-%m-%d') if date_start else None
date_filter_end   = date_end.strftime('%Y-%m-%d')   if date_end   else None

print("Chargement des IDs depuis la DB...", end='', flush=True)

while True:
    params = {
        "select": "id_inter,date",
        "order":  "date.asc",
        "limit":  str(page_size),
        "offset": str(offset),
    }
    if date_filter_start:
        params["date"] = f"gte.{date_filter_start}"
    if date_filter_end:
        params["date"] = f"lte.{date_filter_end}"

    # Si les deux filtres sont actifs on doit les combiner via range
    # Supabase REST ne supporte qu'un seul param par colonne → on filtre côté Python si besoin
    if date_filter_start and date_filter_end:
        params.pop("date", None)
        params["date"] = f"gte.{date_filter_start}"

    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/interventions",
        headers={**headers, "Range-Unit": "items", "Range": f"{offset}-{offset + page_size - 1}"},
        params=params,
        timeout=30,
    )

    if resp.status_code not in (200, 206):
        print(f"\n❌ Erreur API Supabase : {resp.status_code} — {resp.text[:200]}")
        sys.exit(1)

    batch = resp.json()
    if not batch:
        break

    for row in batch:
        id_inter = row.get('id_inter', '')
        row_date = parse_date(row.get('date', ''))
        # Filtre date_end côté Python (workaround param unique)
        if date_filter_end and row_date and row_date > datetime.strptime(date_filter_end, '%Y-%m-%d'):
            continue
        if id_inter:
            db_ids.add(id_inter)
            db_rows.append(row)

    print('.', end='', flush=True)
    if len(batch) < page_size:
        break
    offset += page_size

print(f" {len(db_ids)} IDs chargés")
print()

# ── Comparaison ───────────────────────────────────────────────────────────────

in_db_not_csv = db_ids - csv_ids   # orphelins DB
in_csv_not_db = csv_ids - db_ids   # non importés CSV

print("=" * 70)
print("RÉSULTATS")
print("=" * 70)
print(f"IDs uniques CSV (période) : {len(csv_ids)}")
print(f"IDs uniques DB  (période) : {len(db_ids)}")
print()
print(f"🔴 En DB mais absents du CSV : {len(in_db_not_csv)}  ← orphelins potentiels")
print(f"🟡 Dans le CSV mais absents de la DB : {len(in_csv_not_db)}  ← non importés")
print()

if in_db_not_csv:
    print("-" * 70)
    print(f"IDs orphelins (DB sans CSV) :")
    for id_ in sorted(in_db_not_csv):
        print(f"  {id_}")

if in_csv_not_db:
    print()
    print("-" * 70)
    print(f"IDs non importés (CSV sans DB) :")
    for id_ in sorted(in_csv_not_db):
        print(f"  {id_}")

print()
print("=" * 70)
