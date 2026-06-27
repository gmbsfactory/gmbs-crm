import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { ImportMode, ImportResponse } from '@/utils/import-export/import-types'

/**
 * Cycle de vie d'une OPÉRATION D'IMPORT (Phase 3 — cf. migrations 99053/99054).
 *
 * Un import est un ACTE HUMAIN unique, journalisé dans `data_operation_log` et
 * attribué à l'utilisateur. Les milliers d'écritures qu'il génère sont, elles,
 * neutralisées par les triggers : on exécute l'import sous un client
 * service_role portant les en-têtes `x-crm-operation-*`, et le contexte n'est
 * honoré que sous service_role + auth.uid() NULL (anti-forge prouvé en POC).
 *
 * ⚠️ SERVER-ONLY : la service_role key ne doit JAMAIS atteindre le navigateur.
 * Ce module n'est importé que par la route API `app/api/imports/...` (Node.js).
 */

export const IMPORT_OPERATION_TYPE = 'IMPORT_INTERVENTIONS' as const

export interface ImportActor {
  userId: string | null
  display: string | null
  code: string | null
  color: string | null
}

export type ImportOperationStatus = 'success' | 'failed' | 'cancelled'

/** Snapshot acteur cohérent avec l'audit (même source : `get_actor_snapshot`). */
export async function resolveImportActor(publicUserId: string): Promise<ImportActor> {
  if (!supabaseAdmin) return { userId: publicUserId, display: null, code: null, color: null }
  const { data, error } = await supabaseAdmin.rpc('get_actor_snapshot', { p_user_id: publicUserId })
  const row = !error && Array.isArray(data)
    ? (data[0] as { actor_user_id?: string; actor_display?: string; actor_code?: string; actor_color?: string } | undefined)
    : undefined
  return {
    userId: row?.actor_user_id ?? publicUserId,
    display: row?.actor_display ?? null,
    code: row?.actor_code ?? null,
    color: row?.actor_color ?? null,
  }
}

/** Crée la ligne `data_operation_log` en statut 'running'. Retourne son id. */
export async function createImportOperation(opts: {
  actor: ImportActor
  fileName: string | null
  mode: ImportMode
}): Promise<string> {
  if (!supabaseAdmin) throw new Error('[import-operation] supabaseAdmin indisponible')
  const { data, error } = await supabaseAdmin
    .from('data_operation_log')
    .insert({
      operation_type: IMPORT_OPERATION_TYPE,
      actor_user_id: opts.actor.userId,
      actor_display: opts.actor.display,
      actor_code: opts.actor.code,
      actor_color: opts.actor.color,
      status: 'running',
      file_name: opts.fileName,
      mode: opts.mode,
      dry_run: false,
    })
    .select('id')
    .single()
  if (error || !data?.id) {
    throw new Error(`[import-operation] création de l'opération échouée : ${error?.message ?? 'id manquant'}`)
  }
  return data.id as string
}

/**
 * Client service_role ÉPHÉMÈRE (un par opération) portant les en-têtes lus par
 * les triggers. JAMAIS de singleton partagé : chaque import a son operation_id.
 * Lit la config dans process.env à l'appel (testable, pas de capture au load).
 */
export function makeImportServiceClient(operationId: string): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('[import-operation] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant')
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: {
      headers: {
        'x-crm-operation-id': operationId,
        'x-crm-operation-type': IMPORT_OPERATION_TYPE,
      },
    },
  })
}

/** Clôt l'opération : statut + compteurs (mappés depuis le rapport d'import). */
export async function finalizeImportOperation(
  operationId: string,
  status: ImportOperationStatus,
  report?: ImportResponse,
  reason?: string,
): Promise<void> {
  if (!supabaseAdmin) return
  const patch: Record<string, unknown> = {
    status,
    completed_at: new Date().toISOString(),
    total_count: report?.total ?? null,
    inserted_count: report?.inserted ?? null,
    updated_count: report?.updated ?? null,
    skipped_count: report?.skipped ?? null,
    error_count: report?.errors?.length ?? null,
  }
  // Trace exploitable pour les opérations failed/cancelled (monitoring futur).
  if (reason) patch.metadata = { reason }
  const { error } = await supabaseAdmin
    .from('data_operation_log')
    .update(patch)
    .eq('id', operationId)
  if (error) console.error('[import-operation] finalisation échouée :', error.message)
}
