import { useCallback, useMemo, useRef, useState } from "react"
import type React from "react"

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const DIALOG_WIDTH = 448
const DIALOG_HEIGHT = 360
const DIALOG_GAP = 8
const SAFE_MARGIN = 16

export type ReminderApi = {
  saveReminder: (input: {
    interventionId: string
    idInter?: string
    note: string | null
    dueDate: string | null
    mentionedUserIds: string[]
  }) => Promise<unknown> | unknown
  removeReminder: (interventionId: string) => Promise<unknown> | unknown
  getReminderNote: (interventionId: string) => string | null | undefined
  getReminderDueDate: (interventionId: string) => string | Date | null | undefined
  getReminderMentions: (interventionId: string) => string[]
}

export type UseReminderDialogOptions = ReminderApi & {
  /** Resolves a row's `id_inter` from its primary id (used by saveReminder). */
  lookupIdInter: (interventionId: string) => string | undefined
}

const computeDialogPosition = (rect: DOMRect) => {
  if (typeof window === "undefined") {
    return { top: rect.top, left: rect.left }
  }
  let left = rect.left - DIALOG_WIDTH - DIALOG_GAP
  if (left < SAFE_MARGIN) {
    left = rect.right + DIALOG_GAP
  }
  left = Math.max(SAFE_MARGIN, Math.min(left, window.innerWidth - DIALOG_WIDTH - SAFE_MARGIN))

  let top = rect.top
  if (top + DIALOG_HEIGHT > window.innerHeight - SAFE_MARGIN) {
    top = window.innerHeight - DIALOG_HEIGHT - SAFE_MARGIN
  }
  top = Math.max(SAFE_MARGIN, top)
  return { top, left }
}

export const useReminderDialog = ({
  saveReminder,
  removeReminder,
  getReminderNote,
  getReminderDueDate,
  getReminderMentions,
  lookupIdInter,
}: UseReminderDialogOptions) => {
  const [showNoteDialog, setShowNoteDialog] = useState(false)
  const [noteDialogInterventionId, setNoteDialogInterventionId] = useState<string | null>(null)
  const [noteValue, setNoteValue] = useState("")
  const [dueDateValue, setDueDateValue] = useState<Date | null>(null)
  const [mentionIds, setMentionIds] = useState<string[]>([])
  const [noteDialogCoords, setNoteDialogCoords] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  })
  const noteDialogContentRef = useRef<HTMLDivElement | null>(null)

  const isReminderSaveDisabled = useMemo(
    () => noteValue.trim().length === 0 && !dueDateValue,
    [noteValue, dueDateValue],
  )

  const resetDialogState = useCallback(() => {
    setShowNoteDialog(false)
    setNoteDialogInterventionId(null)
    setNoteValue("")
    setDueDateValue(null)
    setMentionIds([])
  }, [])

  const handleReminderContextMenu = useCallback(
    (event: React.MouseEvent, interventionId: string) => {
      event.preventDefault()
      event.stopPropagation()
      const existingNote = getReminderNote(interventionId) ?? ""
      const existingDueDate = getReminderDueDate(interventionId)
      const existingMentions = getReminderMentions(interventionId)
      const target = event.currentTarget as HTMLElement
      const rect = target.getBoundingClientRect()

      setNoteDialogCoords(computeDialogPosition(rect))
      setNoteDialogInterventionId(interventionId)
      setNoteValue(existingNote)
      setDueDateValue(existingDueDate ? new Date(existingDueDate) : null)
      setMentionIds(existingMentions.filter((mention) => UUID_PATTERN.test(mention)))
      setShowNoteDialog(true)
    },
    [getReminderDueDate, getReminderMentions, getReminderNote],
  )

  const handleNoteSave = useCallback(async () => {
    if (!noteDialogInterventionId) return
    const cleaned = noteValue.trim()
    const dueDateIso = dueDateValue ? dueDateValue.toISOString() : null
    const hasContent = cleaned.length > 0 || dueDateIso

    if (hasContent) {
      await saveReminder({
        interventionId: noteDialogInterventionId,
        idInter: lookupIdInter(noteDialogInterventionId),
        note: cleaned.length > 0 ? cleaned : null,
        dueDate: dueDateIso,
        mentionedUserIds: mentionIds,
      })
    } else {
      await removeReminder(noteDialogInterventionId)
    }

    resetDialogState()
  }, [
    dueDateValue,
    lookupIdInter,
    mentionIds,
    noteDialogInterventionId,
    noteValue,
    removeReminder,
    resetDialogState,
    saveReminder,
  ])

  const handleNoteDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        resetDialogState()
      } else {
        setShowNoteDialog(true)
      }
    },
    [resetDialogState],
  )

  return {
    showNoteDialog,
    noteDialogInterventionId,
    noteValue,
    setNoteValue,
    dueDateValue,
    setDueDateValue,
    mentionIds,
    setMentionIds,
    noteDialogCoords,
    noteDialogContentRef,
    isReminderSaveDisabled,
    handleReminderContextMenu,
    handleNoteSave,
    handleNoteDialogOpenChange,
  }
}
