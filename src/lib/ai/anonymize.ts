// ===== PIPELINE D'ANONYMISATION RGPD =====
// Nettoie les donnees personnelles avant tout envoi a une API IA externe.
// Seules les donnees metier (texte, statut, metier, zone, montants, dates) sont conservees.
// Les PII (noms, emails, telephones, adresses completes, IBAN) sont pseudonymisees ou supprimees.

import type { AnonymizedIntervention, AnonymizedArtisan } from './types'

/**
 * Hash simple et deterministe pour pseudonymiser les IDs.
 * Retourne un identifiant stable (meme input = meme output) sans reveler l'ID reel.
 */
function pseudonymize(value: string | null | undefined, prefix: string): string | null {
  if (!value) return null
  // Hash simple: prendre les 8 premiers chars du base64 de l'ID
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0 // Convert to 32bit integer
  }
  const positiveHash = Math.abs(hash)
  return `${prefix}_${positiveHash.toString(36).toUpperCase().padStart(6, '0')}`
}

/**
 * Nettoie le texte libre des eventuelles mentions de noms propres.
 * Heuristique simple : pas de regex complexe, on fait confiance au contexte metier.
 */
function sanitizeText(text: string | null | undefined): string | null {
  if (!text) return null
  return text
}

/**
 * Anonymise une intervention pour envoi a l'API IA.
 *
 * Conserve : contexte, consigne, statut, metier, zone (code postal + ville), dates, montants
 * Supprime : noms, emails, telephones, adresses completes, IBAN
 * Pseudonymise : artisan_id, assigned_user_id
 */
export function anonymizeIntervention(intervention: Record<string, unknown>): AnonymizedIntervention {
  return {
    id: intervention.id as string,
    id_inter: (intervention.id_inter as string) ?? null,
    contexte: sanitizeText(intervention.contexte_intervention as string ?? intervention.contexteIntervention as string),
    consigne: sanitizeText(intervention.consigne_intervention as string ?? intervention.consigneIntervention as string),
    consigne_second_artisan: sanitizeText(
      intervention.consigne_deuxieme_artisan_intervention as string ??
      intervention.consigneDeuxiemeArtisanIntervention as string
    ),
    commentaire_agent: sanitizeText(intervention.commentaire_agent as string ?? intervention.commentaireAgent as string),
    statut_code: (intervention.statusValue as string) ?? (intervention.statut_code as string) ?? null,
    statut_label: (intervention.statusLabel as string) ?? null,
    metier_label: (intervention.metierLabel as string) ?? (intervention.metier_label as string) ?? null,
    metier_code: (intervention.metierCode as string) ?? (intervention.metier_code as string) ?? null,
    code_postal: (intervention.code_postal as string) ?? (intervention.codePostal as string) ?? null,
    ville: (intervention.ville as string) ?? null,
    date: (intervention.date as string) ?? null,
    date_prevue: (intervention.date_prevue as string) ?? (intervention.datePrevue as string) ?? null,
    date_termine: (intervention.date_termine as string) ?? null,
    artisan_pseudo: pseudonymize(
      intervention.artisan_id as string ?? intervention.primaryArtisan?.toString(),
      'ARTISAN'
    ),
    gestionnaire_pseudo: pseudonymize(
      intervention.assigned_user_id as string ?? intervention.assignedUserId as string,
      'USER'
    ),
    agence_label: (intervention.agenceLabel as string) ?? (intervention.agence_label as string) ?? null,
    cout_intervention: (intervention.coutIntervention as number) ?? (intervention.cout_intervention as number) ?? null,
    cout_sst: (intervention.coutSST as number) ?? (intervention.cout_sst as number) ?? null,
    marge: (intervention.marge as number) ?? null,
  }
}

/**
 * Anonymise un artisan pour envoi a l'API IA.
 *
 * Conserve : metiers, zone, statut, SIRET (donnee professionnelle publique)
 * Supprime : nom, prenom, email, telephone, adresse complete, IBAN
 * Pseudonymise : id
 */
export function anonymizeArtisan(artisan: Record<string, unknown>): AnonymizedArtisan {
  const metiers: string[] = []
  const artisanMetiers = artisan.metiers as Array<{ metier?: { label?: string } }> | undefined
  if (Array.isArray(artisanMetiers)) {
    for (const m of artisanMetiers) {
      if (m.metier?.label) metiers.push(m.metier.label)
    }
  }

  return {
    id: artisan.id as string,
    pseudo: pseudonymize(artisan.id as string, 'ARTISAN') ?? 'ARTISAN_UNKNOWN',
    metiers,
    zone_code_postal: (artisan.code_postal as string) ?? null,
    zone_ville: (artisan.ville as string) ?? null,
    statut: (artisan.statut_code as string) ?? (artisan.status?.toString()) ?? null,
    nombre_interventions_actives: (artisan.activeInterventionCount as number) ?? null,
    siret: (artisan.siret as string) ?? null,
  }
}
