// SA, SNC, SCS et SCA retirés à la demande du client (WhatsApp 02/07/2026) :
// non sélectionnables, formes sociétaires jamais utilisées par les artisans.
export const STATUT_JURIDIQUE_OPTIONS = [
  { value: "SARL", label: "SARL" },
  { value: "EIRL", label: "EIRL" },
  { value: "EURL", label: "EURL" },
  { value: "SAS", label: "SAS" },
  { value: "SASU", label: "SASU" },
  { value: "Auto-entrepreneur", label: "Auto-entrepreneur" },
]

export const ZONE_INTERVENTION_OPTIONS = [
  { value: "20", label: "0 à 20 km" },
  { value: "35", label: "20 à 35 km" },
  { value: "50", label: "35 à 50 km" },
  { value: "150", label: "50 et + km" },
]

export const IBAN_LENGTH = 27
export const IBAN_GROUPS = [4, 4, 4, 4, 4, 4, 3]

export const ARTISAN_DOCUMENT_KINDS = [
  { kind: "kbis", label: "Extrait Kbis" },
  { kind: "assurance", label: "Attestation d'assurance" },
  { kind: "cni_recto_verso", label: "CNI recto/verso" },
  { kind: "iban", label: "IBAN" },
  { kind: "decharge_partenariat", label: "Décharge partenariat" },
  { kind: "photo_profil", label: "Photo de profil" },
  { kind: "autre", label: "Autre document" },
]
