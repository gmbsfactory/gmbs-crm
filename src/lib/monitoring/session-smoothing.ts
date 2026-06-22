/**
 * Lissage des sessions d'écran pour la timeline du Monitoring DEV (v2).
 *
 * Les sessions arrivent déjà fusionnées côté serveur (`monitoring_screen_rows`
 * coupe les trous > 90 s). Ce lissage applique, côté client, trois seuils
 * d'affichage sur les trous entre sessions consécutives :
 *
 *  - trou <= `gapMaxMs`            → micro-coupure : fusionnée (comptée en écran)
 *  - `gapMaxMs` < trou < 1h        → **inactivité** : hachurée, déduite mais affichée
 *  - trou >= 1h (`BREAK_MS`)       → **déconnexion timeline** : session fermée,
 *                                    temps retiré (ni écran ni inactivité)
 *
 * La déconnexion timeline est purement visuelle : elle n'affecte pas la session
 * d'authentification (valable 24 h). Une même journée peut donc afficher
 * plusieurs connexions / déconnexions.
 */
import type { ConnectionSession } from "@/types/monitoring"

/** Seuil de déconnexion timeline : au-delà, la session est considérée fermée. */
export const BREAK_MS = 60 * 60_000

/** Un trou entre deux sessions (inactivité ou déconnexion). */
export interface SessionGap {
  /** Début du trou (ISO) = fin de la session précédente. */
  start: string
  /** Fin du trou (ISO) = début de la session suivante. */
  end: string
  /** Durée du trou en millisecondes. */
  durationMs: number
}

export interface SmoothedSessions {
  segs: ConnectionSession[]
  /** Trous `gapMaxMs`..1h : veille / inactivité, déduite du temps écran mais affichée. */
  inactivities: SessionGap[]
  /** Trous >= 1h : déconnexions timeline, retirées de tout (ni écran ni inactivité). */
  breaks: SessionGap[]
}

const ms = (iso: string) => new Date(iso).getTime()

export function smoothSessions(sessions: ConnectionSession[] | undefined, gapMaxMs: number): SmoothedSessions {
  if (!sessions?.length) return { segs: [], inactivities: [], breaks: [] }
  const sorted = [...sessions].sort((a, b) => ms(a.started_at) - ms(b.started_at))
  const segs: ConnectionSession[] = []
  const inactivities: SessionGap[] = []
  const breaks: SessionGap[] = []
  let cur: ConnectionSession = { ...sorted[0] }

  for (let n = 1; n < sorted.length; n++) {
    const s = sorted[n]
    const gap = ms(s.started_at) - ms(cur.ended_at)
    if (gap >= BREAK_MS) {
      // déconnexion timeline : on ferme la session, le temps est retiré
      segs.push(cur)
      breaks.push({ start: cur.ended_at, end: s.started_at, durationMs: gap })
      cur = { ...s }
    } else if (gap > gapMaxMs) {
      // inactivité : on coupe le segment et on hachure le trou
      segs.push(cur)
      inactivities.push({ start: cur.ended_at, end: s.started_at, durationMs: gap })
      cur = { ...s }
    } else if (s.page_name === cur.page_name) {
      // même page : on absorbe la micro-coupure dans le segment courant
      cur = { ...cur, ended_at: s.ended_at, duration_ms: cur.duration_ms + s.duration_ms }
    } else {
      // page différente : on accole le nouveau segment (pas de blanc visuel)
      segs.push(cur)
      cur = { ...s, started_at: cur.ended_at }
    }
  }
  segs.push(cur)
  return { segs, inactivities, breaks }
}

/** Somme des durées d'inactivité (déduite du temps écran, hors déconnexions). */
export function totalInactivityMs(gaps: SessionGap[]): number {
  return gaps.reduce((a, p) => a + p.durationMs, 0)
}
