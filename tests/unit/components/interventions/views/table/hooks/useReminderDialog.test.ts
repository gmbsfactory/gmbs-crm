import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { useReminderDialog } from "@/components/interventions/views/table/hooks/useReminderDialog"

const makeApi = () => ({
  saveReminder: vi.fn().mockResolvedValue(undefined),
  removeReminder: vi.fn().mockResolvedValue(undefined),
  getReminderNote: vi.fn().mockReturnValue(""),
  getReminderDueDate: vi.fn().mockReturnValue(null),
  getReminderMentions: vi.fn().mockReturnValue([]),
  lookupIdInter: vi.fn().mockReturnValue("INT-42"),
})

const makeMouseEvent = (overrides: Partial<DOMRect> = {}) => {
  const rect: DOMRect = {
    top: 100,
    left: 200,
    right: 220,
    bottom: 130,
    width: 20,
    height: 30,
    x: 200,
    y: 100,
    toJSON: () => ({}),
    ...overrides,
  } as DOMRect
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    currentTarget: { getBoundingClientRect: () => rect } as unknown as HTMLElement,
  } as unknown as React.MouseEvent
}

describe("useReminderDialog", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 })
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 })
  })

  it("starts with the dialog closed and the save button disabled", () => {
    const { result } = renderHook(() => useReminderDialog(makeApi()))
    expect(result.current.showNoteDialog).toBe(false)
    expect(result.current.isReminderSaveDisabled).toBe(true)
  })

  it("opens the dialog populated with the existing reminder data", () => {
    const api = makeApi()
    api.getReminderNote.mockReturnValue("existing note")
    api.getReminderDueDate.mockReturnValue("2026-05-10T00:00:00Z")
    api.getReminderMentions.mockReturnValue([
      "11111111-1111-1111-8111-111111111111",
      "not-a-uuid",
    ])

    const { result } = renderHook(() => useReminderDialog(api))
    act(() => result.current.handleReminderContextMenu(makeMouseEvent(), "row-1"))

    expect(result.current.showNoteDialog).toBe(true)
    expect(result.current.noteDialogInterventionId).toBe("row-1")
    expect(result.current.noteValue).toBe("existing note")
    expect(result.current.dueDateValue).toBeInstanceOf(Date)
    expect(result.current.mentionIds).toEqual(["11111111-1111-1111-8111-111111111111"])
    expect(result.current.isReminderSaveDisabled).toBe(false)
  })

  it("re-anchors the dialog on the right when the left side would clip", () => {
    const { result } = renderHook(() => useReminderDialog(makeApi()))
    act(() => result.current.handleReminderContextMenu(makeMouseEvent({ left: 10, right: 30 }), "row-1"))
    expect(result.current.noteDialogCoords.left).toBeGreaterThanOrEqual(16)
  })

  it("calls saveReminder with idInter and resets state on save", async () => {
    const api = makeApi()
    api.getReminderNote.mockReturnValue("hello")
    const { result } = renderHook(() => useReminderDialog(api))
    act(() => result.current.handleReminderContextMenu(makeMouseEvent(), "row-1"))

    await act(async () => {
      await result.current.handleNoteSave()
    })

    expect(api.lookupIdInter).toHaveBeenCalledWith("row-1")
    expect(api.saveReminder).toHaveBeenCalledWith({
      interventionId: "row-1",
      idInter: "INT-42",
      note: "hello",
      dueDate: null,
      mentionedUserIds: [],
    })
    expect(api.removeReminder).not.toHaveBeenCalled()
    expect(result.current.showNoteDialog).toBe(false)
    expect(result.current.noteDialogInterventionId).toBeNull()
  })

  it("removes the reminder when both note and due date are empty", async () => {
    const api = makeApi()
    const { result } = renderHook(() => useReminderDialog(api))
    act(() => result.current.handleReminderContextMenu(makeMouseEvent(), "row-1"))

    await act(async () => {
      await result.current.handleNoteSave()
    })

    expect(api.removeReminder).toHaveBeenCalledWith("row-1")
    expect(api.saveReminder).not.toHaveBeenCalled()
  })

  it("clears state when handleNoteDialogOpenChange(false) is called", () => {
    const { result } = renderHook(() => useReminderDialog(makeApi()))
    act(() => result.current.handleReminderContextMenu(makeMouseEvent(), "row-1"))
    expect(result.current.showNoteDialog).toBe(true)

    act(() => result.current.handleNoteDialogOpenChange(false))
    expect(result.current.showNoteDialog).toBe(false)
    expect(result.current.noteDialogInterventionId).toBeNull()
    expect(result.current.noteValue).toBe("")
  })

  it("does nothing when handleNoteSave is called without an active intervention", async () => {
    const api = makeApi()
    const { result } = renderHook(() => useReminderDialog(api))
    await act(async () => {
      await result.current.handleNoteSave()
    })
    expect(api.saveReminder).not.toHaveBeenCalled()
    expect(api.removeReminder).not.toHaveBeenCalled()
  })
})
