"use client"

import * as React from "react"
import {
  User,
  Shield,
  X,
  Hash,
  Pencil,
  Camera,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"

interface DialogHeaderProps {
  displayName: string
  initials: string
  email: string
  surnom: string
  color: string
  avatarUrl: string | null
  isEditingProfile: boolean
  uploadingAvatar: boolean
  activeSection: "profile" | "permissions"
  overrideCount: number
  firstname: string
  lastname: string
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onClose: () => void
  onSetActiveSection: (section: "profile" | "permissions") => void
  onSetIsEditingProfile: (editing: boolean) => void
  onFirstnameChange: (value: string) => void
  onLastnameChange: (value: string) => void
  onEmailChange: (value: string) => void
  onSurnomChange: (value: string) => void
  onAvatarUpload: (event: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveAvatar: () => void
  onTriggerFileInput: () => void
}

export function DialogHeader({
  displayName,
  initials,
  email,
  surnom,
  color,
  avatarUrl,
  isEditingProfile,
  uploadingAvatar,
  activeSection,
  overrideCount,
  firstname,
  lastname,
  fileInputRef,
  onClose,
  onSetActiveSection,
  onSetIsEditingProfile,
  onFirstnameChange,
  onLastnameChange,
  onEmailChange,
  onSurnomChange,
  onAvatarUpload,
  onRemoveAvatar,
  onTriggerFileInput,
}: DialogHeaderProps) {
  return (
    <div className="relative px-6 py-5 border-b bg-gradient-to-br from-primary/5 via-background to-background">
      <button
        onClick={onClose}
        className="absolute right-4 top-4 p-2 rounded-lg hover:bg-muted transition-colors"
      >
        <X className="h-5 w-5 text-muted-foreground" />
      </button>

      <div className="flex items-start gap-4">
        {/* Avatar avec bouton d'edition */}
        <div className="relative">
          <Avatar
            className="h-20 w-20 border-[5px] shadow-lg"
            style={{ borderColor: color || '#6366f1' }}
          >
            {avatarUrl ? (
              <AvatarImage
                src={avatarUrl}
                alt={displayName}
                className="object-cover"
              />
            ) : null}
            <AvatarFallback
              className="text-2xl font-semibold uppercase tracking-wide text-white"
              style={{
                background: color || '#6366f1',
                color: '#ffffff',
              }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>

          {isEditingProfile && (
            <div className="absolute -bottom-1 -right-1 flex gap-1">
              <button
                type="button"
                onClick={onTriggerFileInput}
                disabled={uploadingAvatar}
                className="h-7 w-7 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50"
                title="Changer la photo"
              >
                {uploadingAvatar ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={onRemoveAvatar}
                  className="h-7 w-7 rounded-full bg-destructive text-destructive-foreground shadow-lg flex items-center justify-center hover:bg-destructive/90 transition-colors"
                  title="Supprimer la photo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onAvatarUpload}
            className="hidden"
            disabled={uploadingAvatar}
          />
        </div>

        {/* Infos utilisateur */}
        <div className="flex-1 min-w-0">
          {isEditingProfile ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={firstname}
                  onChange={(e) => onFirstnameChange(e.target.value)}
                  placeholder="Prenom"
                  className="px-3 py-2 rounded-lg border bg-muted/30 focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm"
                />
                <input
                  type="text"
                  value={lastname}
                  onChange={(e) => onLastnameChange(e.target.value)}
                  placeholder="Nom"
                  className="px-3 py-2 rounded-lg border bg-muted/30 focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm"
                />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                placeholder="Email"
                className="w-full px-3 py-2 rounded-lg border bg-muted/30 focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm"
              />
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={surnom}
                  onChange={(e) => onSurnomChange(e.target.value)}
                  placeholder="Surnom / Code (ex: JD)"
                  className="flex-1 px-3 py-2 rounded-lg border bg-muted/30 focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none text-sm"
                />
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold truncate">{displayName}</h2>
                <button
                  type="button"
                  onClick={() => onSetIsEditingProfile(true)}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                  title="Modifier le profil"
                >
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground truncate">{email}</p>
              {surnom && (
                <span
                  className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-sm font-medium text-white"
                  style={{ backgroundColor: color || '#6366f1' }}
                >
                  <Hash className="h-3.5 w-3.5" />
                  {surnom}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex gap-1 mt-5 p-1 bg-muted/50 rounded-lg w-fit">
        <button
          onClick={() => onSetActiveSection("profile")}
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
          onClick={() => onSetActiveSection("permissions")}
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
  )
}
