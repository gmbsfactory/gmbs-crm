"use client"

import { motion } from "framer-motion"
import {
  Plus,
  Mail,
  Hash,
  X,
  Check,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { TEAM_ROLE_CONFIG } from "./team-types"

interface AddUserModalProps {
  newPrenom: string
  newName: string
  newEmail: string
  newSurnom: string
  newRole: 'admin' | 'manager' | 'gestionnaire'
  creating: boolean
  onPrenomChange: (value: string) => void
  onNameChange: (value: string) => void
  onEmailChange: (value: string) => void
  onSurnomChange: (value: string) => void
  onRoleChange: (role: 'admin' | 'manager' | 'gestionnaire') => void
  onSubmit: () => void
  onClose: () => void
}

export function AddUserModal({
  newPrenom,
  newName,
  newEmail,
  newSurnom,
  newRole,
  creating,
  onPrenomChange,
  onNameChange,
  onEmailChange,
  onSurnomChange,
  onRoleChange,
  onSubmit,
  onClose,
}: AddUserModalProps) {
  return (
    <>
      <motion.div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
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
              onClick={onClose}
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
                <p className="text-sm text-muted-foreground">Creer un nouveau compte utilisateur</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground font-medium">Prenom *</label>
                <input
                  type="text"
                  value={newPrenom}
                  onChange={(e) => onPrenomChange(e.target.value)}
                  placeholder="Jean"
                  className="w-full px-4 py-2.5 rounded-xl border bg-muted/30 focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground font-medium">Nom *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => onNameChange(e.target.value)}
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
                onChange={(e) => onEmailChange(e.target.value)}
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
                onChange={(e) => onSurnomChange(e.target.value)}
                placeholder="JD"
                className="w-full px-4 py-2.5 rounded-xl border bg-muted/30 focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-medium">Role</label>
              <div className="grid grid-cols-3 gap-2">
                {(['admin', 'manager', 'gestionnaire'] as const).map((role) => {
                  const config = TEAM_ROLE_CONFIG[role]
                  const Icon = config.icon
                  const isSelected = newRole === role

                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => onRoleChange(role)}
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
              onClick={onClose}
              disabled={creating}
              className="px-5 py-2.5 rounded-xl font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
            <motion.button
              onClick={onSubmit}
              disabled={creating || !newPrenom || !newName || !newEmail}
              className="px-6 py-2.5 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {creating ? (
                <>
                  <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  Creation...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Creer
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </>
  )
}
