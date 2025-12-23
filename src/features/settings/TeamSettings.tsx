"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Users, 
  Plus, 
  Trash2, 
  Settings2,
  Search,
  Crown,
  Briefcase,
  UserCog,
  Mail,
  Hash,
  X,
  Check,
  AlertTriangle
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { UserPermissionsDialog } from "./UserPermissionsDialog"
import { cn } from "@/lib/utils"

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

const ROLE_CONFIG = {
  admin: { icon: Crown, color: "text-amber-500", bg: "bg-amber-500/10", label: "Admin" },
  manager: { icon: Briefcase, color: "text-blue-500", bg: "bg-blue-500/10", label: "Manager" },
  gestionnaire: { icon: UserCog, color: "text-emerald-500", bg: "bg-emerald-500/10", label: "Gestionnaire" },
}

function getRoleConfig(role: string | null) {
  if (!role) return ROLE_CONFIG.gestionnaire
  const key = role.toLowerCase()
  if (key.includes('admin')) return ROLE_CONFIG.admin
  if (key.includes('manager')) return ROLE_CONFIG.manager
  return ROLE_CONFIG.gestionnaire
}

function getStatusConfig(status: string | null) {
  const s = (status || '').toLowerCase()
  if (s === 'connected') return { label: 'Connecté', color: 'bg-emerald-500', ring: 'ring-emerald-500/30' }
  if (s === 'busy') return { label: 'Occupé', color: 'bg-amber-500', ring: 'ring-amber-500/30' }
  if (s === 'dnd') return { label: 'Ne pas déranger', color: 'bg-red-500', ring: 'ring-red-500/30' }
  return { label: 'Hors ligne', color: 'bg-gray-400', ring: 'ring-gray-400/30' }
}

