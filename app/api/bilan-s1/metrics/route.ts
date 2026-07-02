import { execFileSync } from "node:child_process"
import { NextResponse } from "next/server"
import { getAuthenticatedUser } from "@/lib/auth/permissions"
import { supabaseAdmin } from "@/lib/supabase-admin"
import {
  BILAN_DAYS,
  GIT_SINCE,
  GIT_SNAPSHOT,
  WINDOW_CAP_ISO,
  WINDOW_START_ISO,
} from "@/lib/bilan-s1/constants"
import {
  aggregateAudit,
  computeScreenTimeMs,
  effectiveWindowEnd,
  msToHours,
  parseGitNumstat,
  type ActivityEvent,
  type AuditRow,
} from "@/lib/bilan-s1/metrics-core"
import { canViewBilan } from "@/lib/bilan-s1/visibility-core"
import { loadBilanVisibility } from "@/lib/bilan-s1/visibility-server"
import type { BilanGitStats, BilanMetrics, BilanScreenTime } from "@/types/bilan-s1"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Pagination générique (PostgREST peut plafonner une page à 1000 lignes). */
async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
  hardLimit = 200_000
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; from < hardLimit; ) {
    const { data, error } = await page(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < 1) break
    from += batch.length
    if (batch.length < pageSize) break
  }
  return rows
}

// ---------------------------------------------------------------------------
// Caches module (par instance serveur) : la page est pollée toutes les 60 s
// par chaque dev connecté ; on protège la base.
// ---------------------------------------------------------------------------
let metricsCache: { at: number; data: BilanMetrics } | null = null
const METRICS_TTL_MS = 45_000

let screenCache: { at: number; data: BilanScreenTime } | null = null
let screenPending: Promise<BilanScreenTime> | null = null
const SCREEN_TTL_MS = 5 * 60_000

async function computeScreenTime(windowEnd: string): Promise<BilanScreenTime> {
  const admin = supabaseAdmin!
  const events = await fetchAllRows<ActivityEvent>((from, to) =>
    admin
      .from("user_activity_events")
      .select("user_id,session_id,kind,occurred_at")
      .gte("occurred_at", WINDOW_START_ISO)
      .lt("occurred_at", windowEnd)
      .order("id", { ascending: true })
      .range(from, to)
  )
  const perUserMs = computeScreenTimeMs(events, windowEnd)

  const { data: users, error: usersError } = await admin.from("users").select("id,firstname,lastname")
  if (usersError) throw new Error(usersError.message)
  const nameOf = new Map(
    (users ?? []).map((u: { id: string; firstname: string | null; lastname: string | null }) => [
      u.id,
      `${u.firstname || ""} ${(u.lastname || "").charAt(0)}`.trim() || "inconnu",
    ])
  )

  let totalMs = 0
  const perUser = [...perUserMs.entries()]
    .map(([id, ms]) => {
      totalMs += ms
      return { user: nameOf.get(id) || "inconnu", hours: msToHours(ms) }
    })
    .sort((a, b) => b.hours - a.hours)

  return { totalHours: msToHours(totalMs), perUser, events: events.length }
}

/** Temps d'écran : renvoie le cache s'il est frais, sinon lance le recalcul
 *  en arrière-plan et renvoie l'ancien cache (ou null au premier appel). */
function screenTimeCached(windowEnd: string): BilanScreenTime | null {
  if (screenCache && Date.now() - screenCache.at < SCREEN_TTL_MS) return screenCache.data
  if (!screenPending) {
    screenPending = computeScreenTime(windowEnd)
      .then((data) => {
        screenCache = { at: Date.now(), data }
        return data
      })
      .finally(() => {
        screenPending = null
      })
    screenPending.catch(() => undefined) // journalisé via errors au prochain appel
  }
  return screenCache?.data ?? null
}

/** Stats git : live en dev local, relevé figé en prod (pas de git au runtime Vercel). */
function gitStats(): { git: BilanGitStats; source: "live" | "snapshot" } {
  try {
    const raw = execFileSync(
      "git",
      ["log", `--since=${GIT_SINCE}`, "--no-merges", "--numstat", "--date=format:%d/%m %H:%M", "--pretty=@@%h|%ad|%s"],
      { cwd: process.cwd(), encoding: "utf8", timeout: 5_000 }
    )
    return { git: parseGitNumstat(raw), source: "live" }
  } catch {
    return { git: { ...GIT_SNAPSHOT, lastCommit: { ...GIT_SNAPSHOT.lastCommit } }, source: "snapshot" }
  }
}

