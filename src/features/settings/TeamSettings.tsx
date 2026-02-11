"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Users, Plus, Search } from "lucide-react"
import { UserPermissionsDialog } from "./UserPermissionsDialog"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import type { TeamUser } from "./_components/team-types"
import { TeamMemberRow } from "./_components/TeamMemberRow"
import { AddUserModal } from "./_components/AddUserModal"
import { CreatedUserSuccessModal } from "./_components/CreatedUserSuccessModal"
import { DeleteUserModal } from "./_components/DeleteUserModal"
import { RestoreUserModal } from "./_components/RestoreUserModal"
import { useTeamApi } from "./_components/useTeamApi"

export function TeamSettings() {
  const { data: currentUser } = useCurrentUser()
  const adminHasSmtp = !!(currentUser as unknown as Record<string, unknown>)?.email_smtp

  const api = useTeamApi()

  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newPrenom, setNewPrenom] = useState('')
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newSurnom, setNewSurnom] = useState('')
  const [newRole, setNewRole] = useState<'admin' | 'manager' | 'gestionnaire'>('gestionnaire')
  const [editUser, setEditUser] = useState<TeamUser | null>(null)
  const [deletingUser, setDeletingUser] = useState<TeamUser | null>(null)
  const [deleteEmailConfirm, setDeleteEmailConfirm] = useState('')

  function resetNewUser() {
    setNewPrenom(''); setNewName(''); setNewEmail(''); setNewSurnom(''); setNewRole('gestionnaire')
  }

  const filteredTeam = api.team.filter(u => {
    if (u.status === 'archived') return false
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    const fullName = `${u.firstname || u.prenom || ''} ${u.lastname || u.name || ''}`.toLowerCase()
    return fullName.includes(query) || (u.email?.toLowerCase().includes(query)) ||
           (u.code_gestionnaire?.toLowerCase().includes(query)) || (u.surnom?.toLowerCase().includes(query))
  })

  async function handleCreateUser() {
    const success = await api.handleCreateUser({
      firstname: newPrenom, lastname: newName, email: newEmail, surnom: newSurnom, role: newRole,
    })
    if (success) { setShowAddModal(false); resetNewUser() }
  }

  async function handleRestoreUser() {
    const success = await api.handleRestoreUser()
    if (success) { setShowAddModal(false); resetNewUser() }
  }

  async function handleDeleteUser() {
    if (!deletingUser) return
    await api.handleDeleteUser(deletingUser.id, deleteEmailConfirm)
    setDeletingUser(null); setDeleteEmailConfirm('')
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-card/50 overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-br from-blue-500/5 via-background to-background border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Membres de l&apos;equipe</h2>
                <p className="text-sm text-muted-foreground">
                  {api.team.length} membre{api.team.length > 1 ? 's' : ''} •
                  {api.lastSync && ` Derniere sync ${api.lastSync.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
                </p>
              </div>
            </div>
            <motion.button onClick={() => setShowAddModal(true)}
              className="px-4 py-2.5 rounded-xl font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2"
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            ><Plus className="h-4 w-4" />Ajouter</motion.button>
          </div>
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Rechercher un membre..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border bg-muted/30 focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
            />
          </div>
        </div>
        <div className="divide-y">
          {api.teamLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Chargement de l&apos;equipe...</p>
              </div>
            </div>
          ) : filteredTeam.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">
                {searchQuery ? 'Aucun resultat pour cette recherche' : "Aucun membre dans l'equipe"}
              </p>
            </div>
          ) : (
            filteredTeam.map((user, index) => (
              <TeamMemberRow key={user.id} user={user} index={index}
                onEdit={setEditUser}
                onDelete={(u) => { setDeletingUser(u); setDeleteEmailConfirm('') }}
              />
            ))
          )}
        </div>
      </div>

      <AnimatePresence>
        {showAddModal && (
          <AddUserModal newPrenom={newPrenom} newName={newName} newEmail={newEmail}
            newSurnom={newSurnom} newRole={newRole} creating={api.creating}
            onPrenomChange={setNewPrenom} onNameChange={setNewName} onEmailChange={setNewEmail}
            onSurnomChange={setNewSurnom} onRoleChange={setNewRole} onSubmit={handleCreateUser}
            onClose={() => { setShowAddModal(false); resetNewUser() }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {api.createdUser && (
          <CreatedUserSuccessModal createdUser={api.createdUser} linkCopied={api.linkCopied}
            sendingInvite={api.sendingInvite} adminHasSmtp={adminHasSmtp}
            onCopyLink={api.handleCopyLink} onSendInviteEmail={api.handleSendInviteEmail}
            onClose={api.handleCloseSuccessModal}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deletingUser && (
          <DeleteUserModal deletingUser={deletingUser} deleteEmailConfirm={deleteEmailConfirm}
            deleting={api.deleting} onEmailConfirmChange={setDeleteEmailConfirm}
            onConfirm={handleDeleteUser}
            onCancel={() => { setDeletingUser(null); setDeleteEmailConfirm('') }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {api.archivedUserToRestore && (
          <RestoreUserModal archivedUser={api.archivedUserToRestore} restoring={api.restoring}
            onConfirm={handleRestoreUser}
            onCancel={() => api.setArchivedUserToRestore(null)}
          />
        )}
      </AnimatePresence>

      <UserPermissionsDialog user={editUser} open={!!editUser}
        onOpenChange={(open) => !open && setEditUser(null)}
        onSave={api.handleSaveUserPermissions}
      />
    </div>
  )
}
