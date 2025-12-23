"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { 
  User, 
  Shield, 
  FileText, 
  Users, 
  Calculator,
  Lock,
  Unlock,
  Check,
  X,
  RotateCcw,
  ChevronRight,
  Sparkles,
  Crown,
  Briefcase,
  UserCog,
  Palette,
  Hash
} from "lucide-react"
import { cn } from "@/lib/utils"
import { updateUserPermissions } from "@/hooks/usePermissions"
import { toast } from "sonner"

// Types
type TeamUser = {
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
  page_permissions?: Record<string, boolean>
}

type Role = "admin" | "manager" | "gestionnaire"

// Permission definitions avec descriptions
const PERMISSION_CATEGORIES = {
  interventions: {
    label: "Interventions",
    icon: FileText,
    color: "blue",
    permissions: [
      { key: "read_interventions", label: "Voir", description: "Accéder à la liste et aux détails" },
      { key: "write_interventions", label: "Créer/Modifier", description: "Créer et modifier" },
      { key: "delete_interventions", label: "Supprimer", description: "Supprimer des interventions" },
      { key: "edit_closed_interventions", label: "Modifier terminées", description: "Modifier les clôturées" },
    ]
  },
  artisans: {
    label: "Artisans",
    icon: Users,
    color: "emerald",
    permissions: [
      { key: "read_artisans", label: "Voir", description: "Accéder à la liste et fiches" },
      { key: "write_artisans", label: "Créer/Modifier", description: "Créer et modifier" },
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
      { key: "write_users", label: "Créer/Modifier", description: "Créer et modifier" },
      { key: "delete_users", label: "Supprimer", description: "Supprimer des utilisateurs" },
      { key: "manage_roles", label: "Gérer rôles", description: "Attribuer rôles et permissions" },
    ]
  },
  admin: {
    label: "Administration",
    icon: Shield,
    color: "amber",
    permissions: [
      { key: "manage_settings", label: "Paramètres", description: "Gérer énumérations, agences" },
      { key: "view_admin", label: "Dashboard Admin", description: "Accéder au tableau de bord" },
      { key: "view_comptabilite", label: "Comptabilité", description: "Accéder à la comptabilité" },
    ]
  }
}

// Role-based permissions mapping
const ROLE_PERMISSIONS: Record<Role, string[]> = {
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

const ROLE_CONFIG: Record<Role, { icon: React.ElementType; color: string; gradient: string; label: string; description: string }> = {
  admin: {
    icon: Crown,
    color: "text-amber-500",
    gradient: "from-amber-500/20 via-orange-500/10 to-red-500/5",
    label: "Admin",
    description: "Accès complet à toutes les fonctionnalités"
  },
  manager: {
    icon: Briefcase,
    color: "text-blue-500",
    gradient: "from-blue-500/20 via-indigo-500/10 to-violet-500/5",
    label: "Manager",
    description: "Gestion d'équipe et supervision"
  },
  gestionnaire: {
    icon: UserCog,
    color: "text-emerald-500",
    gradient: "from-emerald-500/20 via-teal-500/10 to-cyan-500/5",
    label: "Gestionnaire",
    description: "Opérations quotidiennes"
  },
}

interface UserPermissionsDialogProps {
  user: TeamUser | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: {
    userId: string
    role: Role
    surnom: string
    color: string
    pagePermissions: Record<string, boolean>
  }) => Promise<void>
}

// Fetch user permissions from API
async function fetchUserPermissions(userId: string) {
  const response = await fetch(`/api/users/${userId}/permissions?includeRolePermissions=1`)
  if (!response.ok) throw new Error("Failed to fetch permissions")
  return response.json()
}

// Composant pour le sélecteur de couleur moderne
function ColorSelector({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const presetColors = [
    "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
    "#ec4899", "#f43f5e", "#ef4444", "#f97316",
    "#eab308", "#84cc16", "#22c55e", "#10b981",
    "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6",
  ]
  
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {presetColors.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className={cn(
              "h-7 w-7 rounded-full transition-all duration-200 hover:scale-110",
              "ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              value === color && "ring-2 ring-primary ring-offset-2 scale-110"
            )}
            style={{ backgroundColor: color }}
          />
        ))}
        <label className="relative h-7 w-7 cursor-pointer">
          <input
            type="color"
            value={value || "#6366f1"}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          <div 
            className="h-full w-full rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-muted-foreground/50 transition-colors"
            style={{ backgroundColor: value && !presetColors.includes(value) ? value : 'transparent' }}
          >
            {(!value || presetColors.includes(value)) && (
              <Palette className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>
        </label>
      </div>
    </div>
  )
}

