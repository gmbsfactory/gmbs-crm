"use client"

import { motion } from "framer-motion"
import { Settings2, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"
import type { TeamUser } from "./team-types"
import { getRoleConfig, getStatusConfig } from "./team-types"

interface TeamMemberRowProps {
  user: TeamUser
  index: number
  onEdit: (user: TeamUser) => void
  onDelete: (user: TeamUser) => void
}

export function TeamMemberRow({ user, index, onEdit, onDelete }: TeamMemberRowProps) {
  const statusConfig = getStatusConfig(user.status)

  return (
    <motion.div
      key={user.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="px-6 py-4 hover:bg-muted/30 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Avatar avec indicateur de statut */}
          <div className="relative">
            <GestionnaireBadge
              firstname={user.firstname}
              lastname={user.lastname}
              prenom={user.prenom}
              name={user.name}
              color={user.color}
              avatarUrl={user.avatar_url}
              size="lg"
              showBorder={true}
            >
              <div className={cn(
                "absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-background",
                statusConfig.color
              )} />
            </GestionnaireBadge>
          </div>

          {/* Infos utilisateur */}
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold">
                {user.firstname || user.prenom} {user.lastname || user.name}
              </p>
              {user.code_gestionnaire || user.surnom ? (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: user.color || '#6366f1' }}
                >
                  {user.code_gestionnaire || user.surnom}
                </span>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Roles */}
          <div className="flex items-center gap-1.5">
            {(user.roles && user.roles.length > 0 ? user.roles : [user.role].filter(Boolean)).map((r) => {
              const cfg = getRoleConfig(r)
              const Icon = cfg.icon
              return (
                <div key={r} className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg",
                  cfg.bg
                )}>
                  <Icon className={cn("h-3.5 w-3.5", cfg.color)} />
                  <span className={cn("text-xs font-medium", cfg.color)}>
                    {cfg.label}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Statut */}
          <div className="flex items-center gap-2">
            <div className={cn("h-2.5 w-2.5 rounded-full", statusConfig.color)} />
            <span className="text-sm text-muted-foreground">{statusConfig.label}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <motion.button
              onClick={() => onEdit(user)}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Settings2 className="h-4 w-4 text-muted-foreground" />
            </motion.button>
            <motion.button
              onClick={() => onDelete(user)}
              className="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
