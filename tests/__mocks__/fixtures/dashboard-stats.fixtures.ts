/**
 * Fixtures pour les tests de statistiques dashboard
 *
 * Ces données de test ont des résultats prévisibles et documentés
 * pour permettre des assertions précises dans les tests.
 */

// ============================================
// CONSTANTES DE TEST
// ============================================

export const TEST_USER_ID = "test-user-123";
export const TEST_GESTIONNAIRE_ID = "test-user-123";

// Semaine de test : 13-17 janvier 2025 (lundi-vendredi)
export const TEST_WEEK = {
  monday: "2025-01-13",
  tuesday: "2025-01-14",
  wednesday: "2025-01-15",
  thursday: "2025-01-16",
  friday: "2025-01-17",
  saturday: "2025-01-18", // Pour les filtres < saturday
};

// Mois de test : janvier 2025
export const TEST_MONTH = {
  start: "2025-01-01",
  end: "2025-01-31",
  month: 1,
  year: 2025,
};

// ============================================
// STATUTS D'INTERVENTION
// ============================================

export const INTERVENTION_STATUSES = [
  { id: "status-demande", code: "DEMANDE", label: "Demandé" },
  { id: "status-devis", code: "DEVIS_ENVOYE", label: "Devis envoyé" },
  { id: "status-en-cours", code: "INTER_EN_COURS", label: "En cours" },
  { id: "status-terminee", code: "INTER_TERMINEE", label: "Terminée" },
];

export const ARTISAN_STATUSES = [
  { id: "artisan-status-potentiel", code: "POTENTIEL", label: "Potentiel" },
  { id: "artisan-status-actif", code: "ACTIF", label: "Actif" },
];

// ============================================
// INTERVENTIONS DE TEST (SEMAINE)
// ============================================

/**
 * Interventions pour la semaine de test
 *
 * Résultats attendus pour la semaine 13-17 janvier 2025:
 * - devis_envoye: lundi=1, mardi=1, mercredi=0, jeudi=0, vendredi=1, total=3
 * - inter_en_cours: lundi=0, mardi=1, mercredi=1, jeudi=0, vendredi=0, total=2
 * - inter_factures (terminées): lundi=0, mardi=0, mercredi=1, jeudi=1, vendredi=1, total=3
 */
export const WEEK_INTERVENTIONS = [
  // Lundi - 1 devis
  {
    id: "int-1",
    date: "2025-01-13",
    assigned_user_id: TEST_USER_ID,
    statut_id: "status-devis",
    is_active: true,
    status: { code: "DEVIS_ENVOYE" },
  },
  // Mardi - 1 devis, 1 en cours
  {
    id: "int-2",
    date: "2025-01-14",
    assigned_user_id: TEST_USER_ID,
    statut_id: "status-devis",
    is_active: true,
    status: { code: "DEVIS_ENVOYE" },
  },
  {
    id: "int-3",
    date: "2025-01-14",
    assigned_user_id: TEST_USER_ID,
    statut_id: "status-en-cours",
    is_active: true,
    status: { code: "INTER_EN_COURS" },
  },
  // Mercredi - 1 en cours, 1 terminée
  {
    id: "int-4",
    date: "2025-01-15",
    assigned_user_id: TEST_USER_ID,
    statut_id: "status-en-cours",
    is_active: true,
    status: { code: "INTER_EN_COURS" },
  },
  {
    id: "int-5",
    date: "2025-01-15",
    assigned_user_id: TEST_USER_ID,
    statut_id: "status-terminee",
    is_active: true,
    status: { code: "INTER_TERMINEE" },
  },
  // Jeudi - 1 terminée
  {
    id: "int-6",
    date: "2025-01-16",
    assigned_user_id: TEST_USER_ID,
    statut_id: "status-terminee",
    is_active: true,
    status: { code: "INTER_TERMINEE" },
  },
  // Vendredi - 1 devis, 1 terminée
  {
    id: "int-7",
    date: "2025-01-17",
    assigned_user_id: TEST_USER_ID,
    statut_id: "status-devis",
    is_active: true,
    status: { code: "DEVIS_ENVOYE" },
  },
  {
    id: "int-8",
    date: "2025-01-17",
    assigned_user_id: TEST_USER_ID,
    statut_id: "status-terminee",
    is_active: true,
    status: { code: "INTER_TERMINEE" },
  },
];

