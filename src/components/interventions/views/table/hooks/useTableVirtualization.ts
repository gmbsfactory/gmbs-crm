import { useEffect, useMemo, useRef, type RefObject } from "react"
import { useVirtualizer, type Virtualizer } from "@tanstack/react-virtual"
import { SCROLL_CONFIG } from "@/config/interventions"

type Item = { id?: string }

type UseTableVirtualizationOptions<T extends Item> = {
  scrollerRef: RefObject<HTMLDivElement | null>
  dataset: T[]
  rowHeight: number
  currentPage: number
}

export type TableVirtualizationResult = {
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>
  virtualItems: ReturnType<Virtualizer<HTMLDivElement, Element>["getVirtualItems"]>
  totalHeight: number
  visibleItems: ReturnType<Virtualizer<HTMLDivElement, Element>["getVirtualItems"]>
  firstVisible: number
  lastVisible: number
  datasetSignature: string
}

export function useTableVirtualization<T extends Item>({
  scrollerRef,
  dataset,
  rowHeight,
  currentPage,
}: UseTableVirtualizationOptions<T>): TableVirtualizationResult {
  const datasetSignature = useMemo(() => {
    if (dataset.length === 0) return `empty-${currentPage}`
    const firstId = dataset[0]?.id ?? "none"
    const lastId = dataset[dataset.length - 1]?.id ?? "none"
    return `${currentPage}-${dataset.length}-${firstId}-${lastId}`
  }, [dataset, currentPage])

  const rowVirtualizer = useVirtualizer({
    count: dataset.length,
    getScrollElement: () => scrollerRef.current,
    estimateSize: () => rowHeight,
    overscan: SCROLL_CONFIG.OVERSCAN,
    getItemKey: (index) => {
      const item = dataset[index]
      return item?.id ? `${item.id}-${index}` : `index-${index}`
    },
  })

  // Reset scroll on page change (not on every dataset change).
  const previousPageRef = useRef(currentPage)
  useEffect(() => {
    if (previousPageRef.current !== currentPage) {
      previousPageRef.current = currentPage
      if (scrollerRef.current && dataset.length > 0) {
        scrollerRef.current.scrollTop = 0
        requestAnimationFrame(() => {
          if (scrollerRef.current) {
            rowVirtualizer.scrollToIndex(0, { align: "start" })
          }
        })
      }
    }
  }, [currentPage, dataset.length, rowVirtualizer, scrollerRef])

  // Re-measure only when rowHeight changes.
  const previousRowHeightRef = useRef(rowHeight)
  useEffect(() => {
    if (previousRowHeightRef.current !== rowHeight && dataset.length > 0) {
      previousRowHeightRef.current = rowHeight
      rowVirtualizer.measure()
    }
  }, [rowHeight, dataset.length, rowVirtualizer])

  const virtualItems = rowVirtualizer.getVirtualItems()
  const totalHeight = rowVirtualizer.getTotalSize()

  const scroller = scrollerRef.current
  const viewportTop = scroller?.scrollTop ?? 0
  const viewportHeight = scroller?.clientHeight ?? 0
  const viewportBottom = viewportTop + viewportHeight

  const visibleItems = virtualItems.filter((item) => {
    const itemTop = item.start
    const itemBottom = item.start + item.size
    return itemBottom > viewportTop && itemTop < viewportBottom
  })

  const firstVisible = visibleItems[0]?.index ?? virtualItems[0]?.index ?? 0
  const lastVisible =
    visibleItems[visibleItems.length - 1]?.index ??
    virtualItems[virtualItems.length - 1]?.index ??
    0

  return {
    rowVirtualizer,
    virtualItems,
    totalHeight,
    visibleItems,
    firstVisible,
    lastVisible,
    datasetSignature,
  }
}
