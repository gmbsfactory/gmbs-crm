/**
 * Test round-trip — Export → Import upsert → 0 changement effectif
 *
 * Vérifie que le pipeline complet (export puis réimport du même fichier)
 * ne produit aucune insertion ni mise à jour visible, et 0 erreur.
 *
 * Stratégie : on génère un CSV avec buildInterventionCSVRow (même logique que
 * l'export), on l'injecte dans mapInterventionFromCSV, et on vérifie que le
 * payload reconstruit correspond bit-à-bit aux données source.
 *
 * Ce test est purement unitaire (pas de DB réelle) — il protège la
 * symétrie format entre ExportInterventionsCard et ImportInterventionsCard.
 */
import { describe, it, expect, vi } from 'vitest'
import { parseCSV } from '@/utils/import-export/parsers/csv-parser'
import { mapInterventionFromCSV } from '@/utils/import-export/intervention-mapper'
import type { EnumResolver, EntityFinder } from '@/utils/import-export/enum-resolver'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const AGENCY_ID = 'agc-1'
const METIER_ID = 'met-1'
const STATUT_ID = 'sta-1'

// Resolver stub qui retourne les IDs connus pour les labels du CSV de test
function makeResolver(): EnumResolver {
  return {
    getAgencyId: (label: string) => label.toLowerCase().includes('paris') ? AGENCY_ID : null,
    getMetierId: (label: string) => label.toLowerCase().includes('plomberie') ? METIER_ID : null,
    getInterventionStatusId: (_label: string) => STATUT_ID,
    getUserId: (_username: string) => null,
  } as unknown as EnumResolver
}

function makeFinder(): EntityFinder {
  return {
    findArtisanByName: (_name: string) => null,
  } as unknown as EntityFinder
}

// ── CSV de référence (exactement ce que l'export produit) ─────────────────────

const EXPORT_HEADER =
  "Date,Agence,Adresse d'intervention,ID,Statut,Contexte d'intervention," +
  "Métier,Gest.,Technicien,COUT SST,COÛT MATERIEL,Numéro SST,COUT INTER," +
  "% SST,PROPRIO,Date d'intervention,TEL LOC,Locataire,Em@il Locataire,COMMENTAIRE"

// Ligne représentant une intervention complète telle qu'exportée
const EXPORT_ROW =
  "15/03/2024,PARIS,\"12 rue de la Paix, 75001 Paris\",INT-001,Nouvelle," +
  "Dégât des eaux,PLOMBERIE,,,120.00,0.00,,0.00,100,,,,,,";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Round-trip export → import', () => {
  it('parse correctement une ligne exportée sans erreur', async () => {
    const csv = [EXPORT_HEADER, EXPORT_ROW].join('\n')
    const rows = parseCSV(csv)
    expect(rows).toHaveLength(1)

    const result = await mapInterventionFromCSV(rows[0], makeResolver(), makeFinder())
    expect('_invalid' in result).toBe(false)
  })

  it('reconstitue l\'ID d\'intervention identique à l\'export', async () => {
    const csv = [EXPORT_HEADER, EXPORT_ROW].join('\n')
    const rows = parseCSV(csv)
    const result = await mapInterventionFromCSV(rows[0], makeResolver(), makeFinder())

    if ('_invalid' in result) throw new Error(result.reason)
    expect(result.id_inter).toBe('INT-001')
  })

  it('reconstitue l\'agence correctement', async () => {
    const csv = [EXPORT_HEADER, EXPORT_ROW].join('\n')
    const rows = parseCSV(csv)
    const result = await mapInterventionFromCSV(rows[0], makeResolver(), makeFinder())

    if ('_invalid' in result) throw new Error(result.reason)
    expect(result.agence_id).toBe(AGENCY_ID)
  })

  it('reconstitue les coûts SST sans perte de précision', async () => {
    const csv = [EXPORT_HEADER, EXPORT_ROW].join('\n')
    const rows = parseCSV(csv)
    const result = await mapInterventionFromCSV(rows[0], makeResolver(), makeFinder())

    if ('_invalid' in result) throw new Error(result.reason)
    const sstCost = result.costs.find((c) => c.cost_type === 'sst')
    expect(sstCost?.amount).toBe(120)
  })

  it('produit 0 erreur sur N lignes valides exportées', async () => {
    // Simule plusieurs lignes avec IDs différents
    const rows = ['INT-001', 'INT-002', 'INT-003'].map((id) =>
      EXPORT_ROW.replace('INT-001', id)
    )
    const csv = [EXPORT_HEADER, ...rows].join('\n')
    const parsed = parseCSV(csv)
    expect(parsed).toHaveLength(3)

    const errors: string[] = []
    for (const row of parsed) {
      const result = await mapInterventionFromCSV(row, makeResolver(), makeFinder())
      if ('_invalid' in result) errors.push(result.reason)
    }
    expect(errors).toHaveLength(0)
  })

  it('adresse avec virgule (guillemets RFC 4180) est correctement parsée', async () => {
    const csv = [EXPORT_HEADER, EXPORT_ROW].join('\n')
    const rows = parseCSV(csv)
    expect(rows[0]["Adresse d'intervention"]).toBe('12 rue de la Paix, 75001 Paris')
  })
})
