import { NextResponse } from 'next/server'
import { createServerSupabase, bearerFrom } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

// Sélection de base sans jointures pour éviter les erreurs
const userSelectBasic = `
  id, firstname, lastname, email, status, color, 
  code_gestionnaire, username, last_seen_at, email_smtp, avatar_url
`

// Sélection optimisée avec jointures pour récupérer user + roles + permissions en une seule requête
const userSelectWithRelations = `
  id, firstname, lastname, email, status, color, 
  code_gestionnaire, username, last_seen_at, email_smtp, avatar_url,
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
  avatar_url: string | null
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
    avatar_url: record.avatar_url || null,
    roles,
    page_permissions: pagePermissions,
  }
}

export async function GET(req: Request) {
  try {
    // Lire le token depuis le header Authorization OU depuis les cookies HTTP-only
    let token = bearerFrom(req)
    
    if (!token) {
      const cookieStore = await cookies()
      token = cookieStore.get('sb-access-token')?.value || null
    }
    
    if (!token) {
      return NextResponse.json({ user: null })
    }
    
    const supabase = createServerSupabase(token)

    const { data: authUser, error: authError } = await supabase.auth.getUser()
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 401 })
    }
    
    const userId = authUser?.user?.id || null
    const userEmail = authUser?.user?.email || null

    if (!userId && !userEmail) {
      return NextResponse.json({ user: null })
    }

    let record: UserRecord | null = null
    let needsMapping = false
    let roles: string[] = []
    let pagePermissions: Record<string, boolean> = {}

    // OPTIMISATION: Une seule requête avec jointure via auth_user_mapping -> users -> roles + permissions
    if (userId) {
      try {
        const { data: mappingResult, error: mappingError } = await supabase
          .from('auth_user_mapping')
          .select(`
            public_user_id,
            users (${userSelectWithRelations})
          `)
          .eq('auth_user_id', userId)
          .maybeSingle()

        if (mappingError) {
          // Si la table n'existe pas (PGRST205), ignorer et continuer avec le fallback
          if (mappingError.code === 'PGRST205') {
            // Continuer avec le fallback par email
          }
          // Si erreur de jointure, essayer sans jointures
          else if (mappingError.code === 'PGRST301' || mappingError.message?.includes('relation') || mappingError.message?.includes('column')) {
            const { data: mappingResultBasic, error: mappingErrorBasic } = await supabase
              .from('auth_user_mapping')
              .select(`
                public_user_id,
                users (${userSelectBasic})
              `)
              .eq('auth_user_id', userId)
              .maybeSingle()
            
            if (!mappingErrorBasic && mappingResultBasic?.users) {
              record = mappingResultBasic.users as unknown as UserRecord
            }
          }
        } else if (mappingResult?.users) {
          record = mappingResult.users as unknown as UserRecord
        }
      } catch (e: any) {
        // Ignorer les erreurs de mapping et continuer avec le fallback
      }
    }

    // Fallback: chercher par email si pas de mapping
    if (!record && userEmail) {
      try {
        // Essayer d'abord avec les jointures
        const { data: fallbackResult, error: fallbackError } = await supabase
          .from('users')
          .select(userSelectWithRelations)
          .eq('email', userEmail)
          .maybeSingle()

        if (fallbackError) {
          // Si erreur de jointure, essayer sans jointures
          if (fallbackError.code === 'PGRST301' || fallbackError.message?.includes('relation') || fallbackError.message?.includes('column')) {
            const { data: fallbackResultBasic, error: fallbackErrorBasic } = await supabase
              .from('users')
              .select(userSelectBasic)
              .eq('email', userEmail)
              .maybeSingle()
            
            if (!fallbackErrorBasic && fallbackResultBasic) {
              record = fallbackResultBasic as unknown as UserRecord
              needsMapping = true
            } else if (fallbackErrorBasic && fallbackErrorBasic.code !== 'PGRST116') {
              return NextResponse.json({ 
                error: fallbackErrorBasic.message,
                code: fallbackErrorBasic.code 
              }, { status: 500 })
            }
          } else if (fallbackError.code !== 'PGRST116') {
            return NextResponse.json({ 
              error: fallbackError.message,
              code: fallbackError.code 
            }, { status: 500 })
          }
        } else if (fallbackResult) {
          record = fallbackResult as unknown as UserRecord
          needsMapping = true
        }
      } catch (e: any) {
        return NextResponse.json({ 
          error: e?.message || 'Unexpected error in fallback query' 
        }, { status: 500 })
      }
    }

    if (!record) {
      console.log('[auth/me] User not found')
      return NextResponse.json({ user: null })
    }

    // Si on a récupéré les données avec les jointures, extraire les rôles et permissions
    if (record.user_roles || record.user_page_permissions) {
      const extracted = extractRolesAndPermissions(record)
      roles = extracted.roles
      pagePermissions = extracted.pagePermissions
    } else {
      // Sinon, récupérer les rôles et permissions séparément
      try {
        if (record.id) {
          // Récupérer les rôles
          const { data: rolesData, error: rolesError } = await supabase
            .from('user_roles')
            .select('roles (name)')
            .eq('user_id', record.id)
          
          if (!rolesError && rolesData) {
            roles = rolesData
              .map((entry: any) => entry?.roles?.name)
              .filter((name: any): name is string => typeof name === 'string')
          }

          // Récupérer les permissions
          const { data: permsData, error: permsError } = await supabase
            .from('user_page_permissions')
            .select('page_key, has_access')
            .eq('user_id', record.id)
          
          if (permsError) {
            console.error('[auth/me] Error fetching permissions:', permsError.message)
          } else if (permsData) {
            pagePermissions = permsData.reduce((acc: Record<string, boolean>, perm: any) => {
              if (perm?.page_key) {
                const key = String(perm.page_key).toLowerCase()
                acc[key] = perm.has_access !== false
              }
              return acc
            }, {})
          }
        }
      } catch (e: any) {
        // Continuer avec des rôles et permissions vides plutôt que d'échouer
      }
    }

    // Créer le mapping en arrière-plan si nécessaire (non-bloquant)
    if (needsMapping && userId) {
      void (async () => {
        try {
          await supabase
            .from('auth_user_mapping')
            .insert({ auth_user_id: userId, public_user_id: record.id })
        } catch (e: any) {
          console.error('[auth/me] Error creating mapping:', e?.message)
        }
      })()
    }

    const user = buildUserResponse(record, roles, pagePermissions)
    
    return NextResponse.json({ user })
  } catch (e: any) {
    return NextResponse.json({ 
      error: e?.message || 'Unexpected error',
      details: process.env.NODE_ENV === 'development' ? e?.stack : undefined
    }, { status: 500 })
  }
}
