import { NextResponse } from "next/server"
import { requirePermission, isPermissionError } from "@/lib/api/permissions"
import { createClient } from "@supabase/supabase-js"

type Params = {
  params: Promise<{
    id: string
  }>
}

// Créer un client Supabase admin inline pour cette route
function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !serviceKey) {
    console.error("[assign] Missing env vars:", { 
      hasUrl: !!supabaseUrl, 
      hasKey: !!serviceKey 
    })
    return null
  }
  
  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    }
  })
}

export async function POST(request: Request, { params }: Params) {
  try {
    
    const permCheck = await requirePermission(request, "write_interventions")
    if (isPermissionError(permCheck)) return permCheck.error

    const { id } = await params
    
    // requirePermission a déjà vérifié l'authentification et retourne l'ID utilisateur public
    const userId = permCheck.user.id
    
    if (!userId) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 401 })
    }

    const supabaseAdmin = getAdminClient()
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Configuration serveur manquante (env vars)" }, { status: 500 })
    }

    // Mettre à jour l'intervention avec l'utilisateur assigné directement via le client admin
    const { data: updated, error } = await supabaseAdmin
      .from("interventions")
      .update({
        assigned_user_id: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(`
        id,
        id_inter,
        assigned_user_id,
        statut_id,
        status:intervention_statuses(id, code, label, color, sort_order)
      `)
      .single()

    if (error) {
      console.error("[assign] Erreur Supabase:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    if (!updated) {
      return NextResponse.json({ error: "Intervention non trouvée" }, { status: 404 })
    }
    
    return NextResponse.json({ intervention: updated, id_inter: updated.id_inter })
  } catch (error) {
    console.error("[assign] Erreur:", error)
    const message = error instanceof Error ? error.message : "Erreur lors de l'assignation"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
