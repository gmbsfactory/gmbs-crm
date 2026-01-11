/**
 * Builder de mocks Supabase réutilisable
 *
 * Ce module fournit une façon fluide de créer des mocks Supabase
 * pour les tests unitaires. Il simule les chaînes d'appels Supabase.
 *
 * @example
 * ```ts
 * const mockBuilder = new SupabaseMockBuilder()
 *   .onTable("interventions")
 *   .withSelect()
 *   .returns({ data: [...], error: null });
 *
 * vi.mocked(supabase.from).mockImplementation(mockBuilder.build());
 * ```
 */

import { vi, type Mock } from "vitest";

export interface MockQueryResult<T = unknown> {
  data: T | null;
  error: { message: string; code?: string } | null;
  count?: number | null;
}

export interface TableMockConfig {
  selectResult?: MockQueryResult;
  insertResult?: MockQueryResult;
  updateResult?: MockQueryResult;
  deleteResult?: MockQueryResult;
  rpcResult?: MockQueryResult;
}

/**
 * Crée un mock de chaîne de requête Supabase
 * Simule les appels chaînés comme .select().eq().gte().order()
 */
export function createChainableMock<T>(finalResult: MockQueryResult<T>) {
  const chainMock: Record<string, Mock> = {};

  // Méthodes qui retournent la chaîne (pour continuer le chaînage)
  const chainMethods = [
    "select",
    "insert",
    "update",
    "delete",
    "upsert",
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "like",
    "ilike",
    "is",
    "in",
    "contains",
    "containedBy",
    "range",
    "textSearch",
    "match",
    "not",
    "or",
    "filter",
    "order",
    "limit",
    "offset",
  ];

  // Méthodes terminales qui retournent le résultat
  const terminalMethods = ["single", "maybeSingle", "then"];

  // Créer les méthodes chaînables
  chainMethods.forEach((method) => {
    chainMock[method] = vi.fn().mockReturnValue(chainMock);
  });

  // Créer les méthodes terminales
  terminalMethods.forEach((method) => {
    chainMock[method] = vi.fn().mockResolvedValue(finalResult);
  });

  // La méthode range est spéciale : elle termine aussi la chaîne avec une promesse
  chainMock.range = vi.fn().mockResolvedValue(finalResult);

  // Rendre le mock lui-même "thenable" pour les awaits directs
  chainMock.then = vi.fn((resolve) => Promise.resolve(finalResult).then(resolve));

  return chainMock;
}

/**
 * Builder pour créer des mocks Supabase complexes avec plusieurs tables
 */
export class SupabaseMockBuilder {
  private tableMocks: Map<string, ReturnType<typeof createChainableMock>> = new Map();
  private rpcMocks: Map<string, MockQueryResult> = new Map();
  private defaultResult: MockQueryResult = { data: [], error: null };

  /**
   * Configure le mock pour une table spécifique
   */
  forTable<T>(tableName: string, result: MockQueryResult<T>): this {
    this.tableMocks.set(tableName, createChainableMock(result));
    return this;
  }

  /**
   * Configure le mock pour un appel RPC
   */
  forRpc<T>(rpcName: string, result: MockQueryResult<T>): this {
    this.rpcMocks.set(rpcName, result);
    return this;
  }

  /**
   * Définit le résultat par défaut pour les tables non configurées
   */
  withDefaultResult(result: MockQueryResult): this {
    this.defaultResult = result;
    return this;
  }

  /**
   * Construit la fonction mock pour supabase.from()
   */
  buildFromMock(): Mock {
    return vi.fn((tableName: string) => {
      if (this.tableMocks.has(tableName)) {
        return this.tableMocks.get(tableName);
      }
      return createChainableMock(this.defaultResult);
    });
  }

  /**
   * Construit la fonction mock pour supabase.rpc()
   */
  buildRpcMock(): Mock {
    return vi.fn((rpcName: string) => {
      if (this.rpcMocks.has(rpcName)) {
        return Promise.resolve(this.rpcMocks.get(rpcName));
      }
      return Promise.resolve(this.defaultResult);
    });
  }

  /**
   * Construit un objet supabase mocké complet
   */
  build() {
    return {
      from: this.buildFromMock(),
      rpc: this.buildRpcMock(),
    };
  }
}

/**
 * Helper pour créer rapidement un mock Supabase simple
 */
export function createSimpleSupabaseMock<T>(data: T, error: { message: string } | null = null) {
  return new SupabaseMockBuilder()
    .withDefaultResult({ data, error })
    .build();
}
