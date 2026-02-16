'use client'

import { useEffect, useRef } from 'react'

/**
 * Whitelist of form field IDs that should trigger presence tracking.
 * Prevents tracking non-form elements (collapsible triggers, buttons, etc.).
 * Must match the `id` attributes in InterventionEditForm.tsx.
 */
export const TRACKED_FIELD_IDS = new Set([
  // Main section
  'reference_agence',
  'idIntervention',
  'adresse',
  'perimeterKm',
  'contexteIntervention',
  'consigneIntervention',
  // Costs & dates
  'coutIntervention',
  'coutSST',
  'coutMateriel',
  'datePrevue',
  // Owner (propriétaire)
  'nomPrenomFacturation',
  'telephoneProprietaire',
  'emailProprietaire',
  // Vacant housing
  'is_vacant',
  'key_code',
  'floor',
  'apartment_number',
  'vacant_housing_instructions',
  // Tenant (client)
  'nomPrenomClient',
  'telephoneClient',
  'emailClient',
  // Deposits (acomptes)
  'accompteSST',
  'accompteClient',
  // Second artisan
  'consigne_second_artisan',
  'coutSSTSecondArtisan',
  'coutMaterielSecondArtisan',
  // Custom sub-status
  'sousStatutText',
  'sousStatutTextColor',
  'sousStatutBgColor',
  // SST
  'numero_sst',
  'pourcentage_sst',
])

/**
 * Resolves a DOM element to its tracked field name.
 *
 * Strategy:
 * 1. Check for `data-presence-field` attribute on the element or ancestors
 *    (used by custom components like SearchableBadgeSelect)
 * 2. Check the element's `id` against the whitelist
 * 3. Return null if not a tracked field
 */
export function resolveFieldName(element: HTMLElement | null): string | null {
  if (!element) return null

  // 1. Check for data-presence-field on element or ancestor
  const presenceField = element
    .closest('[data-presence-field]')
    ?.getAttribute('data-presence-field')
  if (presenceField) return presenceField

  // 2. Check element id against whitelist
  if (element.id && TRACKED_FIELD_IDS.has(element.id)) return element.id

  return null
}

/**
 * Event delegation hook for field-level presence tracking.
 *
 * Attaches focusin/focusout listeners on the form element. When a tracked
 * field gains focus, calls trackField(). When it loses focus (and focus
 * moves to a non-related element), calls clearField().
 *
 * This is zero-touch instrumentation: no changes needed on individual
 * <Input>, <Textarea>, or <Checkbox> components.
 *
 * Custom components (SearchableBadgeSelect) need a `data-presence-field`
 * attribute on their root element to be resolved.
 */
export function useFieldPresenceDelegation(
  formRef: React.RefObject<HTMLFormElement | HTMLDivElement | null>,
  trackField: (fieldName: string) => void,
  clearField: () => void
) {
  // Store callbacks in refs for stable event handlers
  const trackFieldRef = useRef(trackField)
  const clearFieldRef = useRef(clearField)
  trackFieldRef.current = trackField
  clearFieldRef.current = clearField

  // Track the currently focused field to avoid redundant calls
  const currentFieldRef = useRef<string | null>(null)

  useEffect(() => {
    const form = formRef.current
    if (!form) return

    const handleFocusIn = (e: Event) => {
      const target = (e as FocusEvent).target as HTMLElement
      const fieldName = resolveFieldName(target)
      if (fieldName && fieldName !== currentFieldRef.current) {
        currentFieldRef.current = fieldName
        trackFieldRef.current(fieldName)
      }
    }

    const handleFocusOut = (e: Event) => {
      const leavingFieldName = resolveFieldName((e as FocusEvent).target as HTMLElement)
      if (!leavingFieldName) return

      // Small delay: focus may be moving between related elements within the
      // same logical field (e.g., input → dropdown suggestion, popover open/close).
      // Check after the browser settles the new activeElement.
      setTimeout(() => {
        const newActive = document.activeElement as HTMLElement | null
        const newFieldName = resolveFieldName(newActive)
        if (newFieldName !== leavingFieldName) {
          currentFieldRef.current = newFieldName
          if (!newFieldName) {
            clearFieldRef.current()
          }
          // If newFieldName is a different tracked field, focusin already handled it
        }
      }, 50)
    }

    form.addEventListener('focusin', handleFocusIn)
    form.addEventListener('focusout', handleFocusOut)
    return () => {
      form.removeEventListener('focusin', handleFocusIn)
      form.removeEventListener('focusout', handleFocusOut)
      currentFieldRef.current = null
    }
  }, [formRef])
}
