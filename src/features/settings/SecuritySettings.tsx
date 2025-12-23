"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { 
  Shield, 
  Lock, 
  Smartphone, 
  Key,
  Monitor,
  Globe,
  Clock,
  AlertTriangle,
  Eye,
  EyeOff,
  Check
} from "lucide-react"
import { cn } from "@/lib/utils"

export function SecuritySettings() {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  return (
    <div className="space-y-6 relative">
      {/* Watermark overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="transform -rotate-12 text-6xl font-bold text-muted-foreground/10 select-none whitespace-nowrap">
            DÉMO
          </div>
        </div>
      </div>

      {/* Password Section */}
      <div className="rounded-2xl border bg-card/50 overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-br from-blue-500/5 via-background to-background border-b">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/10 flex items-center justify-center">
              <Lock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Mot de passe</h2>
              <p className="text-sm text-muted-foreground">Mettez à jour votre mot de passe pour sécuriser votre compte</p>
            </div>
          </div>
        </div>
        
        <div className="p-6 space-y-4">
          {/* Current Password */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground font-medium">Mot de passe actuel</label>
            <div className="relative">
              <input
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 pr-10 rounded-xl border bg-muted/30 focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted transition-colors"
              >
                {showCurrentPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>
          
          {/* New Password */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground font-medium">Nouveau mot de passe</label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 pr-10 rounded-xl border bg-muted/30 focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted transition-colors"
              >
                {showNewPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>
          
          {/* Confirm Password */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground font-medium">Confirmer le mot de passe</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 pr-10 rounded-xl border bg-muted/30 focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted transition-colors"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>
          
          <motion.button
            className="px-5 py-2.5 rounded-xl font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Mettre à jour
          </motion.button>
        </div>
      </div>

      {/* Two-Factor Authentication */}
      <div className="rounded-2xl border bg-card/50 overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-br from-emerald-500/5 via-background to-background border-b">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/10 flex items-center justify-center">
              <Key className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Authentification à deux facteurs</h2>
              <p className="text-sm text-muted-foreground">Ajoutez une couche de sécurité supplémentaire</p>
            </div>
          </div>
        </div>
        
        <div className="divide-y">
          {/* Authenticator App */}
          <div className="px-6 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <Smartphone className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="font-medium">Application d&apos;authentification</p>
                <p className="text-sm text-muted-foreground">
                  Utilisez une application comme Google Authenticator
                </p>
              </div>
            </div>
            <motion.button
              className="px-4 py-2 rounded-xl font-medium border hover:bg-muted transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Configurer
            </motion.button>
          </div>
          
          {/* SMS Verification */}
          <div className="px-6 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-medium">Vérification par SMS</p>
                <p className="text-sm text-muted-foreground">
                  Recevez des codes de vérification par SMS
                </p>
              </div>
            </div>
            <motion.button
              className="px-4 py-2 rounded-xl font-medium border hover:bg-muted transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Configurer
            </motion.button>
          </div>
        </div>
      </div>

      {/* Active Sessions */}
      <div className="rounded-2xl border bg-card/50 overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-br from-amber-500/5 via-background to-background border-b">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 flex items-center justify-center">
              <Monitor className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Sessions actives</h2>
              <p className="text-sm text-muted-foreground">Gérez vos sessions sur différents appareils</p>
            </div>
          </div>
        </div>
        
        <div className="divide-y">
          {/* Current Session */}
          <div className="px-6 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Monitor className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">Session actuelle</p>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                    Active
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Globe className="h-3.5 w-3.5" />
                    Chrome sur MacOS
                  </span>
                  <span>•</span>
                  <span>Paris, France</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Maintenant
            </div>
          </div>
          
          {/* Other Session */}
          <div className="px-6 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                <Smartphone className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Application mobile</p>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Globe className="h-3.5 w-3.5" />
                    iPhone
                  </span>
                  <span>•</span>
                  <span>Dernière activité il y a 2h</span>
                </div>
              </div>
            </div>
            <motion.button
              className="px-4 py-2 rounded-xl font-medium text-red-500 border border-red-500/30 hover:bg-red-500/10 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Révoquer
            </motion.button>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 overflow-hidden">
        <div className="px-6 py-5 border-b border-red-500/30">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-red-500/10 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-red-500">Zone de danger</h2>
              <p className="text-sm text-muted-foreground">Actions irréversibles sur votre compte</p>
            </div>
          </div>
        </div>
        
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Supprimer le compte</p>
              <p className="text-sm text-muted-foreground">
                Supprimez définitivement votre compte et toutes vos données
              </p>
            </div>
            <motion.button
              className="px-4 py-2 rounded-xl font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Supprimer
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  )
}

