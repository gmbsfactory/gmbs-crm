import { describe, it, expect } from 'vitest'
import {
  deriveReportEvents,
  mapJournalRow,
  mergeTimelineEvents,
  parseTimelineLimit,
  resolveTimelineActor,
  timelineDetail,
  timelineLabel,
  TIMELINE_MAX_LIMIT,
  type TimelineJournalRow,
} from '@/lib/artisans/portal-timeline'

function journalRow(over: Partial<TimelineJournalRow> = {}): TimelineJournalRow {
  return {
    id: over.id ?? 'log-1',
    action_type: over.action_type ?? 'PRICE_ACCEPTED',
    source: over.source ?? 'portal',
    occurred_at: over.occurred_at ?? '2026-09-10T08:00:00.000Z',
    recorded_at: over.recorded_at ?? '2026-09-10T08:00:05.000Z',
    payload: over.payload ?? {},
    report_id: over.report_id ?? null,
    attachment_id: over.attachment_id ?? null,
    intervention: 'intervention' in over ? over.intervention ?? null : { id: 'i-1', id_inter: 'GMBS-1' },
    actor: over.actor ?? null,
  }
}

describe('artisans/portal-timeline', () => {
  describe('resolveTimelineActor', () => {
    it('should prefer the joined account name', () => {
      const row = journalRow({
        source: 'crm',
        actor: { firstname: 'Badr', lastname: 'B', username: 'badr', email: 'badr@gmbs.fr' },
        payload: { actor: 'badr@gmbs.fr' },
      })
      expect(resolveTimelineActor(row, 'Karim Benali')).toBe('Badr B')
    })

    it('should fall back to the immutable payload copy when the account is deleted', () => {
      const row = journalRow({ source: 'crm', actor: null, payload: { actor: 'badr@gmbs.fr' } })
      expect(resolveTimelineActor(row, 'Karim Benali')).toBe('badr@gmbs.fr')
    })

    it('should fall back to the artisan for a portal action', () => {
      expect(resolveTimelineActor(journalRow(), 'Karim Benali')).toBe('Karim Benali')
    })

    it('should fall back to « un gestionnaire » for a CRM action without any actor', () => {
      expect(resolveTimelineActor(journalRow({ source: 'crm' }), 'Karim Benali')).toBe('un gestionnaire')
    })
  })

  describe('mapJournalRow', () => {
    it('should keep the denormalised intervention when the join is gone', () => {
      const event = mapJournalRow(
        journalRow({ intervention: null, payload: { intervention: { id: 'i-9', id_inter: 'GMBS-9' } } }),
        'Karim Benali',
      )
      expect(event.intervention).toEqual({ id: 'i-9', id_inter: 'GMBS-9' })
    })

    it('should map the source to portal or crm only', () => {
      expect(mapJournalRow(journalRow({ source: 'crm' }), 'K').source).toBe('crm')
      expect(mapJournalRow(journalRow({ source: null }), 'K').source).toBe('portal')
    })
  })

  describe('deriveReportEvents', () => {
    it('should derive an event for a report the journal does not carry', () => {
      const events = deriveReportEvents(
        [{ id: 'r-1', intervention_id: 'i-1', version: 2, status: 'submitted', submitted_at: '2026-09-09T10:00:00.000Z' }],
        new Set(),
        'Karim Benali',
      )
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({ action_type: 'REPORT_SUBMITTED', source: 'derived', report_id: 'r-1' })
    })

    it('should skip a report already journalled — no duplicate line', () => {
      const events = deriveReportEvents(
        [{ id: 'r-1', intervention_id: 'i-1', version: 2, status: 'submitted', submitted_at: '2026-09-09T10:00:00.000Z' }],
        new Set(['r-1']),
        'Karim Benali',
      )
      expect(events).toEqual([])
    })

    it('should skip a report never submitted', () => {
      const events = deriveReportEvents(
        [{ id: 'r-1', intervention_id: 'i-1', version: 1, status: 'draft', submitted_at: null }],
        new Set(),
        'Karim',
      )
      expect(events).toEqual([])
    })
  })

  describe('mergeTimelineEvents', () => {
    it('should sort from the most recent and honour the limit', () => {
      const journal = [
        mapJournalRow(journalRow({ id: 'a', occurred_at: '2026-09-01T08:00:00.000Z' }), 'K'),
        mapJournalRow(journalRow({ id: 'c', occurred_at: '2026-09-12T08:00:00.000Z' }), 'K'),
      ]
      const derived = deriveReportEvents(
        [{ id: 'r-1', intervention_id: 'i-1', version: 1, status: 'submitted', submitted_at: '2026-09-05T08:00:00.000Z' }],
        new Set(),
        'K',
      )
      const merged = mergeTimelineEvents(journal, derived, 10)
      expect(merged.map((e) => e.id)).toEqual(['c', 'report:r-1', 'a'])
      expect(mergeTimelineEvents(journal, derived, 2)).toHaveLength(2)
    })
  })

  describe('parseTimelineLimit', () => {
    it('should default and cap the limit', () => {
      expect(parseTimelineLimit(null)).toBe(50)
      expect(parseTimelineLimit('0')).toBe(50)
      expect(parseTimelineLimit('abc')).toBe(50)
      expect(parseTimelineLimit('10')).toBe(10)
      expect(parseTimelineLimit('99999')).toBe(TIMELINE_MAX_LIMIT)
    })
  })

  describe('libellés', () => {
    it('should translate the known action types', () => {
      expect(timelineLabel('PRICE_ACCEPTED')).toBe('Prix accepté')
      expect(timelineLabel('WORK_STARTED')).toBe('Chantier démarré')
      expect(timelineLabel('REPORT_SUBMITTED')).toBe('Rapport envoyé')
      expect(timelineLabel('DOCUMENT_UPLOADED')).toBe('Pièce déposée')
      expect(timelineLabel('INCONNU')).toBe('INCONNU')
    })

    it('should show the accepted amount and the refusal reason', () => {
      const accepte = mapJournalRow(journalRow({ payload: { amount: 480 } }), 'K')
      expect(timelineDetail(accepte)).toContain('480')
      const refuse = mapJournalRow(
        journalRow({ action_type: 'PRICE_REFUSED', payload: { reason: 'trop loin' } }),
        'K',
      )
      expect(timelineDetail(refuse)).toBe('trop loin')
    })
  })
})
