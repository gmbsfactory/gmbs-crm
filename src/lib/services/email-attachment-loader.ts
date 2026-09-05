import type { SupabaseClient } from '@supabase/supabase-js'
import type { Attachment } from '@/lib/services/email-service'
import {
  MAX_EMAIL_ATTACHMENTS,
  MAX_EMAIL_ATTACHMENTS_TOTAL_BYTES,
  MAX_EMAIL_ATTACHMENTS_TOTAL_LABEL,
  formatFileSize,
  isEmailAttachableKind,
  labelForAttachmentKind,
} from '@/lib/interventions/email-attachments'
import {
  EMAIL_ATTACHMENT_DOWNLOAD_TIMEOUT_MS,
  MAX_EMAIL_ATTACHMENT_BYTES,
  emailAttachmentRefusalMessage,
  resolveEmailAttachmentSource,
} from '@/lib/services/email-attachment-source'

/**
 * Lecture des pièces jointes d'un e-mail artisan DEPUIS LE STOCKAGE (lot L7, spec §5.6).
 *
 * Avant ce lot, le navigateur encodait chaque fichier en base64 et le poussait dans le corps
 * de la requête : Vercel rejetait l'envoi au-delà de ~4,5 Mo de corps, soit ~3,2 Mo de
 * fichiers. Ici le client n'envoie plus que des identifiants de pièces de l'intervention ;
 * le serveur va chercher les octets dans le bucket `documents`. Un PDF de 8 Mo passe.
 *
 * Durcissement SSRF : les octets sont lus par le client Supabase à partir du bucket et du
 * chemin dérivés de l'URL, et jamais par un `fetch` de cette URL. Voir
 * `email-attachment-source.ts` pour la règle d'acceptation et les motifs de refus.
 */

/** Échec attribuable à la sélection du gestionnaire : le code HTTP est porté par l'erreur. */
export class EmailAttachmentError extends Error {
  readonly status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'EmailAttachmentError'
    this.status = status
  }
}

export interface LoadedEmailAttachment {
  id: string
  kind: string
  filename: string
  mimeType: string | null
  content: Buffer
}

interface AttachmentRow {
  id: string
  kind: string
  url: string
  filename: string | null
  mime_type: string | null
  file_size: number | null
}

/** Convertit une pièce chargée en pièce jointe nodemailer. */
export function toNodemailerAttachment(loaded: LoadedEmailAttachment): Attachment {
  return {
    filename: loaded.filename,
    content: loaded.content,
    contentType: loaded.mimeType ?? 'application/octet-stream',
  }
}

/** Borne le téléchargement dans le temps : une lecture qui traîne ne bloque pas l'envoi. */
async function withTimeout<T>(promise: PromiseLike<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new EmailAttachmentError(
                `Le fichier « ${label} » n'a pas pu être lu dans le délai imparti.`,
                504,
              ),
            ),
          EMAIL_ATTACHMENT_DOWNLOAD_TIMEOUT_MS,
        )
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * Télécharge une pièce PAR LE CLIENT SUPABASE, jamais par un `fetch` de son URL.
 *
 * L'URL stockée n'est plus une adresse à appeler : c'est une donnée à valider, dont on ne
 * garde que le bucket et le chemin (voir `email-attachment-source.ts`). Une adresse hors du
 * stockage du projet — service interne, IP littérale, hôte local, autre domaine — est refusée
 * et journalisée : c'est le correctif de la faille SSRF avec exfiltration par e-mail.
 */
async function downloadAttachment(
  supabase: SupabaseClient,
  row: AttachmentRow,
): Promise<Buffer> {
  const label = (row.filename ?? '').trim() || row.id
  const source = resolveEmailAttachmentSource(row.url)

  if (!source.ok) {
    console.warn(
      "[send-email] Pièce jointe refusée : adresse hors du stockage du CRM " +
        `(motif=${source.reason}, pièce=${row.id}, détail=${source.detail})`,
    )
    throw new EmailAttachmentError(emailAttachmentRefusalMessage(source.reason, label), 400)
  }

  const { data, error } = await withTimeout(
    supabase.storage.from(source.object.bucket).download(source.object.path),
    label,
  )
  if (error || !data) {
    throw new EmailAttachmentError(
      `Le fichier « ${label} » est introuvable dans le stockage.`,
      502,
    )
  }

  const content = Buffer.from(await data.arrayBuffer())
  if (content.length > MAX_EMAIL_ATTACHMENT_BYTES) {
    throw new EmailAttachmentError(
      `Le fichier « ${label} » est trop volumineux (${formatFileSize(content.length)}) : ` +
        `maximum ${MAX_EMAIL_ATTACHMENTS_TOTAL_LABEL} par pièce.`,
      413,
    )
  }
  return content
}

/**
 * Charge les pièces demandées, dans l'ordre où le gestionnaire les a cochées.
 *
 * Refuse : un identifiant qui n'appartient pas à l'intervention, une nature interdite
 * (`facturesGMBS`), plus de {@link MAX_EMAIL_ATTACHMENTS} pièces, ou un total au-delà du
 * plafond SMTP.
 */
