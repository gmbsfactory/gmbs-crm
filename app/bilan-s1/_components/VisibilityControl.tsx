"use client"

import { useMemo, useState } from "react"
import { Check, Eye } from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"
import { useGestionnaires } from "@/hooks/useGestionnaires"
import { useBilanS1Visibility } from "@/hooks/useBilanS1Visibility"
import { bilanS1Keys } from "@/lib/react-query/queryKeys"
import {
  DEFAULT_TEMP_HOURS,
  GRANTABLE_ROLES,
  MAX_TEMP_HOURS,
  type PageVisibilityConfig,
} from "@/lib/bilan-s1/visibility-core"

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  gestionnaire: "Gestionnaire",
}

function describeConfig(config: PageVisibilityConfig | undefined): string {
  if (!config) return "Actuellement : devs uniquement"
  const active = !config.expiresAt || Date.parse(config.expiresAt) > Date.now()
  const parts: string[] = []
  if (active && config.allowedRoles.length) parts.push(config.allowedRoles.map((r) => ROLE_LABELS[r] ?? r).join(", "))
  if (active && config.allowedUserIds.length)
    parts.push(`${config.allowedUserIds.length} utilisateur${config.allowedUserIds.length > 1 ? "s" : ""}`)
  if (!parts.length) return "Actuellement : devs uniquement"
  const until =
    config.expiresAt && active
      ? ` · jusqu'à ${new Date(config.expiresAt).toLocaleString("fr-FR", {
          timeZone: "Europe/Paris",
          weekday: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}`
      : ""
  return `Actuellement : devs + ${parts.join(" + ")}${until}`
}

/**
 * Bouton « Visibilité » (œil) à droite du badge LIVE — devs uniquement.
 * Ouvre un panneau : rôles, avatars individuels (comme la page updates),
 * ouverture temporaire (défaut 4 h). La validation prend effet immédiatement.
 */
export function VisibilityControl() {
  const queryClient = useQueryClient()
  const { data: visibility } = useBilanS1Visibility()
  const { data: gestionnaires = [] } = useGestionnaires()

  const [open, setOpen] = useState(false)
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [temporary, setTemporary] = useState(false)
  const [hours, setHours] = useState(DEFAULT_TEMP_HOURS)
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/bilan-s1/visibility", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: selectedRoles, userIds: selectedUsers, temporary, hours }),
      })
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`)
      return body
    },
    onSuccess: () => {
      // Effet immédiat : la sidebar, le gate de la page et le panneau repartent
      // de la nouvelle configuration.
      queryClient.invalidateQueries({ queryKey: bilanS1Keys.visibility() })
      setOpen(false)
      setError(null)
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Erreur lors de la validation"),
  })

  const expiresPreview = useMemo(() => {
    if (!temporary) return null
    return new Date(Date.now() + hours * 3_600_000).toLocaleString("fr-FR", {
      timeZone: "Europe/Paris",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
  }, [temporary, hours])

  if (!visibility?.isDev) return null

  const openPanel = () => {
    const config = visibility.config
    const active = config && (!config.expiresAt || Date.parse(config.expiresAt) > Date.now())
    setSelectedRoles(active ? [...config.allowedRoles] : [])
    setSelectedUsers(active ? [...config.allowedUserIds] : [])
    if (active && config.expiresAt) {
      setTemporary(true)
      const remaining = Math.ceil((Date.parse(config.expiresAt) - Date.now()) / 3_600_000)
      setHours(Math.min(MAX_TEMP_HOURS, Math.max(1, remaining)))
    } else {
      setTemporary(false)
      setHours(DEFAULT_TEMP_HOURS)
    }
    setError(null)
    setOpen(true)
  }

  const toggleRole = (role: string) =>
    setSelectedRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]))
  const toggleUser = (id: string) =>
    setSelectedUsers((prev) => (prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]))

  return (
    <span className="vis-wrap">
      <button type="button" className="vis-btn" onClick={() => (open ? setOpen(false) : openPanel())}>
        <Eye className="vis-eye" aria-hidden="true" />
        <span>Visibilité</span>
      </button>

      {open ? (
        <>
          <div className="vis-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="vis-panel" role="dialog" aria-label="Visibilité de la page">
            <div className="vis-title">Visibilité de la page</div>
            <div className="vis-status">{describeConfig(visibility.config)}</div>

            <div className="vis-section">Rôles</div>
            <div className="vis-roles">
              <label className="vis-role locked">
                <input type="checkbox" checked disabled />
                <span>Dev (toujours)</span>
              </label>
              {GRANTABLE_ROLES.map((role) => (
                <label key={role} className="vis-role">
                  <input type="checkbox" checked={selectedRoles.includes(role)} onChange={() => toggleRole(role)} />
                  <span>{ROLE_LABELS[role]}</span>
                </label>
              ))}
            </div>

            <div className="vis-section">Utilisateurs</div>
            <div className="vis-avatars">
              {gestionnaires.map((g) => {
                const selected = selectedUsers.includes(g.id)
                const displayName =
                  [g.prenom ?? g.firstname, g.name ?? g.lastname].filter(Boolean).join(" ") || g.username || "—"
                return (
                  <button
                    key={g.id}
                    type="button"
                    className={selected ? "vis-avatar sel" : "vis-avatar"}
                    onClick={() => toggleUser(g.id)}
                    title={displayName}
                  >
                    <GestionnaireBadge
                      firstname={g.prenom ?? g.firstname}
                      lastname={g.name ?? g.lastname}
                      color={g.color}
                      avatarUrl={g.avatar_url}
                      size="sm"
                      showBorder={false}
                    />
                    {selected ? (
                      <span className="vis-avatar-check">
                        <Check aria-hidden="true" />
                      </span>
                    ) : null}
                  </button>
                )
              })}
              {!gestionnaires.length ? <span className="vis-empty">Aucun utilisateur chargé</span> : null}
            </div>

            <label className="vis-temp">
              <input type="checkbox" checked={temporary} onChange={(e) => setTemporary(e.target.checked)} />
              <span>Visibilité temporaire</span>
              <input
                type="number"
                min={1}
                max={MAX_TEMP_HOURS}
                value={hours}
                disabled={!temporary}
                onChange={(e) => setHours(Math.min(MAX_TEMP_HOURS, Math.max(1, Number(e.target.value) || 1)))}
                aria-label="Durée en heures"
              />
              <span>h{expiresPreview ? ` · jusqu'à ${expiresPreview}` : ""}</span>
            </label>

            {error ? <div className="vis-error">{error}</div> : null}

            <div className="vis-actions">
              <button type="button" className="vis-cancel" onClick={() => setOpen(false)}>
                Annuler
              </button>
              <button type="button" className="vis-validate" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
                {mutation.isPending ? "Validation…" : "Valider la visibilité"}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </span>
  )
}
