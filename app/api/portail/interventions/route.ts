import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseAdmin } from "@/lib/supabase/server"

async function validateToken(token: string) {
  console.log("[portail/interventions] validateToken: Creating supabase client...")
  
  try {
    const supabase = createServerSupabaseAdmin()
    
    if (!supabase) {
      console.error("[portail/interventions] validateToken: supabase is NULL!")
      return null
    }
    
    console.log("[portail/interventions] validateToken: Querying artisan_portal_tokens...")
    
    // Validation directe sans RPC
    const { data: tokenData, error } = await supabase
      .from("artisan_portal_tokens")
      .select("artisan_id, expires_at")
      .eq("token", token)
      .eq("is_active", true)
      .single()

    console.log("[portail/interventions] validateToken result:", { 
      tokenData, 
      error: error ? { message: error.message, code: error.code, details: error.details, hint: error.hint } : null 
    })

    if (error || !tokenData) return null
    
    // Vérifier l'expiration
    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      console.log("[portail/interventions] validateToken: Token expired!")
      return null
    }

    return tokenData.artisan_id
  } catch (err: any) {
    console.error("[portail/interventions] validateToken EXCEPTION:", err?.message, err?.stack)
    return null
  }
}

function getServiceSupabase() {
  return createServerSupabaseAdmin()
}

/**
 * GET /api/portail/interventions
 * Récupère les interventions assignées à un artisan via son token portail
 */
export async function GET(request: NextRequest) {
  console.log("[portail/interventions] === START REQUEST ===")
  
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")
    console.log("[portail/interventions] Token received:", token ? token.substring(0, 20) + "..." : "null")

    if (!token) {
      return NextResponse.json({ error: "Token manquant" }, { status: 400 })
    }

    console.log("[portail/interventions] Validating token...")
    const artisanId = await validateToken(token)
    console.log("[portail/interventions] artisanId from token:", artisanId)
    
    if (!artisanId) {
      return NextResponse.json({ error: "Token invalide" }, { status: 401 })
    }

    const supabase = getServiceSupabase()
    if (!supabase) {
      return NextResponse.json({ error: "Configuration serveur incorrecte" }, { status: 500 })
    }

    // D'abord, vérifions que l'artisan existe
    const { data: artisanCheck, error: artisanCheckError } = await supabase
      .from("artisans")
      .select("id, nom, prenom, raison_sociale")
      .eq("id", artisanId)
      .single()
    
    console.log("[portail/interventions] Artisan check:", { artisan: artisanCheck, error: artisanCheckError })

    // Récupérer TOUTES les lignes de intervention_artisans pour debug
    const { data: allLinks, error: allLinksError } = await supabase
      .from("intervention_artisans")
      .select("artisan_id, intervention_id, role, is_primary")
      .limit(10)
    
    console.log("[portail/interventions] Sample of ALL intervention_artisans:", { 
      sample: allLinks,
      error: allLinksError 
    })

    // Récupérer les interventions où l'artisan est assigné
    console.log("[portail/interventions] Searching intervention_artisans for artisan_id:", artisanId)
    
    const { data: interventionLinks, error: linksError } = await supabase
      .from("intervention_artisans")
      .select("intervention_id, role, is_primary, artisan_id")
      .eq("artisan_id", artisanId)

    console.log("[portail/interventions] intervention_artisans result for this artisan:", { 
      count: interventionLinks?.length || 0, 
      links: interventionLinks,
      error: linksError 
    })

    if (linksError) {
      console.error("[portail/interventions] Erreur récupération liens:", linksError)
      return NextResponse.json({ error: "Erreur interne" }, { status: 500 })
    }

    if (!interventionLinks || interventionLinks.length === 0) {
      console.log("[portail/interventions] No interventions found for artisan:", artisanId)
      // Retournons aussi l'artisan_id pour debug côté client
      return NextResponse.json({ 
        interventions: [],
        debug: {
          artisanId,
          artisanName: artisanCheck ? `${artisanCheck.prenom} ${artisanCheck.nom}` : "Unknown"
        }
      })
    }

    const interventionIds = interventionLinks.map(link => link.intervention_id)

    // Récupérer les détails des interventions
    const { data: interventions, error: interventionsError } = await supabase
      .from("interventions")
      .select(`
        id,
        id_inter,
        contexte,
        adresse,
        ville,
        code_postal,
        date,
        due_date,
        consigne,
        statut_id,
        metier_id,
        is_active,
        status:intervention_statuses!statut_id(code, label, color),
        metier:metiers!metier_id(label)
      `)
      .in("id", interventionIds)
      .eq("is_active", true)
      .order("date", { ascending: false })

    if (interventionsError) {
      console.error("Erreur récupération interventions:", interventionsError)
      return NextResponse.json({ error: "Erreur interne" }, { status: 500 })
    }

    // Récupérer les photos pour chaque intervention
    const { data: photosCounts } = await supabase
      .from("intervention_attachments")
      .select("intervention_id")
      .in("intervention_id", interventionIds)
      .like("mime_type", "image/%")

    // Compter les photos par intervention
    const photosCountMap: Record<string, number> = {}
    photosCounts?.forEach(p => {
      photosCountMap[p.intervention_id] = (photosCountMap[p.intervention_id] || 0) + 1
    })

    // Transformer les données pour le front
    const transformedInterventions = (interventions || []).map(inter => ({
      id: inter.id,
      id_inter: inter.id_inter,
      context: inter.contexte,
      address: inter.adresse,
      city: inter.ville,
      postal_code: inter.code_postal,
      date: inter.date,
      due_date: inter.due_date,
      consigne: inter.consigne,
      status: inter.status,
      metier: inter.metier,
      hasReport: false, // TODO: vérifier si un rapport existe
      photoCount: photosCountMap[inter.id] || 0
    }))

    return NextResponse.json({ interventions: transformedInterventions })

  } catch (error: any) {
    console.error("[portail/interventions] === ERROR ===")
    console.error("[portail/interventions] Error name:", error?.name)
    console.error("[portail/interventions] Error message:", error?.message)
    console.error("[portail/interventions] Error code:", error?.code)
    console.error("[portail/interventions] Error details:", error?.details)
    console.error("[portail/interventions] Error hint:", error?.hint)
    console.error("[portail/interventions] Error stack:", error?.stack)
    console.error("[portail/interventions] Full error:", JSON.stringify(error, Object.getOwnPropertyNames(error)))
    return NextResponse.json({ 
      error: error?.message || "Erreur inconnue",
      details: error?.details || null,
      hint: error?.hint || null,
      code: error?.code || null
    }, { status: 500 })
  }
}
