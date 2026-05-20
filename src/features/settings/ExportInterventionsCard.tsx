"use client"

import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Download, Loader2, AlertTriangle, FileDown, CalendarRange,
  Users, Search, X, ChevronDown, Check,
} from "lucide-react"
import { format, differenceInDays } from "date-fns"
import { fr } from "date-fns/locale"
import { DateRangePicker } from "@/components/interventions/DateRangePicker"
import { useToast } from "@/hooks/use-toast"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { usePermissions } from "@/hooks/usePermissions"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { usersApi } from "@/lib/api"
import type { User } from "@/lib/api"
import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"

type DateRange = { from: Date | null; to: Date | null }

const WARN_THRESHOLD_DAYS = 365

function userLabel(u: Pick<User, "firstname" | "lastname" | "username" | "email">): string {
  const full = `${u.firstname ?? ""} ${u.lastname ?? ""}`.trim()
  return full || u.username || u.email || "—"
}

export function ExportInterventionsCard() {
  const { toast } = useToast()
  const { data: currentUser } = useCurrentUser()
  const { can, isLoading: permsLoading } = usePermissions()
  const [open, setOpen] = useState(false)
  const [range, setRange] = useState<DateRange>({ from: null, to: null })
  const [exporting, setExporting] = useState(false)
  const [extended, setExtended] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [userQuery, setUserQuery] = useState("")

  const isAdmin = useMemo(
    () =>
      (currentUser?.roles ?? []).some(
        (r) => typeof r === "string" && r.toLowerCase().includes("admin")
      ),
    [currentUser]
  )

  const canExport = can("export_interventions")

  // Initialiser la sélection avec soi-même quand l'utilisateur est connu
  useEffect(() => {
    if (currentUser?.id && selectedUserIds.size === 0) {
      setSelectedUserIds(new Set([currentUser.id]))
    }
  }, [currentUser?.id, selectedUserIds.size])

  // Charger la liste des gestionnaires uniquement pour les admins, à l'ouverture
  useEffect(() => {
    if (!open || !isAdmin || users.length > 0) return
    let cancelled = false
    ;(async () => {
      try {
        setLoadingUsers(true)
        const res = await usersApi.getAll({ limit: 1000 })
        if (!cancelled) setUsers(res.data)
      } catch (err: any) {
        toast({
          title: "Erreur",
          description: err?.message || "Impossible de charger les gestionnaires",
          variant: "destructive",
        })
      } finally {
        if (!cancelled) setLoadingUsers(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, isAdmin, users.length, toast])

  function toggleUser(id: string) {
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllUsers() {
    setSelectedUserIds(new Set(users.map((u) => u.id)))
  }

  function selectOnlyMe() {
    if (currentUser?.id) setSelectedUserIds(new Set([currentUser.id]))
  }

  function clearSelection() {
    setSelectedUserIds(new Set())
  }

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      // Self first, then alphabetical by full name
      if (currentUser?.id === a.id) return -1
      if (currentUser?.id === b.id) return 1
      return userLabel(a).localeCompare(userLabel(b), "fr", { sensitivity: "base" })
    })
  }, [users, currentUser?.id])

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase()
    if (!q) return sortedUsers
    return sortedUsers.filter((u) => {
      const hay = [
        userLabel(u),
        u.username,
        u.email,
        (u as any).code_gestionnaire,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return hay.includes(q)
    })
  }, [sortedUsers, userQuery])

  const selectedUsers = useMemo(
    () => sortedUsers.filter((u) => selectedUserIds.has(u.id)),
    [sortedUsers, selectedUserIds]
  )

  const allFilteredSelected =
    filteredUsers.length > 0 &&
    filteredUsers.every((u) => selectedUserIds.has(u.id))

  function toggleAllFiltered() {
    setSelectedUserIds((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) {
        filteredUsers.forEach((u) => next.delete(u.id))
      } else {
        filteredUsers.forEach((u) => next.add(u.id))
      }
      return next
    })
  }

  const rangeExceeds12Months =
    range.from != null &&
    range.to != null &&
    differenceInDays(range.to, range.from) > WARN_THRESHOLD_DAYS

  async function handleExport() {
    if (isAdmin && selectedUserIds.size === 0) {
      toast({
        title: "Sélection requise",
        description: "Sélectionnez au moins un gestionnaire à exporter.",
        variant: "destructive",
      })
      return
    }

    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (range.from) params.set('start', format(range.from, 'yyyy-MM-dd'))
      if (range.to) params.set('end', format(range.to, 'yyyy-MM-dd'))
      if (isAdmin && selectedUserIds.size > 0) {
        params.set('userIds', Array.from(selectedUserIds).join(','))
      }
      if (extended) {
        params.set('extended', '1')
      }

      const res = await fetch(`/api/exports/interventions?${params}`)

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || "Erreur lors de l'export")
      }

      const blob = await res.blob()

      // Nom du fichier avec la date locale de l'utilisateur
      const filename = `Export_Interventions_${format(new Date(), 'yyyy-MM-dd')}.csv`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({ title: 'Export réussi', description: filename })
    } catch (err: any) {
      toast({
        title: 'Erreur export',
        description: err.message || "Impossible de générer l'export",
        variant: 'destructive',
      })
    } finally {
      setExporting(false)
    }
  }

  const rangeLabel = (() => {
    if (range.from && range.to)
      return `Du ${format(range.from, 'dd MMMM yyyy', { locale: fr })} au ${format(range.to, 'dd MMMM yyyy', { locale: fr })}`
    if (range.from)
      return `Depuis le ${format(range.from, 'dd MMMM yyyy', { locale: fr })}`
    if (range.to)
      return `Jusqu'au ${format(range.to, 'dd MMMM yyyy', { locale: fr })}`
    return null
  })()

  // Gate sur la permission export_interventions (cf. spec §8.3 + migration 00099).
  // On masque silencieusement la carte tant que les permissions chargent ou si
  // l'utilisateur ne l'a pas — pas d'écran d'erreur intermédiaire.
  if (permsLoading || !canExport) return null

  return (
    <div className="rounded-2xl border bg-card/50 overflow-hidden">
      {/* ── En-tête cliquable ── */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-8 py-5 flex items-center justify-between hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <Download className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold">Exporter mes interventions</h3>
            <p className="text-sm text-muted-foreground">
              Téléchargez vos interventions au format CSV
            </p>
          </div>
        </div>
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </motion.div>
      </button>

      {/* ── Contenu dépliable ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-8 pb-8 pt-4 space-y-5 border-t">

              {/* Sélecteur de gestionnaires (admin uniquement) */}
              {isAdmin && (
                <div className="space-y-3">
                  {/* Header : label + counter + quick actions */}
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <label className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                      <Users className="h-3.5 w-3.5" />
                      Gestionnaires à exporter
                      <span className="text-foreground/80 tabular-nums">
                        · {selectedUserIds.size}/{users.length || "…"}
                      </span>
                    </label>
                    <div className="flex items-center gap-1">
                      <QuickAction
                        active={selectedUserIds.size === 1 && currentUser?.id != null && selectedUserIds.has(currentUser.id)}
                        onClick={selectOnlyMe}
                      >
                        Moi
                      </QuickAction>
                      <QuickAction
                        active={users.length > 0 && selectedUserIds.size === users.length}
                        onClick={selectAllUsers}
                      >
                        Tous
                      </QuickAction>
                      <QuickAction
                        active={selectedUserIds.size === 0}
                        onClick={clearSelection}
                      >
                        Aucun
                      </QuickAction>
                    </div>
                  </div>

                  {/* Pills des sélectionnés */}
                  <AnimatePresence initial={false}>
                    {selectedUsers.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-wrap gap-1.5">
                          {selectedUsers.map((u) => {
                            const color = (u as any).color || "hsl(var(--primary))"
                            return (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => toggleUser(u.id)}
                                className="group inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full border bg-background hover:bg-muted/50 transition-colors text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                aria-label={`Retirer ${userLabel(u)} de la sélection`}
                              >
                                <GestionnaireBadge
                                  firstname={u.firstname}
                                  lastname={u.lastname}
                                  color={color}
                                  avatarUrl={(u as any).avatar_url}
                                  size="xs"
                                  showBorder={false}
                                />

                                <span className="font-medium">{userLabel(u)}</span>
                                <X className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors" />
                              </button>
                            )
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Recherche */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <input
                      type="text"
                      value={userQuery}
                      onChange={(e) => setUserQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape" && userQuery) {
                          e.preventDefault()
                          setUserQuery("")
                        }
                      }}
                      placeholder="Rechercher un gestionnaire…"
                      className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border bg-background/50 focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    />
                    {userQuery && (
                      <button
                        type="button"
                        onClick={() => setUserQuery("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted transition-colors"
                        aria-label="Effacer la recherche"
                      >
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </div>

                  {/* Liste */}
                  <div className="rounded-xl border bg-background/50 overflow-hidden">
                    {/* Toolbar : tout sélectionner (filtré) */}
                    {!loadingUsers && filteredUsers.length > 0 && (
                      <button
                        type="button"
                        onClick={toggleAllFiltered}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-muted/40 transition-colors border-b"
                      >
                        <span
                          className={cn(
                            "h-4 w-4 rounded border flex items-center justify-center transition-colors",
                            allFilteredSelected
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-input"
                          )}
                        >
                          {allFilteredSelected && <Check className="h-3 w-3" />}
                        </span>
                        <span>
                          {allFilteredSelected ? "Tout désélectionner" : "Tout sélectionner"}
                          {userQuery && ` (${filteredUsers.length} résultat${filteredUsers.length > 1 ? "s" : ""})`}
                        </span>
                      </button>
                    )}

                    <div className="max-h-64 overflow-y-auto">
                      {loadingUsers ? (
                        <div className="p-2 space-y-1">
                          {[0, 1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-3 px-2 py-2 animate-pulse">
                              <div className="h-7 w-7 rounded-full bg-muted" />
                              <div className="flex-1 space-y-1.5">
                                <div className="h-3 w-32 rounded bg-muted" />
                                <div className="h-2 w-20 rounded bg-muted/60" />
                              </div>
                              <div className="h-4 w-4 rounded bg-muted" />
                            </div>
                          ))}
                        </div>
                      ) : users.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                          <Users className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">Aucun gestionnaire disponible</p>
                        </div>
                      ) : filteredUsers.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                          <Search className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">
                            Aucun résultat pour <span className="font-medium text-foreground">« {userQuery} »</span>
                          </p>
                          <button
                            type="button"
                            onClick={() => setUserQuery("")}
                            className="text-xs text-primary hover:underline mt-2"
                          >
                            Effacer la recherche
                          </button>
                        </div>
                      ) : (
                        <ul role="listbox" aria-multiselectable="true" className="py-1">
                          {filteredUsers.map((u) => {
                            const checked = selectedUserIds.has(u.id)
                            const isSelf = currentUser?.id === u.id
                            const color = (u as any).color || "hsl(var(--primary))"
                            const code = (u as any).code_gestionnaire as string | undefined
                            return (
                              <li key={u.id} role="option" aria-selected={checked}>
                                <label
                                  className={cn(
                                    "relative flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors",
                                    "hover:bg-muted/40 focus-within:bg-muted/40",
                                    checked && "bg-primary/[0.04]"
                                  )}
                                >
                                  {checked && (
                                    <span
                                      className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r-full"
                                      style={{ backgroundColor: color }}
                                    />
                                  )}
                                  <span
                                    className="shrink-0 rounded-full transition-shadow"
                                    style={
                                      checked
                                        ? { boxShadow: `0 0 0 2px var(--background, white), 0 0 0 3.5px ${color}` }
                                        : undefined
                                    }
                                  >
                                    <GestionnaireBadge
                                      firstname={u.firstname}
                                      lastname={u.lastname}
                                      color={color}
                                      avatarUrl={(u as any).avatar_url}
                                      size="sm"
                                      showBorder={false}
                                    />
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium truncate">{userLabel(u)}</span>
                                      {isSelf && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium uppercase tracking-wide shrink-0">
                                          Moi
                                        </span>
                                      )}
                                    </div>
                                    {(code || u.email) && (
                                      <p className="text-xs text-muted-foreground truncate">
                                        {code && <span className="font-mono">{code}</span>}
                                        {code && u.email && <span className="mx-1.5 text-muted-foreground/50">·</span>}
                                        {u.email}
                                      </p>
                                    )}
                                  </div>
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={() => toggleUser(u.id)}
                                    className="shrink-0"
                                    aria-label={`Sélectionner ${userLabel(u)}`}
                                  />
                                </label>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Sélecteur de période */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                  <CalendarRange className="h-3.5 w-3.5" />
                  Période — laisser vide pour toutes les interventions
                </label>
                <DateRangePicker value={range} onChange={setRange} />
                {rangeLabel && (
                  <p className="text-xs text-muted-foreground">{rangeLabel}</p>
                )}
              </div>

              {/* Mode étendu — admin uniquement (cf. spec §8.7) */}
              {isAdmin && (
                <label className="flex items-start gap-3 p-3 rounded-xl border bg-background/30 cursor-pointer hover:bg-muted/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={extended}
                    onChange={(e) => setExtended(e.target.checked)}
                    className="h-4 w-4 mt-0.5 rounded border-input"
                  />
                  <div className="text-sm">
                    <div className="font-medium">Inclure le deuxième artisan</div>
                    <p className="text-xs text-muted-foreground">
                      Ajoute <code>SST 2</code>, <code>COUT SST 2</code> et{' '}
                      <code>COÛT MATERIEL 2</code> en fin de fichier pour les interventions
                      à deux artisans.
                    </p>
                  </div>
                </label>
              )}

              {/* Avertissement > 12 mois */}
              <AnimatePresence>
                {rangeExceeds12Months && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"
                  >
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      La période sélectionnée dépasse 12 mois. L&apos;export peut prendre
                      du temps sur un grand volume de données.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bouton export */}
              <motion.button
                type="button"
                onClick={handleExport}
                disabled={exporting}
                className="px-5 py-2.5 rounded-xl font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {exporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Préparation de l&apos;export…
                  </>
                ) : (
                  <>
                    <FileDown className="h-4 w-4" />
                    Exporter en CSV
                  </>
                )}
              </motion.button>

              <p className="text-xs text-muted-foreground">
                Le fichier est compatible Excel (UTF-8 + BOM). Son format est identique
                aux exports administrateur — vous pouvez les fusionner sans conversion.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function QuickAction({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "px-2.5 py-1 text-xs rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      )}
    >
      {children}
    </button>
  )
}
