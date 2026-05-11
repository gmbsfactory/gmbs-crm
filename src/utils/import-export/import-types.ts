export type ImportMode = 'create' | 'update' | 'upsert'

/**
 * Raison pour laquelle une ligne ne peut pas être tranchée automatiquement
 * entre INSERT et UPDATE et nécessite une décision manuelle.
 *
 *   - 'id_inter_diverges_from_composite' : le CSV pointe vers un `id_inter`
 *      qui matche une ligne X en base, mais la clé composite (agence, date,
 *      adresse) matche une ligne Y différente. Deux interventions distinctes
 *      en base sont candidates — fusion ou divergence à arbitrer.
 *   - 'composite_ambiguous' : le CSV n'a pas d'`id_inter`, et la clé
 *      composite matche plusieurs interventions existantes.
 */
export type ImportConflictReason =
  | 'id_inter_diverges_from_composite'
  | 'composite_ambiguous'

export interface ImportReport {
  inserted: number
  updated: number
  skipped: number
  /**
   * Lignes en conflit nécessitant une résolution manuelle (Phase A : l'import
   * est refusé tant que ce compteur est > 0). Voir `ImportConflictReason`.
   */
  unresolved: number
  errors: Array<{ line: number; id_inter: string | null; reason: string; raw?: Record<string, string> }>
  /** Avertissements non bloquants (ex. artisan SST inconnu — la ligne est importée sans le lien). */
  warnings?: Array<{ line: number; id_inter: string | null; field: string; reason: string }>
}

/** Une ligne du CSV vue depuis la prévisualisation dry-run. */
export interface ImportPreviewRow {
  line: number
  id_inter: string | null
  raw: Record<string, string>
  /** Payload résolu (FKs mappées) tel qu'il sera envoyé en base. */
  payload: Record<string, unknown> | null
  /**
   * Version lisible du payload : les FKs (statut, métier, agence, gestionnaire,
   * locataire, propriétaire) sont remplacées par leurs labels / infos personnes.
   * Présent uniquement en mode dry-run, à côté du `payload` brut pour debug.
   */
  displayPayload?: Record<string, unknown> | null
  /** Pour les lignes "skipped" uniquement : raison du skip. */
  reason?: string
  /**
   * Pour les lignes "toUpdate" uniquement : version lisible des valeurs ACTUELLES
   * en base (avant écrasement). Même forme que `displayPayload`, permettant à l'UI
   * d'afficher une diff `ancien → nouveau` champ par champ.
   */
  previousDisplayPayload?: Record<string, unknown> | null
}

/** Un candidat (intervention existante en base) pour résoudre un conflit. */
export interface ImportConflictCandidate {
  id: string
  id_inter: string | null
  date: string | null
  adresse: string | null
  /** Indique l'origine du match : par `id_inter` du CSV, ou par clé composite. */
  source: 'id_inter' | 'composite'
  /**
   * Snapshot lisible des valeurs ACTUELLES en base pour ce candidat
   * (même forme que `ImportPreviewRow.previousDisplayPayload`). Permet à l'UI
   * de prévisualisation d'afficher une diff `ancien (ce candidat) → nouveau
   * (CSV)` lorsque l'utilisateur compare les options en conflit.
   */
  previousDisplayPayload?: Record<string, unknown> | null
}

/** Une ligne en conflit non résolu : surface les matches concurrents pour l'UI. */
export interface ImportConflictRow extends ImportPreviewRow {
  /** Code machine — pour des traitements futurs (Phase B : résolution interactive). */
  conflictReason: ImportConflictReason
  /** Identifiants des interventions candidates (1+ pour composite_ambiguous, 2 pour divergence). */
  matchIds: string[]
  /** Détails enrichis des candidats (id_inter, date, adresse) pour affichage UI. */
  candidates: ImportConflictCandidate[]
  /** `reason` (hérité) est utilisé pour le texte humain affiché dans l'UI. */
}

/**
 * Décision manuelle de l'utilisateur pour une ligne en conflit (Phase B).
 *
 *   - 'update' : cibler l'une des interventions candidates pour un UPDATE.
 *      `targetId` doit appartenir à `matchIds` du conflit (sinon 422).
 *      RÈGLE : refusé si le candidat porte déjà un `id_inter` non nul
 *      différent de celui du CSV (l'`id_inter` d'une intervention existante
 *      est immuable — voir `create_without_id_inter` pour le cas légitime).
 *   - 'create_without_id_inter' : forcer l'insertion d'une nouvelle ligne en
 *      retirant l'`id_inter` du CSV. Utilisé quand l'utilisateur reconnaît
 *      que la ligne CSV référence une intervention distincte de toutes les
 *      candidates, mais ne veut pas écraser leur identité. Le doublon créé
 *      reste à arbitrer hors import.
 *   - 'skip'   : l'utilisateur choisit explicitement de ne PAS importer cette
 *      ligne. Elle bascule dans `skipped` (et libère le verrou bloquant
 *      la confirmation d'import). Aucune écriture en base pour cette ligne.
 */
export type ImportResolution =
  | { action: 'update'; targetId: string }
  | { action: 'create_without_id_inter' }
  | { action: 'skip' }

/** Map line → résolution, indexée par numéro de ligne CSV. */
export type ImportResolutionsMap = Record<number, ImportResolution>

/** Détails par bucket renvoyés en mode dry-run pour alimenter l'UI. */
export interface ImportPreview {
  toInsert: ImportPreviewRow[]
  toUpdate: ImportPreviewRow[]
  skipped: ImportPreviewRow[]
  /** Lignes nécessitant une résolution manuelle — bloquent la confirmation tant que non vides. */
  toResolve: ImportConflictRow[]
  /** Vrai si l'un des buckets a été tronqué pour borner la taille de la réponse. */
  truncated: boolean
  /** Nombre maximum d'éléments retournés par bucket. */
  perBucketLimit: number
}

export interface ImportResponse extends ImportReport {
  dry_run: boolean
  total: number
  valid: number
  /** Présent uniquement quand dry_run=true. */
  preview?: ImportPreview
}
