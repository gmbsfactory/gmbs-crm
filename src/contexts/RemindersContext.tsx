"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { remindersApi } from "@/lib/api/v2/reminders"
import type { InterventionReminder } from "@/lib/api/v2"
import { useInterventionModal } from "@/hooks/useInterventionModal"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { supabase } from "@/lib/supabase-client"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import { toast } from "sonner"

const normalizeIdentifier = (input: string): string => {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]/g, "")
}

const extractMentions = (note: string): string[] => {
  if (!note) return []
  const regex = /@([\p{L}\p{N}_.-]+)/gu
  const mentions = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = regex.exec(note)) !== null) {
    const normalized = normalizeIdentifier(match[1] ?? "")
    if (normalized) {
      mentions.add(normalized)
    }
  }
  return Array.from(mentions)
}

type ReminderState = {
  reminders: Set<string>
  notes: Map<string, string>
  mentions: Map<string, string[]>
  dueDates: Map<string, string | null>
  records: Map<string, InterventionReminder>
}

type SaveReminderParams = {
  interventionId: string
  idInter?: string
  note?: string | null
  dueDate?: string | null
  mentionedUserIds?: string[]
}

type RemindersContextValue = {
  reminders: Set<string>
  count: number
  toggleReminder: (id: string, idInter?: string) => Promise<void>
  hasReminder: (id: string) => boolean
  removeReminder: (id: string) => Promise<void>
  getReminderNote: (id: string) => string | undefined
  getReminderDueDate: (id: string) => string | null
  setReminderNote: (id: string, note: string, idInter?: string) => Promise<void>
  setReminderDueDate: (id: string, dueDate: string | null, idInter?: string) => Promise<void>
  removeReminderNote: (id: string, idInter?: string) => Promise<void>
  getReminderMentions: (id: string) => string[]
  setReminderMentions: (id: string, mentions: string[], idInter?: string) => Promise<void>
  reminderNotes: Map<string, string>
  reminderMentions: Map<string, string[]>
  reminderDueDates: Map<string, string | null>
  reminderRecords: Map<string, InterventionReminder>
  saveReminder: (params: SaveReminderParams) => Promise<void>
  refreshReminders: () => Promise<void>
}

const RemindersContext = createContext<RemindersContextValue | undefined>(undefined)

const createEmptyState = (): ReminderState => ({
  reminders: new Set(),
  notes: new Map(),
  mentions: new Map(),
  dueDates: new Map(),
  records: new Map(),
})

const cloneState = (state: ReminderState): ReminderState => ({
  reminders: new Set(state.reminders),
  notes: new Map(state.notes),
  mentions: new Map(state.mentions),
  dueDates: new Map(state.dueDates),
  records: new Map(state.records),
})

