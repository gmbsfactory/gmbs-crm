"use client"

import * as React from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  Lock,
  Unlock,
  Check,
  RotateCcw,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { PERMISSION_CATEGORIES } from "./permissions-types"
import type { PermissionCategory } from "./permissions-types"

// Individual permission item
function PermissionItem({
  permission,
  isEffective,
  isOverridden,
  override,
  onToggle,
  onReset
}: {
  permission: { key: string; label: string; description: string }
  isEffective: boolean
  isOverridden: boolean
  override: boolean | null | undefined
  onToggle: () => void
  onReset: () => void
}) {
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      className={cn(
        "group relative flex items-center justify-between w-full px-3 py-2.5 rounded-lg transition-all duration-200",
        "hover:bg-muted/60",
        isEffective
          ? isOverridden
            ? "bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/20"
            : "bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20"
          : isOverridden
            ? "bg-red-500/10 dark:bg-red-500/15 border border-red-500/20"
            : "bg-muted/30 border border-transparent"
      )}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "flex items-center justify-center h-8 w-8 rounded-lg transition-colors",
          isEffective
            ? isOverridden
              ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
              : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
            : isOverridden
              ? "bg-red-500/20 text-red-600 dark:text-red-400"
              : "bg-muted text-muted-foreground"
        )}>
          {isEffective ? (
            <Unlock className="h-4 w-4" />
          ) : (
            <Lock className="h-4 w-4" />
          )}
        </div>
        <div className="text-left">
          <p className={cn(
            "text-sm font-medium transition-colors",
            !isEffective && "text-muted-foreground"
          )}>
            {permission.label}
            {isOverridden && (
              <span className={cn(
                "ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider",
                override ? "bg-blue-500/20 text-blue-600 dark:text-blue-400" : "bg-red-500/20 text-red-600 dark:text-red-400"
              )}>
                {override ? "Ajoute" : "Retire"}
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground/80">{permission.description}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isOverridden && (
          <motion.button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onReset()
            }}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-muted transition-all"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            title="Reinitialiser"
          >
            <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
          </motion.button>
        )}
        <div className={cn(
          "h-5 w-5 rounded-full flex items-center justify-center transition-colors",
          isEffective
            ? isOverridden
              ? "bg-blue-500 text-white"
              : "bg-emerald-500 text-white"
            : "bg-muted-foreground/20"
        )}>
          {isEffective && <Check className="h-3 w-3" />}
        </div>
      </div>
    </motion.button>
  )
}

// Permission category accordion
function PermissionCategoryBlock({
  categoryKey,
  category,
  rolePermissions,
  effectivePermissions,
  permissionOverrides,
  onToggle,
  onReset,
  isExpanded,
  onToggleExpand
}: {
  categoryKey: string
  category: PermissionCategory
  rolePermissions: Set<string>
  effectivePermissions: Set<string>
  permissionOverrides: Record<string, boolean | null>
  onToggle: (key: string) => void
  onReset: (key: string) => void
  isExpanded: boolean
  onToggleExpand: () => void
}) {
  const Icon = category.icon
  const grantedCount = category.permissions.filter(p => effectivePermissions.has(p.key)).length
  const totalCount = category.permissions.length
  const allGranted = grantedCount === totalCount

  const colorClasses = {
    blue: "from-blue-500/20 to-blue-600/5 border-blue-500/20 text-blue-600 dark:text-blue-400",
    emerald: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
    violet: "from-violet-500/20 to-violet-600/5 border-violet-500/20 text-violet-600 dark:text-violet-400",
    amber: "from-amber-500/20 to-amber-600/5 border-amber-500/20 text-amber-600 dark:text-amber-400",
  }

  const colorClass = colorClasses[category.color as keyof typeof colorClasses] || colorClasses.blue

  return (
    <div className="rounded-xl border bg-card/50 overflow-hidden">
      <button
        type="button"
        onClick={onToggleExpand}
        className={cn(
          "w-full flex items-center justify-between p-4 transition-colors hover:bg-muted/30",
          isExpanded && "border-b"
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br border",
            colorClass
          )}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="text-left">
            <p className="font-semibold">{category.label}</p>
            <p className="text-xs text-muted-foreground">
              {grantedCount} / {totalCount} permissions actives
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className={cn(
            "px-2.5 py-1 rounded-full text-xs font-medium",
            allGranted
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : "bg-muted text-muted-foreground"
          )}>
            {allGranted ? "Complet" : `${grantedCount}/${totalCount}`}
          </div>
          <ChevronRight className={cn(
            "h-5 w-5 text-muted-foreground transition-transform duration-200",
            isExpanded && "rotate-90"
          )} />
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-3 space-y-2">
              {category.permissions.map((perm) => {
                const isEffective = effectivePermissions.has(perm.key)
                const override = permissionOverrides[perm.key]
                const isOverridden = override !== undefined && override !== null

                return (
                  <PermissionItem
                    key={perm.key}
                    permission={perm}
                    isEffective={isEffective}
                    isOverridden={isOverridden}
                    override={override}
                    onToggle={() => onToggle(perm.key)}
                    onReset={() => onReset(perm.key)}
                  />
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface UserPermissionsSectionProps {
  loadingPermissions: boolean
  rolePermissions: Set<string>
  effectivePermissions: Set<string>
  permissionOverrides: Record<string, boolean | null>
  expandedCategories: Set<string>
  overrideCount: number
  onTogglePermission: (key: string) => void
  onResetToRoleDefault: (key: string) => void
  onToggleCategory: (categoryKey: string) => void
  onResetAllOverrides: () => void
}

export function UserPermissionsSection({
  loadingPermissions,
  rolePermissions,
  effectivePermissions,
  permissionOverrides,
  expandedCategories,
  overrideCount,
  onTogglePermission,
  onResetToRoleDefault,
  onToggleCategory,
  onResetAllOverrides,
}: UserPermissionsSectionProps) {
  return (
    <motion.div
      key="permissions"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {/* Legende */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border">
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Du role
          </span>
          <span className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            Ajoute
          </span>
          <span className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
            Retire
          </span>
        </div>
        {overrideCount > 0 && (
          <button
            type="button"
            onClick={onResetAllOverrides}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reinitialiser ({overrideCount})
          </button>
        )}
      </div>

      {loadingPermissions ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Chargement des permissions...</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(PERMISSION_CATEGORIES).map(([categoryKey, category]) => (
            <PermissionCategoryBlock
              key={categoryKey}
              categoryKey={categoryKey}
              category={category}
              rolePermissions={rolePermissions}
              effectivePermissions={effectivePermissions}
              permissionOverrides={permissionOverrides}
              onToggle={onTogglePermission}
              onReset={onResetToRoleDefault}
              isExpanded={expandedCategories.has(categoryKey)}
              onToggleExpand={() => onToggleCategory(categoryKey)}
            />
          ))}
        </div>
      )}
    </motion.div>
  )
}
