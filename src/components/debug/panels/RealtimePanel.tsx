"use client"

import { memo, useRef, useEffect, useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useRealtimeStats } from '@/hooks/useRealtimeStats'
import { referenceCacheManager } from '@/lib/api/common/cache'
import { interventionKeys, artisanKeys } from '@/lib/react-query/queryKeys'
import { ChevronDown, ChevronRight, Trash2, Copy } from 'lucide-react'

interface ErrorEntry {
  timestamp: number
  message: string
  type: 'error' | 'warning' | 'success'
}

function formatTimeAgo(timestamp: number | null): string {
  if (!timestamp) return 'N/A'
  const diff = (Date.now() - timestamp) / 1000
  if (diff < 1) return '<1s ago'
  if (diff < 60) return `${Math.floor(diff)}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

function formatMs(ms: number | null): string {
  if (ms === null) return 'N/A'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}m ${rem}s`
}

const statusColors = {
  realtime: 'bg-green-500',
  polling: 'bg-yellow-500',
  connecting: 'bg-blue-500',
  failed: 'bg-red-500',
} as const

const statusLabels = {
  realtime: 'REALTIME CONNECTED',
  polling: 'POLLING FALLBACK',
  connecting: 'CONNECTING...',
} as const

function StatusBanner({ stats }: { stats: NonNullable<ReturnType<typeof useRealtimeStats>['stats']> }) {
  const status = stats.connectionStatus
  const dotColor = statusColors[status] || statusColors.failed
  const label = statusLabels[status] || 'UNKNOWN'

  return (
    <div className={`rounded-md border p-3 mb-2 ${
      status === 'realtime' ? 'border-green-500/30 bg-green-500/5' :
      status === 'polling' ? 'border-yellow-500/30 bg-yellow-500/5' :
      'border-blue-500/30 bg-blue-500/5'
    }`}>
      <div className="flex items-center gap-2">
        <div className={`w-2.5 h-2.5 rounded-full ${dotColor} animate-pulse`} />
        <span className="font-bold text-xs uppercase tracking-wide">{label}</span>
        <span className="text-xs text-muted-foreground ml-auto">
          {formatTimeAgo(stats.lastEventTime)}
        </span>
      </div>
      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
        <span>{stats.leaderStatus === 'leader' ? 'Leader' : stats.leaderStatus === 'follower' ? 'Follower' : 'Acquiring...'}</span>
        <span>|</span>
        <span>Uptime: {formatDuration(stats.uptime)}</span>
      </div>
    </div>
  )
}

function LeadershipCard({ stats }: { stats: NonNullable<ReturnType<typeof useRealtimeStats>['stats']> }) {
  const webLocksSupported = typeof navigator !== 'undefined' && 'locks' in navigator

  return (
    <div className="rounded-md border p-3 mb-2">
      <h4 className="text-xs font-bold uppercase tracking-wide mb-2">Leadership</h4>
      <div className="space-y-1 text-xs font-mono">
        <Row label="Status" value={
          stats.leaderStatus === 'leader' ? 'Leader' :
          stats.leaderStatus === 'follower' ? 'Follower' : 'Acquiring...'
        } />
        <Row label="Web Locks API" value={webLocksSupported ? 'Supported' : 'Not Available'} />
        <Row label="Relay Active" value={stats.relayActive ? 'Yes' : 'No'} />
        <Row label="Uptime" value={formatDuration(stats.uptime)} />
      </div>
    </div>
  )
}

