"use client"

import * as React from "react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import Link from "next/link"
import { LogOut, ScrollText, Settings as SettingsIcon, User as UserIcon } from "lucide-react"
import { supabase } from '@/lib/supabase-client'
import { useQueryClient } from "@tanstack/react-query"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { useUnseenUpdates } from "@/hooks/useUnseenUpdates"
import { getLogoutManager } from '@/lib/auth/logout-manager'
import UpdatesJournal from "@/components/layout/UpdatesJournal"

type Me = {
  id: string
  firstname?: string | null
  lastname?: string | null
  prenom?: string | null
  name?: string | null
  email: string | null
  status: string | null
  color: string | null
  code_gestionnaire?: string | null
  username?: string | null
}

export function AvatarStatus() {
  const queryClient = useQueryClient()
  const [isMounted, setIsMounted] = React.useState(false)
  const [isJournalOpen, setIsJournalOpen] = React.useState(false)
  const { data: unseenUpdates } = useUnseenUpdates()
  const unseenCount = unseenUpdates?.length ?? 0

  // Utiliser useCurrentUser pour consommer la query partagée
  // Cela évite les fetchs parallèles et profite du cache TanStack Query
  const { data: currentUser, isLoading } = useCurrentUser()
  
  // Adapter les données de useCurrentUser au format attendu par le composant
  const me: Me | null = React.useMemo(() => {
    if (!currentUser) return null
    return {
      id: currentUser.id,
      firstname: currentUser.firstname ?? null,
      lastname: currentUser.lastname ?? null,
      prenom: currentUser.prenom ?? null,
      name: currentUser.nom ?? null,
      email: currentUser.email ?? null,
      status: currentUser.status || null,
      color: currentUser.color ?? null,
      code_gestionnaire: currentUser.code_gestionnaire ?? null,
      username: currentUser.username ?? null,
    }
  }, [currentUser])

  React.useEffect(() => {
    setIsMounted(true)
  }, [])

  const status = (me?.status || 'offline') as 'connected' | 'busy' | 'dnd' | 'offline'
  const label = status === 'connected' ? 'En ligne' : status === 'busy' ? 'Occupé' : status === 'dnd' ? 'Ne pas déranger' : 'Hors ligne'
  const statusColorClass = status === 'connected' ? 'bg-green-500' : status === 'busy' ? 'bg-orange-500' : status === 'dnd' ? 'bg-red-500' : 'bg-gray-400'

  async function setStatus(next: 'connected' | 'busy' | 'dnd' | 'offline') {
    // Les cookies HTTP-only seront automatiquement inclus dans la requête
    // Pas besoin de récupérer le token depuis localStorage
    await fetch('/api/auth/status', { 
      method: 'PATCH', 
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Inclure les cookies dans la requête
      body: JSON.stringify({ status: next }) 
    })
    // Invalider la query currentUser pour forcer un refetch avec le nouveau status
    queryClient.invalidateQueries({ queryKey: ["currentUser"] })
  }

  async function logout() {
    const logoutManager = getLogoutManager()

    await logoutManager.executeLogout(
      queryClient,
      supabase,
      me?.id || null,
      {
        reason: 'user_initiated',
        broadcastToOtherTabs: true,
      }
    )
  }

  const userColor = me?.color || undefined
  const borderColor = userColor || '#e5e7eb'
  const bgColor = userColor || undefined
  const textColor = userColor ? '#ffffff' : '#1f2937'
  const avatarUrl = currentUser?.avatar_url || null
  const displayName = React.useMemo(() => {
    if (!me) return ''
    const first = me.firstname ?? me.prenom
    const last = me.lastname ?? me.name
    const full = [first, last].filter(Boolean).join(' ').trim()
    if (full) return full
    if (me.email) return String(me.email)
    return ''
  }, [me])
  const initials = React.useMemo(() => {
    const first = me?.firstname ?? me?.prenom
    const last = me?.lastname ?? me?.name
    if (first || last) {
      return ((first?.[0] || '') + (last?.[0] || '')).toUpperCase() || 'U'
    }
    if (me?.email) {
      const local = String(me.email).split('@')[0] || ''
      return (local.slice(0, 2) || 'U').toUpperCase()
    }
    return 'U'
  }, [me])

  if (!isMounted || isLoading) {
    return (
      <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
    )
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="relative h-9 w-9 rounded-full outline-none focus-visible:ring-1 focus-visible:ring-ring border-2 select-none"
            style={{ borderColor: borderColor || '#e5e7eb' }}
            aria-label={displayName || 'Profil'}
            title={displayName || ''}
          >
            <Avatar className="h-full w-full overflow-hidden" style={{ background: bgColor }}>
              {avatarUrl && (
                <AvatarImage
                  src={avatarUrl}
                  alt={displayName || 'User'}
                  className="object-cover"
                />
              )}
              <AvatarFallback
                className="font-semibold text-xs uppercase"
                style={{
                  background: bgColor,
                  color: textColor,
                }}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            <span
              aria-label={`Status ${label}`}
              className={`absolute -bottom-0 -right-0 h-2.5 w-2.5 rounded-full ring-2 ring-background z-50 ${statusColorClass}`}
            />
            {unseenCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground ring-2 ring-background z-[51]">
                {unseenCount > 9 ? "9+" : unseenCount}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>
            <div className="flex items-center gap-2">
              <div
                  className="relative h-9 w-9 rounded-full border-4 overflow-hidden"
                  style={{ borderColor: borderColor || '#e5e7eb' }}
                >
                  <Avatar className="h-full w-full" style={{ background: bgColor }}>
                    {avatarUrl && (
                      <AvatarImage
                        src={avatarUrl}
                        alt={displayName || 'User'}
                        className="object-cover"
                      />
                    )}
                    <AvatarFallback
                      className="font-semibold text-xs uppercase"
                      style={{
                        background: bgColor,
                        color: textColor,
                      }}
                    >
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                <span
                  aria-label={`Status ${label}`}
                  className={`absolute -bottom-0 -right-0 h-2.5 w-2.5 rounded-full ring-2 ring-foreground z-50 ${statusColorClass}`}
                />
              </div>
              <div className="text-xs">
                <div className="font-medium">{displayName || '—'}</div>
                <div className="text-muted-foreground">{me?.email || ''}</div>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings/profile" className="flex items-center gap-2">
              <UserIcon className="h-4 w-4" />
              Profil
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings/interface" className="flex items-center gap-2">
              <SettingsIcon className="h-4 w-4" />
              Paramètres
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setIsJournalOpen(true)}>
            <ScrollText className="h-4 w-4 mr-2" />
            Journal des mises à jour
            {unseenCount > 0 && (
              <span className="ml-auto inline-flex items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                {unseenCount}
              </span>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-red-600 focus:bg-red-50" onSelect={logout}>
            <LogOut className="h-4 w-4 mr-2" />
            Se déconnecter
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <UpdatesJournal isOpen={isJournalOpen} onClose={() => setIsJournalOpen(false)} />
    </div>
  )
}