/**
 * Résultats attendus pour WEEK_INTERVENTIONS
 */
export const EXPECTED_WEEK_STATS = {
  devis_envoye: {
    lundi: 1,
    mardi: 1,
    mercredi: 0,
    jeudi: 0,
    vendredi: 1,
    total: 3,
  },
  inter_en_cours: {
    lundi: 0,
    mardi: 1,
    mercredi: 1,
    jeudi: 0,
    vendredi: 0,
    total: 2,
  },
  inter_factures: {
    lundi: 0,
    mardi: 0,
    mercredi: 1,
    jeudi: 1,
    vendredi: 1,
    total: 3,
  },
};

// ============================================
// ARTISANS DE TEST (SEMAINE)
// ============================================

/**
 * Artisans créés pendant la semaine de test
 *
 * Résultats attendus:
 * - nouveaux_artisans: lundi=1, mardi=0, mercredi=2, jeudi=0, vendredi=1, total=4
 */
export const WEEK_ARTISANS = [
  {
    id: "art-1",
    date_ajout: "2025-01-13",
    created_at: "2025-01-13T10:00:00Z",
    gestionnaire_id: TEST_GESTIONNAIRE_ID,
    is_active: true,
  },
  {
    id: "art-2",
    date_ajout: "2025-01-15",
    created_at: "2025-01-15T09:00:00Z",
    gestionnaire_id: TEST_GESTIONNAIRE_ID,
    is_active: true,
  },
  {
    id: "art-3",
    date_ajout: "2025-01-15",
    created_at: "2025-01-15T14:00:00Z",
    gestionnaire_id: TEST_GESTIONNAIRE_ID,
    is_active: true,
  },
  {
    id: "art-4",
    date_ajout: "2025-01-17",
    created_at: "2025-01-17T11:00:00Z",
    gestionnaire_id: TEST_GESTIONNAIRE_ID,
    is_active: true,
  },
];

export const EXPECTED_WEEK_ARTISANS = {
  nouveaux_artisans: {
    lundi: 1,
    mardi: 0,
    mercredi: 2,
    jeudi: 0,
    vendredi: 1,
    total: 4,
  },
};

/**
 * Artisans missionnés (POTENTIEL avec interventions)
 *
 * Résultats attendus:
 * - artisans_missionnes: lundi=1, mardi=0, mercredi=1, jeudi=0, vendredi=0, total=2
 */
export const WEEK_ARTISANS_MISSIONNES = [
  {
    id: "art-mission-1",
    date_ajout: "2025-01-13",
    created_at: "2025-01-13T10:00:00Z",
    gestionnaire_id: TEST_GESTIONNAIRE_ID,
    is_active: true,
    artisan_statuses: { code: "POTENTIEL" },
    intervention_artisans: [{ interventions: { id: "int-1", is_active: true } }],
  },
  {
    id: "art-mission-2",
    date_ajout: "2025-01-15",
    created_at: "2025-01-15T10:00:00Z",
    gestionnaire_id: TEST_GESTIONNAIRE_ID,
    is_active: true,
    artisan_statuses: { code: "POTENTIEL" },
    intervention_artisans: [{ interventions: { id: "int-4", is_active: true } }],
  },
];

export const EXPECTED_WEEK_ARTISANS_MISSIONNES = {
  artisans_missionnes: {
    lundi: 1,
    mardi: 0,
    mercredi: 1,
    jeudi: 0,
    vendredi: 0,
    total: 2,
  },
};

// ============================================
// INTERVENTIONS DE TEST (MOIS)
// ============================================

