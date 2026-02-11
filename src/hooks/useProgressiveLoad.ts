"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

export type ProgressiveLoadState<TData> = {
  data: TData[]
  loaded: number
  total: number
  isLoading: boolean
  isComplete: boolean
  error: string | null
}

type UseProgressiveLoadOptions<TData> = {
  batchSize?: number
  initialBatchSize?: number
  fetchBatch: (offset: number, limit: number) => Promise<TData[]>
  fetchTotal?: () => Promise<number>
  enabled?: boolean
}

/**
 * Hook pour charger des données progressivement en arrière-plan.
 * - Charge un premier lot immédiatement (affichage rapide)
 * - Continue de charger le reste en arrière-plan
 * - Fournit les informations de progression du chargement
 */
export function useProgressiveLoad<TData>({
  batchSize = 500,
  initialBatchSize = 500,
  fetchBatch,
  fetchTotal,
  enabled = true,
}: UseProgressiveLoadOptions<TData>) {
  const [state, setState] = useState<ProgressiveLoadState<TData>>({
    data: [],
    loaded: 0,
    total: 0,
    isLoading: false,
    isComplete: false,
    error: null,
  })

  const isLoadingRef = useRef(false)
  const shouldStopRef = useRef(false)

  const loadBatch = useCallback(
    async (offset: number, limit: number) => {
      try {
        const batch = await fetchBatch(offset, limit)

        if (shouldStopRef.current) {
          return 0
        }

        setState((prev) => {
          const nextLoaded = offset === 0 ? batch.length : prev.loaded + batch.length
          const nextTotal = prev.total === 0 ? nextLoaded : prev.total

          return {
            ...prev,
            data: offset === 0 ? batch : [...prev.data, ...batch],
            loaded: nextLoaded,
            total: nextTotal,
            isComplete: batch.length < limit,
          }
        })

        return batch.length
      } catch (error) {
        console.error("Erreur lors du chargement du lot:", error)
        setState((prev) => ({
          ...prev,
          error: (error as Error).message,
          isLoading: false,
        }))
        return 0
      }
    },
    [fetchBatch],
  )

  const loadProgressively = useCallback(async () => {
    if (isLoadingRef.current || !enabled) {
      return;
    }

    isLoadingRef.current = true
    shouldStopRef.current = false

    setState((prev) => ({
      ...prev,
      isLoading: true,
      isComplete: false,
      error: null,
    }))

    try {
      let total = 0
      if (fetchTotal) {
        total = await fetchTotal()
        
        if (shouldStopRef.current) {
          isLoadingRef.current = false
          setState((prev) => ({ ...prev, isLoading: false, total }))
          return
        }
        setState((prev) => ({ ...prev, total }))
      }

      const firstBatchSize = await loadBatch(0, initialBatchSize)

      if (firstBatchSize === 0 || shouldStopRef.current) {
        setState((prev) => ({ ...prev, isLoading: false, isComplete: true }))
        return
      }

      let offset = initialBatchSize
      let hasMore = firstBatchSize >= initialBatchSize

      while (hasMore && !shouldStopRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 100))

        const batchLoaded = await loadBatch(offset, batchSize)

        if (batchLoaded === 0 || batchLoaded < batchSize) {
          hasMore = false
        }

        offset += batchSize
      }

      setState((prev) => ({ ...prev, isLoading: false, isComplete: true }))
    } catch (error) {
      console.error("Erreur lors du chargement progressif:", error)
      setState((prev) => ({
        ...prev,
        error: (error as Error).message,
        isLoading: false,
      }))
    } finally {
      isLoadingRef.current = false
    }
  }, [batchSize, enabled, fetchTotal, initialBatchSize, loadBatch])

  const reset = useCallback(() => {
    shouldStopRef.current = true
    isLoadingRef.current = false
    setState({
      data: [],
      loaded: 0,
      total: 0,
      isLoading: false,
      isComplete: false,
      error: null,
    })
  }, [])

  useEffect(() => {
    if (enabled) {
      loadProgressively()
    } else {
    }

    return () => {
      shouldStopRef.current = true
    }
  }, [enabled, loadProgressively])

  const progress = useMemo(() => {
    if (state.total > 0) {
      return (state.loaded / state.total) * 100
    }
    if (state.loaded === 0) {
      return 0
    }
    return 100
  }, [state.loaded, state.total])

  return {
    ...state,
    reload: loadProgressively,
    reset,
    progress,
  }
}
