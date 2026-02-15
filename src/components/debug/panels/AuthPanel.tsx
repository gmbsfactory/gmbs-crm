"use client"

import { memo, useState, useEffect, useCallback } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { usePermissions } from '@/hooks/usePermissions'
import { supabase } from '@/lib/supabase-client'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Copy, ChevronDown, ChevronRight } from 'lucide-react'

export const AuthPanel = memo(function AuthPanel() {
  const { data: user, isLoading: isLoadingUser } = useCurrentUser()
  const { permissions, isLoading: isLoadingPerms, isAdmin, permissionsData } = usePermissions()
  const [tokenExpiry, setTokenExpiry] = useState<string | null>(null)
  const [permissionsOpen, setPermissionsOpen] = useState(false)

  useEffect(() => {
    async function getTokenInfo() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.expires_at) {
        setTokenExpiry(new Date(session.expires_at * 1000).toLocaleString())
      }
    }
    getTokenInfo()
  }, [])

  const handleCopyInfo = useCallback(() => {
    const info = {
      email: user?.email,
      id: user?.id,
      roles: user?.roles,
      status: user?.status,
      permissions,
    }
    navigator.clipboard.writeText(JSON.stringify(info, null, 2))
  }, [user, permissions])

  if (isLoadingUser) {
    return (
      <div className="p-4 text-xs text-muted-foreground font-mono">
        Loading user session...
      </div>
    )
  }

  if (!user) {
    return (
      <div className="p-4 text-xs text-muted-foreground font-mono">
        No active session
      </div>
    )
  }

  // All permission keys for display
  const allPermissionKeys = [
    'read_interventions', 'write_interventions', 'delete_interventions', 'edit_closed_interventions',
    'read_artisans', 'write_artisans', 'delete_artisans', 'export_artisans',
    'read_users', 'write_users', 'delete_users',
    'manage_roles', 'manage_settings', 'view_admin', 'view_comptabilite',
  ]

  return (
    <div className="p-2 space-y-2">
      {/* Session card */}
      <div className="rounded-md border p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold uppercase tracking-wide">Current Session</h4>
          <button
            onClick={handleCopyInfo}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Copy session info"
          >
            <Copy className="h-3 w-3" />
          </button>
        </div>
        <div className="space-y-1 text-xs font-mono">
          <Row label="User" value={user.email || 'N/A'} />
          <Row label="UID" value={user.id ? `${user.id.slice(0, 8)}...` : 'N/A'} full={user.id || ''} />
          <Row label="Role(s)" value={user.roles?.join(', ') || 'None'} />
          <Row label="Status" value={user.status || 'unknown'} />
          <Row label="Admin" value={isAdmin ? 'Yes' : 'No'} />
          {tokenExpiry && <Row label="Token Exp." value={tokenExpiry} />}
        </div>
      </div>

      {/* Permissions matrix */}
      <Collapsible open={permissionsOpen} onOpenChange={setPermissionsOpen}>
        <CollapsibleTrigger className="flex items-center gap-1 w-full rounded-md border p-3 hover:bg-muted/50 transition-colors">
          {permissionsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <h4 className="text-xs font-bold uppercase tracking-wide">
            Permissions ({permissions.length}/{allPermissionKeys.length})
          </h4>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="rounded-md border border-t-0 rounded-t-none p-3 -mt-0">
            {isLoadingPerms ? (
              <p className="text-xs text-muted-foreground">Loading permissions...</p>
            ) : (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {allPermissionKeys.map((key) => {
                  const granted = permissions.includes(key as any)
                  return (
                    <div key={key} className="flex items-center gap-2 text-xs font-mono">
                      <span className={granted ? 'text-green-500' : 'text-red-500'}>
                        {granted ? '\u2705' : '\u274C'}
                      </span>
                      <span className={granted ? '' : 'text-muted-foreground'}>
                        {key}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
})

function Row({ label, value, full }: { label: string; value: string; full?: string }) {
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(full || value)
  }, [value, full])

  return (
    <div className="flex items-center justify-between group">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">
        <span title={full}>{value}</span>
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
