// ========================================
// CONSTANTES DE NORMALISATION DES IMPORTS
// ========================================
// Centralise les correspondances entre les valeurs issues
// des Google Sheets et les codes canoniques utilisés en base.
// Ces mappings permettent d'éviter la création de doublons
// (statuts, gestionnaires) lors des imports.

/**
 * Mapping des libellés de statuts vers les codes canoniques.
 * Inclut les variations (casse, accents, abréviations) observées
 * dans les fichiers Google Sheets historiques.
 */
const STATUS_LABEL_TO_CODE = {
  // === ACCEPTÉ ===
  "Accepté": "ACCEPTE",
  "Accepte": "ACCEPTE",
  "accepté": "ACCEPTE",
  "accepte": "ACCEPTE",
  "ACCEPTÉ": "ACCEPTE",
  "ACCEPTE": "ACCEPTE",

  // === ANNULÉ ===
  "Annulé": "ANNULE",
  "Annule": "ANNULE",
  "annulé": "ANNULE",
  "annule": "ANNULE",
  "Annulée": "ANNULE",
  "ANNULÉ": "ANNULE",
  "ANNULE": "ANNULE",
  "ANNULÉE": "ANNULE",

  // === ATT ACOMPTE ===
  "Att Acompte": "ATT_ACOMPTE",
  "att acompte": "ATT_ACOMPTE",
  "ATT ACOMPTE": "ATT_ACOMPTE",
  "ATT_ACOMPTE": "ATT_ACOMPTE",
  "En attente acompte": "ATT_ACOMPTE",
  "Attente acompte": "ATT_ACOMPTE",

  // === DEMANDÉ ===
  "Demandé": "DEMANDE",
  "Demande": "DEMANDE",
  "demandé": "DEMANDE",
  "demande": "DEMANDE",
  "DEMANDÉ": "DEMANDE",
  "DEMANDE": "DEMANDE",

  // === DEVIS ENVOYÉ ===
  "Devis Envoyé": "DEVIS_ENVOYE",
  "Devis Envoyé ": "DEVIS_ENVOYE", // Avec espace à la fin
  "Devis envoyé": "DEVIS_ENVOYE",
  "devis envoyé": "DEVIS_ENVOYE",
  "Devis envoyé.": "DEVIS_ENVOYE",
  "DEVIS ENVOYÉ": "DEVIS_ENVOYE",
  "DEVIS ENVOYÉ ": "DEVIS_ENVOYE", // Avec espace à la fin
  "DEVIS ENVOYE": "DEVIS_ENVOYE",
  "DEVIS_ENVOYE": "DEVIS_ENVOYE",

  // === EN COURS / INTER EN COURS ===
  "En cours": "INTER_EN_COURS",
  "en cours": "INTER_EN_COURS",
  "En Cours": "INTER_EN_COURS",
  "En cours.": "INTER_EN_COURS",
  "EN COURS": "INTER_EN_COURS",
  "ENCOURS": "INTER_EN_COURS",
  "EN_COURS": "INTER_EN_COURS",
  "Inter en cours": "INTER_EN_COURS",
  "Inter en cours.": "INTER_EN_COURS",
  "Inter En Cours": "INTER_EN_COURS",
  "inter en cours": "INTER_EN_COURS",
  "INTER EN COURS": "INTER_EN_COURS",
  "INTERENCOU": "INTER_EN_COURS",
  "INTERENCOURS": "INTER_EN_COURS",
  "INTER_ENCOURS": "INTER_EN_COURS",
  "INTER_EN_COURS": "INTER_EN_COURS",

  // === REFUSÉ ===
  "Refusé": "REFUSE",
  "Refuse": "REFUSE",
  "refusé": "REFUSE",
  "refuse": "REFUSE",
  "REFUSÉ": "REFUSE",
  "REFUSE": "REFUSE",

  // === SAV ===
  "SAV": "SAV",
  "sav": "SAV",
  "Sav": "SAV",

  // === STAND BY ===
  "Stand by": "STAND_BY",
  "Stand By": "STAND_BY",
  "stand by": "STAND_BY",
  "STAND BY": "STAND_BY",
  "STAND BY ": "STAND_BY", // Avec espace à la fin
  "STAND_BY": "STAND_BY",
  "StandBy": "STAND_BY",

  // === TERMINÉ / INTER TERMINÉE ===
  "Terminé": "INTER_TERMINEE",
  "Terminée": "INTER_TERMINEE",
  "Terminé.": "INTER_TERMINEE",
  "termine": "INTER_TERMINEE",
  "terminé": "INTER_TERMINEE",
  "terminée": "INTER_TERMINEE",
  "TERMINÉ": "INTER_TERMINEE",
  "TERMINÉE": "INTER_TERMINEE",
  "TERMINE": "INTER_TERMINEE",
  "TERMINEE": "INTER_TERMINEE",
  "Terminee": "INTER_TERMINEE",
  "Inter terminée": "INTER_TERMINEE",
  "Inter terminée ": "INTER_TERMINEE", // Avec espace à la fin
  "Inter Terminée": "INTER_TERMINEE",
  "Intervention terminée": "INTER_TERMINEE",
  "INTER TERMINEE": "INTER_TERMINEE",
  "INTER TERMINEE ": "INTER_TERMINEE", // Avec espace à la fin
  "INTERTERMINEE": "INTER_TERMINEE",
  "INTER TERMINEES": "INTER_TERMINEE",
  "TERMINEES": "INTER_TERMINEE",
  "INTER_TERMINEE": "INTER_TERMINEE",

  // === VISITE TECHNIQUE ===
  "Visite Technique": "VISITE_TECHNIQUE",
  "Visite technique": "VISITE_TECHNIQUE",
  "visite technique": "VISITE_TECHNIQUE",
  "VISITE TECHNIQUE": "VISITE_TECHNIQUE",
  "VISITE_TECHNIQUE": "VISITE_TECHNIQUE",
};

