import {
  FileText,
  Users,
  User,
  Shield,
  Crown,
  Briefcase,
  UserCog,
} from "lucide-react"

// Types
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

export type Role = "admin" | "manager" | "gestionnaire"

// Permission definitions avec descriptions
export const PERMISSION_CATEGORIES = {
  interventions: {
    label: "Interventions",
    icon: FileText,
    color: "blue",
    permissions: [
      { key: "read_interventions", label: "Voir", description: "Acceder a la liste et aux details" },
      { key: "write_interventions", label: "Creer/Modifier", description: "Creer et modifier" },
      { key: "delete_interventions", label: "Supprimer", description: "Supprimer des interventions" },
      { key: "edit_closed_interventions", label: "Modifier terminees", description: "Modifier les cloturees" },
    ]
  },
  artisans: {
    label: "Artisans",
    icon: Users,
    color: "emerald",
    permissions: [
      { key: "read_artisans", label: "Voir", description: "Acceder a la liste et fiches" },
      { key: "write_artisans", label: "Creer/Modifier", description: "Creer et modifier" },
      { key: "delete_artisans", label: "Supprimer", description: "Supprimer des artisans" },
      { key: "export_artisans", label: "Exporter", description: "Exporter la liste" },
    ]
  },
  users: {
    label: "Utilisateurs",
    icon: User,
    color: "violet",
    permissions: [
      { key: "read_users", label: "Voir", description: "Voir la liste utilisateurs" },
      { key: "write_users", label: "Creer/Modifier", description: "Creer et modifier" },
      { key: "delete_users", label: "Supprimer", description: "Supprimer des utilisateurs" },
      { key: "manage_roles", label: "Gerer roles", description: "Attribuer roles et permissions" },
    ]
  },
  admin: {
    label: "Administration",
    icon: Shield,
    color: "amber",
    permissions: [
      { key: "manage_settings", label: "Parametres", description: "Gerer enumerations, agences" },
      { key: "view_admin", label: "Dashboard Admin", description: "Acceder au tableau de bord" },
      { key: "view_comptabilite", label: "Comptabilite", description: "Acceder a la comptabilite" },
    ]
  }
} as const

export type PermissionCategoryKey = keyof typeof PERMISSION_CATEGORIES
export type PermissionCategory = typeof PERMISSION_CATEGORIES[PermissionCategoryKey]

// Role-based permissions mapping
export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  admin: [
    "read_interventions", "write_interventions", "delete_interventions", "edit_closed_interventions",
    "read_artisans", "write_artisans", "delete_artisans", "export_artisans",
    "read_users", "write_users", "delete_users", "manage_roles",
    "manage_settings", "view_admin", "view_comptabilite",
  ],
  manager: [
    "read_interventions", "write_interventions",
    "read_artisans", "write_artisans",
    "read_users", "export_artisans", "view_comptabilite",
  ],
  gestionnaire: [
    "read_interventions", "write_interventions",
    "read_artisans", "write_artisans",
    "read_users",
  ],
}

export const ROLE_CONFIG: Record<Role, { icon: React.ElementType; color: string; gradient: string; label: string; description: string }> = {
  admin: {
    icon: Crown,
    color: "text-amber-500",
    gradient: "from-amber-500/20 via-orange-500/10 to-red-500/5",
    label: "Admin",
    description: "Acces complet a toutes les fonctionnalites"
  },
  manager: {
    icon: Briefcase,
    color: "text-blue-500",
    gradient: "from-blue-500/20 via-indigo-500/10 to-violet-500/5",
    label: "Manager",
    description: "Gestion d'equipe et supervision"
  },
  gestionnaire: {
    icon: UserCog,
    color: "text-emerald-500",
    gradient: "from-emerald-500/20 via-teal-500/10 to-cyan-500/5",
    label: "Gestionnaire",
    description: "Operations quotidiennes"
  },
}

// Fetch user permissions from API
export async function fetchUserPermissions(userId: string) {
  const response = await fetch(`/api/users/${userId}/permissions?includeRolePermissions=1`)
  if (!response.ok) throw new Error("Failed to fetch permissions")
  return response.json()
}

export interface UserPermissionsDialogProps {
  user: TeamUser | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: {
    userId: string
    role: Role
    surnom: string
    color: string
    firstname?: string
    lastname?: string
    email?: string
    avatar_url?: string | null
  }) => Promise<void>
}