async function computeMetrics(): Promise<BilanMetrics> {
  const admin = supabaseAdmin!
  const from = WINDOW_START_ISO
  const to = effectiveWindowEnd(Date.now(), WINDOW_CAP_ISO)
  const errors: string[] = []

  const count = async (label: string, query: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
    try {
      const { count: value, error } = await query
      if (error) throw new Error(error.message)
      return value ?? 0
    } catch (e) {
      errors.push(`${label}: ${e instanceof Error ? e.message : String(e)}`)
      return null
    }
  }

  const head = { count: "exact" as const, head: true }
  const [actInter, actArt, interCreated, statusChanges, comments, docsInter, docsArt, emails] = await Promise.all([
    count("actions interventions", admin.from("intervention_audit_log").select("id", head).gte("occurred_at", from).lt("occurred_at", to).not("actor_user_id", "is", null)),
    count("actions artisans", admin.from("artisan_audit_log").select("id", head).gte("occurred_at", from).lt("occurred_at", to).not("actor_user_id", "is", null)),
    count("interventions créées", admin.from("interventions").select("id", head).gte("created_at", from).lt("created_at", to).not("created_by", "is", null)),
    count("changements de statut", admin.from("intervention_status_transitions").select("id", head).gte("transition_date", from).lt("transition_date", to).not("changed_by_user_id", "is", null)),
    count("commentaires", admin.from("comments").select("id", head).gte("created_at", from).lt("created_at", to)),
    count("documents interventions", admin.from("intervention_attachments").select("id", head).gte("created_at", from).lt("created_at", to).not("created_by", "is", null)),
    count("documents artisans", admin.from("artisan_attachments").select("id", head).gte("created_at", from).lt("created_at", to).not("created_by", "is", null)),
    count("emails envoyés", admin.from("email_logs").select("id", head).gte("sent_at", from).lt("sent_at", to).eq("status", "sent")),
  ])

  let auditRows: AuditRow[] = []
  try {
    const [inter, art] = await Promise.all([
      fetchAllRows<AuditRow>((a, b) =>
        admin
          .from("intervention_audit_log")
          .select("actor_display,occurred_at")
          .gte("occurred_at", from)
          .lt("occurred_at", to)
          .not("actor_user_id", "is", null)
          .order("id", { ascending: true })
          .range(a, b)
      ),
      fetchAllRows<AuditRow>((a, b) =>
        admin
          .from("artisan_audit_log")
          .select("actor_display,occurred_at")
          .gte("occurred_at", from)
          .lt("occurred_at", to)
          .not("actor_user_id", "is", null)
          .order("id", { ascending: true })
          .range(a, b)
      ),
    ])
    auditRows = [...inter, ...art]
  } catch (e) {
    errors.push(`détail audit: ${e instanceof Error ? e.message : String(e)}`)
  }
  const { perDay, perUser } = aggregateAudit(auditRows, BILAN_DAYS)

  const screen = screenTimeCached(to)
  const { git, source: gitSource } = gitStats()

  return {
    generatedAt: new Date().toISOString(),
    windowStart: from,
    windowEnd: to,
    cappedAtFridayNoon: Date.now() >= Date.parse(WINDOW_CAP_ISO),
    counts: {
      actionsTotal: (actInter ?? 0) + (actArt ?? 0),
      actionsInterventions: actInter,
      actionsArtisans: actArt,
      interventionsCreees: interCreated,
      changementsStatut: statusChanges,
      commentaires: comments,
      documents: docsInter === null && docsArt === null ? null : (docsInter ?? 0) + (docsArt ?? 0),
      emails,
    },
    perDay,
    perUser,
    screen,
    git,
    gitSource,
    errors,
  }
}

/**
 * GET /api/bilan-s1/metrics — accessible aux devs et aux rôles/utilisateurs
 * ouverts via la configuration de visibilité (page_visibility, éventuellement
 * temporaire). Lecture seule : uniquement des SELECT/HEAD via le service role.
 */
export async function GET(req: Request) {
  const user = await getAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
  }
  const { config } = await loadBilanVisibility()
  if (!canViewBilan(user, config, Date.now())) {
    return NextResponse.json({ error: "Réservé aux développeurs" }, { status: 403 })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Client admin non configuré (SUPABASE_SERVICE_ROLE_KEY)" }, { status: 500 })
  }

  if (metricsCache && Date.now() - metricsCache.at < METRICS_TTL_MS) {
    return NextResponse.json(metricsCache.data)
  }

  try {
    const data = await computeMetrics()
    metricsCache = { at: Date.now(), data }
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erreur lors du calcul des métriques" },
      { status: 500 }
    )
  }
}
