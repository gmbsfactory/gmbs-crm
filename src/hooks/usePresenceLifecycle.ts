"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { DEFAULT_PRESENCE_SETTINGS, type PresenceSettings } from "@/hooks/usePresenceSettings"
import type { CrmPresenceState } from "@/types/presence"

type PresenceEvent =
  | "AUTH_LOGIN"
  | "PRESENCE_START"
  | "PRESENCE_RESUME"
  | "PRESENCE_PING"
  | "IDLE_START"
  | "PRESENCE_END"

interface UsePresenceLifecycleArgs {
  isIdle: boolean
  getLastActiveAt: () => number
  settings?: PresenceSettings | null
}

interface PresenceLifecycleState {
  presenceState: CrmPresenceState
  sessionId: string
  lastActiveAt: string | null
  idleSinceAt: string | null
}

const ACTIVE_PRESENCE_PING_MS = 60_000

function createSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-presence`
}

function isoFromMs(value: number | null): string | null {
  return value && Number.isFinite(value) ? new Date(value).toISOString() : null
}

/**
 * Cycle de présence CRM (active → idle → offline → reprise), indépendant du token auth.
 *
 * Émetteur UNIQUE des événements de présence côté client :
 * - `AUTH_LOGIN`     : 1re connexion via portail (flag `crm_auth_login` posé sur SIGNED_IN).
 * - `PRESENCE_START` : ouverture/reprise de session CRM sans portail (rechargement, session déjà active).
 * - `PRESENCE_PING`  : ping d'activité 60 s (rafraîchit last_active_at, jamais journalisé).
 * - `IDLE_START`     : passage inactif (souris immobile au-delà du seuil idle).
 * - `PRESENCE_RESUME`: retour d'activité après idle/offline, sans repasser par le portail.
 * - `PRESENCE_END`   : hors ligne après le seuil offline.
 *
 * Limite multi-onglets ASSUMÉE : chaque onglet instancie son propre cycle (sessionId + timer
 * propres). L'état global `users.presence_state` est par-user et converge vers « actif si ≥1
 * onglet actif » (le ping d'un onglet actif écrase l'idle d'un autre). Pas de coordination
 * inter-onglets pour l'instant — acceptable car le cas dominant est un seul onglet.
 */
export function usePresenceLifecycle({
  isIdle,
  getLastActiveAt,
  settings,
}: UsePresenceLifecycleArgs): PresenceLifecycleState {
  const { data: currentUser } = useCurrentUser()
  const effectiveSettings = settings ?? DEFAULT_PRESENCE_SETTINGS
  const offlineAfterMs = effectiveSettings.offlineAfterMinutes * 60_000

  const [presenceState, setPresenceState] = useState<CrmPresenceState>("active")
  const [lastActiveAt, setLastActiveAt] = useState<string | null>(() => isoFromMs(Date.now()))
  const [idleSinceAt, setIdleSinceAt] = useState<string | null>(null)

  const sessionIdRef = useRef(createSessionId())
  const stateRef = useRef<CrmPresenceState>("active")
  const idleSinceRef = useRef<string | null>(null)
  const lastUserIdRef = useRef<string | null>(null)
  const offlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const syncLocalState = useCallback((nextState: CrmPresenceState, nextLastActiveAt?: string | null, nextIdleSinceAt?: string | null) => {
    stateRef.current = nextState
    setPresenceState(nextState)
    if (nextLastActiveAt !== undefined) setLastActiveAt(nextLastActiveAt)
    if (nextIdleSinceAt !== undefined) {
      idleSinceRef.current = nextIdleSinceAt
      setIdleSinceAt(nextIdleSinceAt)
    }
  }, [])

  const postPresence = useCallback(async (
    state: CrmPresenceState,
    event: PresenceEvent,
    metadata: Record<string, unknown> = {},
    occurredAt = new Date().toISOString(),
  ) => {
    if (!currentUser?.id) return

    try {
      await fetch("/api/auth/presence", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state,
          event,
          sessionId: sessionIdRef.current,
          occurredAt,
          metadata,
        }),
      })
    } catch (error) {
      console.warn("[PresenceLifecycle] Failed to post presence:", error)
    }
  }, [currentUser?.id])

  useEffect(() => {
    if (!currentUser?.id) return

    if (lastUserIdRef.current !== currentUser.id) {
      sessionIdRef.current = createSessionId()
      lastUserIdRef.current = currentUser.id
      const now = new Date().toISOString()
      syncLocalState("active", now, null)

      // AUTH_LOGIN si on vient de passer par le portail (flag posé sur SIGNED_IN),
      // sinon PRESENCE_START (rechargement / session déjà active, sans portail).
      // Émetteur unique → la distinction « via portail / sans portail » est déterministe.
      let freshLogin = false
      try {
        freshLogin = sessionStorage.getItem("crm_auth_login") === "1"
        if (freshLogin) sessionStorage.removeItem("crm_auth_login")
      } catch {
        // sessionStorage indisponible (SSR / mode privé) → PRESENCE_START par défaut
      }
      const event: PresenceEvent = freshLogin ? "AUTH_LOGIN" : "PRESENCE_START"
      void postPresence("active", event, { auth_required: false }, now)
    }
  }, [currentUser?.id, postPresence, syncLocalState])

  useEffect(() => {
    if (!currentUser?.id) return

    if (offlineTimerRef.current) {
      clearTimeout(offlineTimerRef.current)
      offlineTimerRef.current = null
    }

    const now = Date.now()
    const activeAtMs = getLastActiveAt()
    const activeAtIso = isoFromMs(activeAtMs) ?? new Date(now).toISOString()

    if (!isIdle) {
      const previousState = stateRef.current
      syncLocalState("active", activeAtIso, null)

      if (previousState === "offline") {
        // Reprise après une déconnexion >1h : nouvelle session + Reconnexion (sans portail).
        sessionIdRef.current = createSessionId()
        void postPresence("active", "PRESENCE_RESUME", {
          auth_required: false,
          previous_client_state: previousState,
        })
      } else if (previousState === "idle") {
        // Retour d'une simple inactivité (<1h) : on réactive la présence SANS journaliser de
        // reconnexion (le PING n'est jamais loggé). L'inactivité reste visible dans la timeline.
        void postPresence("active", "PRESENCE_PING", { reason: "idle_return" })
      }
      return
    }

    const previousState = stateRef.current
    const idleAtIso = idleSinceRef.current ?? new Date(now).toISOString()
    if (previousState === "active") {
      syncLocalState("idle", activeAtIso, idleAtIso)
      void postPresence("idle", "IDLE_START", {
        last_active_at: activeAtIso,
        idle_after_minutes: effectiveSettings.idleAfterMinutes,
      })
    } else if (previousState === "idle") {
      setLastActiveAt(activeAtIso)
    }

    const offlineAtMs = activeAtMs + offlineAfterMs
    const delayMs = Math.max(0, offlineAtMs - now)

    offlineTimerRef.current = setTimeout(() => {
      if (stateRef.current === "offline") return
      const offlineAtIso = new Date().toISOString()
      syncLocalState("offline", activeAtIso, null)
      void postPresence("offline", "PRESENCE_END", {
        reason: "offline_threshold",
        last_active_at: activeAtIso,
        offline_after_minutes: effectiveSettings.offlineAfterMinutes,
      }, offlineAtIso)
    }, delayMs)

    return () => {
      if (offlineTimerRef.current) {
        clearTimeout(offlineTimerRef.current)
        offlineTimerRef.current = null
      }
    }
  }, [
    currentUser?.id,
    effectiveSettings.idleAfterMinutes,
    effectiveSettings.offlineAfterMinutes,
    getLastActiveAt,
    isIdle,
    offlineAfterMs,
    postPresence,
    syncLocalState,
  ])

  useEffect(() => {
    if (!currentUser?.id || isIdle) return

    const pingActive = () => {
      const activeAtIso = isoFromMs(getLastActiveAt()) ?? new Date().toISOString()
      setLastActiveAt(activeAtIso)
      void postPresence("active", "PRESENCE_PING", {
        reason: "active_presence_ping",
      }, activeAtIso)
    }

    const interval = setInterval(pingActive, ACTIVE_PRESENCE_PING_MS)
    return () => clearInterval(interval)
  }, [currentUser?.id, getLastActiveAt, isIdle, postPresence])

  return {
    presenceState,
    sessionId: sessionIdRef.current,
    lastActiveAt,
    idleSinceAt,
  }
}
