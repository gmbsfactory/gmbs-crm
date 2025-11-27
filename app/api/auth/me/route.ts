import { NextResponse } from 'next/server'
import { createServerSupabase, bearerFrom } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  try {
    let token = bearerFrom(req)
    
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

    if (userId) {
      const byId = await supabase
        .from('users')
        .select('id, firstname, lastname, email, status, color, code_gestionnaire, username, last_seen_at, email_smtp')
        .eq('id', userId)
        .maybeSingle()
      record = byId.data
      queryError = byId.error
    }

    if ((!record || queryError) && userEmail) {
      const fallback = await supabase
        .from('users')
        .select('id, firstname, lastname, email, status, color, code_gestionnaire, username, last_seen_at, email_smtp')
        .eq('email', userEmail)
        .maybeSingle()
      record = fallback.data
      queryError = fallback.error
    }

    if (queryError && queryError.code !== 'PGRST116') {
      return NextResponse.json({ error: queryError.message }, { status: 500 })
    }

    if (!record) return NextResponse.json({ user: null })

    // Récupérer les rôles avec protection d'erreur
    let roles: string[] = []
    if (record.id) {
      try {
        const { data: roleRows, error: rolesError } = await supabase
          .from('user_roles')
          .select('roles(name)')
          .eq('user_id', record.id)

        if (!rolesError && Array.isArray(roleRows)) {
          roles = roleRows
            .map((entry: any) => entry?.roles?.name)
            .filter((name: unknown): name is string => typeof name === 'string')
        }
      } catch (rolesException: any) {
        // Si erreur, on continue sans les rôles plutôt que de faire échouer toute la requête
        console.error('[auth/me] Erreur lors du chargement des rôles:', rolesException)
        roles = []
      }
    }

    const user = {
      id: record.id,
      firstname: record.firstname || null,
      lastname: record.lastname || null,
      prenom: record.firstname || null,
      name: record.lastname || null,
      email: record.email || null,
      status: record.status || null,
      color: record.color || null,
      code_gestionnaire: record.code_gestionnaire || null,
      surnom: record.code_gestionnaire || null,
      username: record.username || null,
      last_seen_at: record.last_seen_at || null,
      email_smtp: record.email_smtp || null,
      roles,
    }
    return NextResponse.json({ user })
  } catch (e: any) {
    console.error('[auth/me] Erreur inattendue:', e)
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
