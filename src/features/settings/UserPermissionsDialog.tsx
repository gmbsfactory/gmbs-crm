"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { Check } from "lucide-react"
import { updateUserPermissions } from "@/hooks/usePermissions"
import { toast } from "sonner"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import type { Role, UserPermissionsDialogProps } from "./_components/permissions-types"
import { ROLE_PERMISSIONS, fetchUserPermissions } from "./_components/permissions-types"
import { DialogHeader } from "./_components/DialogHeader"
import { UserProfileSection } from "./_components/UserProfileSection"
import { UserPermissionsSection } from "./_components/UserPermissionsSection"
import { useAvatarHandlers } from "./_components/useAvatarHandlers"
import { usePasswordReset } from "./_components/usePasswordReset"

export type { TeamUser, Role, UserPermissionsDialogProps } from "./_components/permissions-types"

export function UserPermissionsDialog({ user, open, onOpenChange, onSave }: UserPermissionsDialogProps) {
  const queryClient = useQueryClient()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [activeSection, setActiveSection] = React.useState<"profile" | "permissions">("profile")
  const [role, setRole] = React.useState<Role>("gestionnaire")
  const [surnom, setSurnom] = React.useState("")
  const [color, setColor] = React.useState("")
  const [permissionOverrides, setPermissionOverrides] = React.useState<Record<string, boolean | null>>({})
  const [saving, setSaving] = React.useState(false)
  const [expandedCategories, setExpandedCategories] = React.useState<Set<string>>(new Set())
  const [isEditingProfile, setIsEditingProfile] = React.useState(false)
  const [firstname, setFirstname] = React.useState("")
  const [lastname, setLastname] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null)

  // Current user (admin) data
  const { data: currentUser } = useCurrentUser()
  const adminHasSmtp = !!(currentUser as unknown as Record<string, unknown>)?.email_smtp
  const currentUserRoles = (currentUser as unknown as Record<string, unknown>)?.roles as string[] | undefined
  const isCurrentUserAdmin = Array.isArray(currentUserRoles)
    ? currentUserRoles.some((r: string) => r?.toLowerCase()?.includes('admin'))
    : false

  // Custom hooks for avatar and password reset
  const { uploadingAvatar, handleAvatarUpload, handleRemoveAvatar } = useAvatarHandlers({
    userId: user?.id, avatarUrl, setAvatarUrl, fileInputRef,
  })
  const passwordReset = usePasswordReset(user?.id, user?.email)

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
      setActiveSection("profile")
      setExpandedCategories(new Set())
      setIsEditingProfile(false)
      setFirstname(user.firstname || user.prenom || "")
      setLastname(user.lastname || user.name || "")
      setEmail(user.email || "")
      setAvatarUrl(user.avatar_url || null)
      passwordReset.resetPasswordState()
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load existing overrides from DB
  React.useEffect(() => {
    if (permissionsData?.data?.overrides) {
      const overrides: Record<string, boolean | null> = {}
      for (const o of permissionsData.data.overrides) {
        if (o.permission?.key) overrides[o.permission.key] = o.granted
      }
      setPermissionOverrides(overrides)
    }
  }, [permissionsData])

  const rolePermissionsByRole = React.useMemo(() => {
    const fromApi = permissionsData?.data?.rolePermissionsByRole
    if (fromApi && typeof fromApi === "object") return fromApi as Partial<Record<Role, string[]>>
    return {}
  }, [permissionsData])

  const rolePermissions = React.useMemo(
    () => new Set(rolePermissionsByRole[role] || ROLE_PERMISSIONS[role] || []),
    [role, rolePermissionsByRole]
  )

  const effectivePermissions = React.useMemo(() => {
    const effective = new Set<string>(rolePermissions)
    for (const [key, value] of Object.entries(permissionOverrides)) {
      if (value === true) effective.add(key)
      else if (value === false) effective.delete(key)
    }
    return effective
  }, [rolePermissions, permissionOverrides])

  const togglePermission = (key: string) => {
    const roleHas = rolePermissions.has(key)
    const currentEffective = effectivePermissions.has(key)
    setPermissionOverrides(prev => {
      if (currentEffective) return roleHas ? { ...prev, [key]: false } : { ...prev, [key]: null }
      else return roleHas ? { ...prev, [key]: null } : { ...prev, [key]: true }
    })
  }

  const toggleCategory = (categoryKey: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(categoryKey)) next.delete(categoryKey)
      else next.add(categoryKey)
      return next
    })
  }

  const savePermissionsMutation = useMutation({
    mutationFn: async () => {
      if (!user) return
      const permissionsToSave: Record<string, boolean | null> = {}
      for (const [key, value] of Object.entries(permissionOverrides)) {
        if (value !== null && value !== undefined) permissionsToSave[key] = value
      }
      if (permissionsData?.data?.overrides) {
        for (const o of permissionsData.data.overrides) {
          if (o.permission?.key && permissionOverrides[o.permission.key] === null) {
            permissionsToSave[o.permission.key] = null
          }
        }
      }
      if (Object.keys(permissionsToSave).length > 0) await updateUserPermissions(user.id, permissionsToSave)
      await onSave({ userId: user.id, role, surnom, color, firstname, lastname, email, avatar_url: avatarUrl })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-permissions"] })
      queryClient.invalidateQueries({ queryKey: ["user-permissions-edit"] })
      toast.success("Modifications enregistrees avec succes")
      onOpenChange(false)
    },
    onError: (error) => { toast.error("Erreur lors de l'enregistrement: " + error.message) }
  })

  const handleSave = async () => {
    setSaving(true)
    try { await savePermissionsMutation.mutateAsync() }
    finally { setSaving(false) }
  }

  const displayName = `${firstname} ${lastname}`.trim() || "Utilisateur"
  const initials = ((firstname?.[0] || 'U') + (lastname?.[0] || '')).toUpperCase()
  const overrideCount = Object.values(permissionOverrides).filter(v => v !== null && v !== undefined).length

  if (!open) return null

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
          />
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              className="pointer-events-auto relative w-full max-w-2xl max-h-[90vh] bg-background rounded-2xl shadow-2xl border overflow-hidden flex flex-col"
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <DialogHeader
                displayName={displayName} initials={initials} email={email}
                surnom={surnom} color={color} avatarUrl={avatarUrl}
                isEditingProfile={isEditingProfile} uploadingAvatar={uploadingAvatar}
                activeSection={activeSection} overrideCount={overrideCount}
                firstname={firstname} lastname={lastname} fileInputRef={fileInputRef}
                onClose={() => onOpenChange(false)} onSetActiveSection={setActiveSection}
                onSetIsEditingProfile={setIsEditingProfile} onFirstnameChange={setFirstname}
                onLastnameChange={setLastname} onEmailChange={setEmail} onSurnomChange={setSurnom}
                onAvatarUpload={handleAvatarUpload} onRemoveAvatar={handleRemoveAvatar}
                onTriggerFileInput={() => fileInputRef.current?.click()}
              />
              <div className="flex-1 overflow-y-auto p-6 scrollbar-minimal">
                <AnimatePresence mode="wait">
                  {activeSection === "profile" ? (
                    <UserProfileSection
                      role={role} color={color} isCurrentUserAdmin={isCurrentUserAdmin}
                      adminHasSmtp={adminHasSmtp}
                      resetPasswordLoading={passwordReset.resetPasswordLoading}
                      resetPasswordLink={passwordReset.resetPasswordLink}
                      resetLinkCopied={passwordReset.resetLinkCopied}
                      sendingResetEmail={passwordReset.sendingResetEmail}
                      onRoleChange={setRole} onColorChange={setColor}
                      onGenerateResetLink={passwordReset.handleGenerateResetLink}
                      onCopyResetLink={passwordReset.handleCopyResetLink}
                      onSendResetEmail={passwordReset.handleSendResetEmail}
                    />
                  ) : (
                    <UserPermissionsSection
                      loadingPermissions={loadingPermissions} rolePermissions={rolePermissions}
                      effectivePermissions={effectivePermissions} permissionOverrides={permissionOverrides}
                      expandedCategories={expandedCategories} overrideCount={overrideCount}
                      onTogglePermission={togglePermission}
                      onResetToRoleDefault={(key) => setPermissionOverrides(prev => ({ ...prev, [key]: null }))}
                      onToggleCategory={toggleCategory}
                      onResetAllOverrides={() => setPermissionOverrides({})}
                    />
                  )}
                </AnimatePresence>
              </div>
              <div className="px-6 py-4 border-t bg-muted/20 flex items-center justify-end gap-3">
                <button type="button" onClick={() => onOpenChange(false)} disabled={saving}
                  className="px-5 py-2.5 rounded-xl font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                >Annuler</button>
                <motion.button type="button" onClick={handleSave} disabled={saving}
                  className="px-6 py-2.5 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                >
                  {saving ? (
                    <><div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />Enregistrement...</>
                  ) : (
                    <><Check className="h-4 w-4" />Enregistrer</>
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
