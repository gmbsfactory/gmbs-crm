// ===== INTERVENTION IMPORT JOBS API =====
// Enveloppe asynchrone autour de `interventionsImportApi.runImport()`.
//
// Un "job" matérialise un import CSV dans la table `intervention_import_jobs` :
// il survit à la fermeture d'onglet, expose sa progression via Realtime, et
// garde une trace (historique). Le moteur métier reste `runImport()` (slice
// vertical — cf. docs/architecture/imports-async.md, ADR-5).
//
// Deux familles de clients Supabase coexistent ici :
//   - client SSR (RLS, scope utilisateur) pour create / get / list / cancel,
//     appelés depuis les routes côté requête authentifiée ;
//   - client admin (service-role, bypass RLS) pour claim / patchProgress /
//     finish, appelés depuis le worker server-to-server (sans cookie).

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ImportMode,
  ImportResolutionsMap,
  ImportResponse,
} from '@/utils/import-export/import-types';
import type { RunImportResult } from './interventions-import';

export type ImportJobStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

/** Miroir TypeScript d'une ligne de `intervention_import_jobs`. */
export interface ImportJobRow {
  id: string;
  created_by: string;
  mode: ImportMode;
  dry_run: boolean;
  resolutions: ImportResolutionsMap | null;
  status: ImportJobStatus;
  stage: string | null;
  total_rows: number | null;
  processed_rows: number;
  inserted_rows: number;
  updated_rows: number;
  failed_rows: number;
  preview: ImportResponse['preview'] | null;
  result: ImportResponse | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
}

const TABLE = 'intervention_import_jobs';
const DATA_TABLE = 'intervention_import_job_data';

// Colonnes de la table jobs (légère, publiée sur Realtime). Les données
// volumineuses (`csv_content`, `result`, `preview`) vivent dans la sidecar
// `intervention_import_job_data` et sont jointes à la demande (cf. `get`).
const JOB_COLUMNS =
  'id, created_by, mode, dry_run, resolutions, status, stage, total_rows, ' +
  'processed_rows, inserted_rows, updated_rows, failed_rows, ' +
  'error_message, created_at, started_at, finished_at, updated_at';

