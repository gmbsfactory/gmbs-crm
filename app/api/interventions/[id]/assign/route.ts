import { NextResponse } from "next/server"
import { interventionsApi } from "@/lib/api/v2"
import { createServerSupabase, bearerFrom } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { requirePermission, isPermissionError } from "@/lib/api/permissions"

type Params = {
  params: Promise<{
    id: string
  }>
}

export async function POST(request: Request, { params }: Params) {
  try {
    const permCheck = await requirePermission(request, "write_interventions")
    if (isPermissionError(permCheck)) return permCheck.error

    const { id } = await params
    
    // Récupérer le token depuis les headers ou les cookies
    let token = bearerFrom(request)
    if (!token) {
      const cookieStore = await cookies()
      token = cookieStore.get('sb-access-token')?.value || null
    }
    
    if (!token) {
      return NextResponse.json({ error: "Non authentifié. Veuillez vous connecter." }, { status: 401 })
    }
    
    // Récupérer l'utilisateur connecté avec le token
    const supabase = createServerSupabase(token)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié. Veuillez vous reconnecter." }, { status: 401 })
    }

    // Mettre à jour l'intervention avec l'utilisateur assigné
    const updated = await interventionsApi.update(id, {
      assigned_user_id: user.id,
    })
    
    return NextResponse.json({ intervention: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur lors de l'assignation"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
