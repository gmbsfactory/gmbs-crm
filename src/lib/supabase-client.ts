import { createClient } from '@/lib/supabase/client'

// Re-export pour compatibilité avec les 38+ fichiers qui importent { supabase } depuis ce fichier
// Le client utilise maintenant @supabase/ssr (cookies) au lieu de localStorage
export const supabase = createClient()