export const importJobsApi = {
  /**
   * Crée un job en statut `pending`. Le `csv_content` est persisté mais jamais
   * relu par le client. `created_by` DOIT être l'auth uid (RLS :
   * `created_by = auth.uid()`).
   */
  async create(
    supabase: SupabaseClient,
    input: {
      csvContent: string;
      mode: ImportMode;
      dryRun: boolean;
      resolutions?: ImportResolutionsMap;
      createdBy: string;
    },
  ): Promise<ImportJobRow> {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({
        created_by: input.createdBy,
        mode: input.mode,
        dry_run: input.dryRun,
        resolutions: input.resolutions ?? null,
      })
      .select(JOB_COLUMNS)
      .single();

    if (error) throw error;
    const job = data as unknown as ImportJobRow;

    // Données volumineuses dans la sidecar (non publiée sur Realtime).
    const { error: dataError } = await supabase
      .from(DATA_TABLE)
      .insert({ job_id: job.id, csv_content: input.csvContent });
    if (dataError) {
      // Le job parent existe déjà : on tente de le nettoyer pour ne pas laisser
      // un job orphelin sans contenu (le worker échouerait au chargement CSV).
      await supabase.from(TABLE).delete().eq('id', job.id);
      throw dataError;
    }
    return job;
  },

  /**
   * Lit l'état d'un job + ses données de sortie (`result`/`preview`, jointes
   * depuis la sidecar). Fallback de polling si Realtime indisponible.
   */
  async get(supabase: SupabaseClient, id: string): Promise<ImportJobRow | null> {
    const { data, error } = await supabase
      .from(TABLE)
      .select(JOB_COLUMNS)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    const job = data as unknown as ImportJobRow;

    const { data: extra, error: extraError } = await supabase
      .from(DATA_TABLE)
      .select('result, preview')
      .eq('job_id', id)
      .maybeSingle();
    if (extraError) throw extraError;

    job.result = (extra?.result as ImportJobRow['result']) ?? null;
    job.preview = (extra?.preview as ImportJobRow['preview']) ?? null;
    return job;
  },

  /**
   * Historique des imports de l'utilisateur courant (RLS), antéchronologique.
   * N'inclut PAS result/preview (inutiles pour la liste, potentiellement lourds).
   */
  async list(
    supabase: SupabaseClient,
    opts: { limit?: number } = {},
  ): Promise<ImportJobRow[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select(JOB_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(opts.limit ?? 20);

    if (error) throw error;
    return (data ?? []) as unknown as ImportJobRow[];
  },

  /**
   * Lit le contenu CSV brut d'un job depuis la sidecar. Réservé au worker
   * (client admin). Renvoie null si le job ou ses données n'existent pas.
   */
  async getForWorker(
    admin: SupabaseClient,
    id: string,
  ): Promise<(ImportJobRow & { csv_content: string }) | null> {
    const { data: job, error } = await admin
      .from(TABLE)
      .select(JOB_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!job) return null;

    const { data: extra, error: extraError } = await admin
      .from(DATA_TABLE)
      .select('csv_content')
      .eq('job_id', id)
      .maybeSingle();
    if (extraError) throw extraError;
    if (!extra) return null;

    return {
      ...(job as unknown as ImportJobRow),
      csv_content: (extra as { csv_content: string }).csv_content,
    };
  },

  /**
   * Transition atomique `pending → running`. Le `WHERE status = 'pending'`
   * rend l'opération idempotente : un second worker (double self-fetch, retry)
   * obtient zéro ligne et doit s'abstenir.
   *
   * Retourne la ligne claimée, ou null si déjà prise / inexistante.
   */
  async claim(admin: SupabaseClient, id: string): Promise<ImportJobRow | null> {
    const { data, error } = await admin
      .from(TABLE)
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'pending')
      .select(JOB_COLUMNS)
      .maybeSingle();

    if (error) throw error;
    return (data as unknown as ImportJobRow | null) ?? null;
  },

  /**
   * Met à jour la progression (appelé par le worker, throttlé en amont).
   * Renvoie le `status` courant pour que le worker détecte une demande
   * d'annulation (status passé à `cancelled` par l'utilisateur).
   */
  async patchProgress(
    admin: SupabaseClient,
    id: string,
    patch: {
      stage?: string;
      total_rows?: number;
      processed_rows?: number;
    },
  ): Promise<{ status: ImportJobStatus }> {
    const { data, error } = await admin
      .from(TABLE)
      .update(patch)
      .eq('id', id)
      .select('status')
      .single();

    if (error) throw error;
    return data as { status: ImportJobStatus };
  },

  /**
   * Clôt un job depuis son résultat `runImport`. Mappe les compteurs et stocke
   * `result` (et `preview` pour un dry-run) pour réaffichage côté client.
   */
  async finish(
    admin: SupabaseClient,
    id: string,
    result: RunImportResult,
  ): Promise<void> {
    const finishedAt = new Date().toISOString();
    const patch: Record<string, unknown> = { finished_at: finishedAt };

    if (result.ok) {
      const body = result.body;
      patch.status = 'succeeded';
      patch.stage = body.dry_run ? 'parsed' : 'persisting';
      patch.inserted_rows = body.inserted;
      patch.updated_rows = body.updated;
      patch.failed_rows = body.errors.length;
      patch.total_rows = body.total;
      patch.processed_rows = body.total;
      patch.error_message = null;
      // Données volumineuses (result complet + preview) → sidecar, jamais sur
      // la table publiée (limite de taille Realtime).
      const { error: dataError } = await admin
        .from(DATA_TABLE)
        .update({ result: body, preview: body.preview ?? null })
        .eq('job_id', id);
      if (dataError) throw dataError;
    } else {
      patch.status = 'failed';
      patch.error_message = result.error;
    }

    const { error } = await admin.from(TABLE).update(patch).eq('id', id);
    if (error) throw error;
  },

  /**
   * Marque un job échoué avec un message d'erreur fatal (exception inattendue
   * dans le worker). Worker uniquement (client admin).
   */
  async fail(admin: SupabaseClient, id: string, message: string): Promise<void> {
    const { error } = await admin
      .from(TABLE)
      .update({
        status: 'failed',
        error_message: message,
        finished_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw error;
  },

  /**
   * Marque un job `cancelled`. Réservé aux jobs encore actifs
   * (`pending`/`running`) — un job terminé ne peut pas être annulé.
   * Le worker observe ce changement à son prochain `patchProgress` et
   * interrompt le traitement (entre deux chunks).
   */
  async cancel(supabase: SupabaseClient, id: string): Promise<void> {
    const { error } = await supabase
      .from(TABLE)
      .update({ status: 'cancelled', finished_at: new Date().toISOString() })
      .eq('id', id)
      .in('status', ['pending', 'running']);
    if (error) throw error;
  },
};
