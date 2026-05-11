import type { ImportReferentials } from '@/lib/api/referentials';
import gestionnaireCodeMap from '@shared/import-mappings/gestionnaire-code-map.json';

const GESTIONNAIRE_CODE_MAP = gestionnaireCodeMap as Record<string, string | null>;

/**
 * Résout les labels CSV vers des IDs base de données.
 *
 * Pure : reçoit les référentiels déjà chargés (cf. `referentialsApi.loadForImport`)
 * et fait du lookup en mémoire. Toutes les comparaisons sont insensibles
 * à la casse et aux accents.
 */
export class EnumResolver {
  private agencies = new Map<string, string>();
  private metiers = new Map<string, string>();
  private statuses = new Map<string, string>();
  private users = new Map<string, string>();
  private usersByCode = new Map<string, string>();

  // Reverse maps (id -> label) pour l'affichage côté preview.
  private agencyLabels = new Map<string, string>();
  private metierLabels = new Map<string, string>();
  private statusLabels = new Map<string, string>();
  private userLabels = new Map<string, string>();

  constructor(
    refs: Pick<ImportReferentials, 'agencies' | 'metiers' | 'statuses' | 'users'>,
  ) {
    for (const row of refs.agencies) {
      this.agencies.set(normalize(row.label), row.id);
      this.agencyLabels.set(row.id, row.label);
    }
    for (const row of refs.metiers) {
      this.metiers.set(normalize(row.label), row.id);
      this.metierLabels.set(row.id, row.label);
    }
    for (const row of refs.statuses) {
      // Indexé par libellé ET par code technique : un CSV peut contenir aussi
      // bien "Inter terminée" (label) que "INTER_TERMINEE" (code). Sans le code,
      // l'underscore ne se replie pas sur l'espace du label et le statut est
      // perdu silencieusement (cf. parité avec scripts/data-processing).
      this.statuses.set(normalize(row.label), row.id);
      if (row.code) this.statuses.set(normalize(row.code), row.id);
      this.statusLabels.set(row.id, row.label);
    }
    for (const row of refs.users) {
      if (row.username) {
        this.users.set(normalize(row.username), row.id);
        this.userLabels.set(row.id, row.username);
      }
      if (row.code_gestionnaire) {
        this.usersByCode.set(normalize(row.code_gestionnaire), row.id);
      }
    }
  }

  getAgencyId(label: string): string | null {
    return this.agencies.get(normalize(label)) ?? null;
  }

  getMetierId(label: string): string | null {
    return this.metiers.get(normalize(label)) ?? null;
  }

  getInterventionStatusId(label: string): string | null {
    return this.statuses.get(normalize(label)) ?? null;
  }

  /**
   * Résout un libellé "Gest." (lettre, code court, prénom ou username) vers un id user.
   *
   * Stratégie en cascade :
   *   1. Normalisation du label (trim + lowercase + accents retirés).
   *   2. Lookup direct par `users.code_gestionnaire` (source de vérité DB pour
   *      les lettres officielles, ex: "D" → Dimitri).
   *   3. Lookup direct par `users.username`.
   *   4. Code-map statique (`shared/import-mappings/gestionnaire-code-map.json`) :
   *      gère les alias historiques (prénoms, défauts, valeurs aberrantes) que
   *      la DB n'exprime pas. La valeur résolue est ensuite cherchée en base.
   *
   * La code-map sert uniquement de filet de sécurité — l'ajout d'un nouveau
   * gestionnaire en DB (avec `code_gestionnaire` renseigné) suffit, sans toucher
   * au JSON.
   */
  getUserId(label: string): string | null {
    const normalized = normalize(label);

    const byCode = this.usersByCode.get(normalized);
    if (byCode) return byCode;

    const byUsername = this.users.get(normalized);
    if (byUsername) return byUsername;

    if (normalized in GESTIONNAIRE_CODE_MAP) {
      const canonical = GESTIONNAIRE_CODE_MAP[normalized];
      if (canonical === null) return null;
      const mapped = this.users.get(normalize(canonical));
      if (mapped) return mapped;
    }

    return null;
  }

  getAgencyLabel(id: string): string | null {
    return this.agencyLabels.get(id) ?? null;
  }

  getMetierLabel(id: string): string | null {
    return this.metierLabels.get(id) ?? null;
  }

  getInterventionStatusLabel(id: string): string | null {
    return this.statusLabels.get(id) ?? null;
  }

  getUserLabel(id: string): string | null {
    return this.userLabels.get(id) ?? null;
  }
}

/**
 * Recherche d'artisans par plain_nom. Pure : prend la liste des artisans
 * pré-chargée et fait du lookup en mémoire.
 */
export interface ArtisanInfo {
  plain_nom: string | null;
  telephone: string | null;
  email: string | null;
}

