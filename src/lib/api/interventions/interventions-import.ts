// ===== INTERVENTIONS IMPORT API =====
// Méthodes spécifiques aux imports en masse (CSV).
//
// Distinctes du CRUD classique car :
// - elles acceptent un client Supabase explicite (contexte SSR / RLS),
// - le payload est plat et déjà résolu (IDs et non labels),
// - findIdsByIdInter gère le chunking URL pour éviter "URI too long".

import type { SupabaseClient } from '@supabase/supabase-js';
import { parseCSV } from '@/utils/import-export/parsers/csv-parser';
import { extractInterventionId } from '@/utils/import-export/parsers/address-parser';
import { EnumResolver, EntityFinder, type ArtisanInfo } from '@/utils/import-export/enum-resolver';
import {
  mapInterventionFromCSV,
  CSV_HEADERS_REQUIRED,
  type MappedIntervention,
  type InvalidRow,
} from '@/utils/import-export/intervention-mapper';
import type { TenantInfo, OwnerInfo } from '@/utils/import-export/parsers/person-parser';
import type {
  ImportMode,
  ImportResponse,
  ImportConflictReason,
  ImportConflictCandidate,
  ImportResolutionsMap,
} from '@/utils/import-export/import-types';
import { referentialsApi } from '@/lib/api/referentials';

/**
 * Payload d'insert/update pour un import. Tous les FKs sont déjà résolus
 * en IDs par le mapper / la résolution des personnes en amont.
 *
 * Couvre les colonnes directement persistées sur `interventions`, y compris
 * `tenant_id` et `owner_id` (locataire / propriétaire). Les coûts associés
 * (`FormattedCost[]` du mapper) ne sont pas encore persistés ici.
 */
export interface InterventionImportPayload {
  id_inter: string | null;
  agence_id: string | null;
  assigned_user_id: string | null;
  statut_id: string | null;
  metier_id: string | null;
  tenant_id: string | null;
  owner_id: string | null;
  date: string | null;
  date_prevue: string | null;
  contexte_intervention: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  is_active: boolean;
}

// Extrait un message lisible depuis une erreur Supabase / PostgrestError /
// Error standard / valeur quelconque. Sans ça, un PostgrestError (objet plat,
// pas instance d'Error) finit en "[object Object]".
function formatError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object') {
    const obj = e as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof obj.message === 'string') parts.push(obj.message);
    if (typeof obj.details === 'string') parts.push(obj.details);
    if (typeof obj.hint === 'string') parts.push(`hint: ${obj.hint}`);
    if (typeof obj.code === 'string') parts.push(`code: ${obj.code}`);
    if (parts.length > 0) return parts.join(' — ');
    try { return JSON.stringify(obj); } catch { return String(e); }
  }
  return String(e);
}

// PostgREST sérialise `.in()` dans la query string. Quelques milliers d'IDs
// dépassent la limite de longueur d'URL — on découpe par paquets.
const ID_INTER_LOOKUP_CHUNK = 200;

// Taille des lots pour les écritures (insert / upsert). 500 lignes par
// requête garde le payload raisonnable (~200 Ko) tout en transformant des
// milliers d'allers-retours en quelques requêtes.
const PERSIST_CHUNK = 500;

