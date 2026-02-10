"use client"

import { motion } from "framer-motion"
import { X, Check, AlertTriangle } from "lucide-react"
import type { ArchivedUserData } from "./team-types"

interface RestoreUserModalProps {
  archivedUser: ArchivedUserData
  restoring: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function RestoreUserModal({
  archivedUser,
  restoring,
  onConfirm,
  onCancel,
}: RestoreUserModalProps) {
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
          <div className="px-6 py-5 border-b bg-gradient-to-br from-amber-500/10 via-background to-background">
            <button
              onClick={onCancel}
              className="absolute right-4 top-4 p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <h3 className="font-semibold">Compte archive detecte</h3>
                <p className="text-sm text-muted-foreground">Restaurer ce compte ?</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="p-4 rounded-xl bg-muted/30 border">
              <p className="font-medium">
                {archivedUser.firstname} {archivedUser.lastname}
              </p>
              <p className="text-sm text-muted-foreground">{archivedUser.email}</p>
            </div>

            <p className="text-sm text-muted-foreground">
              Un gestionnaire avec l&apos;email <strong>{archivedUser.email}</strong> existe deja mais a ete archive.
              Son historique (interventions, etc.) a ete conserve.
            </p>

            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <p className="text-sm text-blue-700 dark:text-blue-400">
                <strong>Si vous restaurez ce compte :</strong>
                <br />
                {"\u2022"} Un nouveau lien de creation de mot de passe sera genere
                <br />
                {"\u2022"} L&apos;utilisateur retrouvera son historique
              </p>
            </div>
          </div>

          <div className="px-6 py-4 border-t bg-muted/20 flex items-center justify-end gap-3">
            <button
              onClick={onCancel}
              disabled={restoring}
              className="px-5 py-2.5 rounded-xl font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              Abandonner
            </button>
            <motion.button
              onClick={onConfirm}
              disabled={restoring}
              className="px-6 py-2.5 rounded-xl font-semibold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50 flex items-center gap-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {restoring ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Restauration...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Oui, restaurer le compte
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </>
  )
}
