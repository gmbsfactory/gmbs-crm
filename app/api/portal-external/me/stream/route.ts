import { authenticatePortalRequest } from '@/lib/portal-external/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Battement de coeur : tient la connexion ouverte a travers les proxys. */
const PING_MS = 25_000

/** Duree de vie maximale d'un flux ; le client se reconnecte ensuite. */
const DUREE_MAX_MS = 30 * 60 * 1000

/**
 * GET /api/portal-external/me/stream
 *
 * Flux d'evenements (Server-Sent Events) destine a l'application de l'artisan :
 * des que le gestionnaire valide ou refuse un rapport, valide une piece,
 * replanifie, annule ou (des)affecte une intervention, l'application est
 * prevenue sans que l'artisan rafraichisse.
 *
 * Le portail n'a pas de base de donnees : c'est donc le CRM qui pousse. Il
 * s'abonne cote serveur au temps reel de sa propre base (clef service role) et
 * ne relaie que des evenements minimaux, sans aucune donnee de tiers.
 *
 * Authentification : identique aux autres routes portal-external
 * (X-GMBS-Key-Id + X-GMBS-Secret + X-Portal-Token).
 *
 * Evenements emis : ready, report, document, intervention, assignment,
 * price, work, payment, ping.
 *
 * Les evenements de l'affectation sont NOMMES plutot que fondus dans un seul
 * « assignment » : l'application incremente une revision globale a chaque
 * evenement recu et rejoue toutes ses requetes montees. Un prix accepte, un
 * chantier demarre et un paiement saisi n'ont pas la meme urgence, et
 * intervention_artisans est deja publiee en REPLICA IDENTITY FULL — le
 * diff des colonnes ne coute donc aucune requete supplementaire.
 */
export async function GET(request: Request) {
  const auth = await authenticatePortalRequest(request)
  if (!auth.ok) return auth.response
  const { artisan, supabase } = auth

  // Interventions visibles par cet artisan : le filtre serveur de Supabase ne
  // sait pas suivre une jointure, on garde donc la liste en memoire et on la
  // rafraichit a chaque changement d'affectation.
  let interventionIds = new Set<string>()
  const chargerAffectations = async () => {
    const { data } = await supabase
      .from('intervention_artisans')
      .select('intervention_id')
      .eq('artisan_id', artisan.id)
    interventionIds = new Set(
      (data ?? [])
        .map((row) => (row as { intervention_id: string | null }).intervention_id)
        .filter((id): id is string => Boolean(id))
    )
  }
  await chargerAffectations()

  const encoder = new TextEncoder()
  let ping: ReturnType<typeof setInterval> | null = null
  let arret: ReturnType<typeof setTimeout> | null = null
  let ferme = false

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const channel = supabase.channel(`portail-artisan-${artisan.id}`)

      const envoyer = (evenement: string, donnees: Record<string, unknown>) => {
        if (ferme) return
        try {
          controller.enqueue(
            encoder.encode(`event: ${evenement}\ndata: ${JSON.stringify(donnees)}\n\n`)
          )
        } catch {
          // Client parti entre-temps : la fermeture est geree par 'abort'.
        }
      }

      const fermer = () => {
        if (ferme) return
        ferme = true
        if (ping) clearInterval(ping)
        if (arret) clearTimeout(arret)
        ping = null
        arret = null
        void supabase.removeChannel(channel)
        try {
          controller.close()
        } catch {
          // Deja ferme.
        }
      }

      request.signal.addEventListener('abort', fermer)

      channel
        // --- Rapport valide ou refuse par le gestionnaire ---
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'artisan_reports',
            filter: `artisan_id=eq.${artisan.id}`,
          },
          (payload) => {
            const row = (payload.new ?? payload.old ?? {}) as Record<string, unknown>
            envoyer('report', {
              intervention_id: row.intervention_id ?? null,
              status: row.status ?? null,
              version: row.version ?? null,
              review_comment: row.review_comment ?? null,
            })
          }
        )
        // --- Piece du dossier verifiee ---
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'artisan_attachments',
            filter: `artisan_id=eq.${artisan.id}`,
          },
          (payload) => {
            const row = (payload.new ?? payload.old ?? {}) as Record<string, unknown>
            envoyer('document', {
              kind: row.kind ?? null,
              review_status: row.review_status ?? null,
            })
          }
        )
        // --- Statut, date prevue, annulation d'une de ses interventions ---
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'interventions' },
          (payload) => {
            const row = (payload.new ?? {}) as Record<string, unknown>
            const id = row.id as string | undefined
            if (!id || !interventionIds.has(id)) return
            envoyer('intervention', {
              intervention_id: id,
              statut_id: row.statut_id ?? null,
              date_prevue: row.date_prevue ?? null,
              has_portal_report: row.has_portal_report ?? null,
            })
          }
        )
        // --- Affectation : prix, demarrage, paiement, ajout ou retrait ---
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'intervention_artisans',
            filter: `artisan_id=eq.${artisan.id}`,
          },
          async (payload) => {
            const apres = (payload.new ?? {}) as Record<string, unknown>
            const avant = (payload.old ?? {}) as Record<string, unknown>
            const row = (payload.new ?? payload.old ?? {}) as Record<string, unknown>
            const interventionId = (row.intervention_id as string | null) ?? null

            // Ajout ou retrait : la liste des interventions visibles change, il
            // faut la recharger. Une simple mise a jour de colonne, non.
            if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
              await chargerAffectations()
              envoyer('assignment', {
                intervention_id: interventionId,
                action: payload.eventType === 'DELETE' ? 'removed' : 'added',
              })
              return
            }

            const change = (colonne: string) => avant[colonne] !== apres[colonne]

            if (change('price_response') || change('price_responded_at') || change('price_accepted_amount')) {
              envoyer('price', {
                intervention_id: interventionId,
                response: apres.price_response ?? null,
                responded_at: apres.price_responded_at ?? null,
                accepted_amount: apres.price_accepted_amount ?? null,
              })
            }

            if (change('work_started_at')) {
              envoyer('work', {
                intervention_id: interventionId,
                started_at: apres.work_started_at ?? null,
              })
            }

            if (change('payment_status') || change('paid_at')) {
              envoyer('payment', {
                intervention_id: interventionId,
                state: apres.payment_status ?? null,
                paid_at: apres.paid_at ?? null,
              })
            }

            // Repli : une colonne non couverte a bouge (role, is_primary…), ou
            // la publication ne transporte pas l'ancienne ligne. On previent,
            // plutot que de laisser l'application afficher un etat perime.
            const nomme =
              change('price_response') ||
              change('price_responded_at') ||
              change('price_accepted_amount') ||
              change('work_started_at') ||
              change('payment_status') ||
              change('paid_at')
            if (!nomme) {
              envoyer('assignment', { intervention_id: interventionId, action: 'updated' })
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            envoyer('ready', { artisan_id: artisan.id, at: new Date().toISOString() })
          }
        })

      ping = setInterval(() => envoyer('ping', { at: new Date().toISOString() }), PING_MS)
      arret = setTimeout(fermer, DUREE_MAX_MS)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
