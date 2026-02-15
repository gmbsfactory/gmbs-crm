"use client"

import { memo, useCallback } from 'react'
import { LeaderElection } from '@/lib/realtime/leader-election'
import { Copy } from 'lucide-react'

// Public env vars only — never expose secrets
const PUBLIC_ENV_VARS = [
  { key: 'NODE_ENV', value: process.env.NODE_ENV },
  { key: 'NEXT_PUBLIC_SUPABASE_URL', value: process.env.NEXT_PUBLIC_SUPABASE_URL },
  { key: 'NEXT_PUBLIC_ENVIRONMENT', value: process.env.NEXT_PUBLIC_ENVIRONMENT },
  { key: 'NEXT_PUBLIC_SITE_URL', value: process.env.NEXT_PUBLIC_SITE_URL },
] as const

const FEATURE_FLAGS = [
  { name: 'LEADER_ELECTION', enabled: LeaderElection.isSupported(), description: 'Web Locks API for single-tab WebSocket' },
  { name: 'REALTIME_ENABLED', enabled: true, description: 'Supabase Realtime subscription' },
  { name: 'POLLING_FALLBACK', enabled: true, description: 'Polling fallback when Realtime fails' },
  { name: 'SOFT_DELETE_FILTER', enabled: true, description: 'is_active=eq.true filter on Realtime' },
] as const

export const ConfigPanel = memo(function ConfigPanel() {
  const handleCopyAll = useCallback(() => {
    const envText = PUBLIC_ENV_VARS
      .map((v) => `${v.key}=${v.value || '(not set)'}`)
      .join('\n')
    navigator.clipboard.writeText(envText)
  }, [])

  return (
    <div className="p-2 space-y-2">
      {/* Environment Variables */}
      <div className="rounded-md border p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold uppercase tracking-wide">Environment Variables</h4>
          <button
            onClick={handleCopyAll}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Copy all"
          >
            <Copy className="h-3 w-3" />
          </button>
        </div>
        <div className="space-y-1.5">
          {PUBLIC_ENV_VARS.map((env) => (
            <div key={env.key} className="text-xs font-mono">
              <span className="text-muted-foreground">{env.key}</span>
              <div className="ml-2 truncate text-foreground" title={env.value || undefined}>
                {env.value || <span className="text-muted-foreground italic">(not set)</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature Flags */}
      <div className="rounded-md border p-3">
        <h4 className="text-xs font-bold uppercase tracking-wide mb-2">Feature Flags</h4>
        <div className="space-y-2">
          {FEATURE_FLAGS.map((flag) => (
            <div key={flag.name} className="flex items-start gap-2 text-xs font-mono">
              <span className={flag.enabled ? 'text-green-500' : 'text-red-500'}>
                {flag.enabled ? '\u2705' : '\u274C'}
              </span>
              <div>
                <span className="font-bold">{flag.name}</span>
                <p className="text-muted-foreground text-[10px] mt-0.5">{flag.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Build info */}
      <div className="rounded-md border p-3">
        <h4 className="text-xs font-bold uppercase tracking-wide mb-2">Build Info</h4>
        <div className="space-y-1 text-xs font-mono">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Next.js</span>
            <span>15.x</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">React</span>
            <span>18.x</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Browser</span>
            <span className="truncate max-w-[200px]" title={typeof navigator !== 'undefined' ? navigator.userAgent : ''}>
              {typeof navigator !== 'undefined'
                ? navigator.userAgent.includes('Chrome')
                  ? 'Chrome'
                  : navigator.userAgent.includes('Firefox')
                  ? 'Firefox'
                  : navigator.userAgent.includes('Safari')
                  ? 'Safari'
                  : 'Unknown'
                : 'SSR'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
})
