import type { Intervention } from "@/lib/supabase-api-v2"
import type { InterventionStatus } from "@/types/intervention"
import type { InterventionStatusValue } from "@/types/interventions"
import type { InterventionPayment } from "@/lib/api/v2/common/types"

/**
 * Type pour les interventions enrichies avec les champs mappés
 * La fonction mapInterventionRecord ajoute automatiquement ces champs
 */
export type InterventionView = Intervention & {
  // Champs mappés par mapInterventionRecord
  statusValue: InterventionStatusValue
  status?: InterventionStatus | null
  statusLabel?: string | null
  statusColor?: string | null
  attribueA?: string
  assignedUserName?: string
  assignedUserCode?: string | null
  assignedUserColor?: string | null
  statut?: string | null

  // Contexte et consignes (snake_case → camelCase)
  contexteIntervention?: string | null
  consigneIntervention?: string | null
  consigneDeuxiemeArtisanIntervention?: string | null
  commentaireAgent?: string | null

  // Localisation
  codePostal?: string | null
  latitudeAdresse?: string | null
  longitudeAdresse?: string | null
  dateIntervention?: string | null

  // Informations client (mappées depuis les relations)
  prenomClient?: string | null
  nomClient?: string | null
  telephoneClient?: string | null
  telephone2Client?: string | null
  emailClient?: string | null

  // Informations propriétaire
  prenomProprietaire?: string | null
  nomProprietaire?: string | null
  telephoneProprietaire?: string | null
  emailProprietaire?: string | null

  // Finances
  coutIntervention?: number | null
  coutSST?: number | null
  coutMateriel?: number | null
  marge?: number | null

  // SST
  numeroSST?: string | null
  pourcentageSST?: number | null

  // Agence
  agence?: string | null
  agenceLabel?: string | null
  agenceCode?: string | null

  // Métier
  metier?: string | null

  // Artisans
  artisan?: string | null // Nom de l'artisan principal (plain_nom)
  primaryArtisan?: {
    id: string
    prenom: string | null
    nom: string | null
    plain_nom: string | null
    telephone: string | null
    email: string | null
  } | null

  // Dates
  datePrevue?: string | null

  // Legacy
  type?: string | null
  typeDeuxiemeArtisan?: string | null
  telLoc?: string | null
  locataire?: string | null
  emailLocataire?: string | null
  commentaire?: string | null
  idFacture?: number | null
  sousStatutText?: string | null
  sousStatutTextColor?: string | null

  // Demandes
  demandeIntervention?: string | null
  demandeDevis?: string | null
  demandeTrustPilot?: string | null

  // Pièces jointes
  pieceJointeIntervention?: any[]
  pieceJointeCout?: any[]
  pieceJointeDevis?: any[]
  pieceJointePhotos?: any[]
  pieceJointeFactureGMBS?: any[]
  pieceJointeFactureArtisan?: string[]
  pieceJointeFactureMateriel?: string[]
  payments?: InterventionPayment[]

  // Autres
  devisId?: string | null
  deuxiemeArtisan?: string | null
}
