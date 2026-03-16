// ========================================
// CONSTANTES DE NORMALISATION DES IMPORTS
// ========================================
// Centralise les correspondances entre les valeurs issues
// des Google Sheets et les codes canoniques utilisés en base.
// Ces mappings permettent d'éviter la création de doublons
// (statuts, gestionnaires) lors des imports.

/**
 * Mapping des codes/libellés de statuts d'ARTISAN vers les codes canoniques.
 * Les clés doivent être en MAJUSCULES (normalisées) et sans accents.
 * La fonction getArtisanStatusIdNormalized() traite la casse et les accents.
 *
 * Important: Consolide ARCHIVER → ARCHIVE (migration 99010)
 */
const ARTISAN_STATUS_LABEL_TO_CODE = {
  "CANDIDAT": "CANDIDAT",
  "ONE_SHOT": "ONE_SHOT",
  "POTENTIEL": "POTENTIEL",
  "NOVICE": "NOVICE",
  "FORMATION": "FORMATION",
  "CONFIRME": "CONFIRME",
  "EXPERT": "EXPERT",
  "INACTIF": "INACTIF",
  "ARCHIVE": "ARCHIVE",
  // Fusion des anciennes valeurs ARCHIVER vers ARCHIVE
  "ARCHIVER": "ARCHIVE",
  "ARCHIVEE": "ARCHIVE",
};

/**
 * Mapping des libellés de statuts d'INTERVENTION vers les codes canoniques.
 * Les clés doivent être en MAJUSCULES (normalisées) et sans accents.
 * La fonction getInterventionStatusIdNormalized() traite la casse et les accents.
 */
const STATUS_LABEL_TO_CODE = {
  // === ACCEPTÉ ===
  "ACCEPTE": "ACCEPTE",

  // === ANNULÉ ===
  "ANNULE": "ANNULE",

  // === ATT ACOMPTE ===
  "ATT_ACOMPTE": "ATT_ACOMPTE",
  "ATTENTE_ACOMPTE": "ATT_ACOMPTE",

  // === DEMANDÉ ===
  "DEMANDE": "DEMANDE",

  // === DEVIS ENVOYÉ ===
  "DEVIS_ENVOYE": "DEVIS_ENVOYE",

  // === EN COURS / INTER EN COURS ===
  "INTER_EN_COURS": "INTER_EN_COURS",
  "EN_COURS": "INTER_EN_COURS",

  // === REFUSÉ ===
  "REFUSE": "REFUSE",

  // === SAV ===
  "SAV": "SAV",

  // === STAND BY ===
  "STAND_BY": "STAND_BY",

  // === TERMINÉ / INTER TERMINÉE ===
  "INTER_TERMINEE": "INTER_TERMINEE",

  // === VISITE TECHNIQUE ===
  "VISITE_TECHNIQUE": "VISITE_TECHNIQUE",
};

/**
 * Mapping des codes/lettres de gestionnaire vers les usernames canoniques.
 * Les colonnes "Gest." des Sheets peuvent contenir une lettre, un code court
 * ou le prénom complet : on normalise tout ici.
 */
// Clés en lowercase uniquement — la normalisation (trim + lowercase) est appliquée
// avant chaque lookup dans getUserIdNormalized, ce qui rend les variantes de casse inutiles.
const GESTIONNAIRE_CODE_MAP = {
  // from intervention sheet
  "o": "yazid",
  "l": "soufian",
  "j": "clement",
  "a": "andrea",
  "d": "dimitri",
  "m": "adam",
  "b": "badr",  
  "n": "metehan",

  // from artisan sheet
  "metehan": "metehan",
  "badr": "badr",
  "clement": "clement",
  "dimitri": "dimitri",
  "andrea": "andrea",
  "lucien": "soufian",
  "olivier": "yazid",
  "adam": "adam",


  // === VALEURS ABERRANTES (ignorer) ===
  "": null,
};

/**
 * Normalisation des noms d'agences
 * Mappe les variations typographiques vers la forme canonique (majoritaire)
 */
// Clés en lowercase sans accents — normalisées avant le lookup dans getAgencyId.
// Les variantes de casse et accents sont gérées par la normalisation de l'input.
const AGENCE_NORMALIZATION_MAP = {
  "afedim": "AFEDIM",
  "agence blue": "Agence Blue",
  "beanstock": "Beanstock",
  "cabinet grainville": "Cabinet Grainville",
  "century21": "Century21",
  "century 21": "Century21",
  "criterimmo": "CRITERIMMO",
  "criterion": "CRITERIMMO",
  "criter immo": "CRITERIMMO",
  "flatlooker": "Flatlooker",
  "george v": "George V",
  "gererseul": "GererSeul",
  "gerer seul": "GererSeul",
  "gesty": "Gesty",
  "homeassur": "HomeAssur",
  "home assur": "HomeAssur",
  "homepilot": "HomePilot",
  "home pilot": "HomePilot",
  "imodirect": "ImoDirect",
  "imo direct": "ImoDirect",
  "myimmo": "Myimmo",
  "my immo": "Myimmo",
  "oqoro": "Oqoro",
  "particulier": "Particulier",
  "plusse": "Plusse",
  "qantex": "Qantex",
  "remi": "Remi",
  "site gmbs": "Site GMBS",
  "zerent": "ZeRent",
  "ze rent": "ZeRent",

  // === VALEURS ABERRANTES (ignorer) ===
  "2024-08-19 00:00:00": null,
  "2024-09-30 00:00:00": null,
  "": null,
};

/**
 * Normalisation des noms de métiers
 * Mappe les variations typographiques vers la forme canonique (majoritaire)
 */
// Clés en lowercase sans accents — normalisées avant le lookup dans getMetierId.
// Les variantes de casse et accents sont gérées par la normalisation de l'input.
const METIER_NORMALIZATION_MAP = {
  "bricolage": "Bricolage",
  "chauffage": "Chauffage",
  "climatisation": "Climatisation",
  "electricite": "Electricite",
  "electromenager": "Electroménager",
  "entretien general": "Entretien général",
  "jardinage": "Jardinage",
  "menage": "Menage",
  "menuiserie": "Menuiserie",
  "nettoyage": "Nettoyage",
  "nuisible": "Nuisible",
  "peinture": "Peinture",
  "plomberie": "Plomberie",
  "renovation": "Renovation",
  "serrurerie": "Serrurerie",
  "vitrerie": "Vitrerie",
  "volet/store": "Volet/Store",

  // === VALEURS ABERRANTES (ignorer) ===
  "2024-08-19 00:00:00": null,
  "2024-09-30 00:00:00": null,
  "": null,
};

module.exports = {
  ARTISAN_STATUS_LABEL_TO_CODE,
  STATUS_LABEL_TO_CODE,
  GESTIONNAIRE_CODE_MAP,
  AGENCE_NORMALIZATION_MAP,
  METIER_NORMALIZATION_MAP,
};
