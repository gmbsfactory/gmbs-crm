import { cleanCSVKeys, getCSVValue, getStatutValue, isValidRow, type CsvRow } from './parsers/csv-parser';
import { cleanString, truncateString } from './parsers/string-cleaner';
import { parseDate } from './parsers/date-number-parser';
import { extractInterventionId } from './parsers/address-parser';
import { parseTenantInfo, parseOwnerInfo, type TenantInfo, type OwnerInfo } from './parsers/person-parser';
import { extractCostsData, formatCostsForInsertion, type FormattedCost } from './parsers/cost-extractor';
import type { EnumResolver, EntityFinder } from './enum-resolver';

// ─── Types publics ────────────────────────────────────────────────────────────

export interface MapperWarning {
  field: string;
  reason: string;
}

export interface MappedIntervention {
  id_inter: string | null;
  agence_id: string | null;
  assigned_user_id: string | null;
  statut_id: string | null;
  metier_id: string | null;
  /** ISO 8601 — issu de la colonne Date (= created_at) */
  date: string | null;
  date_prevue: string | null;
  contexte_intervention: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  is_active: true;
  tenant: TenantInfo | null;
  owner: OwnerInfo | null;
  /** ID artisan position 1 (colonne SST) */
  artisan_sst: string | null;
  /** ID artisan position 2 (colonne SST 2) — null si absent ou > 2 artisans */
  artisan_sst2: string | null;
  costs: FormattedCost[];
  warnings: MapperWarning[];
}

export interface InvalidRow {
  _invalid: true;
  reason: string;
  id_inter: string | null;
}

export type MapperResult = MappedIntervention | InvalidRow;

// ─── Champs requis (refus strict si absents) ─────────────────────────────────

export const CSV_HEADERS_REQUIRED = ['Date', 'Métier', 'Agence'] as const;

// ─── Mapper principal ─────────────────────────────────────────────────────────

