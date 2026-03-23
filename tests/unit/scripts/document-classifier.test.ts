import { describe, it, expect } from 'vitest'

// Le classifier est un module JS pur sans dépendances — import direct
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  classifyDocument,
  extractFactureGmbs,
  getDocumentTypeLabel,
  isValidDocumentType,
  normalizeString,
} = require('../../../scripts/data/imports/documents/document-classifier.js')

// ─────────────────────────────────────────────────────────────────────────────
// normalizeString
// ─────────────────────────────────────────────────────────────────────────────
describe('normalizeString', () => {
  it('should lowercase and strip accents', () => {
    expect(normalizeString('Décharge')).toBe('decharge')
    expect(normalizeString('Attestation Assurance')).toBe('attestation assurance')
  })

  it('should collapse multiple spaces', () => {
    expect(normalizeString('FACTURE   1234')).toBe('facture 1234')
  })

  it('should return empty string for null/undefined', () => {
    expect(normalizeString(null)).toBe('')
    expect(normalizeString(undefined)).toBe('')
    expect(normalizeString('')).toBe('')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// extractFactureGmbs
// ─────────────────────────────────────────────────────────────────────────────
describe('extractFactureGmbs', () => {
  describe('pattern nominal', () => {
    it('should detect "FACTURE NUM INTER ID" with spaces', () => {
      const result = extractFactureGmbs('FACTURE 1234 INTER 5678')
      expect(result).toEqual({
        type: 'facturesGMBS',
        numeroFacture: 1234,
        interventionId: 5678,
        confidence: 0.95,
      })
    })

    it('should detect "FACTURE NUM INTER ID NUM" explicit keyword', () => {
      const result = extractFactureGmbs('FACTURE 1234 INTER ID 5678')
      expect(result).toMatchObject({ type: 'facturesGMBS', numeroFacture: 1234, interventionId: 5678 })
    })

    it('should detect with underscores', () => {
      const result = extractFactureGmbs('FACTURE_1234_INTER_5678')
      expect(result).toMatchObject({ type: 'facturesGMBS', numeroFacture: 1234, interventionId: 5678 })
    })

    it('should detect with dashes', () => {
      const result = extractFactureGmbs('FACTURE-1234-INTER-5678')
      expect(result).toMatchObject({ type: 'facturesGMBS', numeroFacture: 1234, interventionId: 5678 })
    })
  })

  describe('variantes de typos sur FACTURE', () => {
    it('should detect "FRACTURE" (typo commune)', () => {
      const result = extractFactureGmbs('FRACTURE 1234 INTER 5678')
      expect(result).toMatchObject({ type: 'facturesGMBS', numeroFacture: 1234, interventionId: 5678 })
    })

    it('should detect "FACRTURE" (transposition)', () => {
      const result = extractFactureGmbs('FACRTURE 1234 INTER 5678')
      expect(result).toMatchObject({ type: 'facturesGMBS', numeroFacture: 1234, interventionId: 5678 })
    })
  })

  describe('cas non-détectés', () => {
    it('should return null for plain filename', () => {
      expect(extractFactureGmbs('photo_chantier.jpg')).toBeNull()
    })

    it('should return null for FACTURE without INTER', () => {
      expect(extractFactureGmbs('FACTURE 1234')).toBeNull()
    })

    it('should return null for null/undefined', () => {
      expect(extractFactureGmbs(null)).toBeNull()
      expect(extractFactureGmbs(undefined)).toBeNull()
      expect(extractFactureGmbs('')).toBeNull()
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// classifyDocument
// ─────────────────────────────────────────────────────────────────────────────
describe('classifyDocument', () => {
  describe('facturesGMBS (priorité haute)', () => {
    it('should classify facture GMBS pattern before other rules', () => {
      expect(classifyDocument('FACTURE 1234 INTER 5678.pdf')).toBe('facturesGMBS')
    })

    it('should classify typo FRACTURE as facturesGMBS', () => {
      expect(classifyDocument('FRACTURE 99 INTER ID 100')).toBe('facturesGMBS')
    })
  })

  describe('kbis', () => {
    it('should classify KBIS', () => {
      expect(classifyDocument('KBIS_entreprise.pdf')).toBe('kbis')
      expect(classifyDocument('extrait kbis SARL Dupont.pdf')).toBe('kbis')
      expect(classifyDocument('SIRET_12345.pdf')).toBe('kbis')
    })
  })

  describe('cni_recto_verso', () => {
    it('should classify CNI', () => {
      expect(classifyDocument('CNI_Jean_Dupont.jpg')).toBe('cni_recto_verso')
      expect(classifyDocument('carte identite recto verso.pdf')).toBe('cni_recto_verso')
      expect(classifyDocument('piece identite.pdf')).toBe('cni_recto_verso')
    })
  })

  describe('decharge_partenariat', () => {
    it('should classify décharge', () => {
      expect(classifyDocument('decharge_partenariat.pdf')).toBe('decharge_partenariat')
      expect(classifyDocument('DECHARGE PATERNELLE signed.pdf')).toBe('decharge_partenariat')
      expect(classifyDocument('autorisation parentale.pdf')).toBe('decharge_partenariat')
    })
  })

  describe('assurance', () => {
    it('should classify attestation assurance', () => {
      expect(classifyDocument('attestation_assurance_2025.pdf')).toBe('assurance')
      expect(classifyDocument('RC Pro BTP.pdf')).toBe('assurance')
      expect(classifyDocument('responsabilite civile.pdf')).toBe('assurance')
    })
  })

  describe('iban', () => {
    it('should classify IBAN / RIB', () => {
      expect(classifyDocument('IBAN_Dupont.pdf')).toBe('iban')
      expect(classifyDocument('RIB compte bancaire.pdf')).toBe('iban')
      expect(classifyDocument('coordonnees_bancaires.pdf')).toBe('iban')
    })
  })

  describe('autre (fallback)', () => {
    it('should return "autre" for unrecognized files', () => {
      expect(classifyDocument('photo_chantier_01.jpg')).toBe('autre')
      expect(classifyDocument('document_divers.pdf')).toBe('autre')
    })

    it('should return "autre" for null/undefined', () => {
      expect(classifyDocument(null)).toBe('autre')
      expect(classifyDocument(undefined)).toBe('autre')
      expect(classifyDocument('')).toBe('autre')
    })
  })

  describe('priorité facturesGMBS vs autres patterns', () => {
    it('should not confuse INTER keyword with CNI when FACTURE is present', () => {
      // "INTER" seul ne doit pas déclencher autre chose que facturesGMBS
      expect(classifyDocument('FACTURE 10 INTER ID 20')).toBe('facturesGMBS')
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getDocumentTypeLabel
// ─────────────────────────────────────────────────────────────────────────────
describe('getDocumentTypeLabel', () => {
  it('should return correct labels for all types', () => {
    expect(getDocumentTypeLabel('facturesGMBS')).toBe('Facture GMBS')
    expect(getDocumentTypeLabel('kbis')).toBe('KBIS')
    expect(getDocumentTypeLabel('cni_recto_verso')).toBe("Carte d'identité")
    expect(getDocumentTypeLabel('decharge_partenariat')).toBe('Décharge paternelle')
    expect(getDocumentTypeLabel('assurance')).toBe('Attestation assurance')
    expect(getDocumentTypeLabel('iban')).toBe('IBAN')
    expect(getDocumentTypeLabel('autre')).toBe('Autre')
  })

  it('should return "Autre" for unknown type', () => {
    expect(getDocumentTypeLabel('type_inconnu')).toBe('Autre')
    expect(getDocumentTypeLabel('')).toBe('Autre')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// isValidDocumentType
// ─────────────────────────────────────────────────────────────────────────────
describe('isValidDocumentType', () => {
  it('should accept all valid types', () => {
    const validTypes = ['facturesGMBS', 'kbis', 'cni_recto_verso', 'decharge_partenariat', 'assurance', 'iban', 'autre']
    validTypes.forEach(type => {
      expect(isValidDocumentType(type)).toBe(true)
    })
  })

  it('should reject invalid types', () => {
    expect(isValidDocumentType('a_classe')).toBe(false)
    expect(isValidDocumentType('unknown')).toBe(false)
    expect(isValidDocumentType('')).toBe(false)
  })
})
