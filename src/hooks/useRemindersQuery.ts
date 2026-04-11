"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { remindersApi } from "@/lib/api/v2/reminders"
import type { InterventionReminder } from "@/lib/api/v2"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { useInterventionModal } from "@/hooks/useInterventionModal"
import { onReminderRealtimeEvent } from "@/lib/realtime/reminder-events"
import { toast } from "sonner"

// ===== Query Keys =====

export const reminderKeys = {
  all: ["reminders"] as const,
  mine: (userId: string) => [...reminderKeys.all, userId] as const,
}

// ===== Types =====

type SaveReminderParams = {
  interventionId: string
  idInter?: string
  note?: string | null
  dueDate?: string | null
  mentionedUserIds?: string[]
}

type RemindersData = {
  reminders: Set<string>
  notes: Map<string, string>
  mentions: Map<string, string[]>
  dueDates: Map<string, string | null>
  records: Map<string, InterventionReminder>
}

// ===== Helpers =====

function buildRemindersData(reminders: InterventionReminder[]): RemindersData {
  const result: RemindersData = {
    reminders: new Set(),
    notes: new Map(),
    mentions: new Map(),
    dueDates: new Map(),
    records: new Map(),
  }

  for (const reminder of reminders) {
    const id = reminder.intervention_id
    result.reminders.add(id)
    if (reminder.note) {
      result.notes.set(id, reminder.note)
    }
    result.mentions.set(id, reminder.mentioned_user_ids ?? [])
    result.dueDates.set(id, reminder.due_date ?? null)
    result.records.set(id, reminder)
  }

  return result
}

const EMPTY_DATA: RemindersData = {
  reminders: new Set(),
  notes: new Map(),
  mentions: new Map(),
  dueDates: new Map(),
  records: new Map(),
}

// ===== Main Hook =====

