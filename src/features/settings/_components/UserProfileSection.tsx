"use client"

import * as React from "react"
import { motion } from "framer-motion"
import {
  Check,
  Sparkles,
  Palette,
  KeyRound,
  Send,
  Copy,
  Loader2,
  Mail,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Role } from "./permissions-types"
import { ROLE_CONFIG } from "./permissions-types"

// Color selector sub-component
function ColorSelector({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const presetColors = [
    "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
    "#ec4899", "#f43f5e", "#ef4444", "#f97316",
    "#eab308", "#84cc16", "#22c55e", "#10b981",
    "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6",
  ]

  return (
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
  )
}

interface UserProfileSectionProps {
  role: Role
  color: string
  isCurrentUserAdmin: boolean
  adminHasSmtp: boolean
  resetPasswordLoading: boolean
  resetPasswordLink: string | null
  resetLinkCopied: boolean
  sendingResetEmail: boolean
  onRoleChange: (role: Role) => void
  onColorChange: (color: string) => void
  onGenerateResetLink: () => void
  onCopyResetLink: () => void
  onSendResetEmail: () => void
}

export function UserProfileSection({
  role,
  color,
  isCurrentUserAdmin,
  adminHasSmtp,
  resetPasswordLoading,
  resetPasswordLink,
  resetLinkCopied,
  sendingResetEmail,
  onRoleChange,
  onColorChange,
  onGenerateResetLink,
  onCopyResetLink,
  onSendResetEmail,
}: UserProfileSectionProps) {
  return (
    <motion.div
      key="profile"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Selection du role */}
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
                onClick={() => onRoleChange(r)}
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

      {/* Couleur du badge */}
      <div className="space-y-3">
        <label className="text-sm font-semibold flex items-center gap-2">
          <Palette className="h-4 w-4 text-muted-foreground" />
          Couleur du badge
        </label>
        <ColorSelector value={color} onChange={onColorChange} />
      </div>

      {/* Password Reset Section - Only visible to admins */}
      {isCurrentUserAdmin && (
        <div className="space-y-3">
          <label className="text-sm font-semibold flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-blue-500" />
            Mot de passe
          </label>
          <div className="p-4 rounded-xl border bg-muted/20 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <KeyRound className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-medium">Reinitialisation mot de passe</p>
                <p className="text-xs text-muted-foreground">
                  Envoyer un lien pour definir un nouveau mot de passe
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              {adminHasSmtp ? (
                <motion.button
                  type="button"
                  onClick={onSendResetEmail}
                  disabled={sendingResetEmail || resetPasswordLoading}
                  className="w-full px-4 py-3 rounded-xl font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  {sendingResetEmail ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Envoyer lien par email
                    </>
                  )}
                </motion.button>
              ) : (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <p className="text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
                    <Mail className="h-4 w-4 flex-shrink-0" />
                    <span>
                      Pour envoyer par email, configurez vos identifiants SMTP dans{' '}
                      <span className="font-medium">Parametres &gt; Profil</span>.
                    </span>
                  </p>
                </div>
              )}

              <motion.button
                type="button"
                onClick={onGenerateResetLink}
                disabled={resetPasswordLoading || sendingResetEmail}
                className="w-full px-4 py-2.5 rounded-xl font-medium bg-muted hover:bg-muted/80 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                {resetPasswordLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generation...
                  </>
                ) : (
                  <>
                    <KeyRound className="h-4 w-4" />
                    Generer un lien (copier manuellement)
                  </>
                )}
              </motion.button>
            </div>

            {/* Generated link display */}
            {resetPasswordLink && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="space-y-2 pt-2 border-t"
              >
                <label className="text-xs text-muted-foreground font-medium">
                  Lien de reinitialisation (expire dans 24h)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={resetPasswordLink}
                    readOnly
                    className="flex-1 px-3 py-2 rounded-lg border bg-muted/50 text-xs text-muted-foreground truncate"
                  />
                  <motion.button
                    type="button"
                    onClick={onCopyResetLink}
                    className={cn(
                      "px-3 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-1.5",
                      resetLinkCopied
                        ? "bg-emerald-500 text-white"
                        : "bg-muted hover:bg-muted/80"
                    )}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {resetLinkCopied ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Copie
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copier
                      </>
                    )}
                  </motion.button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}
