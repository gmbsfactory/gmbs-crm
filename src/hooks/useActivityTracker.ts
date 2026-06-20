'use client'

import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase-client'
import { useCurrentUser } from '@/hooks/useCurrentUser'

/**
 * Émetteur du JOURNAL D'ÉVÉNEMENTS d'activité (temps d'écran précis et auditable).
 *
 * Le client n'écrit PLUS de durées : il émet uniquement des événements dans
 * `user_activity_events` (horodatés SERVEUR via `occurred_at default now()`).
 * Les durées sont recalculées côté serveur (cf. monitoring_active_intervals /
 * src/lib/monitoring/active-time.ts) en bornant chaque marqueur actif à MAX_GAP.
 *
 * Marqueurs émis :
 * - `connect`     : montage (nouvelle session navigateur).
 * - `page`        : changement de page / d'intervention ouverte.
 * - `heartbeat`   : toutes les 60 s, UNIQUEMENT s'il y a eu une vraie activité
 *                   depuis le dernier battement (preuve de vie réelle → exclut
 *                   l'inactivité sans rien compter à tort).
 * - `idle`        : bascule en inactivité (souris immobile / onglet caché).
 * - `blur`/`focus`: fenêtre au second / premier plan (dé-doublonnage multi-écran).
 * - `disconnect`  : fermeture de l'onglet (best-effort keepalive).
 *
 * Veille OS, coupure réseau et crash ne produisent aucun heartbeat → le serveur
 * ne crédite qu'un MAX_GAP (≤ ~90 s), jamais des heures fantômes.
 *
 * @param pageName        Page courante (ex. 'interventions', 'dashboard')
 * @param isIdle          Inactivité courante (cf. useIdleDetector)
 * @param getLastActiveAt Getter stable de l'epoch (ms) de la dernière activité réelle
 * @param interventionId  Id de l'intervention ouverte (modal), ou null
 */
const HEARTBEAT_MS = 60_000
const EVENTS_TABLE = 'user_activity_events'

type EventKind =
  | 'connect'
  | 'page'
  | 'heartbeat'
  | 'idle'
  | 'focus'
  | 'blur'
  | 'disconnect'

/** Marqueurs actifs : leur émission "réamorce" le crédit de temps. */
const ACTIVE_KINDS = new Set<EventKind>(['connect', 'page', 'heartbeat', 'focus'])

function newSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback (navigateurs anciens)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Date.now() + Math.floor(Math.random() * 16)) % 16
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function useActivityTracker(
  pageName: string | null,
  isIdle = false,
  getLastActiveAt: () => number = () => Date.now(),
  interventionId: string | null = null,
): void {
  const { data: currentUser } = useCurrentUser()
  const currentUserId = currentUser?.id ?? null

  // ─── Refs synchronisées chaque render ────────────────────────────────────────
  const currentUserIdRef = useRef<string | null>(null)
  const isIdleRef = useRef(isIdle)
  const getLastActiveAtRef = useRef(getLastActiveAt)
  const pageNameRef = useRef<string | null>(pageName)
  const interventionIdRef = useRef<string | null>(interventionId)
  currentUserIdRef.current = currentUserId
  getLastActiveAtRef.current = getLastActiveAt

  // ─── État de session / heartbeat ─────────────────────────────────────────────
  const sessionIdRef = useRef<string>('')
  const lastBeatRef = useRef<number>(0)
  const hasFocusRef = useRef<boolean>(
    typeof document === 'undefined' ? true : document.hasFocus()
  )
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const accessTokenRef = useRef<string | null>(null)

  const lastActiveMs = useCallback(() => {
    const fn = getLastActiveAtRef.current
    return typeof fn === 'function' ? fn() : Date.now()
  }, [])

  // ─── Émission d'un événement (insert append-only, fire-and-forget) ───────────
  const emit = useCallback((kind: EventKind) => {
    const userId = currentUserIdRef.current
    if (!userId || !sessionIdRef.current) return

    if (ACTIVE_KINDS.has(kind)) lastBeatRef.current = Date.now()

    try {
      const builder = (supabase as any).from(EVENTS_TABLE).insert({
        user_id: userId,
        session_id: sessionIdRef.current,
        kind,
        page_name: pageNameRef.current,
        intervention_id: interventionIdRef.current,
        client_ts: new Date().toISOString(),
        // occurred_at : NON envoyé → horodatage serveur (default now())
      })
      // PostgREST builder est "thenable" : .then() déclenche la requête.
      builder.then(
        () => {},
        (err: unknown) => console.warn('[ActivityTracker] emit failed:', kind, err)
      )
    } catch (err) {
      console.warn('[ActivityTracker] emit error:', kind, err)
    }
  }, [])

  // ─── Heartbeat : ne bat que sur vraie activité depuis le dernier battement ───
  const tick = useCallback(() => {
    if (isIdleRef.current || !hasFocusRef.current) return
    if (lastActiveMs() > lastBeatRef.current) emit('heartbeat')
  }, [emit, lastActiveMs])

  // ─── Cycle de vie de la session (lié au userId) ──────────────────────────────
  useEffect(() => {
    if (!currentUserId) return

    sessionIdRef.current = newSessionId()
    lastBeatRef.current = Date.now()
    emit('connect')

    if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current)
    heartbeatTimerRef.current = setInterval(tick, HEARTBEAT_MS)

    return () => {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current)
        heartbeatTimerRef.current = null
      }
      emit('disconnect')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId])

  // ─── Idle → marqueur d'arrêt ; retour actif → réamorce ───────────────────────
  useEffect(() => {
    const wasIdle = isIdleRef.current
    isIdleRef.current = isIdle
    if (!currentUserId || !sessionIdRef.current) return

    if (isIdle && !wasIdle) emit('idle')
    else if (!isIdle && wasIdle) emit('heartbeat') // reprise = marqueur actif
  }, [isIdle, currentUserId, emit])

  // ─── Focus / blur (dé-doublonnage multi-écran) ───────────────────────────────
  useEffect(() => {
    const onFocus = () => {
      if (hasFocusRef.current) return
      hasFocusRef.current = true
      if (currentUserIdRef.current && sessionIdRef.current) emit('focus')
    }
    const onBlur = () => {
      if (!hasFocusRef.current) return
      hasFocusRef.current = false
      if (currentUserIdRef.current && sessionIdRef.current) emit('blur')
    }
    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
    }
  }, [emit])

  // ─── Changement de page / d'intervention → marqueur 'page' ───────────────────
  useEffect(() => {
    const prevPage = pageNameRef.current
    const prevIntervention = interventionIdRef.current
    pageNameRef.current = pageName
    interventionIdRef.current = interventionId

    if (!currentUserId || !sessionIdRef.current) return
    if (prevPage === pageName && prevIntervention === interventionId) return

    // Seulement si actif au premier plan (sinon le prochain 'focus'/reprise réamorce)
    if (!isIdleRef.current && hasFocusRef.current) emit('page')
  }, [pageName, interventionId, currentUserId, emit])

  // ─── Token frais pour le disconnect au beforeunload ──────────────────────────
  useEffect(() => {
    if (!currentUserId) return
    const refreshToken = async () => {
      const { data } = await supabase.auth.getSession()
      accessTokenRef.current = data?.session?.access_token ?? null
    }
    refreshToken()
    const tokenTimer = setInterval(refreshToken, 60_000)
    return () => clearInterval(tokenTimer)
  }, [currentUserId])

  // ─── beforeunload : 'disconnect' fiable via keepalive ────────────────────────
  useEffect(() => {
    const handleBeforeUnload = () => {
      const userId = currentUserIdRef.current
      const accessToken = accessTokenRef.current
      if (!userId || !accessToken || !sessionIdRef.current) return

      const payload = JSON.stringify({
        user_id: userId,
        session_id: sessionIdRef.current,
        kind: 'disconnect',
        page_name: pageNameRef.current,
        intervention_id: interventionIdRef.current,
        client_ts: new Date().toISOString(),
      })

      try {
        fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${EVENTS_TABLE}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
            Authorization: `Bearer ${accessToken}`,
            Prefer: 'return=minimal',
          },
          body: payload,
          keepalive: true,
        })
      } catch {
        // Best effort — onglet en fermeture
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])
}