export async function mapInterventionFromCSV(
  rawRow: CsvRow,
  resolver: EnumResolver,
  finder: EntityFinder,
): Promise<MapperResult> {
  const row = cleanCSVKeys(rawRow);
  const warnings: MapperWarning[] = [];

  // Ligne vide
  if (!Object.values(row).some((v) => v?.trim())) {
    return invalid(null, 'Ligne vide');
  }

  // Mauvais formatage (date ISO dans un champ textuel)
  if (!isValidRow(row)) {
    return invalid(null, 'Ligne avec mauvais formatage');
  }

  const id_inter = extractInterventionId(getCSVValue(row, 'ID'));

  // ── Champs requis ──────────────────────────────────────────────────────────
  const dateRaw = getCSVValue(row, 'Date');
  const date = parseDate(dateRaw);
  if (!date) {
    const hint = dateRaw && String(dateRaw).trim() !== '' ? ` — valeur reçue : "${String(dateRaw).trim()}"` : '';
    return invalid(id_inter, `Date manquante ou invalide (format attendu : DD/MM/YYYY)${hint}`);
  }

  // Métier : fallback "AUTRES" si manquant ou inconnu (parité script data-processing).
  const metierLabel = getCSVValue(row, 'Métier')?.trim();
  let metier_id = metierLabel ? resolver.getMetierId(metierLabel) : null;
  if (!metier_id) {
    metier_id = resolver.getMetierId('AUTRES');
    warnings.push({
      field: 'Métier',
      reason: metierLabel
        ? `Métier inconnu : "${metierLabel}" — fallback "AUTRES"`
        : 'Métier manquant — fallback "AUTRES"',
    });
  }

  // Agence : fallback "DEFAUT" si manquante ou inconnue (parité script data-processing).
  const agenceLabel = getCSVValue(row, 'Agence')?.trim();
  let agence_id = agenceLabel ? resolver.getAgencyId(agenceLabel) : null;
  if (!agence_id) {
    agence_id = resolver.getAgencyId('DEFAUT');
    warnings.push({
      field: 'Agence',
      reason: agenceLabel
        ? `Agence inconnue : "${agenceLabel}" — fallback "DEFAUT"`
        : 'Agence manquante — fallback "DEFAUT"',
    });
  }

  // ── Statut (optionnel dans le format standard, requis logiquement) ─────────
  const statutLabel = getStatutValue(row);
  let statut_id: string | null = null;
  if (statutLabel) {
    statut_id = resolver.getInterventionStatusId(statutLabel);
    if (!statut_id) {
      warnings.push({ field: 'Statut', reason: `Statut inconnu : "${statutLabel}" — sera ignoré` });
    }
  }

  // ── Gestionnaire ───────────────────────────────────────────────────────────
  const gestLabel = getCSVValue(row, 'Gest.')?.trim();
  let assigned_user_id: string | null = null;
  if (gestLabel) {
    assigned_user_id = resolver.getUserId(gestLabel);
    if (!assigned_user_id) {
      warnings.push({ field: 'Gest.', reason: `Gestionnaire inconnu : "${gestLabel}"` });
    }
  }

  // ── Adresse ────────────────────────────────────────────────────────────────
  // On conserve l'adresse brute du CSV dans `adresse` (sans split CP/ville),
  // par cohérence avec le pipeline legacy `scripts/data/imports/crm-importer.js`.
  const adresseRaw = getCSVValue(row, 'Adresse') ?? getCSVValue(row, "Adresse d'intervention");
  const adresse = adresseRaw?.trim() ? adresseRaw.trim() : null;
  if (!adresse) {
    warnings.push({ field: 'Adresse', reason: "Adresse manquante — intervention créée sans adresse" });
  }

  // ── Artisans (SST / SST 2) ─────────────────────────────────────────────────
  const sstLabel = getCSVValue(row, 'SST')?.trim() ?? getCSVValue(row, 'Technicien')?.trim();
  const sst2Label = getCSVValue(row, 'SST 2')?.trim();

  const artisan_sst = await resolveArtisan(sstLabel, finder, 'SST', id_inter, warnings);
  const artisan_sst2 = sst2Label
    ? await resolveArtisan(sst2Label, finder, 'SST 2', id_inter, warnings)
    : null;

  // ── Coûts ──────────────────────────────────────────────────────────────────
  const rawCosts = extractCostsData(row);
  const costs = formatCostsForInsertion(rawCosts, id_inter);

  // ── Champs simples ─────────────────────────────────────────────────────────
  const contexte = truncateString(cleanString(getCSVValue(row, "Contexte d'intervention")), 10_000)
    ?? 'Intervention sans contexte détaillé';

  return {
    id_inter,
    agence_id,
    assigned_user_id,
    statut_id,
    metier_id,
    date,
    date_prevue: (() => {
      const raw = getCSVValue(row, "Date d'intervention");
      const parsed = parseDate(raw);
      if (!parsed && raw && String(raw).trim() !== '') {
        warnings.push({
          field: "Date d'intervention",
          reason: `Date d'intervention invalide : "${String(raw).trim()}" — ignorée`,
        });
      }
      return parsed;
    })(),
    contexte_intervention: contexte,
    adresse,
    code_postal: null,
    ville: null,
    is_active: true,
    tenant: parseTenantInfo(row),
    owner: parseOwnerInfo(row),
    artisan_sst,
    artisan_sst2,
    costs,
    warnings,
  };
}

// ─── Helpers privés ───────────────────────────────────────────────────────────

function invalid(id_inter: string | null, reason: string): InvalidRow {
  return { _invalid: true, reason, id_inter };
}

async function resolveArtisan(
  label: string | null | undefined,
  finder: EntityFinder,
  field: string,
  id_inter: string | null,
  warnings: MapperWarning[],
): Promise<string | null> {
  if (!label) return null;
  const id = finder.findArtisanByName(label);
  if (!id) {
    warnings.push({ field, reason: `Artisan inconnu : "${label}" — intervention créée sans artisan` });
  }
  return id;
}