interface ArtisanIndexEntry {
  id: string;
  normName: string;
  words: string[];
}

/** Score minimum pour accepter un match flou. */
const FUZZY_MATCH_THRESHOLD = 60;

export class EntityFinder {
  private artisans = new Map<string, string>();
  private artisanIndex: ArtisanIndexEntry[] = [];
  private artisanInfoById = new Map<string, ArtisanInfo>();

  constructor(refs: Pick<ImportReferentials, 'artisans'>) {
    for (const row of refs.artisans) {
      if (row.plain_nom) {
        const normName = normalize(row.plain_nom);
        this.artisans.set(normName, row.id);
        this.artisanIndex.push({
          id: row.id,
          normName,
          words: normName.split(' ').filter((w) => w.length > 2),
        });
      }
      this.artisanInfoById.set(row.id, {
        plain_nom: row.plain_nom,
        telephone: row.telephone,
        email: row.email,
      });
    }
  }

  /**
   * Résout un label CSV "SST" vers un id artisan. Stratégie en cascade :
   *   1. Sanitisation du label (suffixes "(archivé)", "IDF", codes numériques, "/")
   *   2. Lookup exact normalisé (Map)
   *   3. Match flou par scoring (substring + recouvrement de mots) au-dessus du seuil
   *   4. Split sur "/" et retry sur chaque partie (2 max)
   *
   * Portée depuis le script GSheets pour gérer les noms composites et les
   * variantes du gabarit Excel client.
   */
  findArtisanByName(plainNom: string): string | null {
    if (!plainNom) return null;
    const cleaned = sanitizeArtisanLabel(plainNom);
    if (!cleaned) return null;

    const exact = this.artisans.get(normalize(cleaned));
    if (exact) return exact;

    const fuzzy = this.fuzzyMatch(cleaned);
    if (fuzzy) return fuzzy;

    if (cleaned.includes('/')) {
      const separator = cleaned.includes(' / ') ? ' / ' : '/';
      const parts = cleaned.split(separator).slice(0, 2);
      for (const part of parts) {
        const cleanedPart = sanitizeArtisanLabel(part);
        if (!cleanedPart || cleanedPart.length <= 2) continue;
        const exactPart = this.artisans.get(normalize(cleanedPart));
        if (exactPart) return exactPart;
        const fuzzyPart = this.fuzzyMatch(cleanedPart);
        if (fuzzyPart) return fuzzyPart;
      }
    }

    return null;
  }

  getArtisanInfo(id: string): ArtisanInfo | null {
    return this.artisanInfoById.get(id) ?? null;
  }

  private fuzzyMatch(label: string): string | null {
    const search = normalize(label);
    if (!search) return null;
    const searchWords = search.split(' ').filter((w) => w.length > 2);

    let best: { id: string; score: number } | null = null;
    for (const entry of this.artisanIndex) {
      let score = 0;
      if (entry.normName === search) {
        score = 100;
      } else if (entry.normName.includes(search) || search.includes(entry.normName)) {
        score = 80;
      } else if (searchWords.length > 0 && entry.words.length > 0) {
        const matching = searchWords.filter((w) =>
          entry.words.some((ew) => ew.includes(w) || w.includes(ew)),
        );
        if (matching.length > 0) {
          score = (matching.length / Math.max(searchWords.length, entry.words.length)) * 60;
        }
      }
      if (score > (best?.score ?? 0)) {
        best = { id: entry.id, score };
      }
    }

    return best && best.score >= FUZZY_MATCH_THRESHOLD ? best.id : null;
  }
}

/**
 * Nettoie un label artisan provenant du CSV : retire les suffixes parasites
 * (mention "archivé", IDF, codes numériques de fin, slash terminal) et
 * normalise les espaces. Ne fait pas la normalisation casse/accents — c'est
 * le rôle de `normalize()` au moment du lookup.
 */
function sanitizeArtisanLabel(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s*\(?\s*archiv[eé]\s*\)?/gi, '')
    .replace(/\s+IDF\s*$/i, '')
    .replace(/\s*\/\s*$/, '')
    .replace(/\s+\d{2,3}(?:\s+\d{2,3})?\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalisation pour comparaisons insensibles à la casse, aux accents et aux
 * séparateurs. Tout caractère non alphanumérique (underscore, tiret, slash,
 * apostrophe, espaces multiples) est replié sur un seul espace, ce qui permet
 * de matcher indifféremment "INTER_TERMINEE", "Inter-terminée" et
 * "Inter terminée" sur la même clé canonique.
 *
 * Parité avec `normalizeSheetKey` du pipeline legacy
 * (scripts/data-processing/resolvers/enum-resolver.js).
 */
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}
