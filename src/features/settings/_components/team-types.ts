import { Crown, Briefcase, UserCog } from "lucide-react"

export type TeamUser = {
  id: string
  firstname: string | null
  lastname: string | null
  prenom?: string | null
  name?: string | null
  email: string | null
  role: string | null
  status: string | null
  code_gestionnaire: string | null
  surnom?: string | null
  color: string | null
  username?: string | null
  last_seen_at?: string | null
  avatar_url?: string | null
  page_permissions?: Record<string, boolean>
}

export type CreatedUserData = {
  id: string
  inviteLink: string
  email: string
  firstname: string
  lastname: string
}

export type ArchivedUserData = {
  id: string
  email: string
  firstname: string | null
  lastname: string | null
}

export const TEAM_ROLE_CONFIG = {
  admin: { icon: Crown, color: "text-amber-500", bg: "bg-amber-500/10", label: "Admin" },
  manager: { icon: Briefcase, color: "text-blue-500", bg: "bg-blue-500/10", label: "Manager" },
  gestionnaire: { icon: UserCog, color: "text-emerald-500", bg: "bg-emerald-500/10", label: "Gestionnaire" },
} as const

export function getRoleConfig(role: string | null) {
  if (!role) return TEAM_ROLE_CONFIG.gestionnaire
  const key = role.toLowerCase()
  if (key.includes('admin')) return TEAM_ROLE_CONFIG.admin
  if (key.includes('manager')) return TEAM_ROLE_CONFIG.manager
  return TEAM_ROLE_CONFIG.gestionnaire
}

export function getStatusConfig(status: string | null) {
  const s = (status || '').toLowerCase()
  if (s === 'connected') return { label: 'Connecte', color: 'bg-emerald-500', ring: 'ring-emerald-500/30' }
  if (s === 'busy') return { label: 'Occupe', color: 'bg-amber-500', ring: 'ring-amber-500/30' }
  if (s === 'dnd') return { label: 'Ne pas deranger', color: 'bg-red-500', ring: 'ring-red-500/30' }
  return { label: 'Hors ligne', color: 'bg-gray-400', ring: 'ring-gray-400/30' }
}
