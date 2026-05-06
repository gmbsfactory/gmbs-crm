"use client"

import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Download, Loader2, AlertTriangle, FileDown, CalendarRange, Users } from "lucide-react"
import { format, differenceInDays } from "date-fns"
import { fr } from "date-fns/locale"
import { DateRangePicker } from "@/components/interventions/DateRangePicker"
import { useToast } from "@/hooks/use-toast"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { usePermissions } from "@/hooks/usePermissions"
import { usersApi } from "@/lib/api"
import type { User } from "@/lib/api"

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
          variant: "destructive" as any,
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

  const rangeExceeds12Months =
    range.from != null &&
    range.to != null &&
    differenceInDays(range.to, range.from) > WARN_THRESHOLD_DAYS

  async function handleExport() {
    if (isAdmin && selectedUserIds.size === 0) {
      toast({
        title: "Sélection requise",
        description: "Sélectionnez au moins un gestionnaire à exporter.",
        variant: "destructive" as any,
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
        variant: 'destructive' as any,
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
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                      <Users className="h-3.5 w-3.5" />
                      Gestionnaires — interventions de qui exporter
                    </label>
                    <div className="flex gap-2 text-xs">
                      <button
                        type="button"
                        onClick={selectOnlyMe}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Moi seulement
                      </button>
                      <span className="text-muted-foreground/50">·</span>
                      <button
                        type="button"
                        onClick={selectAllUsers}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Tout sélectionner
                      </button>
                    </div>
                  </div>
                  <div className="rounded-xl border bg-background/50 max-h-56 overflow-y-auto">
                    {loadingUsers ? (
                      <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Chargement des gestionnaires…
                      </div>
                    ) : users.length === 0 ? (
                      <div className="p-4 text-sm text-muted-foreground">
                        Aucun gestionnaire disponible.
                      </div>
                    ) : (
                      <ul className="divide-y">
                        {users.map((u) => {
                          const checked = selectedUserIds.has(u.id)
                          const isSelf = currentUser?.id === u.id
                          return (
                            <li key={u.id}>
                              <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/40 transition-colors">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleUser(u.id)}
                                  className="h-4 w-4 rounded border-input"
                                />
                                <span className="text-sm">
                                  {userLabel(u)}
                                  {isSelf && (
                                    <span className="ml-2 text-xs text-muted-foreground">(moi)</span>
                                  )}
                                </span>
                              </label>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedUserIds.size} gestionnaire{selectedUserIds.size > 1 ? "s" : ""} sélectionné
                    {selectedUserIds.size > 1 ? "s" : ""}.
                  </p>
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
                    <div className="font-medium">Inclure colonnes internes</div>
                    <p className="text-xs text-muted-foreground">
                      Ajoute <code>Statut</code>, <code>Gest.</code> et <code>COMMENTAIRE</code> en
                      fin de fichier. Utile pour la sauvegarde admin — à éviter pour un partage client.
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