export function RemindersProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ReminderState>(createEmptyState)
  const { open: openInterventionModal } = useInterventionModal()
  const { data: currentUser } = useCurrentUser()
  const currentUserIdRef = useRef<string | null>(null)
  currentUserIdRef.current = currentUser?.id ?? null

  const updateState = useCallback((updater: (prev: ReminderState) => ReminderState) => {
    setState((prev) => updater(prev))
  }, [])

  const saveReminder = useCallback(
    async ({ interventionId, idInter, note, dueDate, mentionedUserIds }: SaveReminderParams) => {
      const existingRecord = state.records.get(interventionId) ?? null
      const resolvedNote =
        note === undefined
          ? state.notes.get(interventionId) ?? null
          : note?.trim()
            ? note.trim()
            : null
      const resolvedDueDate =
        dueDate === undefined ? state.dueDates.get(interventionId) ?? null : dueDate ?? null
      const resolvedMentions =
        mentionedUserIds === undefined ? state.mentions.get(interventionId) ?? [] : mentionedUserIds

      // Toujours sauvegarder le reminder, même s'il est vide
      // Le reminder sera créé avec is_active: true
      let remoteReminder: InterventionReminder | null = null

      try {
        // Toujours appeler upsertReminder, même si le reminder est vide
        remoteReminder = await remindersApi.upsertReminder({
          intervention_id: interventionId,
          note: resolvedNote,
          due_date: resolvedDueDate,
          mentioned_user_ids: resolvedMentions,
        }, currentUserIdRef.current ?? undefined)
      } catch (error) {
        console.error("Failed to save reminder", error)
      }

      // Toast pour "Reminder actif" si c'est une création ou mise à jour par l'utilisateur courant
      // On suppose que si saveReminder est appelé, c'est l'utilisateur courant qui agit
      if (resolvedNote || resolvedDueDate) {
        toast.success(`Reminder pour ${idInter || "Intervention"} créé avec succès`, {
          description: resolvedNote || "Aucune description",
        })
      }

      updateState((prev) => {
        const next = cloneState(prev)
        // Toujours ajouter le reminder à l'état, même s'il est vide
        next.reminders.add(interventionId)

        if (remoteReminder?.note ?? resolvedNote) {
          next.notes.set(interventionId, remoteReminder?.note ?? resolvedNote ?? "")
        } else {
          next.notes.delete(interventionId)
        }

        next.mentions.set(
          interventionId,
          remoteReminder?.mentioned_user_ids ?? resolvedMentions ?? [],
        )

        next.dueDates.set(
          interventionId,
          remoteReminder?.due_date ?? resolvedDueDate ?? null,
        )

        if (remoteReminder) {
          next.records.set(interventionId, remoteReminder)
        } else if (existingRecord) {
          next.records.set(interventionId, {
            ...existingRecord,
            note: resolvedNote,
            due_date: resolvedDueDate,
            mentioned_user_ids: resolvedMentions,
            updated_at: new Date().toISOString(),
          })
        }

        return next
      })
    },
    [state.dueDates, state.mentions, state.notes, state.records, updateState],
  )

  const refreshReminders = useCallback(async () => {
    try {
      const userId = currentUserIdRef.current
      if (!userId) {
        // Utilisateur non authentifié, ne pas faire la requête
        return
      }

      const remote = await remindersApi.getMyReminders(userId)
      updateState(() => {
        const next: ReminderState = {
          reminders: new Set<string>(),
          notes: new Map<string, string>(),
          mentions: new Map<string, string[]>(),
          dueDates: new Map<string, string | null>(),
          records: new Map<string, InterventionReminder>(),
        }

        remote.forEach((reminder) => {
          const interventionId = reminder.intervention_id
          next.reminders.add(interventionId)
          if (reminder.note) {
            next.notes.set(interventionId, reminder.note)
          }
          next.mentions.set(interventionId, reminder.mentioned_user_ids ?? [])
          next.dueDates.set(interventionId, reminder.due_date ?? null)
          next.records.set(interventionId, reminder)
        })

        return next
      })
    } catch (error) {
      console.warn("Unable to refresh intervention reminders", error)
    }
  }, [updateState])

  // Subscription realtime pour mettre à jour automatiquement tous les composants
  // NOTE: Ce useEffect ne doit PAS avoir de dépendances qui changent fréquemment
  // pour éviter de recréer la subscription à chaque render
  useEffect(() => {
    if (typeof window === "undefined") return

    let mounted = true
    let channel: ReturnType<typeof supabase.channel> | null = null
    let isSubscribed = false // Flag pour éviter les subscriptions multiples
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null

    const checkIfEventConcernsUser = (
      payload: RealtimePostgresChangesPayload<{
        id: string
        intervention_id: string
        user_id: string
        mentioned_user_ids: string[] | null
        is_active: boolean | null
      }>
    ): boolean => {
      const publicUserId = currentUserIdRef.current
      if (!publicUserId) return false

      // Vérifier si le nouveau reminder concerne l'utilisateur (via public.users.id)
      if (payload.new && 'user_id' in payload.new) {
        const newUserId = payload.new.user_id
        const newMentionedIds = payload.new.mentioned_user_ids ?? []
        if (newUserId === publicUserId || (Array.isArray(newMentionedIds) && newMentionedIds.includes(publicUserId))) {
          return true
        }
      }

      // Vérifier si l'ancien reminder concernait l'utilisateur (pour DELETE ou UPDATE)
      if (payload.old && 'user_id' in payload.old) {
        const oldUserId = payload.old.user_id
        const oldMentionedIds = payload.old.mentioned_user_ids ?? []
        if (oldUserId === publicUserId || (Array.isArray(oldMentionedIds) && oldMentionedIds.includes(publicUserId))) {
          return true
        }
      }

      return false
    }

    const bindChannel = () => {
      // Éviter les subscriptions multiples
      if (isSubscribed && channel) {
        return
      }

      // Nettoyer l'ancien channel s'il existe
      if (channel) {
        channel.unsubscribe()
        channel = null
      }

      channel = supabase
        .channel("intervention_reminders_realtime")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "intervention_reminders",
          },
          async (payload: RealtimePostgresChangesPayload<{
            id: string
            intervention_id: string
            user_id: string
            mentioned_user_ids: string[] | null
            is_active: boolean | null
            note: string | null
          }>) => {
            if (!mounted) return

            const userId = currentUserIdRef.current
            if (!userId) return

            // Filtrer les événements pour ne traiter que ceux qui concernent l'utilisateur
            const concernsUser = checkIfEventConcernsUser(payload)
            if (concernsUser) {
              const newReminder = payload.new && 'id' in payload.new ? payload.new : null

              // Refresh les reminders en passant le userId connu
              try {
                const remote = await remindersApi.getMyReminders(userId)
                if (mounted) {
                  setState(() => {
                    const next: ReminderState = {
                      reminders: new Set<string>(),
                      notes: new Map<string, string>(),
                      mentions: new Map<string, string[]>(),
                      dueDates: new Map<string, string | null>(),
                      records: new Map<string, InterventionReminder>(),
                    }

                    remote.forEach((reminder) => {
                      const interventionId = reminder.intervention_id
                      next.reminders.add(interventionId)
                      if (reminder.note) {
                        next.notes.set(interventionId, reminder.note)
                      }
                      next.mentions.set(interventionId, reminder.mentioned_user_ids ?? [])
                      next.dueDates.set(interventionId, reminder.due_date ?? null)
                      next.records.set(interventionId, reminder)
                    })

                    return next
                  })
                }
              } catch (error) {
                console.warn("[RemindersContext] Unable to refresh reminders after realtime event", error)
              }

              // Si c'est un nouveau reminder qui concerne l'utilisateur
              // et que ce n'est PAS l'utilisateur courant qui l'a créé (pour éviter le double toast)
              const isCreator = newReminder?.user_id === userId

              // Si on n'est pas le créateur, c'est qu'on a été identifié/mentionné
              if (!isCreator && newReminder) {
                const interventionId = newReminder.intervention_id
                toast("Vous avez été identifié dans un reminder", {
                  description: newReminder.note || "Aucune description",
                  duration: Infinity,
                  closeButton: true,
                  action: {
                    label: "Voir",
                    onClick: () => {
                      if (interventionId) {
                        openInterventionModal(interventionId)
                      }
                    },
                  },
                })
              }
            }
          },
        )
        .subscribe((status: string) => {
          if (status === "SUBSCRIBED") {
            isSubscribed = true
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            isSubscribed = false
            console.warn(`[RemindersContext] Channel error: ${status}, reconnecting in 10s...`)

            // Cleanup l'ancien channel
            if (channel) {
              channel.unsubscribe()
              channel = null
            }

            // Reconnexion après un délai
            if (!reconnectTimeout) {
              reconnectTimeout = setTimeout(() => {
                reconnectTimeout = null
                if (mounted && !isSubscribed && currentUserIdRef.current) {
                  bindChannel()
                }
              }, 10000)
            }
          }
        })
    }

    const ensureSubscription = async () => {
      const userId = currentUserIdRef.current
      if (!userId) {
        // Pas encore de currentUser, attendre le prochain render
        return
      }

      if (mounted) {
        // Charger les reminders au démarrage si l'utilisateur est déjà connecté
        try {
          const remote = await remindersApi.getMyReminders(userId)
          if (mounted) {
            setState(() => {
              const next: ReminderState = {
                reminders: new Set<string>(),
                notes: new Map<string, string>(),
                mentions: new Map<string, string[]>(),
                dueDates: new Map<string, string | null>(),
                records: new Map<string, InterventionReminder>(),
              }

              remote.forEach((reminder) => {
                const interventionId = reminder.intervention_id
                next.reminders.add(interventionId)
                if (reminder.note) {
                  next.notes.set(interventionId, reminder.note)
                }
                next.mentions.set(interventionId, reminder.mentioned_user_ids ?? [])
                next.dueDates.set(interventionId, reminder.due_date ?? null)
                next.records.set(interventionId, reminder)
              })

              return next
            })
          }
        } catch (error) {
          console.warn("[RemindersContext] Unable to load initial reminders", error)
        }

        // Bind le channel realtime
        if (!isSubscribed) {
          bindChannel()
        }
      }
    }

    ensureSubscription()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event: string, session: { user?: { id?: string } } | null) => {
      if (!mounted) return

      if (session) {
        // Seulement bind si pas déjà subscribed
        if (!isSubscribed) {
          bindChannel()
        }
        // Refresh des reminders (utilise currentUserIdRef via refreshReminders)
        refreshReminders()
      } else {
        // Déconnexion: nettoyer
        isSubscribed = false
        if (channel) {
          channel.unsubscribe()
          channel = null
        }
      }
    })

    return () => {
      mounted = false
      isSubscribed = false
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout)
      }
      channel?.unsubscribe()
      authListener.subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]) // Re-init quand le currentUser change (login/logout)

  const toggleReminder = useCallback(
    async (id: string, idInter?: string) => {
      const record = state.records.get(id)

      if (record) {
        try {
          await remindersApi.deleteReminder(record.id)
        } catch (error) {
          console.warn("Unable to delete reminder", error)
        }

        updateState((prev) => {
          const next = cloneState(prev)
          next.reminders.delete(id)
          next.notes.delete(id)
          next.mentions.delete(id)
          next.dueDates.delete(id)
          next.records.delete(id)
          return next
        })
        return
      }

      await saveReminder({ interventionId: id, idInter })
    },
    [saveReminder, state.records, updateState],
  )

  const hasReminder = useCallback((id: string) => {
    return state.reminders.has(id)
  }, [state.reminders])

  const removeReminder = useCallback(
    async (id: string) => {
      const record = state.records.get(id)
      if (record) {
        try {
          await remindersApi.deleteReminder(record.id)
        } catch (error) {
          console.warn("Unable to delete reminder", error)
        }
      }
      updateState((prev) => {
        const next = cloneState(prev)
        next.reminders.delete(id)
        next.notes.delete(id)
        next.mentions.delete(id)
        next.dueDates.delete(id)
        next.records.delete(id)
        return next
      })
    },
    [state.records, updateState],
  )

  const setReminderNote = useCallback(
    async (id: string, note: string, idInter?: string) => {
      await saveReminder({
        interventionId: id,
        idInter,
        note,
      })
    },
    [saveReminder],
  )

  const setReminderDueDate = useCallback(
    async (id: string, dueDate: string | null, idInter?: string) => {
      await saveReminder({
        interventionId: id,
        idInter,
        dueDate,
      })
    },
    [saveReminder],
  )

  const setReminderMentions = useCallback(
    async (id: string, mentionsList: string[], idInter?: string) => {
      await saveReminder({
        interventionId: id,
        idInter,
        mentionedUserIds: mentionsList,
      })
    },
    [saveReminder],
  )

  const removeReminderNote = useCallback(
    async (id: string, idInter?: string) => {
      await saveReminder({
        interventionId: id,
        idInter,
        note: null,
      })
    },
    [saveReminder],
  )

  const getReminderNote = useCallback(
    (id: string) => {
      return state.notes.get(id)
    },
    [state.notes],
  )

  const getReminderDueDate = useCallback(
    (id: string) => {
      return state.dueDates.get(id) ?? null
    },
    [state.dueDates],
  )

  const getReminderMentions = useCallback(
    (id: string) => {
      return state.mentions.get(id) ?? []
    },
    [state.mentions],
  )

  const count = state.reminders.size

  const value: RemindersContextValue = {
    reminders: state.reminders,
    count,
    toggleReminder,
    hasReminder,
    removeReminder,
    getReminderNote,
    getReminderDueDate,
    setReminderNote,
    setReminderDueDate,
    removeReminderNote,
    getReminderMentions,
    setReminderMentions,
    reminderNotes: state.notes,
    reminderMentions: state.mentions,
    reminderDueDates: state.dueDates,
    reminderRecords: state.records,
    saveReminder,
    refreshReminders,
  }

  return <RemindersContext.Provider value={value}>{children}</RemindersContext.Provider>
}

export function useReminders() {
  const context = useContext(RemindersContext)
  if (context === undefined) {
    throw new Error("useReminders must be used within a RemindersProvider")
  }
  return context
}

export { normalizeIdentifier as normalizeReminderIdentifier, extractMentions as extractReminderMentions }
