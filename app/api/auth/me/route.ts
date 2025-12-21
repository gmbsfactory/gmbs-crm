import { NextResponse } from 'next/server'
import { createServerSupabase, bearerFrom } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

// Sélection optimisée avec jointures pour récupérer user + roles + permissions en une seule requête
const userSelectWithRelations = `
  id, firstname, lastname, email, status, color, 
  code_gestionnaire, username, last_seen_at, email_smtp,
  user_roles (
    roles (name)
  ),
  user_page_permissions (
    page_key, has_access
  )
`

interface UserRecord {
  id: string
  firstname: string | null
  lastname: string | null
  email: string | null
  status: string | null
  color: string | null
  code_gestionnaire: string | null
  username: string | null
  last_seen_at: string | null
  email_smtp: string | null
  user_roles?: Array<{ roles: { name: string } | null } | null>
  user_page_permissions?: Array<{ page_key: string; has_access: boolean }>
}

function extractRolesAndPermissions(record: UserRecord) {
  // Extraire les rôles depuis la jointure
  const roles: string[] = (record.user_roles || [])
    .map((entry) => entry?.roles?.name)
    .filter((name): name is string => typeof name === 'string')

  // Extraire les permissions depuis la jointure
  const pagePermissions: Record<string, boolean> = (record.user_page_permissions || [])
    .reduce((acc: Record<string, boolean>, perm) => {
      if (perm?.page_key) {
        const key = String(perm.page_key).toLowerCase()
        acc[key] = perm.has_access !== false
      }
      return acc
    }, {})

  return { roles, pagePermissions }
}

function buildUserResponse(record: UserRecord, roles: string[], pagePermissions: Record<string, boolean>) {
  return {
    id: record.id,
    firstname: record.firstname,
    lastname: record.lastname,
    prenom: record.firstname,
    name: record.lastname,
    email: record.email,
    status: record.status,
    color: record.color,
    code_gestionnaire: record.code_gestionnaire,
    surnom: record.code_gestionnaire,
    username: record.username,
    last_seen_at: record.last_seen_at,
    email_smtp: record.email_smtp || null,
    roles,
    page_permissions: pagePermissions,
  }
}

export async function GET(req: Request) {
  try {
    // Lire le token depuis le header Authorization OU depuis les cookies HTTP-only
    // Les cookies sont la source de vérité car ils sont isolés par navigateur/fenêtre
    // et ne peuvent pas être partagés entre différentes sessions comme localStorage
    let token = bearerFrom(req)
    
    // Si pas de token dans le header, lire depuis les cookies HTTP-only
    if (!token) {
      const cookieStore = await cookies()
      token = cookieStore.get('sb-access-token')?.value || null
    }
    
    if (!token) return NextResponse.json({ user: null })
    const supabase = createServerSupabase(token)

    const { data: authUser, error: authError } = await supabase.auth.getUser()
    if (authError) return NextResponse.json({ error: authError.message }, { status: 401 })
    const userId = authUser?.user?.id || null
    const userEmail = authUser?.user?.email || null

    let record: UserRecord | null = null
    let needsMapping = false

    // OPTIMISATION: Une seule requête avec jointure via auth_user_mapping -> users -> roles + permissions
    if (userId) {
      const { data: mappingResult, error: mappingError } = await supabase
        .from('auth_user_mapping')
        .select(`
          public_user_id,
          users (${userSelectWithRelations})
        `)
        .eq('auth_user_id', userId)
        .maybeSingle()

      if (!mappingError && mappingResult?.users) {
        // Cast nécessaire car Supabase retourne un objet unique, pas un array
        record = mappingResult.users as unknown as UserRecord
      }
    }

    // Fallback: chercher par email si pas de mapping (une seule requête avec jointures)
    if (!record && userEmail) {
      const { data: fallbackResult, error: fallbackError } = await supabase
        .from('users')
        .select(userSelectWithRelations)
        .eq('email', userEmail)
        .maybeSingle()

      if (!fallbackError && fallbackResult) {
        record = fallbackResult as unknown as UserRecord
        needsMapping = true
      } else if (fallbackError && fallbackError.code !== 'PGRST116') {
        return NextResponse.json({ error: fallbackError.message }, { status: 500 })
      }
    }

    if (!record) return NextResponse.json({ user: null })

    // Créer le mapping en arrière-plan si nécessaire (non-bloquant)
    if (needsMapping && userId) {
      void (async () => {
        try {
          await supabase
            .from('auth_user_mapping')
            .insert({ auth_user_id: userId, public_user_id: record.id })
        } catch {
          // Ignore les erreurs silencieusement
        }
      })()
    }

    const { roles, pagePermissions } = extractRolesAndPermissions(record)
    const user = buildUserResponse(record, roles, pagePermissions)
    
    return NextResponse.json({ user })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
