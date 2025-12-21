"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "@/lib/supabase-client"

export type BatchResolverMapValue = { label: string; color?: string | null }

type BatchResolverOptions<T> = {
  ids: string[]
  table: string
  select: string
  buildLabel: (row: T) => BatchResolverMapValue
  enabled?: boolean
  idField?: string
  chunkSize?: number
}

const chunkIds = (ids: string[], size: number) => {
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size))
  }
  return chunks
}

export function useBatchResolver<T extends Record<string, any>>({
  ids,
  table,
  select,
  buildLabel,
  enabled = true,
  idField = "id",
  chunkSize = 50,
}: BatchResolverOptions<T>) {
  const [map, setMap] = useState<Record<string, BatchResolverMapValue>>({})
  const inFlightRef = useRef(new Set<string>())
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const missingIds = useMemo(() => {
    return ids.filter((id) => id && !map[id] && !inFlightRef.current.has(id))
  }, [ids, map])

  useEffect(() => {
    if (!enabled || missingIds.length === 0) return
    let cancelled = false

    const fetchBatches = async () => {
      const batches = chunkIds(missingIds, chunkSize)

      for (const batch of batches) {
        if (cancelled) return
        batch.forEach((id) => inFlightRef.current.add(id))

        const { data, error } = await supabase
          .from(table)
          .select(select)
          .in(idField, batch)

        batch.forEach((id) => inFlightRef.current.delete(id))

        if (cancelled || !mountedRef.current) return

        if (error) {
          console.error(`[history] Impossible de charger ${table}`, error)
          continue
        }

        if (data?.length) {
          const nextEntries: Record<string, BatchResolverMapValue> = {}
          data.forEach((row) => {
            const rowRecord = row as unknown as Record<string, unknown>
            const rowId = rowRecord[idField] as string | undefined
            if (!rowId) return
            nextEntries[rowId] = buildLabel(rowRecord as T)
          })
          if (Object.keys(nextEntries).length > 0) {
            setMap((prev) => ({ ...prev, ...nextEntries }))
          }
        }
      }
    }

    void fetchBatches()
    return () => {
      cancelled = true
    }
  }, [enabled, missingIds, table, select, idField, buildLabel, chunkSize])

  return { map }
}
