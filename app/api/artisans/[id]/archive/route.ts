import { NextResponse } from "next/server"
import { artisansApi, commentsApi } from "@/lib/api/v2"
import { createSSRServerClient } from "@/lib/supabase/server-ssr"
import { referenceApi } from "@/lib/reference-api"
import { requirePermission, isPermissionError } from "@/lib/auth/permissions"

type Params = {
  params: Promise<{
    id: string
  }>
}

type ArchiveBody = {
  reason: string
}

export async function POST(request: Request, { params }: Params) {
  try {
    const permCheck = await requirePermission(request, "write_artisans")
    if (isPermissionError(permCheck)) return permCheck.error

    const { id } = await params
    const body: ArchiveBody = await request.json()
    
    if (!body.reason || !body.reason.trim()) {
      return NextResponse.json({ error: "Le motif d'archivage est requis" }, { status: 400 })
    }
    
    // @supabase/ssr lit automatiquement les cookies de session
    const supabase = await createSSRServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié. Veuillez vous reconnecter." }, { status: 401 })
    }

    // Récupérer les statuts d'artisan pour trouver le statut ARCHIVE
    const refs = await referenceApi.getAll()
    const archiveStatus = refs.artisanStatuses.find(
      (s: any) => s.code === "ARCHIVE"
    )
    
    if (!archiveStatus) {
      return NextResponse.json({ error: "Statut d'archivage introuvable" }, { status: 500 })
    }

    // Mettre à jour le statut de l'artisan
    const updated = await artisansApi.update(id, {
      statut_id: archiveStatus.id,
      is_active: false,
    })

    // Créer un commentaire avec le motif d'archivage
    await commentsApi.create({
      entity_id: id,
      entity_type: "artisan",
      content: body.reason.trim(),
      comment_type: "system",
      author_id: user.id,
      is_internal: true,
    })
    
    return NextResponse.json({ artisan: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur lors de l'archivage"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
