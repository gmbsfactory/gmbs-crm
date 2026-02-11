"use client"

import { motion } from "framer-motion"
import { Trash2, AlertTriangle } from "lucide-react"
import type { TeamUser } from "./team-types"

interface DeleteUserModalProps {
  deletingUser: TeamUser
  deleteEmailConfirm: string
  deleting: boolean
  onEmailConfirmChange: (value: string) => void
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteUserModal({
  deletingUser,
  deleteEmailConfirm,
  deleting,
  onEmailConfirmChange,
  onConfirm,
  onCancel,
}: DeleteUserModalProps) {
  return (
    <>
      <motion.div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
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
                <h3 className="font-semibold">Archiver l&apos;utilisateur</h3>
                <p className="text-sm text-muted-foreground">L&apos;utilisateur perdra son acces au CRM</p>
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

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                <strong>Note :</strong> L&apos;historique de l&apos;utilisateur (interventions, etc.) sera conserve.
                Le compte pourra etre restaure ulterieurement si necessaire.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">
                Tapez l&apos;adresse email pour confirmer :
              </label>
              <input
                type="email"
                value={deleteEmailConfirm}
                onChange={(e) => onEmailConfirmChange(e.target.value)}
                placeholder={deletingUser.email || ''}
                className="w-full px-4 py-2.5 rounded-xl border bg-muted/30 focus:bg-background focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all outline-none"
              />
            </div>
          </div>

          <div className="px-6 py-4 border-t bg-muted/20 flex items-center justify-end gap-3">
            <button
              onClick={onCancel}
              disabled={deleting}
              className="px-5 py-2.5 rounded-xl font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
            <motion.button
              onClick={onConfirm}
              disabled={deleting || !deletingUser.email || deletingUser.email.toLowerCase() !== deleteEmailConfirm.toLowerCase()}
              className="px-6 py-2.5 rounded-xl font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {deleting ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Archivage...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Archiver
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </>
  )
}