/**
 * Mapping des codes/lettres de gestionnaire vers les usernames canoniques.
 * Les colonnes "Gest." des Sheets peuvent contenir une lettre, un code court
 * ou le prénom complet : on normalise tout ici.
 */
const GESTIONNAIRE_CODE_MAP = {
  // === ANDREA ===
  "A": "andrea",
  "A ": "andrea", // Avec espace à la fin
  "a": "andrea",
  "a ": "andrea", // Avec espace à la fin
  "ANDREA": "andrea",
  "Andrea": "andrea",
  "andrea": "andrea",

  // === BADR ===
  "B": "badr",
  "b": "badr",
  "BAD": "badr",
  "Bad": "badr",
  "bad": "badr",
  "BAD.": "badr",
  "bad.": "badr",
  "BADR": "badr",
  "Badr": "badr",
  "badr": "badr",
  "BADR.": "badr",
  "badr.": "badr",

  // === CLÉMENT ===
  "C": "clement",
  "c": "clement",
  "CL": "clement",
  "Cl": "clement",
  "cl": "clement",
  "CLEMENT": "clement",
  "Clement": "clement",
  "clement": "clement",
  "Clément": "clement",

  // === DIMITRI ===
  "D": "dimitri",
  "D ": "dimitri", // Avec espace à la fin
  "d": "dimitri",
  "d ": "dimitri", // Avec espace à la fin
  "DIM": "dimitri",
  "Dim": "dimitri",
  "dim": "dimitri",
  "DIMI": "dimitri",
  "Dimi": "dimitri",
  "dimi": "dimitri",
  "DIMI.": "dimitri",
  "dimi.": "dimitri",
  "DIMITRI": "dimitri",
  "Dimitri": "dimitri",
  "dimitri": "dimitri",

  // === LOUIS (code J) ===
  "J": "louis",
  "j": "louis",
  "LOUIS": "louis",
  "Louis": "louis",
  "louis": "louis",

  // === KILLIAN ===
  "K": "killian",
  "k": "killian",
  "KILLIAN": "killian",
  "Killian": "killian",
  "killian": "killian",

  // === LUCIEN ===
  "L": "lucien",
  "l": "lucien",
  "LU": "lucien",
  "Lu": "lucien",
  "lu": "lucien",
  "LUC": "lucien",
  "Luc": "lucien",
  "luc": "lucien",
  "LU.": "lucien",
  "lu.": "lucien",
  "LUCIEN": "lucien",
  "Lucien": "lucien",
  "lucien": "lucien",

  // === OLIVIER ===
  "O": "olivier",
  "O ": "olivier", // Avec espace à la fin
  "o": "olivier",
  "o ": "olivier", // Avec espace à la fin
  "OLI": "olivier",
  "Oli": "olivier",
  "oli": "olivier",
  "OLIV": "olivier",
  "Oliv": "olivier",
  "oliv": "olivier",
  "OLIV.": "olivier",
  "oliv.": "olivier",
  "OLIVIER": "olivier",
  "Olivier": "olivier",
  "olivier": "olivier",

  // === PAUL ===
  "P": "paul",
  "p": "paul",
  "PAUL": "paul",
  "Paul": "paul",
  "paul": "paul",

  // === SAMUEL ===
  "S": "samuel",
  "s": "samuel",
  "SAM": "samuel",
  "Sam": "samuel",
  "sam": "samuel",
  "SAM.": "samuel",
  "sam.": "samuel",
  "SAMU": "samuel",
  "Samu": "samuel",
  "samu": "samuel",
  "SAMUEL": "samuel",
  "Samuel": "samuel",
  "samuel": "samuel",

  // === SOULAIMANE ===
  "SO": "soulaimane",
  "So": "soulaimane",
  "so": "soulaimane",
  "SOULAIMANE": "soulaimane",
  "Soulaimane": "soulaimane",
  "soulaimane": "soulaimane",

  // === TOM ===
  "T": "tom",
  "t": "tom",
  "TO": "tom",
  "To": "tom",
  "to": "tom",
  "TO.": "tom",
  "to.": "tom",
  "TOM": "tom",
  "Tom": "tom",
  "tom": "tom",
  "TOM.": "tom",
  "tom.": "tom",

  // === VALEURS ABERRANTES (ignorer) ===
  "2024-08-19 00:00:00": null,
  "": null,
};

