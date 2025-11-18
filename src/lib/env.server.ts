// ===== CONFIGURATION D'ENVIRONNEMENT SERVEUR UNIQUEMENT =====
// Ce fichier ne doit JAMAIS être importé côté client
// Il contient uniquement les variables d'environnement sensibles côté serveur

interface ServerEnvConfig {
  SUPABASE_SERVICE_ROLE_KEY: string;
}

/**
 * Configuration d'environnement côté serveur uniquement
 * IMPORTANT: Ne jamais importer ce fichier dans du code client
 * Utiliser uniquement dans les routes API, middleware, SSR, etc.
 */
export const serverEnv: ServerEnvConfig = {
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
};

// Vérification en développement
if (process.env.NODE_ENV !== 'production' && !serverEnv.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    '[env.server] ⚠️ SUPABASE_SERVICE_ROLE_KEY n\'est pas définie. ' +
    'Certaines fonctionnalités admin peuvent ne pas fonctionner.'
  );
}

// Export par défaut
export default serverEnv;