export function TeamSettings() {
  const { toast } = useToast()
  
  // Team data
  const [team, setTeam] = useState<TeamUser[]>([])
  const [teamLoading, setTeamLoading] = useState(true)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Add user modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [newPrenom, setNewPrenom] = useState('')
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newSurnom, setNewSurnom] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'manager' | 'gestionnaire'>('gestionnaire')
  const [creating, setCreating] = useState(false)
  
  // Edit user
  const [editUser, setEditUser] = useState<TeamUser | null>(null)
  
  // Delete user
  const [deletingUser, setDeletingUser] = useState<TeamUser | null>(null)
  const [deleteEmailConfirm, setDeleteEmailConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Load team data
  useEffect(() => {
    loadTeam()
  }, [])

  async function loadTeam() {
    setTeamLoading(true)
    try {
      const res = await fetch('/api/settings/team', { cache: 'no-store' })
      const data = await res.json()
      setTeam(data?.users || [])
      setLastSync(new Date())
    } catch (e) {
      setTeam([])
    } finally {
      setTeamLoading(false)
    }
  }

  // Filtered team
  const filteredTeam = team.filter(u => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    const fullName = `${u.firstname || u.prenom || ''} ${u.lastname || u.name || ''}`.toLowerCase()
    return fullName.includes(query) || 
           (u.email?.toLowerCase().includes(query)) ||
           (u.code_gestionnaire?.toLowerCase().includes(query)) ||
           (u.surnom?.toLowerCase().includes(query))
  })

  // Create user
  async function handleCreateUser() {
    if (!newPrenom || !newName || !newEmail) {
      toast({ title: 'Erreur', description: 'Veuillez remplir tous les champs obligatoires', variant: 'destructive' as any })
      return
    }
    
    setCreating(true)
    try {
      const payload = { firstname: newPrenom, lastname: newName, email: newEmail, surnom: newSurnom, role: newRole }
      const resp = await fetch('/api/settings/team/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const j = await resp.json().catch(() => ({}))
      
      if (!resp.ok) {
        if (j?.error === 'email_taken') {
          toast({ title: 'Utilisateur existant', description: 'Cette adresse email est déjà utilisée.', variant: 'destructive' as any })
        } else {
          toast({ title: 'Erreur', description: j?.error || 'Impossible de créer l\'utilisateur', variant: 'destructive' as any })
        }
        return
      }
      
      await loadTeam()
      setShowAddModal(false)
      resetNewUser()
      toast({ title: 'Utilisateur créé avec succès' })
    } finally {
      setCreating(false)
    }
  }

  function resetNewUser() {
    setNewPrenom('')
    setNewName('')
    setNewEmail('')
    setNewSurnom('')
    setNewRole('gestionnaire')
  }

  // Delete user
  async function handleDeleteUser() {
    if (!deletingUser) return
    
    setDeleting(true)
    try {
      await fetch('/api/settings/team/user', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: deletingUser.id, emailConfirm: deleteEmailConfirm })
      })
      await loadTeam()
      setDeletingUser(null)
      setDeleteEmailConfirm('')
      toast({ title: 'Utilisateur supprimé' })
    } finally {
      setDeleting(false)
    }
  }

  // Save user permissions
  const handleSaveUserPermissions = async (data: {
    userId: string
    role: string
    surnom: string
    color: string
    pagePermissions: Record<string, boolean>
  }) => {
    await fetch('/api/settings/team/user', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: data.userId, surnom: data.surnom, color: data.color })
    })
    
    if (data.role) {
      await fetch('/api/settings/team/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: data.userId, role: data.role })
      })
    }
    
    await fetch(`/api/settings/team/user/${data.userId}/page-permissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissions: data.pagePermissions })
    })
    
    await loadTeam()
    
    toast({
      title: "Permissions mises à jour",
      description: "Les permissions de l'utilisateur ont été enregistrées."
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border bg-card/50 overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-br from-blue-500/5 via-background to-background border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Membres de l&apos;équipe</h2>
                <p className="text-sm text-muted-foreground">
                  {team.length} membre{team.length > 1 ? 's' : ''} • 
                  {lastSync && ` Dernière sync ${lastSync.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
                </p>
              </div>
            </div>
            <motion.button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2.5 rounded-xl font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Plus className="h-4 w-4" />
              Ajouter
            </motion.button>
          </div>
          
          {/* Search */}
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher un membre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border bg-muted/30 focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
            />
          </div>
        </div>
        
        {/* Team list */}
        <div className="divide-y">
          {teamLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Chargement de l&apos;équipe...</p>
              </div>
            </div>
          ) : filteredTeam.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">
                {searchQuery ? 'Aucun résultat pour cette recherche' : 'Aucun membre dans l&apos;équipe'}
              </p>
            </div>
          ) : (
            filteredTeam.map((user, index) => {
              const roleConfig = getRoleConfig(user.role)
              const statusConfig = getStatusConfig(user.status)
              const RoleIcon = roleConfig.icon
              const initials = `${(user.firstname?.[0] || user.prenom?.[0] || '').toUpperCase()}${(user.lastname?.[0] || user.name?.[0] || '').toUpperCase()}`
              
              return (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="px-6 py-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Avatar avec indicateur de statut */}
                      <div className="relative">
                        <div
                          className="h-12 w-12 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-md"
                          style={{ backgroundColor: user.color || '#6366f1' }}
                        >
                          {initials}
                        </div>
                        <div className={cn(
                          "absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-background",
                          statusConfig.color
                        )} />
                      </div>
                      
                      {/* Infos utilisateur */}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">
                            {user.firstname || user.prenom} {user.lastname || user.name}
                          </p>
                          {user.code_gestionnaire || user.surnom ? (
                            <span 
                              className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                              style={{ backgroundColor: user.color || '#6366f1' }}
                            >
                              {user.code_gestionnaire || user.surnom}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      {/* Rôle */}
                      <div className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg",
                        roleConfig.bg
                      )}>
                        <RoleIcon className={cn("h-4 w-4", roleConfig.color)} />
                        <span className={cn("text-sm font-medium", roleConfig.color)}>
                          {roleConfig.label}
                        </span>
                      </div>
                      
                      {/* Statut */}
                      <div className="flex items-center gap-2">
                        <div className={cn("h-2.5 w-2.5 rounded-full", statusConfig.color)} />
                        <span className="text-sm text-muted-foreground">{statusConfig.label}</span>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <motion.button
                          onClick={() => setEditUser(user)}
                          className="p-2 rounded-lg hover:bg-muted transition-colors"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <Settings2 className="h-4 w-4 text-muted-foreground" />
                        </motion.button>
                        <motion.button
                          onClick={() => { setDeletingUser(user); setDeleteEmailConfirm('') }}
                          className="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })
          )}
        </div>
      </div>

      {/* Add User Modal */}
      <AnimatePresence>
        {showAddModal && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
            />
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="pointer-events-auto relative w-full max-w-lg bg-background rounded-2xl shadow-2xl border overflow-hidden"
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-6 py-5 border-b bg-gradient-to-br from-primary/5 via-background to-background">
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="absolute right-4 top-4 p-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    <X className="h-5 w-5 text-muted-foreground" />
                  </button>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Plus className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Ajouter un membre</h3>
                      <p className="text-sm text-muted-foreground">Créer un nouveau compte utilisateur</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground font-medium">Prénom *</label>
                      <input
                        type="text"
                        value={newPrenom}
                        onChange={(e) => setNewPrenom(e.target.value)}
                        placeholder="Jean"
                        className="w-full px-4 py-2.5 rounded-xl border bg-muted/30 focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground font-medium">Nom *</label>
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="Dupont"
                        className="w-full px-4 py-2.5 rounded-xl border bg-muted/30 focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      Email *
                    </label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="jean.dupont@exemple.com"
                      className="w-full px-4 py-2.5 rounded-xl border bg-muted/30 focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                      <Hash className="h-3.5 w-3.5" />
                      Surnom / Code
                    </label>
                    <input
                      type="text"
                      value={newSurnom}
                      onChange={(e) => setNewSurnom(e.target.value)}
                      placeholder="JD"
                      className="w-full px-4 py-2.5 rounded-xl border bg-muted/30 focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground font-medium">Rôle</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['admin', 'manager', 'gestionnaire'] as const).map((role) => {
                        const config = ROLE_CONFIG[role]
                        const Icon = config.icon
                        const isSelected = newRole === role
                        
                        return (
                          <button
                            key={role}
                            type="button"
                            onClick={() => setNewRole(role)}
                            className={cn(
                              "relative p-3 rounded-xl border-2 transition-all text-center",
                              isSelected 
                                ? "border-primary bg-primary/5" 
                                : "border-muted hover:border-muted-foreground/30"
                            )}
                          >
                            <Icon className={cn("h-5 w-5 mx-auto mb-1", config.color)} />
                            <span className="text-sm font-medium">{config.label}</span>
                            {isSelected && (
                              <div className="absolute top-1 right-1 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                                <Check className="h-2.5 w-2.5 text-primary-foreground" />
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
                
                <div className="px-6 py-4 border-t bg-muted/20 flex items-center justify-end gap-3">
                  <button
                    onClick={() => { setShowAddModal(false); resetNewUser() }}
                    disabled={creating}
                    className="px-5 py-2.5 rounded-xl font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <motion.button
                    onClick={handleCreateUser}
                    disabled={creating || !newPrenom || !newName || !newEmail}
                    className="px-6 py-2.5 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {creating ? (
                      <>
                        <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                        Création...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Créer
                      </>
                    )}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingUser && (
          <>
            <motion.div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingUser(null)}
            />
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="pointer-events-auto relative w-full max-w-md bg-background rounded-2xl shadow-2xl border overflow-hidden"
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-6 py-5 border-b">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Supprimer l&apos;utilisateur</h3>
                      <p className="text-sm text-muted-foreground">Cette action est irréversible</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-6 space-y-4">
                  <div className="p-4 rounded-xl bg-muted/30 border">
                    <p className="font-medium">
                      {deletingUser.firstname || deletingUser.prenom} {deletingUser.lastname || deletingUser.name}
                    </p>
                    <p className="text-sm text-muted-foreground">{deletingUser.email}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">
                      Tapez l&apos;adresse email pour confirmer :
                    </label>
                    <input
                      type="email"
                      value={deleteEmailConfirm}
                      onChange={(e) => setDeleteEmailConfirm(e.target.value)}
                      placeholder={deletingUser.email || ''}
                      className="w-full px-4 py-2.5 rounded-xl border bg-muted/30 focus:bg-background focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all outline-none"
                    />
                  </div>
                </div>
                
                <div className="px-6 py-4 border-t bg-muted/20 flex items-center justify-end gap-3">
                  <button
                    onClick={() => { setDeletingUser(null); setDeleteEmailConfirm('') }}
                    disabled={deleting}
                    className="px-5 py-2.5 rounded-xl font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <motion.button
                    onClick={handleDeleteUser}
                    disabled={deleting || !deletingUser.email || deletingUser.email.toLowerCase() !== deleteEmailConfirm.toLowerCase()}
                    className="px-6 py-2.5 rounded-xl font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {deleting ? (
                      <>
                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Suppression...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" />
                        Supprimer
                      </>
                    )}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Edit User Permissions Dialog */}
      <UserPermissionsDialog
        user={editUser}
        open={!!editUser}
        onOpenChange={(open) => !open && setEditUser(null)}
        onSave={handleSaveUserPermissions}
      />
    </div>
  )
}