export async function loadEmailAttachments(
  supabase: SupabaseClient,
  interventionId: string,
  attachmentIds: readonly string[],
): Promise<LoadedEmailAttachment[]> {
  const ids = Array.from(new Set(attachmentIds.map((id) => String(id ?? '').trim()).filter(Boolean)))
  if (ids.length === 0) return []

  if (ids.length > MAX_EMAIL_ATTACHMENTS) {
    throw new EmailAttachmentError(
      `Maximum ${MAX_EMAIL_ATTACHMENTS} pièces jointes par e-mail (${ids.length} demandées).`,
    )
  }

  const { data, error } = await supabase
    .from('intervention_attachments')
    .select('id, kind, url, filename, mime_type, file_size')
    .eq('intervention_id', interventionId)
    .in('id', ids)

  if (error) {
    throw new EmailAttachmentError(`Lecture des pièces impossible : ${error.message}`, 500)
  }

  const rows = (data ?? []) as AttachmentRow[]
  const byId = new Map(rows.map((row) => [row.id, row]))

  const missing = ids.filter((id) => !byId.has(id))
  if (missing.length > 0) {
    throw new EmailAttachmentError(
      `Pièce jointe introuvable sur cette intervention : ${missing.join(', ')}.`,
      404,
    )
  }

  const forbidden = rows.filter((row) => !isEmailAttachableKind(row.kind))
  if (forbidden.length > 0) {
    throw new EmailAttachmentError(
      `Ces pièces ne peuvent pas être envoyées à un artisan : ` +
        forbidden.map((row) => `${row.filename ?? row.id} (${labelForAttachmentKind(row.kind)})`).join(', ') +
        '.',
    )
  }

  const declaredSize = rows.reduce((sum, row) => sum + (row.file_size ?? 0), 0)
  if (declaredSize > MAX_EMAIL_ATTACHMENTS_TOTAL_BYTES) {
    throw new EmailAttachmentError(
      `Pièces jointes trop volumineuses (${formatFileSize(declaredSize)}) : ` +
        `maximum ${MAX_EMAIL_ATTACHMENTS_TOTAL_LABEL} au total.`,
      413,
    )
  }

  const loaded: LoadedEmailAttachment[] = []
  let totalBytes = 0

  // Séquentiel et non Promise.all : cinq téléchargements simultanés de 4 Mo tiennent en
  // mémoire d'une fonction serverless, mais rien ne garantit la taille réelle avant lecture
  // (file_size est déclaratif). On s'arrête dès le plafond franchi.
  for (const id of ids) {
    const row = byId.get(id)!
    const content = await downloadAttachment(supabase, row)
    totalBytes += content.length

    if (totalBytes > MAX_EMAIL_ATTACHMENTS_TOTAL_BYTES) {
      throw new EmailAttachmentError(
        `Pièces jointes trop volumineuses (${formatFileSize(totalBytes)}) : ` +
          `maximum ${MAX_EMAIL_ATTACHMENTS_TOTAL_LABEL} au total.`,
        413,
      )
    }

    loaded.push({
      id: row.id,
      kind: row.kind,
      filename: (row.filename ?? '').trim() || `piece-${row.id}`,
      mimeType: row.mime_type,
      content,
    })
  }

  return loaded
}

/**
 * Estampille les pièces réellement parties chez l'artisan (migration 99083).
 *
 * `sent_to_artisan_at` porte le PREMIER envoi et n'est jamais réécrite — d'où le filtre
 * `.is('sent_to_artisan_at', null)`. Sans lui, chaque relance rejouerait un UPDATE sur une
 * table publiée en `REPLICA IDENTITY FULL` (99077) : du WAL et un événement temps réel pour
 * rien. L'historique complet des envois vit dans `email_logs.attachment_ids`.
 *
 * Ne lève jamais : un e-mail parti reste parti, une marque manquée n'a pas à faire échouer la
 * réponse. L'échec éventuel est journalisé et renvoyé au format booléen.
 */
export async function markAttachmentsAsSentToArtisan(
  supabase: SupabaseClient,
  attachmentIds: readonly string[],
  emailLogId: string | null,
  sentAt: string = new Date().toISOString(),
): Promise<boolean> {
  const ids = Array.from(new Set(attachmentIds.filter(Boolean)))
  if (ids.length === 0) return true

  try {
    const { error } = await supabase
      .from('intervention_attachments')
      .update({
        sent_to_artisan_at: sentAt,
        sent_to_artisan_email_log_id: emailLogId,
      })
      .in('id', ids)
      .is('sent_to_artisan_at', null)

    if (error) {
      console.error('[send-email] Estampillage des pièces envoyées impossible :', error)
      return false
    }
    return true
  } catch (err) {
    console.error('[send-email] Estampillage des pièces envoyées impossible :', err)
    return false
  }
}
