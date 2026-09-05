/**
 * Pièces jointes de l'e-mail artisan — règles pures, partagées client et serveur.
 *
 * Lot L7 (spec §5.6). Les pièces jointes de l'e-mail ne sont plus des fichiers du disque du
 * gestionnaire encodés en base64 : ce sont des lignes d'`intervention_attachments`. Ce module
 * ne connaît ni React ni Supabase ni Node — la modale et la route d'envoi en dépendent toutes
 * les deux, et il doit rester importable depuis le bundle navigateur.
 */

/** Nombre maximum de pièces jointes sélectionnables pour un envoi (hors logo GMBS). */
export const MAX_EMAIL_ATTACHMENTS = 5

/**
 * Plafond de taille cumulée d'un envoi.
 *
 * Avant L7, le plafond réel était de ~3,2 Mo : les fichiers transitaient en base64 dans le
 * corps de la requête, et Vercel rejette (413) tout corps sérialisé au-delà de ~4,5 Mo. Les
 * fichiers étant désormais lus dans Storage côté serveur, la seule limite qui reste est celle
 * du transport SMTP. Gmail refuse au-delà de 25 Mo une fois le message encodé (+33 % en
 * base64 MIME) : 20 Mo de fichiers bruts laissent la marge nécessaire.
 */
export const MAX_EMAIL_ATTACHMENTS_TOTAL_BYTES = 20 * 1024 * 1024
export const MAX_EMAIL_ATTACHMENTS_TOTAL_LABEL = '20 Mo'

/**
 * Les factures GMBS ne partent jamais chez l'artisan.
 *
 * C'est la facture de GMBS à son client : elle ne regarde pas le sous-traitant, et l'API
 * portail l'exclut déjà explicitement de `documents` (spec §4.2, « jamais `facturesGMBS` »).
 * Si la modale pouvait la joindre, le mail et l'application diraient deux choses différentes —
 * exactement la divergence que ce lot supprime.
 */
export const EMAIL_ATTACHMENT_FORBIDDEN_KINDS: readonly string[] = ['facturesGMBS']

/** Libellés français des natures de pièce, pour le sélecteur et les messages d'erreur. */
export const EMAIL_ATTACHMENT_KIND_LABELS: Record<string, string> = {
  devis: 'Devis',
  photos: 'Photo',
  facturesArtisans: 'Facture artisan',
  facturesMateriel: 'Facture matériel',
  autre: 'Autre',
  a_classe: 'À classer',
}

/** Natures proposées quand le gestionnaire ajoute un fichier depuis son disque. */
export const EMAIL_ATTACHMENT_UPLOAD_KINDS: readonly string[] = [
  'devis',
  'photos',
  'facturesArtisans',
  'facturesMateriel',
  'autre',
]

/** Une pièce de l'intervention telle qu'affichée dans le sélecteur. */
export interface EmailAttachmentOption {
  id: string
  kind: string
  filename: string
  url: string
  mimeType: string | null
  fileSize: number | null
  createdAt: string | null
  /** Date du premier envoi à un artisan, `null` si jamais envoyée. */
  sentToArtisanAt: string | null
}

/** Ligne brute d'`intervention_attachments` telle que rendue par l'API documents. */
export interface RawInterventionAttachment {
  id: string
  kind: string
  url: string
  filename?: string | null
  mime_type?: string | null
  file_size?: number | null
  created_at?: string | null
  sent_to_artisan_at?: string | null
}

/** Une nature de pièce peut-elle être jointe à un e-mail artisan ? */
export function isEmailAttachableKind(kind: string | null | undefined): boolean {
  const value = String(kind ?? '').trim()
  if (!value) return false
  return !EMAIL_ATTACHMENT_FORBIDDEN_KINDS.includes(value)
}

/** Libellé d'affichage d'une nature de pièce. */
export function labelForAttachmentKind(kind: string): string {
  return EMAIL_ATTACHMENT_KIND_LABELS[kind] ?? kind
}

/** Nature par défaut d'un fichier ajouté depuis le disque, selon le type d'e-mail. */
export function defaultUploadKind(emailType: 'devis' | 'intervention'): string {
  return emailType === 'devis' ? 'devis' : 'autre'
}

/**
 * Convertit les lignes d'`intervention_attachments` en options du sélecteur :
 * on écarte les natures interdites, puis on trie les devis en tête (c'est la pièce que le
 * gestionnaire joint dans neuf cas sur dix), et à l'intérieur d'une nature, du plus récent au
 * plus ancien.
 */
export function toEmailAttachmentOptions(
  rows: readonly RawInterventionAttachment[],
): EmailAttachmentOption[] {
  return rows
    .filter((row) => row && row.id && isEmailAttachableKind(row.kind))
    .map((row) => ({
      id: row.id,
      kind: row.kind,
      filename: (row.filename ?? '').trim() || 'Sans nom',
      url: row.url,
      mimeType: row.mime_type ?? null,
      fileSize: typeof row.file_size === 'number' ? row.file_size : null,
      createdAt: row.created_at ?? null,
      sentToArtisanAt: row.sent_to_artisan_at ?? null,
    }))
    .sort((a, b) => {
      if (a.kind === 'devis' && b.kind !== 'devis') return -1
      if (b.kind === 'devis' && a.kind !== 'devis') return 1
      const dateA = a.createdAt ? Date.parse(a.createdAt) : 0
      const dateB = b.createdAt ? Date.parse(b.createdAt) : 0
      return dateB - dateA
    })
}

/** Taille cumulée des pièces sélectionnées (les tailles inconnues comptent pour zéro). */
export function totalAttachmentsSize(options: readonly EmailAttachmentOption[]): number {
  return options.reduce((sum, option) => sum + (option.fileSize ?? 0), 0)
}

/** Formatage humain d'une taille de fichier. */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return 'taille inconnue'
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}