function EventsCard({ stats }: { stats: NonNullable<ReturnType<typeof useRealtimeStats>['stats']> }) {
  const uptimeSec = stats.uptime / 1000
  const tables = [
    { name: 'Interventions', count: stats.eventsReceived.interventions, icon: '\u{1F4DD}' },
    { name: 'Artisans', count: stats.eventsReceived.artisans, icon: '\u{1F465}' },
    { name: 'Junctions', count: stats.eventsReceived.junctions, icon: '\u{1F517}' },
  ]

  return (
    <div className="rounded-md border p-3 mb-2">
      <h4 className="text-xs font-bold uppercase tracking-wide mb-2">
        Events Received
        {stats.lastEventType && (
          <span className="font-normal text-muted-foreground ml-2">
            Last: {stats.lastEventType}
          </span>
        )}
      </h4>
      <div className="space-y-2 text-xs font-mono">
        {tables.map((t) => {
          const rate = uptimeSec > 0 ? (t.count / uptimeSec).toFixed(2) : '0.00'
          return (
            <div key={t.name} className="flex items-center justify-between">
              <span>{t.icon} {t.name}</span>
              <div className="flex items-center gap-3">
                <span className="font-bold">{t.count}</span>
                <span className="text-muted-foreground">{rate} evt/s</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SubscriptionCard({ debugInfo }: { debugInfo: NonNullable<ReturnType<typeof useRealtimeStats>['debugInfo']> }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 w-full rounded-md border p-3 mb-2 hover:bg-muted/50 transition-colors">
        {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <h4 className="text-xs font-bold uppercase tracking-wide">Subscription Config</h4>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="rounded-md border border-t-0 rounded-t-none p-3 mb-2 -mt-2 space-y-1 text-xs font-mono">
          <Row label="Channel" value={debugInfo.channelName} />
          <Row label="Tables" value={debugInfo.subscriptionPayload.tables.join(', ')} />
          {Object.entries(debugInfo.subscriptionPayload.filters).map(([table, filter]) => (
            <Row key={table} label={`  ${table}`} value={filter} />
          ))}
          <Row label="Schema" value="public" />
          <Row label="Events" value={debugInfo.subscriptionPayload.events.join(', ')} />
          <Row label="Sub. Time" value={formatMs(debugInfo.subscriptionTime)} />
          <Row label="Attempts" value={String(debugInfo.subscriptionAttempts)} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function ErrorLogCard({ stats }: { stats: NonNullable<ReturnType<typeof useRealtimeStats>['stats']> }) {
  const [isOpen, setIsOpen] = useState(false)
  const errorsRef = useRef<ErrorEntry[]>([])
  const lastErrorTimeRef = useRef<number | null>(null)
  const [, forceUpdate] = useState(0)

  // Append new errors when lastErrorTime changes
  useEffect(() => {
    if (stats.lastErrorTime && stats.lastErrorTime !== lastErrorTimeRef.current) {
      lastErrorTimeRef.current = stats.lastErrorTime
      const entry: ErrorEntry = {
        timestamp: stats.lastErrorTime,
        message: stats.lastError || 'Unknown error',
        type: stats.lastError?.toLowerCase().includes('success') || stats.lastError?.toLowerCase().includes('subscribed') ? 'success' : 'error',
      }
      errorsRef.current = [entry, ...errorsRef.current].slice(0, 10)
      forceUpdate((n) => n + 1)
    }
  }, [stats.lastErrorTime, stats.lastError])

  const clearErrors = useCallback(() => {
    errorsRef.current = []
    forceUpdate((n) => n + 1)
  }, [])

  const errorCount = errorsRef.current.length

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 w-full rounded-md border p-3 mb-2 hover:bg-muted/50 transition-colors">
        {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <h4 className="text-xs font-bold uppercase tracking-wide">
          Connection Errors
          {errorCount > 0 && (
            <span className="ml-2 text-red-500 font-normal">({errorCount})</span>
          )}
        </h4>
        <span className="ml-auto text-xs text-muted-foreground">
          Reconnects: {stats.reconnectAttempts}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="rounded-md border border-t-0 rounded-t-none p-3 mb-2 -mt-2">
          {errorsRef.current.length === 0 ? (
            <p className="text-xs text-muted-foreground">No errors recorded</p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {errorsRef.current.map((entry, i) => (
                <div key={`${entry.timestamp}-${i}`} className="text-xs font-mono">
                  <span className="text-muted-foreground">
                    [{new Date(entry.timestamp).toLocaleTimeString()}]
                  </span>
                  <span className={`ml-1 ${entry.type === 'error' ? 'text-red-500' : entry.type === 'success' ? 'text-green-500' : 'text-yellow-500'}`}>
                    {entry.message}
                  </span>
                </div>
              ))}
            </div>
          )}
          {errorsRef.current.length > 0 && (
            <button
              onClick={clearErrors}
              className="flex items-center gap-1 mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Trash2 className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function CacheSyncCard() {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)
  const [cacheAge, setCacheAge] = useState<number | null>(null)
  const [cacheValid, setCacheValid] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setCacheAge(referenceCacheManager.getAge())
      setCacheValid(referenceCacheManager.isValid())
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  const queryCache = queryClient.getQueryCache().getAll()
  const interventionCount = queryCache.filter((q) =>
    JSON.stringify(q.queryKey).includes('interventions')
  ).length
  const artisanCount = queryCache.filter((q) =>
    JSON.stringify(q.queryKey).includes('artisans')
  ).length
  const totalQueries = queryCache.length

  const handleInvalidate = useCallback(() => {
    referenceCacheManager.invalidate()
    queryClient.invalidateQueries({ queryKey: interventionKeys.all })
    queryClient.invalidateQueries({ queryKey: artisanKeys.all })
  }, [queryClient])

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 w-full rounded-md border p-3 mb-2 hover:bg-muted/50 transition-colors">
        {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <h4 className="text-xs font-bold uppercase tracking-wide">Cache Sync</h4>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="rounded-md border border-t-0 rounded-t-none p-3 mb-2 -mt-2 space-y-1 text-xs font-mono">
          <Row label="Ref. Cache Age" value={cacheAge !== null ? formatMs(cacheAge) : 'Empty'} />
          <Row label="Ref. Cache Valid" value={cacheValid ? 'Yes' : 'No'} />
          <div className="border-t my-2" />
          <Row label="Intervention Queries" value={String(interventionCount)} />
          <Row label="Artisan Queries" value={String(artisanCount)} />
          <Row label="Total Queries" value={String(totalQueries)} />
          <button
            onClick={handleInvalidate}
            className="mt-2 px-2 py-1 text-xs border rounded hover:bg-muted/50 transition-colors"
          >
            Invalidate All
          </button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(value)
  }, [value])

  return (
    <div className="flex items-center justify-between group">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <span>{value}</span>
        <button
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          title="Copy"
        >
          <Copy className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>
    </div>
  )
}

export const RealtimePanel = memo(function RealtimePanel() {
  const { stats, debugInfo } = useRealtimeStats()

  if (!stats) {
    return (
      <div className="p-4 text-xs text-muted-foreground font-mono">
        Waiting for Realtime stats...
        <p className="mt-1">Stats will appear once the realtime connection initializes.</p>
      </div>
    )
  }

  return (
    <div className="space-y-0 p-2">
      <StatusBanner stats={stats} />
      <LeadershipCard stats={stats} />
      <EventsCard stats={stats} />
      {debugInfo && <SubscriptionCard debugInfo={debugInfo} />}
      <ErrorLogCard stats={stats} />
      <CacheSyncCard />
    </div>
  )
})
