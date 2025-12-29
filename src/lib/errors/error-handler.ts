/**
 * Système centralisé de gestion d'erreurs
 * Remplace le pattern répété: catch (error) { console.error(error); return null; }
 * 
 * Usage:
 *   try {
 *     const result = await someOperation();
 *     return result;
 *   } catch (error) {
 *     return ErrorHandler.handle(error, {
 *       context: 'operationName',
 *       operation: 'someOperation',
 *       fallback: null, // ou une valeur par défaut
 *       propagate: false // si true, re-lance l'erreur après logging
 *     });
 *   }
 */

export interface ErrorContext {
  /** Contexte de l'opération (ex: 'interventionsApi.getAll') */
  context: string;
  /** Nom de l'opération (ex: 'getAll') */
  operation?: string;
  /** Valeur de fallback à retourner si propagate = false */
  fallback?: any;
  /** Si true, re-lance l'erreur après logging */
  propagate?: boolean;
  /** Données additionnelles pour le logging */
  metadata?: Record<string, any>;
  /** Niveau de sévérité */
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly statusCode?: number,
    public readonly context?: string,
    public readonly metadata?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
    // Maintient le stack trace correct
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

export class ErrorHandler {
  /**
   * Gère une erreur de manière centralisée
   * @param error - L'erreur à gérer
   * @param options - Options de gestion
   * @returns La valeur de fallback ou lance l'erreur si propagate = true
   */
  static handle<T = any>(error: unknown, options: ErrorContext): T {
    const {
      context,
      operation,
      fallback,
      propagate = false,
      metadata = {},
      severity = 'medium',
    } = options;

    // Construire le message de log
    const operationLabel = operation ? `${context}.${operation}` : context;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Log structuré selon la sévérité
    const logData = {
      context: operationLabel,
      error: {
        name: errorName,
        message: errorMessage,
        ...(errorStack && { stack: errorStack }),
        ...(error instanceof AppError && {
          code: error.code,
          statusCode: error.statusCode,
          metadata: error.metadata,
        }),
      },
      metadata,
      timestamp: new Date().toISOString(),
      severity,
    };

    // Logging selon la sévérité
    switch (severity) {
      case 'critical':
        console.error(`[CRITICAL] ${operationLabel}:`, logData);
        // En production, on pourrait envoyer à un service de monitoring (Sentry, etc.)
        break;
      case 'high':
        console.error(`[ERROR] ${operationLabel}:`, logData);
        break;
      case 'medium':
        console.warn(`[WARN] ${operationLabel}:`, logData);
        break;
      case 'low':
        console.info(`[INFO] ${operationLabel}:`, logData);
        break;
    }

    // Si propagate = true, re-lancer l'erreur
    if (propagate) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        errorMessage,
        error instanceof AppError ? error.code : 'UNKNOWN_ERROR',
        error instanceof AppError ? error.statusCode : 500,
        operationLabel,
        { ...metadata, originalError: error }
      );
    }

    // Retourner la valeur de fallback
    return fallback as T;
  }

  /**
   * Crée une erreur applicative typée
   */
  static create(
    message: string,
    code?: string,
    statusCode?: number,
    metadata?: Record<string, any>
  ): AppError {
    return new AppError(message, code, statusCode, undefined, metadata);
  }

  /**
   * Wrapper pour les fonctions async qui gère automatiquement les erreurs
   * @example
   * const safeGetAll = ErrorHandler.wrap(interventionsApi.getAll, {
   *   context: 'interventionsApi',
   *   operation: 'getAll',
   *   fallback: []
   * });
   */
  static wrap<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options: Omit<ErrorContext, 'metadata'>
  ): T {
    return (async (...args: Parameters<T>) => {
      try {
        return await fn(...args);
      } catch (error) {
        return ErrorHandler.handle(error, options);
      }
    }) as T;
  }

  /**
   * Wrapper pour les fonctions sync qui gère automatiquement les erreurs
   */
  static wrapSync<T extends (...args: any[]) => any>(
    fn: T,
    options: Omit<ErrorContext, 'metadata'>
  ): T {
    return ((...args: Parameters<T>) => {
      try {
        return fn(...args);
      } catch (error) {
        return ErrorHandler.handle(error, options);
      }
    }) as T;
  }
}

/**
 * Helpers pour créer des erreurs typées
 */
export const Errors = {
  notFound: (resource: string, id?: string) =>
    ErrorHandler.create(
      `${resource}${id ? ` avec l'ID ${id}` : ''} introuvable`,
      'NOT_FOUND',
      404
    ),
  unauthorized: (message = 'Non autorisé') =>
    ErrorHandler.create(message, 'UNAUTHORIZED', 401),
  forbidden: (message = 'Accès interdit') =>
    ErrorHandler.create(message, 'FORBIDDEN', 403),
  badRequest: (message = 'Requête invalide') =>
    ErrorHandler.create(message, 'BAD_REQUEST', 400),
  internal: (message = 'Erreur interne du serveur') =>
    ErrorHandler.create(message, 'INTERNAL_ERROR', 500),
  validation: (message: string, fields?: Record<string, string>) =>
    ErrorHandler.create(message, 'VALIDATION_ERROR', 400, { fields }),
};

