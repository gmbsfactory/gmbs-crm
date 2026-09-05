import { describe, it, expect } from 'vitest'
import {
  PHOTOS_HORS_RAPPORT,
  sortPortalReports,
} from '@/lib/interventions/portal-report-view'

/**
 * Ces symboles vivaient dans `app/api/interventions/[id]/portal-report/route.ts`,
 * où l'App Router interdit tout export autre que les handlers HTTP (typecheck et
 * build rouges). Ils sont désormais ici : ces tests verrouillent le
 * comportement déplacé, et donc l'ordre des rapports vu par le modal.
 */
describe('portal-report-view', () => {
  describe('PHOTOS_HORS_RAPPORT', () => {
    it("vaut la clé attendue par le contrat d'API (photos sans version)", () => {
      expect(PHOTOS_HORS_RAPPORT).toBe('_hors_rapport')
    })
  })

  describe('sortPortalReports', () => {
    const report = (
      id: string,
      status: string,
      submitted_at: string | null,
      version: number,
    ) => ({ id, status, submitted_at, version })

    it('place les rapports en attente avant les rapports traités', () => {
      const result = sortPortalReports([
        report('valide', 'approved', '2026-09-04T10:00:00Z', 3),
        report('attente', 'submitted', '2026-09-01T10:00:00Z', 1),
      ])
      expect(result.map((r) => r.id)).toEqual(['attente', 'valide'])
    })

    it("trie ensuite par date d'envoi décroissante", () => {
      const result = sortPortalReports([
        report('ancien', 'approved', '2026-09-01T10:00:00Z', 1),
        report('recent', 'approved', '2026-09-04T10:00:00Z', 2),
        report('median', 'approved', '2026-09-02T10:00:00Z', 3),
      ])
      expect(result.map((r) => r.id)).toEqual(['recent', 'median', 'ancien'])
    })

    it('départage deux envois simultanés par la version la plus haute', () => {
      const result = sortPortalReports([
        report('v1', 'approved', '2026-09-04T10:00:00Z', 1),
        report('v2', 'approved', '2026-09-04T10:00:00Z', 2),
      ])
      expect(result.map((r) => r.id)).toEqual(['v2', 'v1'])
    })

    it('range une date absente ou illisible en dernier', () => {
      const result = sortPortalReports([
        report('sans-date', 'approved', null, 5),
        report('illisible', 'approved', 'pas-une-date', 4),
        report('date', 'approved', '2026-09-01T10:00:00Z', 1),
      ])
      expect(result[0].id).toBe('date')
      // Les deux horodatages inexploitables valent 0 : la version départage.
      expect(result.map((r) => r.id).slice(1)).toEqual(['sans-date', 'illisible'])
    })

    it("ne modifie pas le tableau d'origine", () => {
      const input = [
        report('valide', 'approved', '2026-09-04T10:00:00Z', 2),
        report('attente', 'submitted', '2026-09-01T10:00:00Z', 1),
      ]
      const result = sortPortalReports(input)
      expect(input.map((r) => r.id)).toEqual(['valide', 'attente'])
      expect(result).not.toBe(input)
    })

    it('accepte une liste vide', () => {
      expect(sortPortalReports([])).toEqual([])
    })
  })
})
