import type { InterventionView } from "@/types/intervention-view"

// Factory pour créer des interventions de test
export const createMockIntervention = (
  overrides: Partial<InterventionView> = {}
): InterventionView => ({
  id: "test-intervention-1",
  idIntervention: "INT-001",
  statut: "En cours",
  statutCode: "EN_COURS",
  sousStatut: null,
  sousStatutCode: null,
  nomClient: "Client Test",
  telephoneClient: "0601020304",
  adresse: "123 Rue Test",
  ville: "Paris",
  codePostal: "75001",
  dateIntervention: new Date().toISOString(),
  date: new Date().toISOString(),
  coutIntervention: 500,
  marge: 150,
  paiementArtisan: 350,
  attribueA: "user-1",
  assignedUserCode: "AB",
  commentaire: null,
  lat: 48.8566,
  lng: 2.3522,
  ...overrides,
})

// Collection de fixtures
export const mockInterventions: InterventionView[] = [
  createMockIntervention({ id: "1", idIntervention: "INT-001", statut: "Nouvelle demande" }),
  createMockIntervention({ id: "2", idIntervention: "INT-002", statut: "En cours" }),
  createMockIntervention({ id: "3", idIntervention: "INT-003", statut: "Terminée" }),
]

// Interventions par statut pour tests de workflow
export const mockInterventionsByStatus = {
  nouvelle: createMockIntervention({ statut: "Nouvelle demande", statutCode: "NOUVELLE" }),
  enCours: createMockIntervention({ statut: "En cours", statutCode: "EN_COURS" }),
  terminee: createMockIntervention({ statut: "Terminée", statutCode: "TERMINEE" }),
  annulee: createMockIntervention({ statut: "Annulée", statutCode: "ANNULEE" }),
}
