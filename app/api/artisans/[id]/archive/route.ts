import { NextResponse } from "next/server"
import { artisansApi, commentsApi } from "@/lib/api"
import { createSSRServerClient } from "@/lib/supabase/server-ssr"
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

    // Récupérer le statut ARCHIVE via le client SSR AUTHENTIFIÉ (rôle `authenticated`).
    // NE PAS passer par referenceApi/artisanStatusesApi ici : côté serveur, ce client
    // singleton n'a pas de session → rôle `anon`, et la RLS de `artisan_statuses`
    // renvoie 0 ligne → le statut ARCHIVE devient introuvable (faux 500).
    const { data: archiveStatus, error: archiveStatusError } = await supabase
      .from("artisan_statuses")
      .select("id")
      .eq("code", "ARCHIVE")
      .eq("is_active", true)
      .single()

    if (archiveStatusError || !archiveStatus) {
      return NextResponse.json({ error: "Statut d'archivage introuvable" }, { status: 500 })
    }

    // Mettre à jour le statut de l'artisan.
    // On ne touche PAS `is_active` : archiver = passer au statut ARCHIVE (is_active reste true),
    // identique au chemin d'édition via formulaire (Edge Function). `is_active=false` est
    // réservé au soft-delete. Voir artisan-is-active-vs-archive.
    const updated = await artisansApi.update(id, {
      statut_id: archiveStatus.id,
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
