"use client"

import { memo, useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

interface QueryGroupStats {
  prefix: string
  total: number
  active: number
  stale: number
  inactive: number
  errored: number
}

export const PerformancePanel = memo(function PerformancePanel() {
  const queryClient = useQueryClient()
  const [queryStats, setQueryStats] = useState<{
    total: number
    active: number
    stale: number
    inactive: number
    errored: number
    groups: QueryGroupStats[]
  }>({ total: 0, active: 0, stale: 0, inactive: 0, errored: 0, groups: [] })

  useEffect(() => {
    function computeStats() {
      const cache = queryClient.getQueryCache().getAll()
      let active = 0
      let stale = 0
      let inactive = 0
      let errored = 0
      const groupMap = new Map<string, QueryGroupStats>()

      for (const query of cache) {
        const prefix = String(query.queryKey[0] ?? 'unknown')
        const isActive = query.getObserversCount() > 0
        const isStale = query.isStale()
        const isError = query.state.status === 'error'

        if (isError) errored++
        else if (!isActive) inactive++
        else if (isStale) stale++
        else active++

        if (!groupMap.has(prefix)) {
          groupMap.set(prefix, { prefix, total: 0, active: 0, stale: 0, inactive: 0, errored: 0 })
        }
        const group = groupMap.get(prefix)!
        group.total++
        if (isError) group.errored++
        else if (!isActive) group.inactive++
        else if (isStale) group.stale++
        else group.active++
      }

      const groups = Array.from(groupMap.values()).sort((a, b) => b.total - a.total)

      setQueryStats({ total: cache.length, active, stale, inactive, errored, groups })
    }

    computeStats()
    const interval = setInterval(computeStats, 2000)
    return () => clearInterval(interval)
  }, [queryClient])

  return (
    <div className="p-2 space-y-2">
      {/* Global stats */}
      <div className="rounded-md border p-3">
        <h4 className="text-xs font-bold uppercase tracking-wide mb-2">TanStack Query Client</h4>
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <StatBox label="Active" value={queryStats.active} color="text-green-500" />
          <StatBox label="Stale" value={queryStats.stale} color="text-yellow-500" />
          <StatBox label="Inactive" value={queryStats.inactive} color="text-muted-foreground" />
          <StatBox label="Errored" value={queryStats.errored} color="text-red-500" />
        </div>
        <div className="mt-2 text-xs text-muted-foreground font-mono">
          Total cached queries: {queryStats.total}
        </div>
      </div>

      {/* Per-group breakdown */}
      <div className="rounded-md border p-3">
        <h4 className="text-xs font-bold uppercase tracking-wide mb-2">Query Groups</h4>
        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          {queryStats.groups.map((group) => (
            <div key={group.prefix} className="text-xs font-mono flex items-center justify-between">
              <span className="truncate max-w-[140px]">{group.prefix}</span>
              <div className="flex items-center gap-2">
                <span className="text-green-500">{group.active}</span>
                <span className="text-muted-foreground">/</span>
                <span className="text-yellow-500">{group.stale}</span>
                <span className="text-muted-foreground">/</span>
                <span>{group.inactive}</span>
                {group.errored > 0 && (
                  <span className="text-red-500 ml-1">({group.errored} err)</span>
                )}
              </div>
            </div>
          ))}
          {queryStats.groups.length === 0 && (
            <p className="text-xs text-muted-foreground">No queries in cache</p>
          )}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Format: active / stale / inactive
        </div>
      </div>
    </div>
  )
})

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between px-2 py-1 rounded bg-muted/30">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-bold ${color}`}>{value}</span>
    </div>
  )
}
