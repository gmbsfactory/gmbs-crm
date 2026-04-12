import { NextResponse } from "next/server"
import { requirePermission, isPermissionError } from "@/lib/auth/permissions"
import { createServerSupabaseAdmin } from "@/lib/supabase/server"

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

    // requirePermission a déjà vérifié l'authentification et retourne l'ID utilisateur public
    const userId = permCheck.user.id

    if (!userId) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 401 })
    }

    const supabaseAdmin = createServerSupabaseAdmin()

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