export function useRemindersQuery() {
  const queryClient = useQueryClient()
  const { data: currentUser } = useCurrentUser()
  const userId = currentUser?.id ?? null
  const { open: openInterventionModal } = useInterventionModal()
  const userIdRef = useRef(userId)
  userIdRef.current = userId

  // --- Query: fetch reminders ---
  const { data: rawReminders = [] } = useQuery({
    queryKey: reminderKeys.mine(userId!),
    queryFn: () => remindersApi.getMyReminders(userId!),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  // --- Derived state (replaces the 5 Maps/Sets) ---
  const data = useMemo(() => {
    if (rawReminders.length === 0) return EMPTY_DATA
    return buildRemindersData(rawReminders)
  }, [rawReminders])

  // --- Mutations ---

  const invalidate = useCallback(() => {
    if (userIdRef.current) {
      queryClient.invalidateQueries({ queryKey: reminderKeys.mine(userIdRef.current) })
    }
  }, [queryClient])

  const saveMutation = useMutation({
    mutationFn: async (params: SaveReminderParams) => {
      const currentData = data
      const resolvedNote =
        params.note === undefined
          ? currentData.notes.get(params.interventionId) ?? null
          : params.note?.trim() || null
      const resolvedDueDate =
        params.dueDate === undefined
          ? currentData.dueDates.get(params.interventionId) ?? null
          : params.dueDate ?? null
      const resolvedMentions =
        params.mentionedUserIds === undefined
          ? currentData.mentions.get(params.interventionId) ?? []
          : params.mentionedUserIds

      const result = await remindersApi.upsertReminder(
        {
          intervention_id: params.interventionId,
          note: resolvedNote,
          due_date: resolvedDueDate,
          mentioned_user_ids: resolvedMentions,
        },
        userIdRef.current ?? undefined,
      )
      return { result, params, resolvedNote, resolvedDueDate }
    },
    onSuccess: ({ params, resolvedNote, resolvedDueDate }) => {
      invalidate()
      if (resolvedNote || resolvedDueDate) {
        toast.success(`Reminder pour ${params.idInter || "Intervention"} créé avec succès`, {
          description: resolvedNote || "Aucune description",
        })
      }
    },
    onError: (error) => {
      console.error("Failed to save reminder", error)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (interventionId: string) => {
      const record = data.records.get(interventionId)
      if (!record) return
      await remindersApi.deleteReminder(record.id)
    },
    onMutate: async (interventionId: string) => {
      // Optimistic: remove from cache immediately
      if (!userIdRef.current) return
      const key = reminderKeys.mine(userIdRef.current)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<InterventionReminder[]>(key)
      queryClient.setQueryData<InterventionReminder[]>(key, (old) =>
        old?.filter((r) => r.intervention_id !== interventionId) ?? [],
      )
      return { previous }
    },
    onError: (_error, _interventionId, context) => {
      // Rollback on error
      if (context?.previous && userIdRef.current) {
        queryClient.setQueryData(reminderKeys.mine(userIdRef.current), context.previous)
      }
      console.warn("Unable to delete reminder", _error)
    },
    onSettled: () => invalidate(),
  })

  // --- Public API (same shape as old RemindersContext) ---

  const saveReminder = useCallback(
    async (params: SaveReminderParams) => {
      await saveMutation.mutateAsync(params)
    },
    [saveMutation],
  )

  const toggleReminder = useCallback(
    async (id: string, idInter?: string) => {
      if (data.records.has(id)) {
        await deleteMutation.mutateAsync(id)
      } else {
        await saveReminder({ interventionId: id, idInter })
      }
    },
    [data.records, deleteMutation, saveReminder],
  )

  const hasReminder = useCallback(
    (id: string) => data.reminders.has(id),
    [data.reminders],
  )

  const removeReminder = useCallback(
    async (id: string) => {
      await deleteMutation.mutateAsync(id)
    },
    [deleteMutation],
  )

  const getReminderNote = useCallback(
    (id: string) => data.notes.get(id),
    [data.notes],
  )

  const getReminderDueDate = useCallback(
    (id: string) => data.dueDates.get(id) ?? null,
    [data.dueDates],
  )

  const getReminderMentions = useCallback(
    (id: string) => data.mentions.get(id) ?? [],
    [data.mentions],
  )

  const setReminderNote = useCallback(
    async (id: string, note: string, idInter?: string) => {
      await saveReminder({ interventionId: id, idInter, note })
    },
    [saveReminder],
  )

  const setReminderDueDate = useCallback(
    async (id: string, dueDate: string | null, idInter?: string) => {
      await saveReminder({ interventionId: id, idInter, dueDate })
    },
    [saveReminder],
  )

  const setReminderMentions = useCallback(
    async (id: string, mentionsList: string[], idInter?: string) => {
      await saveReminder({ interventionId: id, idInter, mentionedUserIds: mentionsList })
    },
    [saveReminder],
  )

  const removeReminderNote = useCallback(
    async (id: string, idInter?: string) => {
      await saveReminder({ interventionId: id, idInter, note: null })
    },
    [saveReminder],
  )

  const refreshReminders = useCallback(async () => {
    invalidate()
  }, [invalidate])

  // --- Realtime subscription ---
  useEffect(() => {
    if (typeof window === "undefined" || !userId) return

    const unsubscribe = onReminderRealtimeEvent((payload) => {
      const publicUserId = userIdRef.current
      if (!publicUserId) return

      // Check if event concerns current user
      let concerns = false
      if (payload.new && "user_id" in payload.new) {
        const newUserId = (payload.new as any).user_id
        const newMentionedIds = (payload.new as any).mentioned_user_ids ?? []
        if (newUserId === publicUserId || (Array.isArray(newMentionedIds) && newMentionedIds.includes(publicUserId))) {
          concerns = true
        }
      }
      if (!concerns && payload.old && "user_id" in payload.old) {
        const oldUserId = (payload.old as any).user_id
        const oldMentionedIds = (payload.old as any).mentioned_user_ids ?? []
        if (oldUserId === publicUserId || (Array.isArray(oldMentionedIds) && oldMentionedIds.includes(publicUserId))) {
          concerns = true
        }
      }

      if (!concerns) return

      // Invalidate to refetch
      invalidate()

      // Toast for mentions by someone else
      const newReminder = payload.new && "id" in payload.new ? payload.new : null
      const isCreator = (newReminder as any)?.user_id === publicUserId
      if (!isCreator && newReminder) {
        const interventionId = (newReminder as any).intervention_id
        toast("Vous avez été identifié dans un reminder", {
          description: (newReminder as any).note || "Aucune description",
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
    })

    return unsubscribe
  }, [userId, invalidate, openInterventionModal])

  return {
    reminders: data.reminders,
    count: data.reminders.size,
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
    reminderNotes: data.notes,
    reminderMentions: data.mentions,
    reminderDueDates: data.dueDates,
    reminderRecords: data.records,
    saveReminder,
    refreshReminders,
  }
}