/**
 * Normalisation des noms d'agences
 * Mappe les variations typographiques vers la forme canonique (majoritaire)
 */
const AGENCE_NORMALIZATION_MAP = {
  // === VARIATIONS DE CASSE ===
  
  // AFEDIM
  "afedim": "AFEDIM",
  "Afedim": "AFEDIM",
  
  // Agence Blue
  "agence blue": "Agence Blue",
  "AGENCE BLUE": "Agence Blue",
  
  // Beanstock
  "beanstock": "Beanstock",
  "BEANSTOCK": "Beanstock",
  
  // Cabinet Grainville
  "cabinet grainville": "Cabinet Grainville",
  "CABINET GRAINVILLE": "Cabinet Grainville",
  "Cabinet grainville": "Cabinet Grainville",
  
  // Century21
  "century21": "Century21",
  "CENTURY21": "Century21",
  "century 21": "Century21",
  
  // CRITERIMMO
  "criterimmo": "CRITERIMMO",
  "Criterimmo": "CRITERIMMO",
  "criterion": "CRITERIMMO",
  "criter immo": "CRITERIMMO",
  "critérimmo": "CRITERIMMO",
  
  // Flatlooker
  "flatlooker": "Flatlooker",
  "FLATLOOKER": "Flatlooker",
  "FlatLooker": "Flatlooker",
  
  // George V
  "george v": "George V",
  "GEORGE V": "George V",
  "George v": "George V",
  
  // GererSeul
  "gererseul": "GererSeul",
  "GERERSEUL": "GererSeul",
  "Gererseul": "GererSeul",
  "gerer seul": "GererSeul",
  
  // Gesty
  "gesty": "Gesty",
  "GESTY": "Gesty",
  
  // HomeAssur
  "homeassur": "HomeAssur",
  "HOMEASSUR": "HomeAssur",
  "Homeassur": "HomeAssur",
  "home assur": "HomeAssur",
  
  // HomePilot
  "homepilot": "HomePilot",
  "HOMEPILOT": "HomePilot",
  "Homepilot": "HomePilot",
  "home pilot": "HomePilot",
  
  // ImoDirect
  "imodirect": "ImoDirect",
  "IMODIRECT": "ImoDirect",
  "Imodirect": "ImoDirect",
  "imo direct": "ImoDirect",
  
  // Myimmo
  "myimmo": "Myimmo",
  "MYIMMO": "Myimmo",
  "MyImmo": "Myimmo",
  "my immo": "Myimmo",
  
  // Oqoro
  "oqoro": "Oqoro",
  "OQORO": "Oqoro",
  
  // Particulier
  "particulier": "Particulier",
  "PARTICULIER": "Particulier",
  
  // Plusse
  "plusse": "Plusse",
  "PLUSSE": "Plusse",
  
  // Qantex
  "qantex": "Qantex",
  "QANTEX": "Qantex",
  
  // Remi
  "remi": "Remi",
  "REMI": "Remi",
  "Rémi": "Remi",
  
  // Site GMBS
  "site gmbs": "Site GMBS",
  "SITE GMBS": "Site GMBS",
  "Site Gmbs": "Site GMBS",
  "site GMBS": "Site GMBS",
  
  // ZeRent
  "zerent": "ZeRent",
  "ZERENT": "ZeRent",
  "Zerent": "ZeRent",
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
const METIER_NORMALIZATION_MAP = {
  // === BRICOLAGE ===
  "bricolage": "Bricolage",
  "BRICOLAGE": "Bricolage",
  
  // === CHAUFFAGE ===
  "chauffage": "Chauffage",
  "CHAUFFAGE": "Chauffage",
  
  // === CLIMATISATION ===
  "climatisation": "Climatisation",
  "CLIMATISATION": "Climatisation",
  
  // === ÉLECTRICITÉ ===
  "electricite": "Electricite",  // Sans accent (majoritaire dans les données)
  "Electricite": "Electricite",
  "Électricité": "Electricite",
  "électricité": "Electricite",
  "ELECTRICITE": "Electricite",
  "ÉLECTRICITÉ": "Electricite",
  "Électricite": "Electricite",
  
  // === ÉLECTROMÉNAGER ===
  "electromenager": "Electroménager",
  "Electroménager": "Electroménager",
  "Électroménager": "Electroménager",
  "électroménager": "Electroménager",
  "ELECTROMENAGER": "Electroménager",
  "ÉLECTROMÉNAGER": "Electroménager",
  
  // === ENTRETIEN GÉNÉRAL ===
  "entretien general": "Entretien général",
  "Entretien général": "Entretien général",
  "Entretien Général": "Entretien général",
  "ENTRETIEN GÉNÉRAL": "Entretien général",
  "ENTRETIEN GENERAL": "Entretien général",
  
  // === JARDINAGE ===
  "jardinage": "Jardinage",
  "JARDINAGE": "Jardinage",
  
  // === MÉNAGE ===
  "menage": "Menage",  // Sans accent (majoritaire dans les données)
  "Menage": "Menage",
  "Ménage": "Menage",
  "ménage": "Menage",
  "ménage ": "Menage",
  "Ménage ": "Menage",
  "MENAGE": "Menage",
  "MÉNAGE": "Menage",
  
  // === MENUISERIE ===
  "menuiserie": "Menuiserie",
  "MENUISERIE": "Menuiserie",
  
  // === NETTOYAGE ===
  "nettoyage": "Nettoyage",
  "NETTOYAGE": "Nettoyage",
  
  // === NUISIBLE ===
  "nuisible": "Nuisible",
  "NUISIBLE": "Nuisible",
  
  // === PEINTURE ===
  "peinture": "Peinture",
  "PEINTURE": "Peinture",
  
  // === PLOMBERIE ===
  "plomberie": "Plomberie",
  "PLOMBERIE": "Plomberie",
  
  // === RÉNOVATION ===
  "renovation": "Renovation",
  "Renovation": "Renovation",
  "Rénovation": "Renovation",
  "rénovation": "Renovation",
  "RENOVATION": "Renovation",
  "RÉNOVATION": "Renovation",
  
  // === SERRURERIE ===
  "serrurerie": "Serrurerie",
  "SERRURERIE": "Serrurerie",
  
  // === VITRERIE ===
  "vitrerie": "Vitrerie",
  "VITRERIE": "Vitrerie",
  
  // === VOLET/STORE ===
  "volet/store": "Volet/Store",
  "Volet/Store": "Volet/Store",
  "Volet/store": "Volet/Store",
  "VOLET/STORE": "Volet/Store",
  
  // === VALEURS ABERRANTES (ignorer) ===
  "2024-08-19 00:00:00": null,
  "2024-09-30 00:00:00": null,
  "": null,
};

module.exports = {
  STATUS_LABEL_TO_CODE,
  GESTIONNAIRE_CODE_MAP,
  AGENCE_NORMALIZATION_MAP,
  METIER_NORMALIZATION_MAP,
};
