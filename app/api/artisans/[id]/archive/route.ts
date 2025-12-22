import { NextResponse } from "next/server"
import { artisansApi, commentsApi } from "@/lib/api/v2"
import { createServerSupabase, bearerFrom } from "@/lib/supabase/server"
import { referenceApi } from "@/lib/reference-api"
import { cookies } from "next/headers"
import { requirePermission, isPermissionError } from "@/lib/api/permissions"

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

    // Récupérer les statuts d'artisan pour trouver le statut ARCHIVE
    const refs = await referenceApi.getAll()
    const archiveStatus = refs.artisanStatuses.find(
      (s: any) => s.code === "ARCHIVE" || s.code === "ARCHIVER"
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
