// ===== ERROR HANDLER =====
// Sécurise les messages d'erreur exposés dans les réponses API.
// En production, les détails internes (messages Supabase, stack traces)
// sont remplacés par un message générique ; le détail complet est loggé côté serveur.

const isDev = process.env.NODE_ENV !== "production";

/**
 * Retourne un message d'erreur sûr pour les réponses API / UI.
 *
 * - **dev** : message complet pour faciliter le debug
 * - **prod** : message générique « Erreur lors de {context} » + log serveur
 *
 * @param error   - L'erreur capturée (unknown)
 * @param context - Description courte de l'opération (ex. "la création du client")
 */
export function safeErrorMessage(error: unknown, context: string): string {
  const fullMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);

  if (isDev) {
    return fullMessage;
  }

  // Production : log complet côté serveur, message générique côté client
  console.error(`[safeErrorMessage] Erreur lors de ${context}:`, error);
  return `Erreur lors de ${context}`;
}
