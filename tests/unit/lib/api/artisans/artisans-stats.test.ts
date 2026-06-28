import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock du module `_helpers` qui expose `supabaseClient`.
 * On remplace tout le module pour ne pas dépendre de credentials Supabase réels.
 * `__setResult` permet à chaque test de définir le jeu de données renvoyé par la
 * chaîne de requête (qui est "thenable", comme le vrai client PostgREST).
 */
vi.mock("@/lib/api/artisans/_helpers", () => {
  let current: { data: unknown[]; error: unknown; count: number | null } = {
    data: [],
    error: null,
    count: 0,
  };

  const chainMethods = [
    "select", "insert", "update", "delete",
    "eq", "neq", "in", "not", "or", "ilike", "is",
    "gt", "gte", "lt", "lte", "order", "limit", "range", "filter", "match", "contains",
  ];

  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    chainMethods.forEach((m) => {
      chain[m] = vi.fn(() => chain);
    });
    chain.single = vi.fn(() => Promise.resolve(current));
    chain.maybeSingle = vi.fn(() => Promise.resolve(current));
    // Rendre la chaîne awaitable (await query => { data, error, count })
    chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(current).then(resolve, reject);
    return chain;
  };

  return {
    supabaseClient: { from: vi.fn(() => makeChain()) },
    __setResult: (r: { data: unknown[]; error?: unknown; count?: number | null }) => {
      current = {
        data: r.data,
        error: r.error ?? null,
        count: r.count ?? (Array.isArray(r.data) ? r.data.length : null),
      };
    },
  };
});

import { artisansStats } from "@/lib/api/artisans/artisans-stats";
import { ARTISAN_DOSSIER_VIEW_EXCLUDED_STATUTS } from "@/config/artisans";
import * as helpers from "@/lib/api/artisans/_helpers";

const setResult = (helpers as unknown as {
  __setResult: (r: { data: unknown[]; error?: unknown; count?: number | null }) => void;
}).__setResult;

describe("artisansStats.getStatsByGestionnaire", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exclut CANDIDAT et POTENTIEL du compteur dossiers_a_completer", async () => {
    setResult({
      data: [
        // status sous forme de tableau (PostgREST embedded) -> doit compter
        { statut_dossier: "À compléter", status: [{ id: "1", code: "CONFIRME", label: "Confirmé" }] },
        { statut_dossier: "incomplet", status: { id: "2", code: "EXPERT", label: "Expert" } },
        // exclus du compteur (mais présents dans la répartition)
        { statut_dossier: "À compléter", status: { id: "3", code: "POTENTIEL", label: "Potentiel" } },
        { statut_dossier: "INCOMPLET", status: { id: "4", code: "CANDIDAT", label: "Candidat" } },
        // dossier complet -> ne compte pas
        { statut_dossier: "Complet", status: { id: "1", code: "CONFIRME", label: "Confirmé" } },
      ],
    });

    const stats = await artisansStats.getStatsByGestionnaire("user-1");

    // Seuls CONFIRME (À compléter) + EXPERT (incomplet) sont comptés
    expect(stats.dossiers_a_completer).toBe(2);
  });

  it("conserve POTENTIEL et CANDIDAT dans la répartition by_status (pas de régression)", async () => {
    setResult({
      data: [
        { statut_dossier: "À compléter", status: { id: "3", code: "POTENTIEL", label: "Potentiel" } },
        { statut_dossier: "INCOMPLET", status: { id: "4", code: "CANDIDAT", label: "Candidat" } },
        { statut_dossier: "À compléter", status: { id: "1", code: "CONFIRME", label: "Confirmé" } },
      ],
    });

    const stats = await artisansStats.getStatsByGestionnaire("user-1");

    // La répartition par statut continue d'inclure POTENTIEL et CANDIDAT
    expect(stats.by_status.POTENTIEL).toBe(1);
    expect(stats.by_status.CANDIDAT).toBe(1);
    expect(stats.by_status.CONFIRME).toBe(1);
    // ... mais seul l'artisan actif (CONFIRME) compte dans le KPI
    expect(stats.dossiers_a_completer).toBe(1);
  });

  it("lève une erreur si gestionnaireId est manquant", async () => {
    await expect(artisansStats.getStatsByGestionnaire("")).rejects.toThrow();
  });
});

describe("artisansStats.getArtisansWithDossiersACompleter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exclut ARCHIVE, POTENTIEL et CANDIDAT de la liste détaillée", async () => {
    setResult({
      data: [
        { id: "a1", nom: "Durand", prenom: "Paul", statut_id: "1", artisan_statuses: { code: "CONFIRME" } },
        { id: "a2", nom: "Martin", prenom: "Luc", statut_id: "3", artisan_statuses: { code: "POTENTIEL" } },
        { id: "a3", nom: "Petit", prenom: "Anne", statut_id: "4", artisan_statuses: { code: "CANDIDAT" } },
        { id: "a4", nom: "Roux", prenom: "Eve", statut_id: "9", artisan_statuses: { code: "ARCHIVE" } },
      ],
    });

    const list = await artisansStats.getArtisansWithDossiersACompleter("user-1");

    expect(list).toEqual([
      { artisan_id: "a1", artisan_nom: "Durand", artisan_prenom: "Paul" },
    ]);
  });

  it("gère artisan_statuses renvoyé sous forme de tableau", async () => {
    setResult({
      data: [
        { id: "a5", nom: "Blanc", prenom: "Jo", statut_id: "1", artisan_statuses: [{ code: "EXPERT" }] },
        { id: "a6", nom: "Noir", prenom: "Max", statut_id: "3", artisan_statuses: [{ code: "POTENTIEL" }] },
      ],
    });

    const list = await artisansStats.getArtisansWithDossiersACompleter("user-1");

    expect(list).toEqual([
      { artisan_id: "a5", artisan_nom: "Blanc", artisan_prenom: "Jo" },
    ]);
  });

  it("lève une erreur si gestionnaireId est manquant", async () => {
    await expect(artisansStats.getArtisansWithDossiersACompleter("")).rejects.toThrow();
  });
});

describe("ARTISAN_DOSSIER_VIEW_EXCLUDED_STATUTS (règle métier)", () => {
  it("exclut exactement CANDIDAT, POTENTIEL et ARCHIVE", () => {
    expect([...ARTISAN_DOSSIER_VIEW_EXCLUDED_STATUTS].sort()).toEqual([
      "ARCHIVE",
      "CANDIDAT",
      "POTENTIEL",
    ]);
  });
});
