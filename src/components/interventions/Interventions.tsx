"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Clock } from "lucide-react"
import InterventionCard from "@/components/interventions/InterventionCard"
import Loader from "@/components/ui/Loader"
import { mapStatusFromDb, mapStatusToDb } from "@/lib/interventions/mappers"
import useInterventionModal from "@/hooks/useInterventionModal"
import type { InterventionStatusValue } from "@/types/interventions"
import type { InterventionView } from "@/types/intervention-view"
import type { Intervention as SupabaseIntervention } from "@/lib/supabase-api-v2"

type ScrollDirection = "left" | "right" | null

type InterventionsProps = {
  interventions: InterventionView[]
  loading: boolean
  error: string | null
  selectedStatus: InterventionStatusValue | null
  displayedStatuses: InterventionStatusValue[]
  onSelectStatus: (status: InterventionStatusValue | null) => void
  getCountByStatus: (status: InterventionStatusValue | null) => number
  onStatusChange: (id: string, status: InterventionStatusValue) => void
}

const DEFAULT_STATUS_LABEL = "Toutes les interventions"
const SCROLL_THRESHOLD = 100

export default function Interventions({
  interventions,
  loading,
  error,
  selectedStatus,
  displayedStatuses,
  onSelectStatus,
  getCountByStatus,
  onStatusChange,
}: InterventionsProps) {
  const { open } = useInterventionModal()
  const orderedIds = React.useMemo(() => interventions.map((item) => item.id), [interventions])

  const [keyboardSelectedIndex, setKeyboardSelectedIndex] = React.useState<number>(-1)
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const [isKeyboardMode, setIsKeyboardMode] = React.useState(false)
  const lastMouseOverIndex = React.useRef<number>(-1)
  const cardRefs = React.useRef<(HTMLDivElement | null)[]>([])
  const lastEscAtRef = React.useRef(0)

  const [scrollDirection, setScrollDirection] = React.useState<ScrollDirection>(null)
  const [scrollAccumulator, setScrollAccumulator] = React.useState(0)

  const animateCenterToIndex = React.useCallback((index: number) => {
    const targetEl = cardRefs.current[index]
    if (!targetEl) return

    const scrollEl = document.getElementById("main") as HTMLElement | null
    const container: HTMLElement | null = scrollEl ?? (document.scrollingElement as HTMLElement | null)
    if (!container) {
      targetEl.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }

    const containerRect = container.getBoundingClientRect()
    const targetRect = targetEl.getBoundingClientRect()
    const currentTop = container.scrollTop
    const absoluteTargetTop = currentTop + (targetRect.top - containerRect.top)
    const desiredTop = Math.max(0, absoluteTargetTop - (container.clientHeight - targetRect.height) / 2)

    const start = container.scrollTop
    const distance = desiredTop - start
    if (Math.abs(distance) < 1) return

    const duration = 300
    const startTs = performance.now()
    const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

    const prevAnchor = container.style.getPropertyValue("overflow-anchor")
    container.style.setProperty("overflow-anchor", "none")

    const step = (ts: number) => {
      const elapsed = Math.min(1, (ts - startTs) / duration)
      const eased = easeInOut(elapsed)
      container.scrollTo({ top: start + distance * eased })
      if (elapsed < 1) requestAnimationFrame(step)
      else {
        if (prevAnchor) container.style.setProperty("overflow-anchor", prevAnchor)
        else container.style.removeProperty("overflow-anchor")
      }
    }
    requestAnimationFrame(step)
  }, [])

  const onWheel = (event: React.WheelEvent) => {
    if (Math.abs(event.deltaX) < Math.abs(event.deltaY)) return
    event.preventDefault()
    setScrollAccumulator((acc) => {
      const next = acc + event.deltaX
      if (Math.abs(next) >= SCROLL_THRESHOLD) {
        const statuses: (InterventionStatusValue | null)[] = [null, ...displayedStatuses]
        const currentIndex = statuses.indexOf(selectedStatus ?? null)
        if (next > 0) {
          const nextStatus = statuses[currentIndex < statuses.length - 1 ? currentIndex + 1 : 0]
          onSelectStatus(nextStatus)
          setScrollDirection("right")
        } else {
          const nextStatus = statuses[currentIndex > 0 ? currentIndex - 1 : statuses.length - 1]
          onSelectStatus(nextStatus)
          setScrollDirection("left")
        }
        setTimeout(() => setScrollDirection(null), 200)
        return 0
      }
      return next
    })
  }

  const handleNavigateToDetail = React.useCallback(
    (id: string, index: number) => {
      open(id, {
        layoutId: `intervention-card-${id}`,
        orderedIds,
        index,
      })
    },
    [open, orderedIds],
  )

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (interventions.length === 0) return
      
      // Don't handle keyboard events if a modal is open
      const hasOpenModal = document.querySelector('[role="dialog"], [role="alertdialog"]')
      if (hasOpenModal) return

      if (event.key === "Escape") {
        const now = Date.now()
        if (now - lastEscAtRef.current < 400) {
          window.scrollTo({ top: 0, behavior: "smooth" })
        }
        lastEscAtRef.current = now
        if (keyboardSelectedIndex >= 0) {
          const currentId = interventions[keyboardSelectedIndex]?.id
          if (currentId && expandedId === currentId) {
            event.preventDefault()
            setExpandedId(null)
            return
          }
        }
        setKeyboardSelectedIndex(-1)
        return
      }

      if (event.key === "ArrowUp") {
        event.preventDefault()
        document.body.style.cursor = "none"
        setIsKeyboardMode(true)
        if (expandedId) {
          const current = interventions.findIndex((i) => i.id === expandedId)
          const next = current > 0 ? current - 1 : interventions.length - 1
          if (next >= 0) {
            setKeyboardSelectedIndex(next)
            const nextId = interventions[next]?.id
            if (nextId) setExpandedId(nextId)
          }
          return
        }
        setKeyboardSelectedIndex((prev) => {
          const start = prev === -1 ? (lastMouseOverIndex.current >= 0 ? lastMouseOverIndex.current : interventions.length - 1) : prev
          const next = start > 0 ? start - 1 : interventions.length - 1
          return next
        })
        return
      }

      if (event.key === "ArrowDown") {
        event.preventDefault()
        document.body.style.cursor = "none"
        setIsKeyboardMode(true)
        if (expandedId) {
          const current = interventions.findIndex((i) => i.id === expandedId)
          const next = current < interventions.length - 1 ? current + 1 : 0
          if (next >= 0) {
            setKeyboardSelectedIndex(next)
            const nextId = interventions[next]?.id
            if (nextId) setExpandedId(nextId)
          }
          return
        }
        setKeyboardSelectedIndex((prev) => {
          const start = prev === -1 ? (lastMouseOverIndex.current >= 0 ? lastMouseOverIndex.current : 0) : prev
          const next = start < interventions.length - 1 ? start + 1 : 0
          return next
        })
        return
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault()
        const statuses: (InterventionStatusValue | null)[] = [null, ...displayedStatuses]
        const idx = statuses.indexOf(selectedStatus ?? null)
        if (event.key === "ArrowRight") {
          const nextStatus = statuses[idx < statuses.length - 1 ? idx + 1 : 0]
          onSelectStatus(nextStatus)
          setScrollDirection("right")
        } else {
          const nextStatus = statuses[idx > 0 ? idx - 1 : statuses.length - 1]
          onSelectStatus(nextStatus)
          setScrollDirection("left")
        }
        setScrollAccumulator(SCROLL_THRESHOLD)
        setTimeout(() => {
          setScrollDirection(null)
          setScrollAccumulator(0)
        }, 200)
        return
      }

      if (event.key === " ") {
        if (keyboardSelectedIndex >= 0) {
          event.preventDefault()
          const currentId = interventions[keyboardSelectedIndex]?.id
          if (currentId) setExpandedId((prev) => (prev === currentId ? null : currentId))
        }
        return
      }
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [displayedStatuses, interventions, keyboardSelectedIndex, selectedStatus, expandedId, onSelectStatus])

  React.useEffect(() => {
    if (!isKeyboardMode) return
    const onMove = () => {
      setIsKeyboardMode(false)
      document.body.style.cursor = "auto"
    }
    window.addEventListener("mousemove", onMove)
    return () => window.removeEventListener("mousemove", onMove)
  }, [isKeyboardMode])

  const handleStatusChange = React.useCallback(
    (intervention: SupabaseIntervention, statusLabel: string) => {
      const newStatus = mapStatusFromDb(statusLabel)
      const current = interventions.find((item) => item.id === intervention.id)
      if (current?.statusValue === newStatus) return
      onStatusChange(intervention.id, newStatus)
    },
    [interventions, onStatusChange],
  )

  const displayedLabel = selectedStatus ? mapStatusToDb(selectedStatus) : DEFAULT_STATUS_LABEL
  const displayedCount = getCountByStatus(selectedStatus)

  return (
    <div className="flex flex-col">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base font-medium">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div
                className={`text-xs px-2 py-1 rounded-full ${
                  selectedStatus === null
                    ? "bg-gray-100 text-gray-700 border border-gray-200"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {displayedLabel} ({displayedCount})
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="mr-2 hidden sm:inline">Trier par:</span>
              <Clock className="h-4 w-4" />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            onWheel={onWheel}
            className={`space-y-2 transition-all duration-200 ease-out ${
              scrollDirection === "right" ? "translate-x-2 opacity-90" : ""
            } ${scrollDirection === "left" ? "-translate-x-2 opacity-90" : ""}`}
          >
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader />
              </div>
            ) : error ? (
              <div className="py-12 text-center text-sm text-destructive">{error}</div>
            ) : interventions.length === 0 ? (
              <div className="rounded-md border py-12 text-center text-sm text-muted-foreground">
                Aucune intervention ne correspond aux filtres.
              </div>
            ) : (
              interventions.map((intervention, index) => (
                <div
                  key={intervention.id}
                  data-intervention-index={index}
                  className={`relative rounded-lg p-1 transition-all duration-150 ease-out ${
                    keyboardSelectedIndex === index ? "scale-[1.01] shadow-lg" : "hover:bg-muted/50"
                  } ${isKeyboardMode ? "pointer-events-none" : ""}`}
                  onClick={() => setKeyboardSelectedIndex(index)}
                  onMouseEnter={() => {
                    lastMouseOverIndex.current = index
                    if (!isKeyboardMode) setKeyboardSelectedIndex(index)
                  }}
                  ref={(element) => {
                    cardRefs.current[index] = element
                  }}
                  tabIndex={0}
                >
                  <InterventionCard
                    intervention={intervention}
                    onSendEmail={() => console.log("TODO: send email", intervention.id)}
                    onCall={() => console.log("TODO: call", intervention.id)}
                    onAddDocument={() => console.log("TODO: add document", intervention.id)}
                    onStatusChange={(it, status) => handleStatusChange(it as unknown as SupabaseIntervention, status)}
                    expanded={expandedId === intervention.id}
                    onToggle={() => setExpandedId((prev) => (prev === intervention.id ? null : intervention.id))}
                    hideBorder={keyboardSelectedIndex === index}
                    keyboardHovered={keyboardSelectedIndex === index}
                    selectedActionIndex={-1}
                    onDoubleClick={() => handleNavigateToDetail(intervention.id, index)}
                  />
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
