"use client"

import { useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { createClient as createRealtimeOnlyClient } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase-client"
import {
  artisanKeys,
  documentKeys,
  interventionKeys,
} from "@/lib/react-query/queryKeys"

/**
 * Synchronisation instantanee de ce que l'artisan envoie depuis le portail.
 *
 * Les tables interventions et intervention_reminders sont deja ecoutees par le
 * canal central (src/lib/realtime/realtime-client.ts) : le badge « A verifier »
 * remonte donc deja seul, puisqu'il vient de interventions.has_portal_report,
 * pose par un trigger. Ce qui manquait, ce sont les trois tables ajoutees a la
 * publication par la migration 99077 :
 *
 * - intervention_attachments : les photos de chantier ;
 * - artisan_reports          : le rapport d'intervention et sa revue ;
 * - artisan_attachments      : les pieces du dossier de l'artisan.
 *
 * Canal dedie volontairement separe du canal central (fichier critique) :
 * meme motif que useUpdatesRealtime / useComptabiliteQuery.
 */

/** Fenetre de regroupement : un envoi de plusieurs photos ne fait qu'un toast. */
const REGROUPEMENT_MS = 600

/** Delais de reprise apres une fermeture de canal (ms). */
const REPRISES_MS = [2_000, 5_000, 10_000, 30_000]

/**
 * Connexion temps reel DEDIEE au portail.
 *
 * supabase-js partage une seule socket entre tous les canaux d'un meme client :
 * quand le canal central « crm-sync » se referme et se rabat sur du sondage, il
 * emporte les autres canaux de ce client. Une socket isolee garantit que les
 * photos et les rapports de l'artisan arrivent meme dans ce cas.
 */
function creerClientDedie() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const cle = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !cle) return null
  return createRealtimeOnlyClient(url, cle, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}

type Evenement = {
  interventionId?: string | null
  artisanId?: string | null
  message: string | null
}

