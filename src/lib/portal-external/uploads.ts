import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Réception de fichiers envoyés par le portail (base64 dans un corps JSON)
 * et dépôt dans le bucket Storage « documents » du CRM.
 */

/** Bucket utilisé par le CRM pour toutes les pièces (interventions et artisans). */
export const DOCUMENTS_BUCKET = 'documents'

/** Taille maximale du champ base64 (4 Mo) — au-delà : 413. */
export const MAX_BASE64_LENGTH = 4 * 1024 * 1024

/** Types MIME acceptés pour les photos d'intervention. */
export const PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

/** Types MIME acceptés pour les pièces du dossier artisan : PDF ou image. */
export function isDocumentMimeAllowed(mimeType: string): boolean {
  return mimeType === 'application/pdf' || /^image\/[a-z0-9.+-]+$/i.test(mimeType)
}

export type DecodeResult =
  | { ok: true; buffer: Buffer }
  | { ok: false; status: 400 | 413; error: string }

/**
 * Décode un contenu base64 (avec ou sans préfixe `data:…;base64,`).
 * - 413 si la chaîne dépasse 4 Mo ;
 * - 400 si elle est vide ou invalide.
 */
export function decodeBase64Payload(base64Data: unknown): DecodeResult {
  if (typeof base64Data !== 'string' || base64Data.length === 0) {
    return { ok: false, status: 400, error: 'base64Data required' }
  }
  if (base64Data.length > MAX_BASE64_LENGTH) {
    return { ok: false, status: 413, error: 'Payload too large' }
  }
  const payload = base64Data.includes(',') ? base64Data.slice(base64Data.indexOf(',') + 1) : base64Data
  const cleaned = payload.replace(/\s+/g, '')
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(cleaned)) {
    return { ok: false, status: 400, error: 'Invalid base64Data' }
  }
  const buffer = Buffer.from(cleaned, 'base64')
  if (buffer.length === 0) {
    return { ok: false, status: 400, error: 'Invalid base64Data' }
  }
  return { ok: true, buffer }
}

/** Nom de fichier sûr pour un chemin Storage (ASCII, 120 caractères max). */
export function sanitizeFilename(filename: unknown, fallback = 'fichier'): string {
  const raw = typeof filename === 'string' ? filename.trim() : ''
  const base = raw.split(/[\\/]/).pop() ?? ''
  const safe = base.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '')
  return (safe || fallback).slice(0, 120)
}

/** SHA-256 hexadécimal d'un contenu binaire. */
export function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

export type UploadResult =
  | { ok: true; url: string; path: string }
  | { ok: false; error: string }

/**
 * Dépose un fichier dans le bucket « documents » puis renvoie son URL publique
 * (même mécanisme que `documentsApi.upload` côté CRM).
 */
export async function uploadToDocumentsBucket(
  supabase: SupabaseClient,
  path: string,
  buffer: Buffer,
  contentType: string,
): Promise<UploadResult> {
  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, buffer, { contentType, cacheControl: '31536000', upsert: false })

  if (error) {
    console.error('[portal-external] Dépôt Storage échoué :', error.message)
    return { ok: false, error: 'Upload failed' }
  }

  const { data } = supabase.storage.from(DOCUMENTS_BUCKET).getPublicUrl(path)
  return { ok: true, url: data.publicUrl, path }
}
