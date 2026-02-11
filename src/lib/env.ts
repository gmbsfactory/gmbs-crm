// ===== CONFIGURATION D'ENVIRONNEMENT POUR NEXT.JS =====
// Compatible avec le côté client et serveur
// IMPORTANT: Ne contient QUE les variables publiques (NEXT_PUBLIC_*)
// Les variables sensibles (service-role key) sont dans env.server.ts

interface EnvConfig {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  NODE_ENV: string;
}

export const env: EnvConfig = {
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
  NODE_ENV: process.env.NODE_ENV || 'development',
};

export function logEnvironmentConfig() {
}

// Export par défaut
export default env;