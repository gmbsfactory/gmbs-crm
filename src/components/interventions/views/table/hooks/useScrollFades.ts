import { useCallback, useEffect, useRef, useState, type RefObject } from "react"

type UseScrollFadesOptions = {
  scrollerRef: RefObject<HTMLElement | null>
  rowHeight: number
  /** Values that should re-trigger an immediate recomputation (e.g. dataset length, expanded row). */
  recomputeDeps: ReadonlyArray<unknown>
}

export const useScrollFades = ({
  scrollerRef,
  rowHeight,
  recomputeDeps,
}: UseScrollFadesOptions) => {
  const [showTopFade, setShowTopFade] = useState(false)
  const [showBottomFade, setShowBottomFade] = useState(true)
  const rafIdRef = useRef<number | null>(null)

  const computeFades = useCallback(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const { scrollTop, scrollHeight, clientHeight } = scroller
    const scrollBottom = scrollHeight - scrollTop - clientHeight
    setShowTopFade(scrollTop > rowHeight * 0.5)
    setShowBottomFade(scrollBottom > rowHeight * 0.5)
  }, [rowHeight, scrollerRef])

  const handleScrollWithFades = useCallback(() => {
    if (rafIdRef.current !== null) return
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null
      computeFades()
    })
  }, [computeFades])

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
      }
    }
  }, [])

  useEffect(() => {
    computeFades()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computeFades, ...recomputeDeps])

  return { showTopFade, showBottomFade, handleScrollWithFades }
}
