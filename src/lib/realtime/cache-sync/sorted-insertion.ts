/**
 * Insertion ordonnee dans le cache Realtime.
 *
 * Probleme resolu : jusqu'ici, une intervention qui (re)entrait dans une vue via Realtime
 * etait systematiquement prependee en tete de liste (`[record, ...data]`), sans respecter
 * l'ordre du serveur. Une ligne modifiee « sautait » donc en haut jusqu'au prochain refetch.
 *
 * Ce module calcule la position triee de la ligne selon les parametres de tri portes par la
 * query (`sortBy` / `sortDir`), en repliquant EXACTEMENT la logique de tri de l'Edge Function
 * `interventions-v2` (voir `supabase/functions/interventions-v2/_lib/helpers.ts`) :
 *   - defaut = `created_at DESC` ;
 *   - nulls toujours en dernier (equivalent `nullsFirst: false`) ;
 *   - tie-break final systematique sur `created_at DESC`.
 * Ainsi l'ordre optimiste cote client reste coherent avec l'ordre renvoye au prochain refetch.
 */

import type { Intervention, PaginatedResponse } from '@/lib/api/common/types'
import type { InterventionQueryParams } from '@/lib/api'

type GetAllParams = InterventionQueryParams

/**
 * Mapping `sortBy` (cle cote client) -> champ de l'objet `Intervention`.
 * Miroir de `SORTABLE_DIRECT_COLUMNS` de l'Edge Function interventions-v2.
 * NOTE: la cle `date` pointe volontairement sur `created_at` (quirk existant cote serveur).
 */
const SORT_FIELD_MAP: Record<string, keyof Intervention> = {
  date: 'created_at',
  created_at: 'created_at',
  dateIntervention: 'date',
  datePrevue: 'date_prevue',
  date_prevue: 'date_prevue',
  date_termine: 'date_termine',
  due_date: 'due_date',
  id_inter: 'id_inter',
  updated_at: 'updated_at',
}

interface ResolvedSort {
  field: keyof Intervention
  dir: 'asc' | 'desc'
}

/** Resout le champ + direction de tri effectifs (defaut : created_at DESC, comme le serveur). */
export function resolveSort(filters: GetAllParams | undefined): ResolvedSort {
  const mapped = filters?.sortBy ? SORT_FIELD_MAP[filters.sortBy] : undefined
  if (!mapped) {
    return { field: 'created_at', dir: 'desc' }
  }
  return { field: mapped, dir: filters?.sortDir ?? 'desc' }
}

function isNil(v: unknown): boolean {
  return v === null || v === undefined
}

/**
 * Comparateur : renvoie < 0 si `a` doit apparaitre AVANT `b` dans la liste.
 * Reproduit l'ordre serveur : champ principal (dir), nulls en dernier, puis created_at DESC.
 */
export function compareInterventions(a: Intervention, b: Intervention, sort: ResolvedSort): number {
  const { field, dir } = sort

  const av = (a as unknown as Record<string, unknown>)[field as string]
  const bv = (b as unknown as Record<string, unknown>)[field as string]

  const aNil = isNil(av)
  const bNil = isNil(bv)

  if (aNil !== bNil) {
    // nulls toujours en dernier, quelle que soit la direction (nullsFirst: false)
    return aNil ? 1 : -1
  }

  if (!aNil && !bNil && av !== bv) {
    const cmp = (av as string | number) < (bv as string | number) ? -1 : 1
    return dir === 'asc' ? cmp : -cmp
  }

  // Egalite sur le champ principal -> tie-break created_at DESC
  const at = a.created_at
  const bt = b.created_at
  const atNil = isNil(at)
  const btNil = isNil(bt)
  if (atNil !== btNil) return atNil ? 1 : -1
  if (atNil && btNil) return 0
  if (at === bt) return 0
  return (at as string) < (bt as string) ? 1 : -1 // DESC
}

/**
 * Calcule l'index d'insertion de `record` dans une liste supposee deja triee,
 * de sorte que la liste reste triee.
 */
export function findInsertIndex(
  list: readonly Intervention[],
  record: Intervention,
  sort: ResolvedSort
): number {
  for (let i = 0; i < list.length; i++) {
    if (compareInterventions(record, list[i], sort) < 0) {
      return i
    }
  }
  return list.length
}

/**
 * Insere (ou reinsere) `record` a sa position triee.
 * Toute occurrence existante de meme `id` est d'abord retiree, puis la ligne est
 * repositionnee selon l'ordre de la vue. Fonctionne aussi bien pour un nouvel element
 * (absent de la liste) que pour une mise a jour (repositionnement).
 */
export function insertSorted(
  list: readonly Intervention[],
  record: Intervention,
  filters: GetAllParams | undefined
): Intervention[] {
  const sort = resolveSort(filters)
  const without = list.filter((i) => i.id !== record.id)
  const idx = findInsertIndex(without, record, sort)
  return [...without.slice(0, idx), record, ...without.slice(idx)]
}

/** Helper: retourne la donnee paginee avec `data` remplace par `nextData`. */
export function withData(
  oldData: PaginatedResponse<Intervention>,
  nextData: Intervention[]
): PaginatedResponse<Intervention> {
  return { ...oldData, data: nextData }
}
