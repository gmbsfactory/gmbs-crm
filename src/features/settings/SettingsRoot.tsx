"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
    User,
    Shield,
    Users,
    Palette,
    Target,
    Settings2,
  } from "lucide-react"
import { useRouter } from "next/navigation"
import { usePermissions } from "@/hooks/usePermissions"
import { TargetsSettings } from "./TargetsSettings"
import { EnumManager } from "./EnumManager"
import { ProfileSettings } from "./ProfileSettings"
import { InterfaceSettings } from "./InterfaceSettings"
import { TeamSettings } from "./TeamSettings"
import { SecuritySettings } from "./SecuritySettings"

export type SettingsTab = "profile" | "interface" | "team" | "enums" | "security" | "targets"

export default function SettingsPage({ activeTab = "profile", embedHeader = true }: { activeTab?: SettingsTab; embedHeader?: boolean }) {
  const router = useRouter()
  
  // Utiliser le hook centralisé usePermissions pour les vérifications de droits
  const { can, canAny, isAdmin, isLoading: rolesLoading } = usePermissions()
  
  // Vérifier les permissions pour les différents onglets
  // Team tab: nécessite write_users (pas juste read_users car c'est pour la gestion)
  const canAccessTeam = can("write_users")
  
  // Enums tab: admin uniquement (manage_settings)
  const canManageEnums = can("manage_settings")
  
  // Targets tab: admin ou manager peuvent gérer les objectifs
  const canManageTargets = canAny(["manage_settings", "view_comptabilite"])

  return (
    <div className="flex flex-col min-h-[1px]">
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          const val = v as SettingsTab
          const target = val === "profile" ? "/settings/profile" : `/settings/${val}`
          router.push(target)
        }}
        className="space-y-6"
      >
        {embedHeader && (
          <>
            <div className="mb-6">
              <h1 className="text-3xl font-bold tracking-tight">Paramètres</h1>
              <p className="text-muted-foreground">Gérez vos paramètres et préférences</p>
            </div>
            <TabsList className={`grid w-full ${
                canAccessTeam && canManageTargets && canManageEnums ? "grid-cols-6" :
                canAccessTeam && canManageTargets ? "grid-cols-5" : 
                canAccessTeam || canManageTargets ? "grid-cols-4" : 
                "grid-cols-3"
              }`}>
              <TabsTrigger value="profile" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Profil
              </TabsTrigger>
              <TabsTrigger value="interface" className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Interface
              </TabsTrigger>
              {canAccessTeam && (
                <TabsTrigger value="team" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Équipe
                </TabsTrigger>
              )}
              {canManageEnums && (
                <TabsTrigger value="enums" className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Données
                </TabsTrigger>
              )}
              {canManageTargets && (
                <TabsTrigger value="targets" className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Objectifs
                </TabsTrigger>
              )}
              <TabsTrigger value="security" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Sécurité
              </TabsTrigger>
            </TabsList>
          </>
        )}

          <TabsContent value="profile" className="space-y-6">
            <ProfileSettings />
          </TabsContent>

          <TabsContent value="interface" className="space-y-6">
            <InterfaceSettings />
          </TabsContent>

          {canAccessTeam && (
            <TabsContent value="team" className="space-y-6">
              <TeamSettings />
            </TabsContent>
          )}

          {canManageEnums && (
            <TabsContent value="enums" className="space-y-6">
              <EnumManager />
            </TabsContent>
          )}

          {canManageTargets && (
            <TabsContent value="targets" className="space-y-6">
              <TargetsSettings />
            </TabsContent>
          )}

          <TabsContent value="security" className="space-y-6">
            <SecuritySettings />
          </TabsContent>
        </Tabs>
      </div>
    )
  }
