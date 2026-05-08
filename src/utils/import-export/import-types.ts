export type ImportMode = 'create' | 'update' | 'upsert'

export interface ImportReport {
  inserted: number
  updated: number
  skipped: number
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
}

/** Détails par bucket renvoyés en mode dry-run pour alimenter l'UI. */
export interface ImportPreview {
  toInsert: ImportPreviewRow[]
  toUpdate: ImportPreviewRow[]
  skipped: ImportPreviewRow[]
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
