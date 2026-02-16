import { describe, it, expect } from 'vitest'
import { resolveFieldName, TRACKED_FIELD_IDS } from '@/hooks/useFieldPresenceDelegation'

// ─── resolveFieldName tests ──────────────────────────────────────────────────

describe('resolveFieldName', () => {
  function createElement(tag: string, attrs: Record<string, string> = {}): HTMLElement {
    const el = document.createElement(tag)
    for (const [key, value] of Object.entries(attrs)) {
      el.setAttribute(key, value)
    }
    return el
  }

  describe('with id matching whitelist', () => {
    it('should resolve tracked field by id', () => {
      const input = createElement('input', { id: 'coutSST' })
      expect(resolveFieldName(input)).toBe('coutSST')
    })

    it('should resolve all known field IDs', () => {
      for (const fieldId of TRACKED_FIELD_IDS) {
        const input = createElement('input', { id: fieldId })
        expect(resolveFieldName(input)).toBe(fieldId)
      }
    })

    it('should return null for unknown id', () => {
      const input = createElement('input', { id: 'unknownField' })
      expect(resolveFieldName(input)).toBeNull()
    })

    it('should return null for element without id', () => {
      const input = createElement('input')
      expect(resolveFieldName(input)).toBeNull()
    })
  })

  describe('with data-presence-field attribute', () => {
    it('should resolve from data-presence-field on element', () => {
      const div = createElement('div', { 'data-presence-field': 'statut_id' })
      expect(resolveFieldName(div)).toBe('statut_id')
    })

    it('should resolve from data-presence-field on ancestor', () => {
      const wrapper = createElement('div', { 'data-presence-field': 'agence_id' })
      const button = createElement('button')
      wrapper.appendChild(button)
      // Need to attach to document for closest() to work
      document.body.appendChild(wrapper)

      expect(resolveFieldName(button)).toBe('agence_id')

      document.body.removeChild(wrapper)
    })

    it('should prefer data-presence-field over id', () => {
      const wrapper = createElement('div', { 'data-presence-field': 'metier_id' })
      const input = createElement('input', { id: 'coutSST' })
      wrapper.appendChild(input)
      document.body.appendChild(wrapper)

      // data-presence-field on ancestor takes priority
      expect(resolveFieldName(input)).toBe('metier_id')

      document.body.removeChild(wrapper)
    })
  })

  describe('null handling', () => {
    it('should return null for null element', () => {
      expect(resolveFieldName(null)).toBeNull()
    })

    it('should return null for non-form elements like buttons', () => {
      const button = createElement('button', { id: 'saveButton' })
      expect(resolveFieldName(button)).toBeNull()
    })

    it('should return null for collapsible triggers', () => {
      const trigger = createElement('div', { id: 'collapsibleTrigger' })
      expect(resolveFieldName(trigger)).toBeNull()
    })
  })
})

// ─── TRACKED_FIELD_IDS whitelist tests ───────────────────────────────────────

describe('TRACKED_FIELD_IDS', () => {
  it('should contain key form fields', () => {
    const expectedFields = [
      'coutSST',
      'coutIntervention',
      'coutMateriel',
      'adresse',
      'contexteIntervention',
      'consigneIntervention',
      'datePrevue',
      'nomPrenomFacturation',
      'nomPrenomClient',
      'accompteSST',
      'accompteClient',
    ]

    for (const field of expectedFields) {
      expect(TRACKED_FIELD_IDS.has(field)).toBe(true)
    }
  })

  it('should not contain non-form elements', () => {
    expect(TRACKED_FIELD_IDS.has('saveButton')).toBe(false)
    expect(TRACKED_FIELD_IDS.has('collapsibleTrigger')).toBe(false)
    expect(TRACKED_FIELD_IDS.has('modal')).toBe(false)
  })
})
