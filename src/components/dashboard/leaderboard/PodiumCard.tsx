import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"
import { Card } from "@/components/ui/card"
import { Crown } from "lucide-react"
import { cn } from "@/lib/utils"

interface GestionnaireRankingItem {
  user_id: string
  user_name: string
  user_firstname: string | null
  user_code: string | null
  user_color: string | null
  user_avatar_url: string | null
  total_margin: number
  total_revenue?: number
  total_interventions: number
  rank: number
}

interface PodiumCardProps {
  entry: GestionnaireRankingItem
  position: 1 | 2 | 3
  displayMetric?: 'margin' | 'revenue'
}

const positionConfig = {
  1: {
    height: "h-[160px]",
    gradient: "bg-gradient-to-br from-gold via-gold-glow to-gold",
    shadow: "shadow-[0_8px_32px_-8px_hsl(var(--gold)/0.5)]",
    icon: Crown,
    emoji: null,
    iconColor: "text-yellow-900",
    textColor: "text-yellow-900",
    nameSize: "text-sm",
    scoreSize: "text-2xl",
    scoreColor: "text-yellow-600 font-black",
    avatarBorder: "border-gold",
    order: "order-2",
    scale: "hover:scale-105",
    marginTop: "mt-12",
  },
  2: {
    height: "h-[130px]",
    gradient: "bg-gradient-to-br from-silver via-silver-glow to-silver",
    shadow: "shadow-[0_8px_32px_-8px_hsl(var(--silver)/0.4)]",
    icon: null,
    emoji: "🥈",
    iconColor: "text-gray-700",
    textColor: "text-gray-700",
    nameSize: "text-xs",
    scoreSize: "text-xl",
    scoreColor: "text-gray-600 font-black",
    avatarBorder: "border-silver",
    order: "order-1",
    scale: "hover:scale-105",
    marginTop: "mt-16",
  },
  3: {
    height: "h-[130px]",
    gradient: "bg-gradient-to-br from-bronze via-bronze-glow to-bronze",
    shadow: "shadow-[0_8px_32px_-8px_hsl(var(--bronze)/0.4)]",
    icon: null,
    emoji: "🥉",
    iconColor: "text-orange-900",
    textColor: "text-orange-900",
    nameSize: "text-xs",
    scoreSize: "text-xl",
    scoreColor: "text-orange-700 font-black",
    avatarBorder: "border-bronze",
    order: "order-3",
    scale: "hover:scale-105",
    marginTop: "mt-16",
  },
}

const getInitials = (name: string) => {
  const parts = name.split(" ").filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

const getFirstName = (fullName: string) => {
  const parts = fullName.split(" ").filter(Boolean)
  return parts.length > 0 ? parts[0] : fullName
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export const PodiumCard = ({ entry, position, displayMetric = 'margin' }: PodiumCardProps) => {
  const config = positionConfig[position]
  const Icon = config.icon
  // Utiliser firstname depuis la DB, sinon extraire depuis user_name (si différent du code), sinon user_code, sinon user_name complet
  const firstNameFromName = entry.user_name && entry.user_name !== entry.user_code
    ? getFirstName(entry.user_name)
    : null
  const displayName = entry.user_firstname || firstNameFromName || entry.user_code || entry.user_name

  // Afficher soit la marge soit le CA selon displayMetric
  const displayValue = displayMetric === 'revenue'
    ? (entry.total_revenue || 0)
    : entry.total_margin

  return (
    <div className={cn("flex flex-col items-center gap-3", config.order)}>
      <Card
        className={cn(
          "relative w-24 md:w-28 flex flex-col items-center justify-end p-3 pb-4 transition-transform duration-300",
          config.height,
          config.gradient,
          config.shadow,
          config.scale,
          "border-none"
        )}
      >
        <div className="absolute -top-12 flex flex-col items-center gap-1.5">
          {Icon ? (
            <div className="relative">
              {position === 1 ? (
                <>
                  {/* Effet de brillance animé en arrière-plan */}
                  <div
                    className="absolute inset-0 w-8 h-8 -translate-x-0.5 -translate-y-0.5 opacity-70 blur-md"
                    style={{
                      background: "radial-gradient(circle, rgba(255,215,0,1) 0%, rgba(255,165,0,0.8) 40%, transparent 70%)",
                      animation: "pulse 2s ease-in-out infinite",
                    }}
                  />
                  {/* Reflet brillant diamanté */}
                  <div
                    className="absolute inset-0 w-8 h-8 -translate-x-0.5 -translate-y-0.5 opacity-50"
                    style={{
                      background: "linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,215,0,0.6) 30%, transparent 60%)",
                    }}
                  />
                  {/* Couronne avec gradient or diamanté */}
                  <Icon
                    className="w-8 h-8 relative z-10"
                    style={{
                      filter: "drop-shadow(0 0 6px rgba(255, 215, 0, 1)) drop-shadow(0 0 12px rgba(255, 215, 0, 0.8)) drop-shadow(0 0 18px rgba(255, 165, 0, 0.6))",
                      background: "linear-gradient(135deg, #FFD700 0%, #FFA500 25%, #FFD700 50%, #FFF8DC 75%, #FFD700 100%)",
                      backgroundSize: "200% 200%",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                      animation: "shimmer-gradient 3s ease-in-out infinite",
                    }}
                  />
                </>
              ) : (
                <Icon className={cn("w-6 h-6", config.iconColor)} />
              )}
            </div>
          ) : (
            <span className="text-3xl">{config.emoji}</span>
          )}
          <GestionnaireBadge
            firstname={entry.user_firstname}
            lastname={entry.user_name?.split(' ').slice(1).join(' ')} // Extracting last name if possible
            color={entry.user_color}
            avatarUrl={entry.user_avatar_url}
            size="lg"
            className={cn("border-[3px] shadow-lg", config.avatarBorder)}
            showBorder={true}
          />
        </div>

        <div className={cn("flex flex-col items-center gap-1", config.marginTop)}>
          <p className={cn("font-bold text-center", config.textColor, config.nameSize)}>
            {displayName}
          </p>
          <p className={cn("font-extrabold", config.scoreColor, config.scoreSize)}>
            {formatCurrency(displayValue)}
          </p>
        </div>
      </Card>
    </div>
  )
}

