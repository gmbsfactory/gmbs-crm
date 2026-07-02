/**
 * Bilan semaine 1 — constantes partagées (client + serveur).
 * Aucun secret ici : ce module est importable côté navigateur.
 *
 * La fenêtre de mesure est celle de la réunion bilan du vendredi 03/07/2026 :
 * lundi 29/06 00:00 Paris → vendredi 03/07 12:00 Paris (les chiffres se figent
 * d'eux-mêmes au plafond).
 */

export const WINDOW_START_ISO = "2026-06-28T22:00:00.000Z" // lundi 29/06 00:00 Paris
export const WINDOW_CAP_ISO = "2026-07-03T10:00:00.000Z" // vendredi 03/07 12:00 Paris
export const GIT_SINCE = "2026-06-28 21:00"

/** Jours affichés sur l'écran adoption (libellés produits par parisDayLabel). */
export const BILAN_DAYS = ["lun 29/06", "mar 30/06", "mer 01/07", "jeu 02/07", "ven 03/07"] as const

/** Compteurs figés issus de l'analyse WhatsApp (réconciliés avec git). */
export const BILAN_WHATSAPP = {
  signalements: 15,
  bugsReels: 8,
  bugsCorriges: 7, // dont n°15 partiel (collage adresse complète encore KO)
  medianeReponseMin: 10,
  medianeCorrection: "2 h 13",
} as const

/** Règles métier actives (source : src/config/workflow-rules.ts). */
export const BILAN_REGLES_METIER = {
  total: 65,
  statuts: 12,
  transitions: 24,
  validations: 17,
  champsRequis: 22,
  automatismes: 2,
} as const

export type BilanBugStatus = "resolu" | "encours" | "discuter" | "nonbug"

export type BilanBugItem = {
  n: number
  q: string
  who: string
  txt: string
  type: string
  rep: string
  st: BilanBugStatus
  stTxt: string
}

/** Les 15 signalements WhatsApp (extraction figée du 02/07). */
export const BILAN_BUGS: BilanBugItem[] = [
  { n: 1, q: "lun 01:05", who: "Gabriel", txt: "Profil « Tim D » affiché comme la lettre V après le transfert", type: "Données", rep: "8h17 (nuit)", st: "resolu", stTxt: "Corrigé au réveil" },
  { n: 2, q: "lun 10:59", who: "Andrea", txt: "Impossible de sortir un artisan des archives", type: "Évolution", rep: "9 min", st: "discuter", stTxt: "Contourné · à cadrer" },
  { n: 3, q: "lun 16:50", who: "Andrea", txt: "Édition non persistée : métier qui revient, proprio/locataire perdus", type: "Bug", rep: "1 min", st: "resolu", stTxt: "Corrigé en 2 h 13" },
  { n: 4, q: "lun 16:52", who: "Andrea", txt: "Délai d'affichage du nom de l'artisan sur le suivi", type: "Bug", rep: "—", st: "encours", stTxt: "À requalifier" },
  { n: 5, q: "mar 12:22", who: "Gabriel", txt: "Archivage artisan par clic droit cassé", type: "Bug", rep: "1 min", st: "resolu", stTxt: "Corrigé en 2 h 14" },
  { n: 6, q: "mar 12:27", who: "Andrea", txt: "Ordre de la liste générale « pas bon »", type: "Faux positif", rep: "—", st: "nonbug", stTxt: "Auto-résolu en 24 s" },
  { n: 7, q: "mar 12:36", who: "Andrea", txt: "Envoi WhatsApp impossible (artisan sans n° de téléphone)", type: "Données", rep: "2 min", st: "nonbug", stTxt: "Expliqué" },
  { n: 8, q: "mar 13:11", who: "Gabriel", txt: "L'intervention « saute » de la liste après un commentaire", type: "Bug", rep: "1 h 25", st: "resolu", stTxt: "Corrigé en 1 h 25" },
  { n: 9, q: "mar 15:23", who: "Antoine", txt: "Toute l'adresse atterrit dans le champ « ville »", type: "Bug", rep: "13 min", st: "resolu", stTxt: "Corrigé en 22 min · non annoncé" },
  { n: 10, q: "mar 15:36", who: "Andrea", txt: "Mail bloqué : pièces jointes > 3,2 Mo (limite Gmail)", type: "Limite", rep: "10 min", st: "discuter", stTxt: "Message clair ajouté · limite à discuter" },
  { n: 11, q: "mer 11:26", who: "Gabriel", txt: "Métier « Débarras » invisible côté artisans sans F5", type: "Bug", rep: "1 h 38", st: "resolu", stTxt: "Corrigé en 3 h 43" },
  { n: 12, q: "mer 11:30", who: "Andrea", txt: "Acompte non saisissable (statut « En cours »)", type: "Workflow", rep: "1 h 41", st: "discuter", stTxt: "Règle métier · sens à valider" },
  { n: 13, q: "mer 16:22", who: "Gabriel", txt: "Consigne artisan aplatie en un seul bloc", type: "Bug", rep: "27 min", st: "resolu", stTxt: "Corrigé en 28 min" },
  { n: 14, q: "mer 16:48", who: "Andrea", txt: "Facture .docx illisible → utiliser PDF / JPEG", type: "Format", rep: "4 min", st: "nonbug", stTxt: "Expliqué" },
  { n: 15, q: "mer 17:06", who: "Gabriel", txt: "Recherche : adresse « RESIDENCE DE L'ETOILE » introuvable", type: "Bug", rep: "—", st: "resolu", stTxt: "Corrigé en 9 h 52 (nuit) · validé en prod" },
]

/**
 * Instantané git de secours : en prod (Vercel), le binaire git et l'historique
 * ne sont pas disponibles au runtime — on affiche alors ce relevé daté.
 * Mis à jour à la main (dernier relevé : jeu 02/07 ~03h15).
 */
export const GIT_SNAPSHOT = {
  commits: 22,
  fixes: 17,
  feats: 4,
  files: 66,
  insertions: 3179,
  deletions: 584,
  lastCommit: {
    date: "02/07 02:58",
    subject: "fix(search): rend 99060 applicable en prod (DROP préalable) + résout le doublon de version 99055",
  },
} as const