export function usePortalLiveSync(enabled: boolean = true) {
  const queryClient = useQueryClient()
  const enAttente = useRef<Evenement[]>([])
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled) return

    /** Applique les invalidations et affiche au plus un toast par lot. */
    const vider = () => {
      minuteur.current = null
      const lot = enAttente.current
      enAttente.current = []
      if (lot.length === 0) return

      const interventions = new Set(
        lot.map((e) => e.interventionId).filter((id): id is string => Boolean(id))
      )
      const artisans = new Set(
        lot.map((e) => e.artisanId).filter((id): id is string => Boolean(id))
      )

      for (const id of interventions) {
        queryClient.invalidateQueries({ queryKey: interventionKeys.portalReport(id) })
        queryClient.invalidateQueries({ queryKey: documentKeys.byEntity("intervention", id) })
        queryClient.invalidateQueries({ queryKey: interventionKeys.detail(id) })
      }
      if (interventions.size > 0) {
        queryClient.invalidateQueries({ queryKey: interventionKeys.lists() })
        queryClient.invalidateQueries({ queryKey: interventionKeys.lightLists() })
      }
      for (const id of artisans) {
        queryClient.invalidateQueries({ queryKey: documentKeys.byEntity("artisan", id) })
        queryClient.invalidateQueries({ queryKey: artisanKeys.detail(id) })
      }

      const messages = lot.map((e) => e.message).filter((m): m is string => Boolean(m))
      if (messages.length === 1) {
        toast.info(messages[0])
      } else if (messages.length > 1) {
        const unique = Array.from(new Set(messages))
        toast.info(
          unique.length === 1
            ? `${messages.length} envois de l'artisan`
            : unique.join(" · ")
        )
      }
    }

    const empiler = (evenement: Evenement) => {
      enAttente.current.push(evenement)
      if (minuteur.current) return
      minuteur.current = setTimeout(vider, REGROUPEMENT_MS)
    }

    const ligne = (payload: { new?: unknown; old?: unknown }) => {
      const nouvelle = (payload.new ?? null) as Record<string, unknown> | null
      const ancienne = (payload.old ?? null) as Record<string, unknown> | null
      return (nouvelle && Object.keys(nouvelle).length > 0 ? nouvelle : ancienne) ?? null
    }

    /** Une piece jointe vient-elle du portail ? (metadata.source = 'portal') */
    const vientDuPortail = (row: Record<string, unknown> | null) => {
      if (!row) return false
      if (row.source === "portal") return true
      const metadata = row.metadata
      if (metadata && typeof metadata === "object") {
        return (metadata as Record<string, unknown>).source === "portal"
      }
      return false
    }

    const client = creerClientDedie()
    if (!client) return

    let canal: ReturnType<typeof client.channel> | null = null
    let reprise: ReturnType<typeof setTimeout> | null = null
    let essais = 0
    let arrete = false

    const abonner = () => {
      if (arrete || canal) return
      canal = client
      .channel("portail-live")
      // --- Photos de chantier envoyees par l'artisan ---
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "intervention_attachments" },
        (payload: { eventType?: string; new?: unknown; old?: unknown }) => {
          const row = ligne(payload)
          // Les depots faits par un gestionnaire dans le CRM sont deja geres
          // par le flux normal : on ne reagit qu'aux envois du portail.
          if (!vientDuPortail(row)) return
          const interventionId = (row?.intervention_id as string | undefined) ?? null
          empiler({
            interventionId,
            message:
              payload.eventType === "INSERT"
                ? "Nouvelle photo de l'artisan"
                : null,
          })
        }
      )
      // --- Rapport d'intervention ---
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "artisan_reports" },
        (payload: { eventType?: string; new?: unknown; old?: unknown }) => {
          const row = ligne(payload)
          const nouvelle = (payload.new ?? null) as Record<string, unknown> | null
          const ancienne = (payload.old ?? null) as Record<string, unknown> | null
          const soumis =
            payload.eventType === "INSERT"
              ? nouvelle?.status === "submitted"
              : nouvelle?.status === "submitted" && ancienne?.status !== "submitted"
          empiler({
            interventionId: (row?.intervention_id as string | undefined) ?? null,
            artisanId: (row?.artisan_id as string | undefined) ?? null,
            message: soumis ? "Rapport reçu de l'artisan" : null,
          })
        }
      )
      // --- Pieces du dossier de l'artisan ---
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "artisan_attachments" },
        (payload: { eventType?: string; new?: unknown; old?: unknown }) => {
          const row = ligne(payload)
          if (!vientDuPortail(row)) return
          empiler({
            artisanId: (row?.artisan_id as string | undefined) ?? null,
            message:
              payload.eventType === "INSERT"
                ? "Pièce reçue de l'artisan"
                : null,
          })
        }
      )
      .subscribe((status) => {
        // Meme convention de trace que le canal central (realtime-client.ts).
        console.log(`[Realtime] portail-live: ${status}`)
        if (status === "SUBSCRIBED") {
          essais = 0
          return
        }
        if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          // Reprise autonome : le canal du portail ne doit pas rester muet
          // parce que la connexion a ete coupee.
          const ancien = canal
          canal = null
          if (ancien) void client.removeChannel(ancien)
          if (arrete || reprise) return
          const attente = REPRISES_MS[Math.min(essais, REPRISES_MS.length - 1)]
          essais += 1
          reprise = setTimeout(() => {
            reprise = null
            abonner()
          }, attente)
        }
      })
    }

    // Le canal doit porter le jeton de l'utilisateur : c'est lui qui autorise
    // la lecture des evenements (les policies RLS sont appliquees par Realtime).
    let desinscription: (() => void) | null = null
    void supabase.auth.getSession().then(({ data }: { data: { session: { access_token?: string } | null } }) => {
      if (arrete) return
      if (data.session?.access_token) client.realtime.setAuth(data.session.access_token)
      abonner()
      const { data: ecoute } = supabase.auth.onAuthStateChange(
        (_evenement: string, session: { access_token?: string } | null) => {
          if (session?.access_token) client.realtime.setAuth(session.access_token)
        }
      )
      desinscription = () => ecoute.subscription.unsubscribe()
    })

    return () => {
      arrete = true
      if (minuteur.current) {
        clearTimeout(minuteur.current)
        minuteur.current = null
      }
      if (reprise) {
        clearTimeout(reprise)
        reprise = null
      }
      enAttente.current = []
      desinscription?.()
      if (canal) void client.removeChannel(canal)
      void client.realtime.disconnect()
    }
  }, [enabled, queryClient])
}