/**
 * Interventions pour le mois de test (janvier 2025)
 * Les semaines du mois sont calculées par rapport aux lundis
 *
 * Semaine 1: 30 déc - 3 jan (chevauchement)
 * Semaine 2: 6 jan - 10 jan
 * Semaine 3: 13 jan - 17 jan
 * Semaine 4: 20 jan - 24 jan
 * Semaine 5: 27 jan - 31 jan
 */
export const MONTH_INTERVENTIONS = [
  // Semaine 1 (début janvier)
  { id: "m-int-1", date: "2025-01-02", assigned_user_id: TEST_USER_ID, statut_id: "status-devis", is_active: true, status: { code: "DEVIS_ENVOYE" } },
  { id: "m-int-2", date: "2025-01-03", assigned_user_id: TEST_USER_ID, statut_id: "status-terminee", is_active: true, status: { code: "INTER_TERMINEE" } },

  // Semaine 2
  { id: "m-int-3", date: "2025-01-07", assigned_user_id: TEST_USER_ID, statut_id: "status-devis", is_active: true, status: { code: "DEVIS_ENVOYE" } },
  { id: "m-int-4", date: "2025-01-08", assigned_user_id: TEST_USER_ID, statut_id: "status-en-cours", is_active: true, status: { code: "INTER_EN_COURS" } },
  { id: "m-int-5", date: "2025-01-09", assigned_user_id: TEST_USER_ID, statut_id: "status-terminee", is_active: true, status: { code: "INTER_TERMINEE" } },

  // Semaine 3
  { id: "m-int-6", date: "2025-01-14", assigned_user_id: TEST_USER_ID, statut_id: "status-devis", is_active: true, status: { code: "DEVIS_ENVOYE" } },
  { id: "m-int-7", date: "2025-01-15", assigned_user_id: TEST_USER_ID, statut_id: "status-devis", is_active: true, status: { code: "DEVIS_ENVOYE" } },
  { id: "m-int-8", date: "2025-01-16", assigned_user_id: TEST_USER_ID, statut_id: "status-en-cours", is_active: true, status: { code: "INTER_EN_COURS" } },

  // Semaine 4
  { id: "m-int-9", date: "2025-01-21", assigned_user_id: TEST_USER_ID, statut_id: "status-terminee", is_active: true, status: { code: "INTER_TERMINEE" } },
  { id: "m-int-10", date: "2025-01-23", assigned_user_id: TEST_USER_ID, statut_id: "status-terminee", is_active: true, status: { code: "INTER_TERMINEE" } },

  // Semaine 5
  { id: "m-int-11", date: "2025-01-28", assigned_user_id: TEST_USER_ID, statut_id: "status-devis", is_active: true, status: { code: "DEVIS_ENVOYE" } },
  { id: "m-int-12", date: "2025-01-30", assigned_user_id: TEST_USER_ID, statut_id: "status-en-cours", is_active: true, status: { code: "INTER_EN_COURS" } },
];

// ============================================
// HELPERS POUR CRÉER DES FIXTURES PERSONNALISÉES
// ============================================

/**
 * Crée une intervention de test
 */
export function createTestIntervention(overrides: Partial<typeof WEEK_INTERVENTIONS[0]> = {}) {
  return {
    id: `int-${Date.now()}`,
    date: TEST_WEEK.monday,
    assigned_user_id: TEST_USER_ID,
    statut_id: "status-demande",
    is_active: true,
    status: { code: "DEMANDE" },
    ...overrides,
  };
}

/**
 * Crée un artisan de test
 */
export function createTestArtisan(overrides: Partial<typeof WEEK_ARTISANS[0]> = {}) {
  return {
    id: `art-${Date.now()}`,
    date_ajout: TEST_WEEK.monday,
    created_at: `${TEST_WEEK.monday}T10:00:00Z`,
    gestionnaire_id: TEST_GESTIONNAIRE_ID,
    is_active: true,
    ...overrides,
  };
}
