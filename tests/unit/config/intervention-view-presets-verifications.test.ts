import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  DEFAULT_VIEWS,
  USER_SCOPED_VIEW_IDS,
  applyUserScopedFilters,
  mergeStoredViews,
} from '@/config/intervention-view-presets'
import { PORTAL_REPORT_REVIEW_STATUSES } from '@/lib/interventions/portal-report-status'

const VIEW_ID = 'mes-verifications'

describe('Vue « Mes vérifications »', () => {
  const view = DEFAULT_VIEWS.find((v) => v.id === VIEW_ID)

  it('existe et porte une pastille', () => {
    expect(view).toBeDefined()
    expect(view?.title).toBe('Mes vérifications')
    expect(view?.showBadge).toBe(true)
  })

  it('est placée entre « Market » et « Mes demandes »', () => {
    const ids = DEFAULT_VIEWS.map((v) => v.id)
    expect(ids.indexOf(VIEW_ID)).toBe(ids.indexOf('market') + 1)
    expect(ids.indexOf('mes-demandes')).toBe(ids.indexOf(VIEW_ID) + 1)
  })

  it('conserve l\'ordre complet des vues par défaut', () => {
    expect(DEFAULT_VIEWS.map((v) => v.id)).toEqual([
      'liste-generale',
      'market',
      'mes-verifications',
      'mes-demandes',
      'ma-liste-en-cours',
      'mes-visites-technique',
      'ma-liste-accepte',
      'ma-liste-att-acompte',
      'mes-interventions-a-check',
    ])
  })

  it('filtre sur le rapport à vérifier ET sur l\'utilisateur connecté', () => {
    expect(view?.filters).toEqual([
      { property: 'hasPortalReport', operator: 'eq', value: true },
      { property: 'attribueA', operator: 'eq', value: '__CURRENT_USER_USERNAME__' },
    ])
  })

  it('est rattachée à l\'utilisateur connecté (USER_SCOPED_VIEW_IDS)', () => {
    expect(USER_SCOPED_VIEW_IDS.has(VIEW_ID)).toBe(true)
    const resolved = applyUserScopedFilters(view!, 'user-42')
    expect(resolved.filters).toContainEqual({ property: 'attribueA', operator: 'eq', value: 'user-42' })
  })
})

describe('mergeStoredViews — arrivée d\'une nouvelle puce par défaut', () => {
  it('insère « Mes vérifications » entre Market et Mes demandes malgré un localStorage antérieur', () => {
    // Ordre stocké par un utilisateur d'avant la livraison de la vue
    const stored = DEFAULT_VIEWS.filter((v) => v.id !== 'mes-verifications').map((v) => ({ ...v }))

    const merged = mergeStoredViews(stored as never)
    const ids = merged.map((v) => v.id)

    expect(ids.indexOf('mes-verifications')).toBe(ids.indexOf('market') + 1)
    expect(ids.indexOf('mes-demandes')).toBe(ids.indexOf('mes-verifications') + 1)
  })

  it('respecte un ordre personnalisé et ne déplace pas les vues existantes', () => {
    const stored = [
      { ...DEFAULT_VIEWS.find((v) => v.id === 'mes-demandes')! },
      { ...DEFAULT_VIEWS.find((v) => v.id === 'market')! },
    ]

    const merged = mergeStoredViews(stored as never)
    const ids = merged.map((v) => v.id)

    // Les deux vues stockées gardent leur ordre, la nouvelle suit « market »
    expect(ids.indexOf('mes-demandes')).toBeLessThan(ids.indexOf('market'))
    expect(ids.indexOf('mes-verifications')).toBe(ids.indexOf('market') + 1)
  })
})

describe('Statuts « À vérifier » : pas de dérive entre TypeScript et SQL', () => {
  it('la migration 99086 déclare exactement PORTAL_REPORT_REVIEW_STATUSES', () => {
    const sql = readFileSync(
      resolve(__dirname, '../../../supabase/migrations/99086_filter_counts_portal_report.sql'),
      'utf-8',
    )
    const match = sql.match(/SELECT ARRAY\[([^\]]+)\]::TEXT\[\]/)
    expect(match).not.toBeNull()
    const codesSql = match![1]
      .split(',')
      .map((raw) => raw.trim().replace(/^'/, '').replace(/'$/, ''))
    expect(codesSql).toEqual([...PORTAL_REPORT_REVIEW_STATUSES])
  })
})
