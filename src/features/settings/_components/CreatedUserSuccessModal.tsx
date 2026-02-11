"use client"

import { motion } from "framer-motion"
import {
  X,
  Check,
  CheckCircle2,
  Copy,
  Link2,
  Send,
  Loader2,
  Mail,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { CreatedUserData } from "./team-types"

interface CreatedUserSuccessModalProps {
  createdUser: CreatedUserData
  linkCopied: boolean
  sendingInvite: boolean
  adminHasSmtp: boolean
  onCopyLink: () => void
  onSendInviteEmail: () => void
  onClose: () => void
}

export function CreatedUserSuccessModal({
  createdUser,
  linkCopied,
  sendingInvite,
  adminHasSmtp,
  onCopyLink,
  onSendInviteEmail,
  onClose,
}: CreatedUserSuccessModalProps) {
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
          <div className="px-6 py-5 border-b bg-gradient-to-br from-emerald-500/10 via-background to-background">
            <button
              onClick={onClose}
              className="absolute right-4 top-4 p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-semibold">Utilisateur cree avec succes</h3>
                <p className="text-sm text-muted-foreground">
                  {createdUser.firstname} {createdUser.lastname}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div className="p-4 rounded-xl bg-muted/30 border">
              <p className="text-sm text-muted-foreground mb-2">
                Un lien d&apos;invitation a ete genere pour permettre a l&apos;utilisateur de definir son mot de passe.
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                Ce lien expire dans 24 heures.
              </p>
            </div>

            {/* Invite link */}
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                <Link2 className="h-3.5 w-3.5" />
                Lien d&apos;invitation
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={createdUser.inviteLink}
                  readOnly
                  className="flex-1 px-4 py-2.5 rounded-xl border bg-muted/50 text-sm text-muted-foreground truncate"
                />
                <motion.button
                  onClick={onCopyLink}
                  className={cn(
                    "px-4 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2",
                    linkCopied
                      ? "bg-emerald-500 text-white"
                      : "bg-muted hover:bg-muted/80"
                  )}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {linkCopied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copie
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copier
                    </>
                  )}
                </motion.button>
              </div>
            </div>

            {/* Send by email section */}
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-3">
                Vous pouvez egalement envoyer ce lien par email directement a l&apos;utilisateur.
              </p>

              {adminHasSmtp ? (
                <motion.button
                  onClick={onSendInviteEmail}
                  disabled={sendingInvite}
                  className="w-full px-4 py-3 rounded-xl font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  {sendingInvite ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Envoyer par email a {createdUser.email}
                    </>
                  )}
                </motion.button>
              ) : (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    <Mail className="h-4 w-4 inline mr-2" />
                    Pour envoyer des emails, configurez vos identifiants SMTP Gmail dans{' '}
                    <span className="font-medium">Parametres &gt; Profil</span>.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-4 border-t bg-muted/20 flex items-center justify-end">
            <motion.button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Fermer
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </>
  )
}
