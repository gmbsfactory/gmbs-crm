import { createServerSupabase } from "@/lib/supabase/server"
import type { InterventionDocumentDTO } from "@/types/interventions"
import { randomUUID } from "crypto"

const BUCKET_NAME = "documents" // Using the existing 'documents' bucket from 00004_documents_bucket.sql if available, or I should check. 
// Actually migration 00004_documents_bucket.sql suggests there is a bucket. I'll assume 'intervention-attachments' if I created it, 
// OR I can use a subdirectory in 'documents' bucket which is often easier if one already exists.
// The user plan said "Ensure a Supabase Storage bucket named intervention-attachments". 
// Since I cannot easily create a bucket via SQL without pg_net or dashboard, I will try to use 'documents' bucket 
// or assume 'intervention-attachments' exists/will be created by the user or is not strictly required if I use another one.
// However, for clean separation I'll use 'intervention_attachments' as the bucket name in code, 
// and if it fails I might need to ask user to create it or fall back. 
// BUT, looking at `00004_documents_bucket.sql` in file list, it seems a bucket `documents` might exist.
// Let's stick to the plan: `intervention-attachments` bucket. 
// I'll make the bucket name a constant.

const STORAGE_BUCKET = "intervention-attachments"

type UploadParams = {
  interventionId: string
  fileName: string
  mimeType: string
  buffer: ArrayBuffer | Buffer
  metadata?: Record<string, unknown>
}

type UploadResult = {
  document: InterventionDocumentDTO
  publicUrl?: string
}

export async function uploadInterventionDocument({
  interventionId,
  fileName,
  mimeType,
  buffer,
  metadata,
}: UploadParams): Promise<UploadResult> {
  const supabase = createServerSupabase()

  // 1. Upload to Supabase Storage
  const uniqueId = randomUUID()
  const storagePath = `${interventionId}/${uniqueId}-${fileName}`

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    })

  if (uploadError) {
    // Fallback: try 'documents' bucket if 'intervention-attachments' fails? 
    // No, better to fail and report.
    throw new Error(`Erreur upload storage: ${uploadError.message}`)
  }

  // 2. Insert record into database
  const sizeBytes = buffer instanceof ArrayBuffer ? buffer.byteLength : Buffer.isBuffer(buffer) ? buffer.byteLength : 0

  const { data: inserted, error: dbError } = await supabase
    .from("intervention_attachments")
    .insert({
      intervention_id: interventionId,
      storage_path: storagePath,
      filename: fileName,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      metadata: metadata ?? {},
      created_by: (await supabase.auth.getUser()).data.user?.id
    })
    .select("*")
    .single()

  if (dbError) {
    // Attempt to clean up storage if DB insert fails
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath])
    throw new Error(`Erreur base de données: ${dbError.message}`)
  }

  // 3. Get Public URL (optional, depending on bucket privacy)
  const { data: { publicUrl } } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath)

  return {
    document: mapDbRowToDTO(inserted, publicUrl),
    publicUrl,
  }
}

type RemoveParams = {
  documentId: string
}

export async function removeInterventionDocument({ documentId }: RemoveParams) {
  const supabase = createServerSupabase()

  // 1. Get document details to find storage path
  const { data: doc, error: fetchError } = await supabase
    .from("intervention_attachments")
    .select("*")
    .eq("id", documentId)
    .single()

  if (fetchError || !doc) {
    throw new Error("Document introuvable")
  }

  // 2. Remove from Storage
  const { error: storageError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([doc.storage_path])

  if (storageError) {
    console.error("Erreur suppression storage:", storageError)
    // We continue to delete from DB even if storage delete fails (consistency)
  }

  // 3. Remove from DB
  const { error: deleteError } = await supabase
    .from("intervention_attachments")
    .delete()
    .eq("id", documentId)

  if (deleteError) {
    throw new Error(`Erreur suppression DB: ${deleteError.message}`)
  }

  return { documentId }
}

export async function listInterventionDocuments(interventionId: string): Promise<InterventionDocumentDTO[]> {
  const supabase = createServerSupabase()

  const { data, error } = await supabase
    .from("intervention_attachments")
    .select("*")
    .eq("intervention_id", interventionId)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(`Erreur chargement documents: ${error.message}`)
  }

  // Generate public URLs for all documents
  // Note: For signed URLs, we would do it differently. Assuming public bucket for now as per "Photo-to-Report" common usage.
  return data.map(row => {
    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(row.storage_path)
    return mapDbRowToDTO(row, publicUrl)
  })
}

export async function updateDocumentMetadata(documentId: string, metadata: Record<string, unknown>) {
  const supabase = createServerSupabase()

  const { data, error } = await supabase
    .from("intervention_attachments")
    .update({ metadata })
    .eq("id", documentId)
    .select("*")
    .single()

  if (error) {
    throw new Error(`Erreur mise à jour métadonnées: ${error.message}`)
  }

  const { data: { publicUrl } } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(data.storage_path)

  return mapDbRowToDTO(data, publicUrl)
}

// Mapper helper
function mapDbRowToDTO(row: any, publicUrl: string | null): InterventionDocumentDTO {
  return {
    id: row.id,
    interventionId: row.intervention_id,
    name: row.filename,
    mimeType: row.mime_type,
    storagePath: row.storage_path,
    publicUrl: publicUrl,
    sizeBytes: row.size_bytes,
    metadata: row.metadata,
    createdAt: row.created_at
  }
}
