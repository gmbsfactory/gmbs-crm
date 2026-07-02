/**
 * Bilan S1 — cœur de calcul PUR (sans I/O), testé unitairement.
 * Utilisé par la route API /api/bilan-s1/metrics.
 */

import type { BilanGitStats, BilanPerDay, BilanPerUser } from "@/types/bilan-s1"

const dayFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
})

/** "2026-06-29T07:12:00Z" → "lun 29/06" (jour civil de Paris). */
export function parisDayLabel(iso: string): string {
  return dayFmt.format(new Date(iso)).replace(".", "")
}

export type AuditRow = { actor_display: string | null; occurred_at: string }

/**
 * Agrège les lignes d'audit (acteur humain) en actions par jour et par
 * utilisateur. `days` fixe l'ordre et remplit les jours sans activité à 0.
 */
export function aggregateAudit(
  rows: AuditRow[],
  days: readonly string[]
): { perDay: BilanPerDay[]; perUser: BilanPerUser[] } {
  const perDayMap: Record<string, number> = {}
  const perUserMap: Record<string, number> = {}
  for (const row of rows) {
    const who = row.actor_display || "?"
    perUserMap[who] = (perUserMap[who] || 0) + 1
    const day = parisDayLabel(row.occurred_at)
    perDayMap[day] = (perDayMap[day] || 0) + 1
  }
  return {
    perDay: days.map((day) => ({ day, actions: perDayMap[day] || 0 })),
    perUser: Object.entries(perUserMap)
      .map(([user, actions]) => ({ user, actions }))
      .sort((a, b) => b.actions - a.actions),
  }
}

export type ActivityEvent = {
  user_id: string
  session_id: string
  kind: string
  occurred_at: string
}

/** Kinds « actifs » de l'algo officiel du monitoring (migration 99034). */
const ACTIVE_KINDS = new Set(["connect", "heartbeat", "page", "visible", "focus"])
const MAX_GAP_MS = 90_000

/**
 * Temps d'écran actif par user_id (ms), miroir de monitoring_active_intervals :
 * partition par session, chaque événement actif crédite min(écart avec
 * l'événement suivant de la même session, 90 s) ; le dernier événement est
 * borné par la fin de fenêtre.
 */
export function computeScreenTimeMs(
  events: ActivityEvent[],
  windowEndIso: string
): Map<string, number> {
  const bySession = new Map<string, { u: string; k: string; t: number }[]>()
  for (const e of events) {
    let list = bySession.get(e.session_id)
    if (!list) {
      list = []
      bySession.set(e.session_id, list)
    }
    list.push({ u: e.user_id, k: e.kind, t: Date.parse(e.occurred_at) })
  }
  const endT = Date.parse(windowEndIso)
  const perUser = new Map<string, number>()
  for (const list of bySession.values()) {
    list.sort((a, b) => a.t - b.t)
    for (let i = 0; i < list.length; i++) {
      if (!ACTIVE_KINDS.has(list[i].k)) continue
      const next = list[i + 1]
      const credit = Math.min(MAX_GAP_MS, next ? next.t - list[i].t : endT - list[i].t)
      if (credit > 0) perUser.set(list[i].u, (perUser.get(list[i].u) || 0) + credit)
    }
  }
  return perUser
}

/** Arrondit des ms en heures à une décimale (55.6). */
export function msToHours(ms: number): number {
  return Math.round(ms / 360000) / 10
}

/**
 * Parse la sortie de
 *   git log --since=… --no-merges --numstat --pretty=@@%h|%ad|%s
 * en dédoublonnant par sujet (les cherry-picks entre branches comptent une
 * seule fois, leurs numstat aussi).
 */
export function parseGitNumstat(raw: string): BilanGitStats {
  const seen = new Set<string>()
  let commits = 0
  let fixes = 0
  let feats = 0
  let files = 0
  let insertions = 0
  let deletions = 0
  let skip = false
  let lastCommit: BilanGitStats["lastCommit"] = null

  for (const line of raw.split("\n")) {
    if (line.startsWith("@@")) {
      const body = line.slice(2)
      const i1 = body.indexOf("|")
      const i2 = body.indexOf("|", i1 + 1)
      const date = body.slice(i1 + 1, i2)
      const subject = body.slice(i2 + 1)
      skip = seen.has(subject)
      if (!skip) {
        seen.add(subject)
        commits++
        if (/^fix/.test(subject)) fixes++
        if (/^feat/.test(subject)) feats++
        if (!lastCommit) lastCommit = { date, subject }
      }
    } else if (!skip) {
      const m = line.match(/^(\d+|-)\t(\d+|-)\t/)
      if (m) {
        files++
        if (m[1] !== "-") insertions += Number(m[1])
        if (m[2] !== "-") deletions += Number(m[2])
      }
    }
  }
  return { commits, fixes, feats, files, insertions, deletions, lastCommit }
}

/** Fin de fenêtre effective : min(maintenant, plafond vendredi 12h Paris). */
export function effectiveWindowEnd(nowMs: number, capIso: string): string {
  return new Date(Math.min(nowMs, Date.parse(capIso))).toISOString()
}