export const interventionsImportApi = {
  /**
   * Recherche les interventions existantes par `id_inter`.
   * Retourne une Map id_inter → id (UUID interne).
   * Les id_inter absents de la DB sont simplement omis de la Map.
   */
  async findIdsByIdInter(
    supabase: SupabaseClient,
    idInters: string[],
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (idInters.length === 0) return result;

    for (let i = 0; i < idInters.length; i += ID_INTER_LOOKUP_CHUNK) {
      const slice = idInters.slice(i, i + ID_INTER_LOOKUP_CHUNK);
      const { data, error } = await supabase
        .from('interventions')
        .select('id, id_inter')
        .in('id_inter', slice);

      if (error) throw error;

      for (const row of (data ?? []) as Array<{ id: string; id_inter: string }>) {
        result.set(row.id_inter, row.id);
      }
    }

    return result;
  },

  /**
   * Résout les correspondances par clé composite (agence?, date, adresse).
   * Appelle le RPC `csv_intervention_import_resolve_by_composite` qui renvoie,
   * par ligne, la liste des interventions matchant la clé (peut être vide,
   * unique ou multiple — l'orchestrateur arbitre).
   *
   * Les entrées avec `date` ou `adresse` nulles sont filtrées en amont (rien
   * à matcher).
   */
  async resolveByComposite(
    supabase: SupabaseClient,
    rows: Array<{ line: number; agence_id: string | null; date: string; adresse: string }>,
  ): Promise<Map<number, string[]>> {
    const result = new Map<number, string[]>();
    if (rows.length === 0) return result;

    // Convertit `date` (ISO timestamptz) → YYYY-MM-DD (jour UTC) : aligné
    // avec l'expression `(date at time zone 'UTC')::date` côté index.
    const toUtcDay = (iso: string): string => iso.slice(0, 10);

    const { data, error } = await supabase.rpc(
      'csv_intervention_import_resolve_by_composite',
      {
        p_lines: rows.map((r) => r.line),
        p_agence_ids: rows.map((r) => r.agence_id),
        p_dates: rows.map((r) => toUtcDay(r.date)),
        p_addresses: rows.map((r) => r.adresse),
      },
    );
    if (error) throw error;

    for (const row of (data ?? []) as Array<{ line: number; match_ids: string[] }>) {
      if (Array.isArray(row.match_ids) && row.match_ids.length > 0) {
        result.set(row.line, row.match_ids);
      }
    }
    return result;
  },

  /**
   * Insère une intervention depuis un import CSV. Retourne l'ID créé.
   */
  async createFromImport(
    supabase: SupabaseClient,
    payload: InterventionImportPayload,
  ): Promise<{ id: string }> {
    const { data, error } = await supabase
      .from('interventions')
      .insert(payload)
      .select('id')
      .single();

    if (error) throw error;
    return { id: (data as { id: string }).id };
  },

  /**
   * Met à jour une intervention existante depuis un import CSV.
   */
  async updateFromImport(
    supabase: SupabaseClient,
    id: string,
    payload: Partial<InterventionImportPayload>,
  ): Promise<void> {
    const { error } = await supabase
      .from('interventions')
      .update(payload)
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Insertion en lot. Une seule requête PostgREST pour N lignes.
   * En cas d'échec, l'appelant est responsable de retomber en per-row
   * pour attribuer l'erreur à la ligne fautive.
   */
  async bulkInsert(
    supabase: SupabaseClient,
    payloads: InterventionImportPayload[],
  ): Promise<string[]> {
    if (payloads.length === 0) return [];
    const { data, error } = await supabase.from('interventions').insert(payloads).select('id');
    if (error) throw error;
    return ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
  },

  /**
   * Mise à jour en lot via upsert avec conflit sur la clé primaire `id`.
   * Permet d'envoyer plusieurs UPDATEs hétérogènes en une seule requête.
   */
  async bulkUpdateByIds(
    supabase: SupabaseClient,
    payloads: Array<InterventionImportPayload & { id: string }>,
  ): Promise<void> {
    if (payloads.length === 0) return;
    const { error } = await supabase
      .from('interventions')
      .upsert(payloads, { onConflict: 'id' });
    if (error) throw error;
  },

  /**
   * Orchestre un import CSV complet : parsing → validation des entêtes →
   * dédup en mémoire → mapping → (dry-run | persist).
   * Renvoie un résultat structuré indépendant de la couche HTTP.
   */
  async runImport(
    supabase: SupabaseClient,
    input: {
      content: string;
      mode: ImportMode;
      dryRun: boolean;
      /**
       * Phase B : décisions manuelles utilisateur pour des lignes qui sinon
       * seraient en conflit. Map `line` → { action: 'update', targetId }.
       * Le `targetId` DOIT correspondre à l'un des candidats matchés pour
       * cette ligne ; sinon la requête est rejetée (422).
       */
      resolutions?: ImportResolutionsMap;
      onProgress?: (event: ImportProgressEvent) => void;
      signal?: AbortSignal;
    },
  ): Promise<RunImportResult> {
    const { content, mode, dryRun, resolutions, onProgress, signal } = input;
    const emit = (e: ImportProgressEvent) => onProgress?.(e);
    const checkAbort = () => {
      if (signal?.aborted) throw new ImportAbortedError();
    };

    emit({ stage: 'parsing' });
    let rows = parseCSV(content);
    if (rows.length === 0) {
      return { ok: false, status: 422, error: 'CSV vide ou non parsable' };
    }
    emit({ stage: 'parsed', rowCount: rows.length });

    const headers = Object.keys(rows[0]);
    const missing = CSV_HEADERS_REQUIRED.filter((col) => !headers.some((h) => h.trim() === col));
    if (missing.length > 0) {
      return {
        ok: false,
        status: 422,
        error: `Colonnes requises manquantes : ${missing.join(', ')}`,
      };
    }

    // Same extraction rule as scripts/data-processing: only values starting
    // with digits are real intervention IDs. In-file duplicates are silently
    // deduped — the last occurrence wins.
    const lastIndexById = new Map<string, number>();
    for (let i = 0; i < rows.length; i++) {
      const id = extractInterventionId(rows[i]['ID']);
      if (id) lastIndexById.set(id, i);
    }
    rows = rows.filter((r, i) => {
      const id = extractInterventionId(r['ID']);
      return !id || lastIndexById.get(id) === i;
    });

    const refs = await referentialsApi.loadForImport(supabase);
    const resolver = new EnumResolver(refs);
    const finder = new EntityFinder(refs);

    type Mapped = { line: number; id_inter: string | null; mapped: MappedIntervention; raw: Record<string, string> };
    const mappedRows: Mapped[] = [];
    const errors: ImportResponse['errors'] = [];

    emit({ stage: 'validating', done: 0, total: rows.length });
    for (let i = 0; i < rows.length; i++) {
      checkAbort();
      const line = i + 2;
      const result = await mapInterventionFromCSV(rows[i], resolver, finder);
      if ((result as InvalidRow)._invalid) {
        const inv = result as InvalidRow;
        errors.push({ line, id_inter: inv.id_inter, reason: inv.reason, raw: rows[i] });
      } else {
        const m = result as MappedIntervention;
        mappedRows.push({ line, id_inter: m.id_inter, mapped: m, raw: rows[i] });
      }
      // Émet une progression toutes les 100 lignes (et à la fin).
      if ((i + 1) % 100 === 0 || i === rows.length - 1) {
        emit({ stage: 'validating', done: i + 1, total: rows.length });
      }
    }

    const total = rows.length;
    const valid = mappedRows.length;

    emit({ stage: 'lookup', total: mappedRows.length });
    const idInters = mappedRows.map((m) => m.id_inter).filter((x): x is string => !!x);
    let existingMap: Map<string, string>;
    let compositeMap: Map<number, string[]>;
    try {
      // Lookups parallèles : id_inter et composite. Le composite ne concerne
      // que les lignes ayant `date` ET `adresse` (sinon, rien à matcher).
      const compositeInputs = mappedRows
        .filter((m): m is typeof m & { mapped: MappedIntervention & { date: string; adresse: string } } =>
          !!m.mapped.date && !!m.mapped.adresse)
        .map((m) => ({
          line: m.line,
          agence_id: m.mapped.agence_id,
          date: m.mapped.date,
          adresse: m.mapped.adresse,
        }));

      [existingMap, compositeMap] = await Promise.all([
        this.findIdsByIdInter(supabase, idInters),
        this.resolveByComposite(supabase, compositeInputs),
      ]);
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      return { ok: false, status: 500, error: reason };
    }

    // Résolution des locataires / propriétaires : dédup par téléphone|email|nom,
    // lookup en base puis bulk insert pour les manquants. En mode dry-run,
    // on fait quand même le lookup (lecture seule) pour pouvoir distinguer
    // dans la prévisualisation les personnes existantes de celles qui seraient
    // créées, mais on saute le bulk insert.
    let tenantByLine = new Map<number, PersonResolution>();
    let ownerByLine = new Map<number, PersonResolution>();
    try {
      tenantByLine = await resolveTenants(supabase, mappedRows, dryRun);
      ownerByLine = await resolveOwners(supabase, mappedRows, dryRun);
    } catch (e) {
      const reason = formatError(e);
      return { ok: false, status: 500, error: `Résolution locataires/propriétaires : ${reason}` };
    }
    const resolutionId = (r: PersonResolution | undefined): string | null =>
      r && r.kind !== 'none' ? r.id : null;

    // Partition: créations (sans match) vs mises à jour (match unique)
    // vs conflits (matches concurrents → résolution manuelle requise).
    // Le mode dicte ce qui est ignoré silencieusement.
    //
    // Arbre de décision par ligne (id_inter optionnel, composite en fallback) :
    //   A. id_inter match + composite match :
    //        - même ligne en base       → UPDATE
    //        - lignes différentes       → CONFLIT (id_inter_diverges_from_composite)
    //   B. id_inter match seul          → UPDATE
    //   C. composite match unique       → UPDATE (set id_inter du CSV si présent)
    //   D. composite matches multiples  → CONFLIT (composite_ambiguous)
    //   E. aucun match                  → INSERT
    type Job = {
      line: number;
      id_inter: string | null;
      raw: Record<string, string>;
      payload: InterventionImportPayload;
      mapped: MappedIntervention;
      existsId?: string;
    };
    const toInsert: Job[] = [];
    const toUpdate: Array<Job & { existsId: string }> = [];
    type SkippedJob = Job & { reason: string };
    const skippedJobs: SkippedJob[] = [];
    type ConflictJob = Job & {
      conflictReason: ImportConflictReason;
      matchIds: string[];
      /** Origine de chaque matchId, dans le même ordre. */
      matchSources: Array<'id_inter' | 'composite'>;
    };
    const conflictJobs: ConflictJob[] = [];
    // Validation des résolutions reçues : on collecte les conflits réels par
    // ligne, puis on vérifie après-coup que chaque targetId est bien dans
    // matchIds. Une résolution qui pointe vers un id étranger est un signe de
    // CSV/état UI désynchronisé — on refuse plutôt que d'écrire silencieusement.
    const resolutionErrors: Array<{ line: number; reason: string }> = [];

    // Prefetch des id_inter des candidats référencés par des résolutions
    // 'update'. Utilisé pour rejeter les résolutions qui écraseraient un
    // id_inter non nul (règle d'immutabilité). On reste lazy : si aucune
    // résolution n'est fournie, aucun aller-retour réseau.
    const updateTargetIds = Array.from(
      new Set(
        Object.values(resolutions ?? {})
          .filter((r): r is { action: 'update'; targetId: string } => r.action === 'update')
          .map((r) => r.targetId),
      ),
    );
    const targetIdInterByUuid = new Map<string, string | null>();
    if (updateTargetIds.length > 0) {
      const FETCH_CHUNK = 100;
      for (let i = 0; i < updateTargetIds.length; i += FETCH_CHUNK) {
        const slice = updateTargetIds.slice(i, i + FETCH_CHUNK);
        const { data, error } = await supabase
          .from('interventions')
          .select('id, id_inter')
          .in('id', slice);
        if (error) {
          return { ok: false, status: 500, error: formatError(error) };
        }
        for (const row of (data ?? []) as Array<{ id: string; id_inter: string | null }>) {
          targetIdInterByUuid.set(row.id, row.id_inter);
        }
      }
    }

    for (const { line, id_inter, mapped, raw } of mappedRows) {
      const idMatch = id_inter ? existingMap.get(id_inter) : undefined;
      const compositeMatches = compositeMap.get(line) ?? [];
      const payload = buildInterventionPayload(
        mapped,
        resolutionId(tenantByLine.get(line)),
        resolutionId(ownerByLine.get(line)),
      );
      const job: Job = { line, id_inter, raw, payload, mapped };

      // Résolution : déduire l'existsId effectif OU détecter un conflit.
      let existsId: string | undefined;
      let conflict:
        | { reason: ImportConflictReason; matchIds: string[]; matchSources: Array<'id_inter' | 'composite'> }
        | undefined;

      if (idMatch && compositeMatches.length > 0) {
        if (compositeMatches.includes(idMatch)) {
          // Cas A.1 : id_inter et composite convergent (même ligne).
          existsId = idMatch;
        } else {
          // Cas A.2 : divergence — fusion ou non à arbitrer manuellement.
          conflict = {
            reason: 'id_inter_diverges_from_composite',
            matchIds: [idMatch, ...compositeMatches],
            matchSources: ['id_inter', ...compositeMatches.map(() => 'composite' as const)],
          };
        }
      } else if (idMatch) {
        // Cas B
        existsId = idMatch;
      } else if (compositeMatches.length === 1) {
        // Cas C
        existsId = compositeMatches[0];
      } else if (compositeMatches.length > 1) {
        // Cas D
        conflict = {
          reason: 'composite_ambiguous',
          matchIds: compositeMatches,
          matchSources: compositeMatches.map(() => 'composite' as const),
        };
      }
      // Cas E : existsId et conflict tous deux undefined → insertion.

      if (conflict) {
        // Phase B : si l'utilisateur a fourni une résolution pour cette ligne,
        // on l'applique. 'update' valide que targetId est bien dans matchIds
        // ET que la cible ne sera pas écrasée sur son id_inter ;
        // 'create_without_id_inter' force une insertion sans id_inter ;
        // 'skip' bascule la ligne dans skippedJobs sans écriture.
        const userResolution = resolutions?.[line];
        if (userResolution?.action === 'skip') {
          skippedJobs.push({ ...job, reason: 'Ignoré manuellement (conflit non tranché)' });
          continue;
        } else if (userResolution?.action === 'create_without_id_inter') {
          // Insertion forcée avec id_inter retiré : l'utilisateur reconnaît la
          // ligne CSV comme distincte des candidates en base, sans écraser
          // leur identité. Le doublon créé sera arbitré hors import.
          job.payload.id_inter = null;
          job.id_inter = null;
          toInsert.push(job);
          continue;
        } else if (userResolution?.action === 'update') {
          if (!conflict.matchIds.includes(userResolution.targetId)) {
            resolutionErrors.push({
              line,
              reason:
                `Résolution invalide : la cible ${userResolution.targetId} ne fait pas partie ` +
                `des candidats (${conflict.matchIds.join(', ')}).`,
            });
            continue;
          }
          // Règle d'immutabilité de l'id_inter : on refuse l'update si la
          // cible porte déjà un id_inter non nul différent de celui du CSV.
          // L'utilisateur doit choisir `create_without_id_inter` ou `skip`.
          const targetIdInter = targetIdInterByUuid.get(userResolution.targetId) ?? null;
          if (targetIdInter && job.id_inter && targetIdInter !== job.id_inter) {
            resolutionErrors.push({
              line,
              reason:
                `Résolution invalide : la cible ${userResolution.targetId} porte déjà ` +
                `id_inter "${targetIdInter}" — refus d'écrasement par "${job.id_inter}" ` +
                `(utilisez "create_without_id_inter" ou "skip").`,
            });
            continue;
          }
          existsId = userResolution.targetId;
          // Tombe dans la classification normale plus bas (toUpdate).
        } else {
          conflictJobs.push({
            ...job,
            conflictReason: conflict.reason,
            matchIds: conflict.matchIds,
            matchSources: conflict.matchSources,
          });
          continue;
        }
      }

      if (mode === 'create') {
        if (existsId) {
          skippedJobs.push({ ...job, reason: 'Match existant en base (mode "create")', existsId });
          continue;
        }
        toInsert.push(job);
      } else if (mode === 'update') {
        if (!existsId) {
          skippedJobs.push({ ...job, reason: 'Aucun match en base (mode "update")' });
          continue;
        }
        toUpdate.push({ ...job, existsId });
      } else {
        if (existsId) toUpdate.push({ ...job, existsId });
        else toInsert.push(job);
      }
    }
    const skipped = skippedJobs.length;
    const unresolved = conflictJobs.length;

    // Préservation de `id_inter` à l'UPDATE : si le CSV ne porte pas d'ID
    // pour une ligne qui matche une intervention existante (clé composite,
    // ou résolution de conflit), on ne doit pas écraser l'ID en base avec
    // null. On récupère l'ID existant et on le réinjecte dans le payload.
    // Règle métier : "une intervention qui a un id prédomine sur une qui n'en
    // a pas" — l'absence dans le CSV signifie "pas d'info", jamais "effacer".
    const updateJobsMissingIdInter = toUpdate.filter((j) => j.payload.id_inter === null);
    if (updateJobsMissingIdInter.length > 0) {
      const missingIds = Array.from(new Set(updateJobsMissingIdInter.map((j) => j.existsId)));
      const FETCH_CHUNK = 100;
      const existingIdInterById = new Map<string, string | null>();
      for (let i = 0; i < missingIds.length; i += FETCH_CHUNK) {
        const slice = missingIds.slice(i, i + FETCH_CHUNK);
        const { data, error } = await supabase
          .from('interventions')
          .select('id, id_inter')
          .in('id', slice);
        if (error) {
          return { ok: false, status: 500, error: formatError(error) };
        }
        for (const row of (data ?? []) as Array<{ id: string; id_inter: string | null }>) {
          existingIdInterById.set(row.id, row.id_inter);
        }
      }
      for (const job of updateJobsMissingIdInter) {
        const existing = existingIdInterById.get(job.existsId) ?? null;
        if (existing !== null) {
          job.payload.id_inter = existing;
        }
      }
    }

    // Rejet précoce des résolutions incohérentes (ids étrangers aux candidats).
    if (resolutionErrors.length > 0) {
      return {
        ok: false,
        status: 422,
        error:
          `Résolutions invalides — ${resolutionErrors.length} ligne(s) : ` +
          resolutionErrors.map((r) => `L${r.line} ${r.reason}`).join(' | '),
      };
    }

    if (dryRun) {
      // Per-bucket cap to keep the dry-run response a reasonable size even
      // for large imports. The UI can still show the counts in full.
      const PREVIEW_LIMIT = 10000;

      // Pour le bucket "toUpdate", on charge les valeurs ACTUELLES en base
      // afin que l'UI puisse afficher une diff ancien → nouveau. Limité au
      // PREVIEW_LIMIT pour ne pas exploser la latence sur des très gros imports.
      const updateJobsForPreview = toUpdate.slice(0, PREVIEW_LIMIT);

      // Pour le bucket "toResolve" (Phase B), on charge les détails (id_inter,
      // date, adresse) de tous les candidats afin que l'UI puisse afficher
      // chaque option de manière intelligible avant que l'utilisateur tranche.
      const conflictJobsForPreview = conflictJobs.slice(0, PREVIEW_LIMIT);
      const allCandidateIds = Array.from(
        new Set(conflictJobsForPreview.flatMap((j) => j.matchIds)),
      );
      const candidatesById = allCandidateIds.length > 0
        ? await fetchConflictCandidates(supabase, allCandidateIds)
        : new Map<string, { id_inter: string | null; date: string | null; adresse: string | null }>();

      // Snapshot lisible (FKs résolues en labels, personnes en objets) pour
      // toutes les interventions concernées par un diff : celles à mettre à
      // jour ET celles candidates à un conflit. Une seule passe groupée pour
      // limiter les allers-retours réseau.
      const previousIdsToLoad = Array.from(new Set<string>([
        ...updateJobsForPreview.map((j) => j.existsId),
        ...allCandidateIds,
      ]));
      const previousById = previousIdsToLoad.length > 0
        ? await fetchPreviousDisplayPayloads(supabase, previousIdsToLoad, resolver)
        : new Map<string, Record<string, unknown>>();

      const toRow = (j: Job) => ({
        line: j.line,
        id_inter: j.id_inter,
        raw: j.raw,
        payload: j.payload as unknown as Record<string, unknown>,
        displayPayload: buildDisplayPayload(
          j.mapped,
          j.raw,
          j.payload,
          resolver,
          finder,
          tenantByLine.get(j.line),
          ownerByLine.get(j.line),
        ),
      });
      const preview = {
        toInsert: toInsert.slice(0, PREVIEW_LIMIT).map(toRow),
        toUpdate: updateJobsForPreview.map((j) => ({
          ...toRow(j),
          previousDisplayPayload: previousById.get(j.existsId) ?? null,
        })),
        skipped: skippedJobs.slice(0, PREVIEW_LIMIT).map((j) => ({
          ...toRow(j),
          reason: j.reason,
        })),
        toResolve: conflictJobsForPreview.map((j) => ({
          ...toRow(j),
          conflictReason: j.conflictReason,
          matchIds: j.matchIds,
          candidates: j.matchIds.map((id, idx): ImportConflictCandidate => {
            const info = candidatesById.get(id);
            return {
              id,
              id_inter: info?.id_inter ?? null,
              date: info?.date ?? null,
              adresse: info?.adresse ?? null,
              source: j.matchSources[idx] ?? 'composite',
              previousDisplayPayload: previousById.get(id) ?? null,
            };
          }),
          reason:
            j.conflictReason === 'id_inter_diverges_from_composite'
              ? `Conflit : l'ID CSV pointe vers une intervention, mais la clé (agence, date, adresse) en désigne une autre — ${j.matchIds.length} candidates`
              : `Conflit : ${j.matchIds.length} interventions existantes correspondent à (agence, date, adresse)`,
        })),
        truncated:
          toInsert.length > PREVIEW_LIMIT ||
          toUpdate.length > PREVIEW_LIMIT ||
          skippedJobs.length > PREVIEW_LIMIT ||
          conflictJobs.length > PREVIEW_LIMIT,
        perBucketLimit: PREVIEW_LIMIT,
      };
      return {
        ok: true,
        body: {
          dry_run: true,
          total,
          valid,
          inserted: toInsert.length,
          updated: toUpdate.length,
          skipped,
          unresolved,
          errors,
          preview,
        },
      };
    }

    // Phase B : refus dur si conflits non résolus. Les lignes pour lesquelles
    // l'utilisateur a fourni une résolution valide ont déjà été retirées de
    // conflictJobs ci-dessus ; ce qui reste est ce qu'il faut encore arbitrer.
    if (unresolved > 0) {
      return {
        ok: false,
        status: 409,
        error:
          `${unresolved} ligne${unresolved > 1 ? 's' : ''} en conflit non résolu — ` +
          `lancez une simulation, choisissez un candidat pour chaque conflit puis relancez.`,
      };
    }

    let inserted = 0;
    let updated = 0;
    const persistTotal = toInsert.length + toUpdate.length;
    let persistDone = 0;
    emit({ stage: 'persisting', done: 0, total: persistTotal });

    // On garde la trace du `intervention_id` final pour chaque ligne
    // persistée, afin de pouvoir écrire les liens artisans après coup.
    const mappedByLine = new Map<number, MappedIntervention>();
    for (const m of mappedRows) mappedByLine.set(m.line, m.mapped);
    const persistedInterventionIds: Array<{ line: number; interventionId: string }> = [];

    // Écritures en lot, avec fallback per-row sur les chunks fautifs pour
    // garder une attribution précise des erreurs ligne-par-ligne.
    for (let i = 0; i < toInsert.length; i += PERSIST_CHUNK) {
      checkAbort();
      const chunk = toInsert.slice(i, i + PERSIST_CHUNK);
      try {
        const ids = await this.bulkInsert(supabase, chunk.map((j) => j.payload));
        inserted += chunk.length;
        // PostgREST renvoie les rows insérées dans l'ordre d'envoi.
        for (let k = 0; k < ids.length; k++) {
          persistedInterventionIds.push({ line: chunk[k].line, interventionId: ids[k] });
        }
      } catch (bulkErr) {
        console.error('[import] bulkInsert failed, falling back per-row:', formatError(bulkErr), bulkErr);
        for (const job of chunk) {
          try {
            const { id } = await this.createFromImport(supabase, job.payload);
            inserted++;
            persistedInterventionIds.push({ line: job.line, interventionId: id });
          } catch (e) {
            const reason = formatError(e);
            console.error(`[import] insert ligne ${job.line} (id_inter=${job.id_inter}) :`, reason, e, 'payload:', job.payload);
            errors.push({ line: job.line, id_inter: job.id_inter, reason });
          }
        }
      }
      persistDone += chunk.length;
      emit({ stage: 'persisting', done: persistDone, total: persistTotal });
    }

    for (let i = 0; i < toUpdate.length; i += PERSIST_CHUNK) {
      checkAbort();
      const chunk = toUpdate.slice(i, i + PERSIST_CHUNK);
      try {
        await this.bulkUpdateByIds(
          supabase,
          chunk.map((j) => ({ ...j.payload, id: j.existsId })),
        );
        updated += chunk.length;
        for (const job of chunk) {
          persistedInterventionIds.push({ line: job.line, interventionId: job.existsId });
        }
      } catch (bulkErr) {
        console.error('[import] bulkUpdateByIds failed, falling back per-row:', formatError(bulkErr), bulkErr);
        for (const job of chunk) {
          try {
            await this.updateFromImport(supabase, job.existsId, job.payload);
            updated++;
            persistedInterventionIds.push({ line: job.line, interventionId: job.existsId });
          } catch (e) {
            const reason = formatError(e);
            console.error(`[import] update ligne ${job.line} (id_inter=${job.id_inter}, id=${job.existsId}) :`, reason, e, 'payload:', job.payload);
            errors.push({ line: job.line, id_inter: job.id_inter, reason });
          }
        }
      }
      persistDone += chunk.length;
      emit({ stage: 'persisting', done: persistDone, total: persistTotal });
    }

    // Liens artisans (intervention_artisans). Pour chaque intervention
    // persistée, on remplace les liens existants par ceux du CSV (SST →
    // primary, SST 2 → secondary). Les artisans inconnus ont déjà été
    // résolus à null par le mapper et sont remontés en warnings ci-dessous.
    try {
      await persistArtisanLinks(supabase, persistedInterventionIds, mappedByLine);
    } catch (e) {
      const reason = formatError(e);
      console.error('[import] persistArtisanLinks failed:', reason, e);
      // Non bloquant : les interventions sont écrites, on signale via errors.
      errors.push({ line: 0, id_inter: null, reason: `Liens artisans : ${reason}` });
    }

    // Warnings non bloquants (artisan inconnu, etc.) — on ne remonte que les
    // lignes qui ont été persistées (les autres sont déjà dans `errors`).
    const persistedLines = new Set(persistedInterventionIds.map((p) => p.line));
    const warnings: NonNullable<ImportResponse['warnings']> = [];
    for (const m of mappedRows) {
      if (!persistedLines.has(m.line)) continue;
      for (const w of m.mapped.warnings) {
        if (w.field === 'SST' || w.field === 'SST 2' || w.field === 'ID') {
          warnings.push({ line: m.line, id_inter: m.id_inter, field: w.field, reason: w.reason });
        }
      }
    }

    return {
      ok: true,
      body: {
        dry_run: false,
        total,
        valid,
        inserted,
        updated,
        skipped,
        unresolved,
        errors,
        ...(warnings.length > 0 ? { warnings } : {}),
      },
    };
  },
};

export type RunImportResult =
  | { ok: true; body: ImportResponse }
  | { ok: false; status: number; error: string };

export type ImportProgressEvent =
  | { stage: 'parsing' }
  | { stage: 'parsed'; rowCount: number }
  | { stage: 'validating'; done: number; total: number }
  | { stage: 'lookup'; total: number }
  | { stage: 'persisting'; done: number; total: number };

export class ImportAbortedError extends Error {
  constructor() {
    super('Import annulé');
    this.name = 'ImportAbortedError';
  }
}

function buildInterventionPayload(
  m: MappedIntervention,
  tenant_id: string | null,
  owner_id: string | null,
): InterventionImportPayload {
  return {
    id_inter: m.id_inter,
    agence_id: m.agence_id,
    assigned_user_id: m.assigned_user_id,
    statut_id: m.statut_id,
    metier_id: m.metier_id,
    tenant_id,
    owner_id,
    date: m.date,
    date_prevue: m.date_prevue,
    contexte_intervention: m.contexte_intervention,
    adresse: m.adresse,
    code_postal: m.code_postal,
    ville: m.ville,
    is_active: m.is_active,
  };
}

/**
 * Construit une version lisible du payload pour la prévisualisation dry-run :
 * les FKs (agence, statut, métier, gestionnaire) sont remplacées par leurs
 * labels via le resolver, et locataire / propriétaire par leur identité
 * humaine (nom · téléphone · email) issue du mapper. Si un id n'a pas de
 * correspondance dans le resolver, on retombe sur l'id brut pour ne rien
 * masquer.
 *
 * Pour les artisans (SST / SST 2) :
 *   null                                              → pas de SST dans le CSV
 *   { resolved: false, label }                        → SST présent mais inconnu en base
 *   { resolved: true, plain_nom, telephone, email }   → SST trouvé en base
 */
type ArtisanDisplay =
  | null
  | { resolved: false; label: string }
  | ({ resolved: true } & ArtisanInfo);

function artisanDisplay(
  resolvedId: string | null,
  rawLabel: string | null | undefined,
  finder: EntityFinder,
): ArtisanDisplay {
  if (resolvedId) {
    const info = finder.getArtisanInfo(resolvedId);
    return {
      resolved: true,
      plain_nom: info?.plain_nom ?? null,
      telephone: info?.telephone ?? null,
      email: info?.email ?? null,
    };
  }
  const label = rawLabel?.trim();
  if (label) return { resolved: false, label };
  return null;
}

function personStatus(r: PersonResolution | undefined): 'existing' | 'new' | null {
  if (!r || r.kind === 'none') return null;
  return r.kind === 'existing' ? 'existing' : 'new';
}

/**
 * Charge les valeurs actuelles en base pour les interventions données et
 * retourne, par id, un objet de la même forme que `buildDisplayPayload`
 * (labels résolus pour les FKs, infos personnes pour locataire/propriétaire).
 *
 * Permet à l'UI de prévisualisation d'afficher une diff `ancien → nouveau`
 * pour les lignes du bucket "à mettre à jour". Les artisans ne sont pas
 * inclus dans cette première version (relation many-to-many via la table
 * `intervention_artisans`, à ajouter plus tard si besoin).
 */
async function fetchPreviousDisplayPayloads(
  supabase: SupabaseClient,
  ids: string[],
  resolver: EnumResolver,
): Promise<Map<string, Record<string, unknown>>> {
  const result = new Map<string, Record<string, unknown>>();
  if (ids.length === 0) return result;

  type Row = {
    id: string;
    id_inter: string | null;
    agence_id: string | null;
    assigned_user_id: string | null;
    statut_id: string | null;
    metier_id: string | null;
    tenant_id: string | null;
    owner_id: string | null;
    date: string | null;
    date_prevue: string | null;
    contexte_intervention: string | null;
    adresse: string | null;
    code_postal: string | null;
    ville: string | null;
    is_active: boolean | null;
  };

  // 100 UUIDs (~3.6 Ko) reste très en dessous des limites Kong/PostgREST locales.
  const FETCH_CHUNK = 100;
  const rows: Row[] = [];
  for (let i = 0; i < ids.length; i += FETCH_CHUNK) {
    const slice = ids.slice(i, i + FETCH_CHUNK);
    const { data, error } = await supabase
      .from('interventions')
      .select(
        'id, id_inter, agence_id, assigned_user_id, statut_id, metier_id, tenant_id, owner_id, date, date_prevue, contexte_intervention, adresse, code_postal, ville, is_active',
      )
      .in('id', slice);
    if (error) throw error;
    rows.push(...((data ?? []) as Row[]));
  }

  // Lookup des locataires / propriétaires en lot (deux SELECTs au plus).
  const tenantIds = Array.from(new Set(rows.map((r) => r.tenant_id).filter((v): v is string => !!v)));
  const ownerIds = Array.from(new Set(rows.map((r) => r.owner_id).filter((v): v is string => !!v)));

  type TenantRow = {
    id: string;
    plain_nom_client: string | null;
    telephone: string | null;
    telephone2: string | null;
    email: string | null;
  };
  type OwnerRow = {
    id: string;
    plain_nom_facturation: string | null;
    telephone: string | null;
    email: string | null;
  };

  const tenantsById = new Map<string, TenantRow>();
  const ownersById = new Map<string, OwnerRow>();

  if (tenantIds.length > 0) {
    for (let i = 0; i < tenantIds.length; i += FETCH_CHUNK) {
      const slice = tenantIds.slice(i, i + FETCH_CHUNK);
      const { data, error } = await supabase
        .from('tenants')
        .select('id, plain_nom_client, telephone, telephone2, email')
        .in('id', slice);
      if (error) throw error;
      for (const t of (data ?? []) as TenantRow[]) tenantsById.set(t.id, t);
    }
  }

  if (ownerIds.length > 0) {
    for (let i = 0; i < ownerIds.length; i += FETCH_CHUNK) {
      const slice = ownerIds.slice(i, i + FETCH_CHUNK);
      const { data, error } = await supabase
        .from('owner')
        .select('id, plain_nom_facturation, telephone, email')
        .in('id', slice);
      if (error) throw error;
      for (const o of (data ?? []) as OwnerRow[]) ownersById.set(o.id, o);
    }
  }

  const personObject = (
    nom: string | null,
    telephone: string | null,
    telephone2: string | null,
    email: string | null,
  ): Record<string, string | null> | null => {
    const hasAny = [nom, telephone, telephone2, email].some(
      (s) => typeof s === 'string' && s.length > 0,
    );
    if (!hasAny) return null;
    const obj: Record<string, string | null> = { nom, telephone, email };
    if (telephone2) obj.telephone2 = telephone2;
    return obj;
  };

  for (const r of rows) {
    const t = r.tenant_id ? tenantsById.get(r.tenant_id) : undefined;
    const o = r.owner_id ? ownersById.get(r.owner_id) : undefined;
    result.set(r.id, {
      id_inter: r.id_inter,
      agence: r.agence_id ? resolver.getAgencyLabel(r.agence_id) ?? r.agence_id : null,
      statut: r.statut_id ? resolver.getInterventionStatusLabel(r.statut_id) ?? r.statut_id : null,
      metier: r.metier_id ? resolver.getMetierLabel(r.metier_id) ?? r.metier_id : null,
      gestionnaire: r.assigned_user_id
        ? resolver.getUserLabel(r.assigned_user_id) ?? r.assigned_user_id
        : null,
      locataire: t
        ? personObject(t.plain_nom_client, t.telephone, t.telephone2, t.email)
        : null,
      proprietaire: o ? personObject(o.plain_nom_facturation, o.telephone, null, o.email) : null,
      date: r.date,
      date_prevue: r.date_prevue,
      contexte_intervention: r.contexte_intervention,
      adresse: r.adresse,
      is_active: r.is_active,
    });
  }

  return result;
}

/**
 * Récupère les détails minimaux (id_inter, date, adresse) pour un ensemble
 * d'interventions candidates à un conflit. Permet à l'UI d'afficher chaque
 * option de manière intelligible au lieu d'un simple UUID.
 */
async function fetchConflictCandidates(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, { id_inter: string | null; date: string | null; adresse: string | null }>> {
  const result = new Map<string, { id_inter: string | null; date: string | null; adresse: string | null }>();
  if (ids.length === 0) return result;
  const CHUNK = 100;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('interventions')
      .select('id, id_inter, date, adresse')
      .in('id', slice);
    if (error) throw error;
    for (const row of (data ?? []) as Array<{
      id: string;
      id_inter: string | null;
      date: string | null;
      adresse: string | null;
    }>) {
      result.set(row.id, { id_inter: row.id_inter, date: row.date, adresse: row.adresse });
    }
  }
  return result;
}

function buildDisplayPayload(
  m: MappedIntervention,
  raw: Record<string, string>,
  payload: InterventionImportPayload,
  resolver: EnumResolver,
  finder: EntityFinder,
  tenantRes: PersonResolution | undefined,
  ownerRes: PersonResolution | undefined,
): Record<string, unknown> {
  const personObject = (
    nom: string | null,
    telephone: string | null,
    telephone2: string | null,
    email: string | null,
  ): Record<string, string | null> | null => {
    const hasAny = [nom, telephone, telephone2, email].some(
      (s) => typeof s === 'string' && s.length > 0,
    );
    if (!hasAny) return null;
    const obj: Record<string, string | null> = { nom, telephone, email };
    if (telephone2) obj.telephone2 = telephone2;
    return obj;
  };

  return {
    id_inter: payload.id_inter,
    agence: payload.agence_id
      ? resolver.getAgencyLabel(payload.agence_id) ?? payload.agence_id
      : null,
    statut: payload.statut_id
      ? resolver.getInterventionStatusLabel(payload.statut_id) ?? payload.statut_id
      : null,
    metier: payload.metier_id
      ? resolver.getMetierLabel(payload.metier_id) ?? payload.metier_id
      : null,
    gestionnaire: payload.assigned_user_id
      ? resolver.getUserLabel(payload.assigned_user_id) ?? payload.assigned_user_id
      : null,
    locataire: m.tenant
      ? personObject(
          m.tenant.plain_nom_client,
          m.tenant.telephone,
          m.tenant.telephone2,
          m.tenant.email,
        )
      : null,
    proprietaire: m.owner
      ? personObject(
          m.owner.plain_nom_facturation,
          m.owner.telephone,
          null,
          m.owner.email,
        )
      : null,
    date: payload.date,
    date_prevue: payload.date_prevue,
    contexte_intervention: payload.contexte_intervention,
    adresse: payload.adresse,
    is_active: payload.is_active,
    artisan_sst: artisanDisplay(m.artisan_sst, raw['SST'] ?? raw['Technicien'], finder),
    artisan_sst2: artisanDisplay(m.artisan_sst2, raw['SST 2'], finder),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Résolution locataires / propriétaires
//
// Stratégie commune : on déduit une clé d'identité stable par personne
// (téléphone > email > nom complet), on dédup les rangées de l'import par
// cette clé, on cherche en base les correspondances existantes (par
// téléphone/téléphone2, email, plain_nom), et on crée en bulk celles qui
// manquent. Si une rangée n'a aucune info exploitable, sa FK reste null.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Statut de résolution d'une personne (locataire / propriétaire) :
 *   - 'none'     : aucune info exploitable dans le CSV (FK reste null)
 *   - 'existing' : correspondance trouvée en base, on réutilise l'`id`
 *   - 'new'      : pas de correspondance — sera créée en base. `id` est null
 *                  en dry-run (rien n'est écrit), sinon contient l'id créé.
 */
type PersonResolution =
  | { kind: 'none' }
  | { kind: 'existing'; id: string }
  | { kind: 'new'; id: string | null };

function tenantKey(t: TenantInfo | null): string | null {
  if (!t) return null;
  if (t.telephone) return `t:${t.telephone}`;
  if (t.email) return `e:${t.email.toLowerCase()}`;
  if (t.plain_nom_client) return `n:${t.plain_nom_client.toLowerCase().trim()}`;
  return null;
}

function ownerKey(o: OwnerInfo | null): string | null {
  if (!o) return null;
  if (o.telephone) return `t:${o.telephone}`;
  if (o.email) return `e:${o.email.toLowerCase()}`;
  if (o.plain_nom_facturation) return `n:${o.plain_nom_facturation.toLowerCase().trim()}`;
  return null;
}

type TenantRow = {
  id: string;
  email: string | null;
  telephone: string | null;
  telephone2: string | null;
  plain_nom_client: string | null;
};

type OwnerRow = {
  id: string;
  email: string | null;
  telephone: string | null;
  telephone2: string | null;
  plain_nom_facturation: string | null;
};

export async function resolveTenants(
  supabase: SupabaseClient,
  mapped: Array<{ line: number; mapped: MappedIntervention }>,
  dryRun: boolean,
): Promise<Map<number, PersonResolution>> {
  const out = new Map<number, PersonResolution>();

  const byKey = new Map<string, TenantInfo>();
  for (const { mapped: m } of mapped) {
    const k = tenantKey(m.tenant);
    if (k && !byKey.has(k)) byKey.set(k, m.tenant!);
  }

  if (byKey.size === 0) {
    for (const { line } of mapped) out.set(line, { kind: 'none' });
    return out;
  }

  const phones = unique([...byKey.values()].map((t) => t.telephone).filter(isStr));
  const emails = unique([...byKey.values()].map((t) => t.email?.toLowerCase() ?? null).filter(isStr));
  const names = unique([...byKey.values()].map((t) => t.plain_nom_client).filter(isStr));

  // Lookup set-based via RPC (POST body) : élimine HTTP 414 par construction.
  // Cf. docs/architecture/imports-async.md ADR-2.
  let existing: TenantRow[] = [];
  if (phones.length || emails.length || names.length) {
    const { data, error } = await supabase.rpc('csv_intervention_import_resolve_tenants', {
      p_telephones: phones,
      p_telephones2: phones,
      p_emails: emails,
      p_names: names,
    });
    if (error) throw error;
    existing = (data ?? []) as TenantRow[];
  }

  const existingIdByKey = new Map<string, string>();
  for (const [k, t] of byKey) {
    const found = existing.find((r) =>
      (!!t.telephone && (r.telephone === t.telephone || r.telephone2 === t.telephone)) ||
      (!!t.email && !!r.email && r.email.toLowerCase() === t.email.toLowerCase()) ||
      (!!t.plain_nom_client && !!r.plain_nom_client &&
        r.plain_nom_client.toLowerCase().trim() === t.plain_nom_client.toLowerCase().trim()),
    );
    if (found) existingIdByKey.set(k, found.id);
  }

  const newIdByKey = new Map<string, string | null>();
  const missing = [...byKey.entries()].filter(([k]) => !existingIdByKey.has(k));
  if (missing.length > 0) {
    if (dryRun) {
      for (const [k] of missing) newIdByKey.set(k, null);
    } else {
      const payloads = missing.map(([, t]) => ({
        firstname: t.firstname,
        lastname: t.lastname,
        plain_nom_client: t.plain_nom_client,
        email: t.email,
        telephone: t.telephone,
        telephone2: t.telephone2,
      }));
      for (let i = 0; i < payloads.length; i += PERSIST_CHUNK) {
        const chunkKeys = missing.slice(i, i + PERSIST_CHUNK).map(([k]) => k);
        const chunk = payloads.slice(i, i + PERSIST_CHUNK);
        const { data, error } = await supabase.from('tenants').insert(chunk).select('id');
        if (error) throw error;
        const inserted = (data ?? []) as Array<{ id: string }>;
        // PostgREST renvoie les rows insérées dans l'ordre d'envoi.
        for (let j = 0; j < inserted.length; j++) newIdByKey.set(chunkKeys[j], inserted[j].id);
      }
    }
  }

  for (const { line, mapped: m } of mapped) {
    const k = tenantKey(m.tenant);
    if (!k) { out.set(line, { kind: 'none' }); continue; }
    const existingId = existingIdByKey.get(k);
    if (existingId) { out.set(line, { kind: 'existing', id: existingId }); continue; }
    out.set(line, { kind: 'new', id: newIdByKey.get(k) ?? null });
  }
  return out;
}

export async function resolveOwners(
  supabase: SupabaseClient,
  mapped: Array<{ line: number; mapped: MappedIntervention }>,
  dryRun: boolean,
): Promise<Map<number, PersonResolution>> {
  const out = new Map<number, PersonResolution>();

  const byKey = new Map<string, OwnerInfo>();
  for (const { mapped: m } of mapped) {
    const k = ownerKey(m.owner);
    if (k && !byKey.has(k)) byKey.set(k, m.owner!);
  }

  if (byKey.size === 0) {
    for (const { line } of mapped) out.set(line, { kind: 'none' });
    return out;
  }

  const phones = unique([...byKey.values()].map((o) => o.telephone).filter(isStr));
  const emails = unique([...byKey.values()].map((o) => o.email?.toLowerCase() ?? null).filter(isStr));
  const names = unique([...byKey.values()].map((o) => o.plain_nom_facturation).filter(isStr));

  let existing: OwnerRow[] = [];
  if (phones.length || emails.length || names.length) {
    const { data, error } = await supabase.rpc('csv_intervention_import_resolve_owners', {
      p_telephones: phones,
      p_telephones2: phones,
      p_emails: emails,
      p_names: names,
    });
    if (error) throw error;
    existing = (data ?? []) as OwnerRow[];
  }

  const existingIdByKey = new Map<string, string>();
  for (const [k, o] of byKey) {
    const found = existing.find((r) =>
      (!!o.telephone && (r.telephone === o.telephone || r.telephone2 === o.telephone)) ||
      (!!o.email && !!r.email && r.email.toLowerCase() === o.email.toLowerCase()) ||
      (!!o.plain_nom_facturation && !!r.plain_nom_facturation &&
        r.plain_nom_facturation.toLowerCase().trim() === o.plain_nom_facturation.toLowerCase().trim()),
    );
    if (found) existingIdByKey.set(k, found.id);
  }

  const newIdByKey = new Map<string, string | null>();
  const missing = [...byKey.entries()].filter(([k]) => !existingIdByKey.has(k));
  if (missing.length > 0) {
    if (dryRun) {
      for (const [k] of missing) newIdByKey.set(k, null);
    } else {
      // OwnerInfo.firstname/lastname → owner_firstname/owner_lastname (schéma).
      const payloads = missing.map(([, o]) => ({
        owner_firstname: o.firstname,
        owner_lastname: o.lastname,
        plain_nom_facturation: o.plain_nom_facturation,
        email: o.email,
        telephone: o.telephone,
      }));
      for (let i = 0; i < payloads.length; i += PERSIST_CHUNK) {
        const chunkKeys = missing.slice(i, i + PERSIST_CHUNK).map(([k]) => k);
        const chunk = payloads.slice(i, i + PERSIST_CHUNK);
        const { data, error } = await supabase.from('owner').insert(chunk).select('id');
        if (error) throw error;
        const inserted = (data ?? []) as Array<{ id: string }>;
        for (let j = 0; j < inserted.length; j++) newIdByKey.set(chunkKeys[j], inserted[j].id);
      }
    }
  }

  for (const { line, mapped: m } of mapped) {
    const k = ownerKey(m.owner);
    if (!k) { out.set(line, { kind: 'none' }); continue; }
    const existingId = existingIdByKey.get(k);
    if (existingId) { out.set(line, { kind: 'existing', id: existingId }); continue; }
    out.set(line, { kind: 'new', id: newIdByKey.get(k) ?? null });
  }
  return out;
}

function isStr(x: string | null | undefined): x is string {
  return typeof x === 'string' && x.length > 0;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

// ───────────────────────────────────────────────────────────────────────────
// Liens artisans (intervention_artisans)
//
// Stratégie : pour chaque intervention persistée, on supprime les liens
// existants puis on insère les nouveaux (SST → primary, SST 2 → secondary).
// Les artisans non résolus (null) sont ignorés silencieusement — la mention
// remonte déjà via les warnings du mapper.
// ───────────────────────────────────────────────────────────────────────────

const ARTISAN_LINK_DELETE_CHUNK = 100;

async function persistArtisanLinks(
  supabase: SupabaseClient,
  persisted: Array<{ line: number; interventionId: string }>,
  mappedByLine: Map<number, MappedIntervention>,
): Promise<void> {
  if (persisted.length === 0) return;

  type LinkRow = {
    intervention_id: string;
    artisan_id: string;
    role: 'primary' | 'secondary';
    is_primary: boolean;
  };

  const links: LinkRow[] = [];
  const interventionIdsWithLinks: string[] = [];

  for (const { line, interventionId } of persisted) {
    const m = mappedByLine.get(line);
    if (!m) continue;
    const rowLinks: LinkRow[] = [];
    if (m.artisan_sst) {
      rowLinks.push({
        intervention_id: interventionId,
        artisan_id: m.artisan_sst,
        role: 'primary',
        is_primary: true,
      });
    }
    if (m.artisan_sst2) {
      rowLinks.push({
        intervention_id: interventionId,
        artisan_id: m.artisan_sst2,
        role: 'secondary',
        is_primary: false,
      });
    }
    if (rowLinks.length > 0) {
      interventionIdsWithLinks.push(interventionId);
      links.push(...rowLinks);
    }
  }

  if (links.length === 0) return;

  // Supprime les liens existants pour les interventions qui en reçoivent de
  // nouveaux. Les interventions sans SST dans le CSV gardent leurs liens
  // existants (rien à faire).
  for (let i = 0; i < interventionIdsWithLinks.length; i += ARTISAN_LINK_DELETE_CHUNK) {
    const slice = interventionIdsWithLinks.slice(i, i + ARTISAN_LINK_DELETE_CHUNK);
    const { error } = await supabase
      .from('intervention_artisans')
      .delete()
      .in('intervention_id', slice);
    if (error) throw error;
  }

  // Insertion en bulk avec onConflict (par sécurité, au cas où une ligne
  // référencerait deux fois le même artisan via SST et SST 2).
  for (let i = 0; i < links.length; i += PERSIST_CHUNK) {
    const chunk = links.slice(i, i + PERSIST_CHUNK);
    const { error } = await supabase
      .from('intervention_artisans')
      .upsert(chunk, { onConflict: 'intervention_id,artisan_id' });
    if (error) throw error;
  }
}
