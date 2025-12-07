import { NextResponse } from 'next/server'
import { createServerSupabase, bearerFrom } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

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

    let record: any = null
    let queryError: any = null
    const userSelect = 'id, firstname, lastname, email, status, color, code_gestionnaire, username, last_seen_at, email_smtp'

    // 1. D'abord, chercher via la table de mapping auth_user_mapping
    if (userId) {
      const { data: mapping } = await supabase
        .from('auth_user_mapping')
        .select('public_user_id')
        .eq('auth_user_id', userId)
        .maybeSingle()
      
      if (mapping?.public_user_id) {
        const byMapping = await supabase
          .from('users')
          .select(userSelect)
          .eq('id', mapping.public_user_id)
          .maybeSingle()
        record = byMapping.data
        queryError = byMapping.error
      }
    }

    // 2. Fallback: chercher par email si pas de mapping
    if ((!record || queryError) && userEmail) {
      const fallback = await supabase
        .from('users')
        .select(userSelect)
        .eq('email', userEmail)
        .maybeSingle()
      record = fallback.data
      queryError = fallback.error
      
      // Si trouvé par email et qu'on a un userId, créer le mapping pour la prochaine fois
      if (record && !queryError && userId) {
        await supabase
          .from('auth_user_mapping')
          .insert({ auth_user_id: userId, public_user_id: record.id })
          .single()
      }
    }

    if (queryError && queryError.code !== 'PGRST116') {
      return NextResponse.json({ error: queryError.message }, { status: 500 })
    }

    if (!record) return NextResponse.json({ user: null })

    let roles: string[] = []
    if (record.id) {
      const { data: roleRows, error: rolesError } = await supabase
        .from('user_roles')
        .select('roles(name)')
        .eq('user_id', record.id)

      if (!rolesError && Array.isArray(roleRows)) {
        roles = roleRows
          .map((entry: any) => entry?.roles?.name)
          .filter((name: unknown): name is string => typeof name === 'string')
      } else if (rolesError && rolesError.code !== 'PGRST116') {
        console.warn('[auth/me] Failed to load user roles', rolesError)
      }
    }

    let pagePermissions: Record<string, boolean> = {}
    if (record?.id) {
      const { data: permissionRows, error: permissionsError } = await supabase
        .from('user_page_permissions')
        .select('page_key, has_access')
        .eq('user_id', record.id)

      if (!permissionsError && Array.isArray(permissionRows)) {
        pagePermissions = permissionRows.reduce((acc: Record<string, boolean>, perm: any) => {
          if (perm?.page_key) {
            const key = String(perm.page_key).toLowerCase()
            acc[key] = perm.has_access !== false
          }
          return acc
        }, {})
      } else if (permissionsError && permissionsError.code !== 'PGRST116') {
        console.warn('[auth/me] Failed to load page permissions', permissionsError)
      }
    }

    const user = {
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
    return NextResponse.json({ user })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
