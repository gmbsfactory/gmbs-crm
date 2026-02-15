"use client"

import { memo, useState, useEffect, useCallback, useRef } from 'react'
import { Trash2, Filter } from 'lucide-react'

interface CapturedRequest {
  id: number
  method: string
  url: string
  status: number | null
  duration: number | null
  size: string | null
  timestamp: number
}

const MAX_REQUESTS = 50
let requestBuffer: CapturedRequest[] = []
let nextId = 1
let isIntercepting = false
let originalFetch: typeof window.fetch | null = null

function startIntercepting() {
  if (isIntercepting || typeof window === 'undefined') return

  originalFetch = window.fetch
  isIntercepting = true

  window.fetch = async function interceptedFetch(input, init) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url
    const method = init?.method || (input instanceof Request ? input.method : 'GET')
    const id = nextId++
    const startTime = performance.now()

    const entry: CapturedRequest = {
      id,
      method: method.toUpperCase(),
      url,
      status: null,
      duration: null,
      size: null,
      timestamp: Date.now(),
    }

    // Add entry immediately
    requestBuffer = [entry, ...requestBuffer].slice(0, MAX_REQUESTS)

    try {
      const response = await originalFetch!.call(window, input, init)
      const duration = Math.round(performance.now() - startTime)

      // Update entry in-place
      entry.status = response.status
      entry.duration = duration

      // Try to get size from content-length header
      const contentLength = response.headers.get('content-length')
      if (contentLength) {
        const bytes = parseInt(contentLength, 10)
        entry.size = bytes < 1024 ? `${bytes}B` : `${(bytes / 1024).toFixed(1)}KB`
      }

      return response
    } catch (error) {
      entry.status = 0
      entry.duration = Math.round(performance.now() - startTime)
      throw error
    }
  }
}

function stopIntercepting() {
  if (!isIntercepting || !originalFetch) return
  window.fetch = originalFetch
  originalFetch = null
  isIntercepting = false
}

function clearBuffer() {
  requestBuffer = []
}

export const NetworkPanel = memo(function NetworkPanel() {
  const [requests, setRequests] = useState<CapturedRequest[]>([])
  const [filter, setFilter] = useState<'all' | 'error' | 'slow'>('all')
  const filterRef = useRef(filter)
  filterRef.current = filter

  // Start intercepting and poll for updates
  useEffect(() => {
    startIntercepting()

    const interval = setInterval(() => {
      setRequests([...requestBuffer])
    }, 500)

    return () => {
      clearInterval(interval)
      // Don't stop intercepting on unmount — keep capturing for when panel reopens
    }
  }, [])

  const handleClear = useCallback(() => {
    clearBuffer()
    setRequests([])
  }, [])

  const filtered = filter === 'all'
    ? requests
    : filter === 'error'
    ? requests.filter((r) => r.status !== null && (r.status === 0 || r.status >= 400))
    : requests.filter((r) => r.duration !== null && r.duration > 300)

  return (
    <div className="p-2 space-y-2">
      <div className="rounded-md border p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold uppercase tracking-wide">
            Recent API Calls ({filtered.length})
          </h4>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs">
              <Filter className="h-3 w-3 text-muted-foreground" />
              {(['all', 'error', 'slow'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-1.5 py-0.5 rounded text-xs ${
                    filter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <button
              onClick={handleClear}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Clear"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        <div className="space-y-1 max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground font-mono py-2">
              {requests.length === 0 ? 'No requests captured yet' : 'No requests match filter'}
            </p>
          ) : (
            filtered.map((req) => <RequestRow key={req.id} request={req} />)
          )}
        </div>
      </div>
    </div>
  )
})

function RequestRow({ request }: { request: CapturedRequest }) {
  const statusIcon = request.status === null ? '\u23F3' :
    request.status >= 200 && request.status < 300 ? '\u2705' :
    request.status >= 300 && request.status < 400 ? '\u21AA\uFE0F' :
    '\u274C'

  const isError = request.status !== null && (request.status === 0 || request.status >= 400)
  const isSlow = request.duration !== null && request.duration > 300

  // Truncate URL for display: remove origin, keep path
  let displayUrl = request.url
  try {
    const parsed = new URL(request.url, window.location.origin)
    displayUrl = parsed.pathname + parsed.search
  } catch {
    // Keep original if parsing fails
  }

  return (
    <div className={`text-xs font-mono rounded px-2 py-1.5 ${isError ? 'bg-red-500/5' : isSlow ? 'bg-yellow-500/5' : 'hover:bg-muted/30'}`}>
      <div className="flex items-center gap-2">
        <span className="text-[10px]">{statusIcon}</span>
        <span className={`font-bold w-10 ${
          request.method === 'GET' ? 'text-blue-500' :
          request.method === 'POST' ? 'text-green-500' :
          request.method === 'PUT' ? 'text-yellow-500' :
          request.method === 'DELETE' ? 'text-red-500' :
          'text-muted-foreground'
        }`}>
          {request.method}
        </span>
        <span className="truncate flex-1" title={request.url}>{displayUrl}</span>
      </div>
      <div className="flex items-center gap-3 mt-0.5 text-muted-foreground ml-6">
        {request.status !== null && (
          <span className={isError ? 'text-red-500' : ''}>{request.status}</span>
        )}
        {request.duration !== null && (
          <span className={isSlow ? 'text-yellow-500 font-bold' : ''}>
            {request.duration}ms
          </span>
        )}
        {request.size && <span>{request.size}</span>}
        <span className="ml-auto">{new Date(request.timestamp).toLocaleTimeString()}</span>
      </div>
    </div>
  )
}
