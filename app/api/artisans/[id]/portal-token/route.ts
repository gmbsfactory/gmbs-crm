import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseAdmin } from "@/lib/supabase/server"
import { requirePermission, isPermissionError } from "@/lib/api/permissions"

/**
 * POST /api/artisans/[id]/portal-token
 * Génère un nouveau token d'accès au portail pour un artisan
 * Seuls les utilisateurs authentifiés du CRM avec permission write_artisans peuvent générer des tokens
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: artisanId } = await params

    // Vérifier l'authentification et les permissions
    const permCheck = await requirePermission(request, "write_artisans")
    if (isPermissionError(permCheck)) {
      return permCheck.error
    }

    const { user } = permCheck
    
    // Utiliser le client admin pour les opérations
    const supabaseAdmin = createServerSupabaseAdmin()
    
    if (!supabaseAdmin) {
      console.error("[portal-token] supabaseAdmin is null - check SUPABASE_SERVICE_ROLE_KEY env var")
      return NextResponse.json(
        { error: "Configuration serveur incorrecte" },
        { status: 500 }
      )
    }

    // Vérifier que l'artisan existe
    const { data: artisan, error: artisanError } = await supabaseAdmin
      .from("artisans")
      .select("id, prenom, nom, raison_sociale")
      .eq("id", artisanId)
      .single()

    if (artisanError || !artisan) {
      return NextResponse.json(
        { error: "Artisan introuvable" },
        { status: 404 }
      )
    }

    // Générer le token directement (sans RPC pour éviter les problèmes de schema cache)
    console.log("[portal-token] Generating token for artisan:", artisanId)
    
    // 1. Générer un token unique
    const newToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
    const expiresAt = new Date()
    expiresAt.setFullYear(expiresAt.getFullYear() + 1) // Expire dans 1 an
    
    // 2. Désactiver les anciens tokens actifs pour cet artisan
    const { error: deactivateError } = await supabaseAdmin
      .from("artisan_portal_tokens")
      .update({ is_active: false })
      .eq("artisan_id", artisanId)
      .eq("is_active", true)
    
    if (deactivateError) {
      console.error("[portal-token] Erreur désactivation anciens tokens:", deactivateError)
      // On continue quand même, ce n'est pas bloquant
    }
    
    // 3. Insérer le nouveau token
    const { data: insertedToken, error: insertError } = await supabaseAdmin
      .from("artisan_portal_tokens")
      .insert({
        artisan_id: artisanId,
        token: newToken,
        expires_at: expiresAt.toISOString(),
        is_active: true
      })
      .select("token, expires_at")
      .single()

    if (insertError) {
      console.error("[portal-token] Erreur insertion token:", insertError)
      return NextResponse.json(
        { error: `Erreur lors de la génération du token: ${insertError.message}` },
        { status: 500 }
      )
    }
    
    console.log("[portal-token] Token created:", insertedToken)

    const tokenResult = insertedToken

    // Construire l'URL du portail
    // Utiliser NEXT_PUBLIC_PORTAL_URL si défini, sinon NEXT_PUBLIC_APP_URL, sinon l'origin de la requête
    const baseUrl = process.env.NEXT_PUBLIC_PORTAL_URL || process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
    const portalUrl = `${baseUrl}/portail/${tokenResult.token}`

    return NextResponse.json({
      success: true,
      token: tokenResult.token,
      portalUrl,
      expiresAt: tokenResult.expires_at,
      artisan: {
        id: artisan.id,
        displayName: artisan.raison_sociale || 
          [artisan.prenom, artisan.nom].filter(Boolean).join(" ") ||
          "Artisan"
      }
    })

  } catch (error: any) {
    console.error("Erreur génération token portail:", error)
    return NextResponse.json(
      { error: error.message || "Erreur interne" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/artisans/[id]/portal-token
 * Récupère le token actif existant pour un artisan (si existe)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: artisanId } = await params

    // Vérifier l'authentification et les permissions (lecture seule ok)
    const permCheck = await requirePermission(request, "read_artisans")
    if (isPermissionError(permCheck)) {
      return permCheck.error
    }

    // Utiliser le client admin pour les opérations
    const supabaseAdmin = createServerSupabaseAdmin()
    
    if (!supabaseAdmin) {
      console.error("[portal-token] supabaseAdmin is null - check SUPABASE_SERVICE_ROLE_KEY env var")
      return NextResponse.json(
        { error: "Configuration serveur incorrecte" },
        { status: 500 }
      )
    }

    // Récupérer le token actif pour cet artisan
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from("artisan_portal_tokens")
      .select("token, expires_at, created_at, last_accessed_at")
      .eq("artisan_id", artisanId)
      .eq("is_active", true)
      .gt("expires_at", new Date().toISOString())
      .single()

    if (tokenError && tokenError.code !== "PGRST116") {
      // PGRST116 = no rows returned (pas une erreur)
      console.error("Erreur récupération token:", tokenError)
      return NextResponse.json(
        { error: "Erreur lors de la récupération du token" },
        { status: 500 }
      )
    }

    if (!tokenData) {
      return NextResponse.json({
        exists: false,
        token: null,
        portalUrl: null
      })
    }

    // Utiliser NEXT_PUBLIC_PORTAL_URL si défini, sinon NEXT_PUBLIC_APP_URL, sinon l'origin de la requête
    const baseUrl = process.env.NEXT_PUBLIC_PORTAL_URL || process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
    const portalUrl = `${baseUrl}/portail/${tokenData.token}`

    return NextResponse.json({
      exists: true,
      token: tokenData.token,
      portalUrl,
      expiresAt: tokenData.expires_at,
      createdAt: tokenData.created_at,
      lastAccessedAt: tokenData.last_accessed_at
    })

  } catch (error: any) {
    console.error("Erreur récupération token portail:", error)
    return NextResponse.json(
      { error: error.message || "Erreur interne" },
      { status: 500 }
    )
  }
}