// Composant pour une permission individuelle
function PermissionItem({ 
  permission, 
  isEffective, 
  isOverridden, 
  override,
  roleHas,
  onToggle, 
  onReset 
}: {
  permission: { key: string; label: string; description: string }
  isEffective: boolean
  isOverridden: boolean
  override: boolean | null | undefined
  roleHas: boolean
  onToggle: () => void
  onReset: () => void
}) {
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      className={cn(
        "group relative flex items-center justify-between w-full px-3 py-2.5 rounded-lg transition-all duration-200",
        "hover:bg-muted/60",
        isEffective 
          ? isOverridden 
            ? "bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20" 
            : "bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20"
          : isOverridden
            ? "bg-red-500/10 dark:bg-red-500/15 border border-red-500/20"
            : "bg-muted/30 border border-transparent"
      )}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "flex items-center justify-center h-8 w-8 rounded-lg transition-colors",
          isEffective 
            ? isOverridden 
              ? "bg-blue-500/20 text-blue-600 dark:text-blue-400" 
              : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
            : isOverridden
              ? "bg-red-500/20 text-red-600 dark:text-red-400"
              : "bg-muted text-muted-foreground"
        )}>
          {isEffective ? (
            <Unlock className="h-4 w-4" />
          ) : (
            <Lock className="h-4 w-4" />
          )}
        </div>
        <div className="text-left">
          <p className={cn(
            "text-sm font-medium transition-colors",
            !isEffective && "text-muted-foreground"
          )}>
            {permission.label}
            {isOverridden && (
              <span className={cn(
                "ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider",
                override ? "bg-blue-500/20 text-blue-600 dark:text-blue-400" : "bg-red-500/20 text-red-600 dark:text-red-400"
              )}>
                {override ? "Ajouté" : "Retiré"}
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground/80">{permission.description}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {isOverridden && (
          <motion.button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onReset()
            }}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-muted transition-all"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            title="Réinitialiser"
          >
            <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
          </motion.button>
        )}
        <div className={cn(
          "h-5 w-5 rounded-full flex items-center justify-center transition-colors",
          isEffective 
            ? isOverridden 
              ? "bg-blue-500 text-white" 
              : "bg-emerald-500 text-white"
            : "bg-muted-foreground/20"
        )}>
          {isEffective && <Check className="h-3 w-3" />}
        </div>
      </div>
    </motion.button>
  )
}

// Composant pour une catégorie de permissions
function PermissionCategory({ 
  categoryKey, 
  category, 
  rolePermissions, 
  effectivePermissions, 
  permissionOverrides,
  onToggle,
  onReset,
  isExpanded,
  onToggleExpand
}: {
  categoryKey: string
  category: typeof PERMISSION_CATEGORIES[keyof typeof PERMISSION_CATEGORIES]
  rolePermissions: Set<string>
  effectivePermissions: Set<string>
  permissionOverrides: Record<string, boolean | null>
  onToggle: (key: string) => void
  onReset: (key: string) => void
  isExpanded: boolean
  onToggleExpand: () => void
}) {
  const Icon = category.icon
  const grantedCount = category.permissions.filter(p => effectivePermissions.has(p.key)).length
  const totalCount = category.permissions.length
  const allGranted = grantedCount === totalCount
  
  const colorClasses = {
    blue: "from-blue-500/20 to-blue-600/5 border-blue-500/20 text-blue-600 dark:text-blue-400",
    emerald: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
    violet: "from-violet-500/20 to-violet-600/5 border-violet-500/20 text-violet-600 dark:text-violet-400",
    amber: "from-amber-500/20 to-amber-600/5 border-amber-500/20 text-amber-600 dark:text-amber-400",
  }
  
  const colorClass = colorClasses[category.color as keyof typeof colorClasses] || colorClasses.blue
  
  return (
    <div className="rounded-xl border bg-card/50 overflow-hidden">
      <button
        type="button"
        onClick={onToggleExpand}
        className={cn(
          "w-full flex items-center justify-between p-4 transition-colors hover:bg-muted/30",
          isExpanded && "border-b"
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br border",
            colorClass
          )}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="text-left">
            <p className="font-semibold">{category.label}</p>
            <p className="text-xs text-muted-foreground">
              {grantedCount} / {totalCount} permissions actives
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={cn(
            "px-2.5 py-1 rounded-full text-xs font-medium",
            allGranted 
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" 
              : "bg-muted text-muted-foreground"
          )}>
            {allGranted ? "Complet" : `${grantedCount}/${totalCount}`}
          </div>
          <ChevronRight className={cn(
            "h-5 w-5 text-muted-foreground transition-transform duration-200",
            isExpanded && "rotate-90"
          )} />
        </div>
      </button>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-3 space-y-2">
              {category.permissions.map((perm) => {
                const roleHas = rolePermissions.has(perm.key)
                const isEffective = effectivePermissions.has(perm.key)
                const override = permissionOverrides[perm.key]
                const isOverridden = override !== undefined && override !== null
                
                return (
                  <PermissionItem
                    key={perm.key}
                    permission={perm}
                    isEffective={isEffective}
                    isOverridden={isOverridden}
                    override={override}
                    roleHas={roleHas}
                    onToggle={() => onToggle(perm.key)}
                    onReset={() => onReset(perm.key)}
                  />
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function UserPermissionsDialog({ 
  user, 
  open, 
  onOpenChange, 
  onSave 
}: UserPermissionsDialogProps) {
  const queryClient = useQueryClient()
  const [activeSection, setActiveSection] = React.useState<"profile" | "permissions">("profile")
  const [role, setRole] = React.useState<Role>("gestionnaire")
  const [surnom, setSurnom] = React.useState("")
  const [color, setColor] = React.useState("")
  const [pagePermissions, setPagePermissions] = React.useState<Record<string, boolean>>({})
  const [permissionOverrides, setPermissionOverrides] = React.useState<Record<string, boolean | null>>({})
  const [saving, setSaving] = React.useState(false)
  const [expandedCategories, setExpandedCategories] = React.useState<Set<string>>(new Set())

  // Fetch existing permissions from DB
  const { data: permissionsData, isLoading: loadingPermissions } = useQuery({
    queryKey: ["user-permissions-edit", user?.id],
    queryFn: () => fetchUserPermissions(user!.id),
    enabled: !!user?.id && open,
    staleTime: 0,
  })

  // Reset state when user changes
  React.useEffect(() => {
    if (user) {
      setRole((user.role as Role) || "gestionnaire")
      setSurnom(user.code_gestionnaire || user.surnom || "")
      setColor(user.color || "#6366f1")
      setPagePermissions(user.page_permissions || {})
      setActiveSection("profile")
      setExpandedCategories(new Set())
    }
  }, [user])

  // Load existing overrides from DB
  React.useEffect(() => {
    if (permissionsData?.data?.overrides) {
      const overrides: Record<string, boolean | null> = {}
      for (const o of permissionsData.data.overrides) {
        if (o.permission?.key) {
          overrides[o.permission.key] = o.granted
        }
      }
      setPermissionOverrides(overrides)
    }
  }, [permissionsData])

  const rolePermissionsByRole = React.useMemo(() => {
    const fromApi = permissionsData?.data?.rolePermissionsByRole
    if (fromApi && typeof fromApi === "object") {
      return fromApi as Partial<Record<Role, string[]>>
    }
    return {}
  }, [permissionsData])

  const rolePermissions = React.useMemo(() => {
    return new Set(rolePermissionsByRole[role] || ROLE_PERMISSIONS[role] || [])
  }, [role, rolePermissionsByRole])

  const effectivePermissions = React.useMemo(() => {
    const effective = new Set<string>()
    for (const perm of rolePermissions) {
      effective.add(perm)
    }
    for (const [key, value] of Object.entries(permissionOverrides)) {
      if (value === true) {
        effective.add(key)
      } else if (value === false) {
        effective.delete(key)
      }
    }
    return effective
  }, [rolePermissions, permissionOverrides])

  const togglePermission = (key: string) => {
    const roleHas = rolePermissions.has(key)
    const currentEffective = effectivePermissions.has(key)
    
    setPermissionOverrides(prev => {
      if (currentEffective) {
        if (roleHas) {
          return { ...prev, [key]: false }
        } else {
          return { ...prev, [key]: null }
        }
      } else {
        if (roleHas) {
          return { ...prev, [key]: null }
        } else {
          return { ...prev, [key]: true }
        }
      }
    })
  }

  const resetToRoleDefault = (key: string) => {
    setPermissionOverrides(prev => ({ ...prev, [key]: null }))
  }

  const toggleCategory = (categoryKey: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(categoryKey)) {
        next.delete(categoryKey)
      } else {
        next.add(categoryKey)
      }
      return next
    })
  }

  const savePermissionsMutation = useMutation({
    mutationFn: async () => {
      if (!user) return
      
      const permissionsToSave: Record<string, boolean | null> = {}
      
      for (const [key, value] of Object.entries(permissionOverrides)) {
        if (value !== null && value !== undefined) {
          permissionsToSave[key] = value
        }
      }
      
      if (permissionsData?.data?.overrides) {
        for (const o of permissionsData.data.overrides) {
          if (o.permission?.key && permissionOverrides[o.permission.key] === null) {
            permissionsToSave[o.permission.key] = null
          }
        }
      }
      
      if (Object.keys(permissionsToSave).length > 0) {
        await updateUserPermissions(user.id, permissionsToSave)
      }
      
      await onSave({
        userId: user.id,
        role,
        surnom,
        color,
        pagePermissions,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-permissions"] })
      queryClient.invalidateQueries({ queryKey: ["user-permissions-edit"] })
      toast.success("Permissions enregistrées avec succès")
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error("Erreur lors de l'enregistrement: " + error.message)
    }
  })

  const handleSave = async () => {
    setSaving(true)
    try {
      await savePermissionsMutation.mutateAsync()
    } finally {
      setSaving(false)
    }
  }

  const displayName = user 
    ? `${user.firstname || user.prenom || ""} ${user.lastname || user.name || ""}`.trim() 
    : ""

  const overrideCount = Object.values(permissionOverrides).filter(v => v !== null && v !== undefined).length

  if (!open) return null

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
          />
          
          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="pointer-events-auto relative w-full max-w-2xl max-h-[90vh] bg-background rounded-2xl shadow-2xl border overflow-hidden flex flex-col"
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header avec dégradé */}
              <div className="relative px-6 py-5 border-b bg-gradient-to-br from-primary/5 via-background to-background">
                <button
                  onClick={() => onOpenChange(false)}
                  className="absolute right-4 top-4 p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
                
                <div className="flex items-center gap-4">
                  <div 
                    className="h-14 w-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white shadow-lg"
                    style={{ backgroundColor: color || "#6366f1" }}
                  >
                    {(user?.firstname?.[0] || user?.prenom?.[0] || "").toUpperCase()}
                    {(user?.lastname?.[0] || user?.name?.[0] || "").toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{displayName}</h2>
                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                  </div>
                </div>
                
                {/* Navigation tabs */}
                <div className="flex gap-1 mt-5 p-1 bg-muted/50 rounded-lg w-fit">
                  <button
                    onClick={() => setActiveSection("profile")}
                    className={cn(
                      "px-4 py-2 rounded-md text-sm font-medium transition-all",
                      activeSection === "profile" 
                        ? "bg-background shadow-sm text-foreground" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span className="flex items-center gap-2">
                <User className="h-4 w-4" />
                      Profil
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveSection("permissions")}
                    className={cn(
                      "px-4 py-2 rounded-md text-sm font-medium transition-all",
                      activeSection === "permissions" 
                        ? "bg-background shadow-sm text-foreground" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Permissions
                {overrideCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-xs">
                    {overrideCount}
                        </span>
                      )}
                    </span>
                  </button>
                </div>
              </div>
              
              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 scrollbar-minimal">
                <AnimatePresence mode="wait">
                  {activeSection === "profile" ? (
                    <motion.div
                      key="profile"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-6"
                    >
              {/* Sélection du rôle */}
              <div className="space-y-3">
                        <label className="text-sm font-semibold flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          Rôle de l&apos;utilisateur
                        </label>
                <div className="grid grid-cols-3 gap-3">
                          {(["admin", "manager", "gestionnaire"] as Role[]).map((r) => {
                            const config = ROLE_CONFIG[r]
                            const Icon = config.icon
                            const isSelected = role === r
                            
                            return (
                              <motion.button
                      key={r}
                      type="button"
                                onClick={() => setRole(r)}
                      className={cn(
                                  "relative p-4 rounded-xl border-2 transition-all text-left overflow-hidden",
                                  isSelected 
                          ? "border-primary bg-primary/5" 
                                    : "border-muted hover:border-muted-foreground/30 hover:bg-muted/30"
                                )}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                              >
                                {isSelected && (
                                  <motion.div
                                    className={cn("absolute inset-0 bg-gradient-to-br opacity-50", config.gradient)}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 0.5 }}
                                  />
                                )}
                                <div className="relative">
                                  <div className={cn(
                                    "h-10 w-10 rounded-xl flex items-center justify-center mb-3",
                                    isSelected ? "bg-background shadow-sm" : "bg-muted"
                                  )}>
                                    <Icon className={cn("h-5 w-5", config.color)} />
                                  </div>
                                  <p className="font-semibold">{config.label}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                    {config.description}
                                  </p>
                                  {isSelected && (
                                    <motion.div
                                      className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center"
                                      initial={{ scale: 0 }}
                                      animate={{ scale: 1 }}
                                    >
                                      <Check className="h-3 w-3 text-primary-foreground" />
                                    </motion.div>
                                  )}
                                </div>
                              </motion.button>
                            )
                          })}
                        </div>
                      </div>

              {/* Surnom et couleur */}
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <label className="text-sm font-semibold flex items-center gap-2">
                            <Hash className="h-4 w-4 text-muted-foreground" />
                            Surnom / Code
                          </label>
                          <input
                            type="text"
                    placeholder="Ex: JD, Pierre..."
                    value={surnom} 
                    onChange={(e) => setSurnom(e.target.value)} 
                            className="w-full px-4 py-3 rounded-xl border bg-muted/30 focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  />
                </div>
                        <div className="space-y-3">
                          <label className="text-sm font-semibold flex items-center gap-2">
                            <Palette className="h-4 w-4 text-muted-foreground" />
                            Couleur du badge
                          </label>
                          <ColorSelector value={color} onChange={setColor} />
                </div>
              </div>

                      {/* Page permissions */}
              <div className="space-y-3">
                        <label className="text-sm font-semibold flex items-center gap-2">
                          <Calculator className="h-4 w-4 text-amber-500" />
                          Accès spéciaux
                        </label>
                        <div className="p-4 rounded-xl border bg-muted/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                                <Calculator className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <p className="font-medium">Page Comptabilité</p>
                                <p className="text-xs text-muted-foreground">
                                  Accès au module comptabilité
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setPagePermissions(prev => ({ 
                                ...prev, 
                                comptabilite: !prev.comptabilite 
                              }))}
                              className={cn(
                                "relative h-7 w-12 rounded-full transition-colors",
                                pagePermissions.comptabilite || rolePermissions.has("view_comptabilite")
                                  ? "bg-primary"
                                  : "bg-muted-foreground/20"
                              )}
                            >
                              <div className={cn(
                                "absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                                pagePermissions.comptabilite || rolePermissions.has("view_comptabilite")
                                  ? "translate-x-6"
                                  : "translate-x-1"
                              )} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="permissions"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                    >
                      {/* Légende */}
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border">
                        <div className="flex items-center gap-4 text-xs">
                          <span className="flex items-center gap-1.5">
                            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    Du rôle
                  </span>
                          <span className="flex items-center gap-1.5">
                            <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                            Ajouté
                  </span>
                          <span className="flex items-center gap-1.5">
                            <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                            Retiré
                  </span>
                </div>
                        {overrideCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setPermissionOverrides({})}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Réinitialiser ({overrideCount})
                          </button>
                        )}
              </div>

              {loadingPermissions ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="flex flex-col items-center gap-3">
                            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            <p className="text-sm text-muted-foreground">Chargement des permissions...</p>
                          </div>
                </div>
              ) : (
                        <div className="space-y-3">
                          {Object.entries(PERMISSION_CATEGORIES).map(([categoryKey, category]) => (
                            <PermissionCategory
                              key={categoryKey}
                              categoryKey={categoryKey}
                              category={category}
                              rolePermissions={rolePermissions}
                              effectivePermissions={effectivePermissions}
                              permissionOverrides={permissionOverrides}
                              onToggle={togglePermission}
                              onReset={resetToRoleDefault}
                              isExpanded={expandedCategories.has(categoryKey)}
                              onToggleExpand={() => toggleCategory(categoryKey)}
                            />
                          ))}
                            </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
                                    </div>
              
              {/* Footer */}
              <div className="px-6 py-4 border-t bg-muted/20 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <motion.button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2.5 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {saving ? (
                    <>
                      <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Enregistrer
                    </>
                  )}
                </motion.button>
                                  </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
