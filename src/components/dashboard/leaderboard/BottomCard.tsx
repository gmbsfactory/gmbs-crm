import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { TrendingDown } from "lucide-react"

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

interface BottomCardProps {
  entry: GestionnaireRankingItem
  position: number
  totalRankings: number
  displayMetric?: 'margin' | 'revenue'
}

const getInitials = (name: string | null) => {
  if (!name) return "??"
  const parts = name.split(" ").filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

const getFirstName = (fullName: string | null) => {
  if (!fullName) return ""
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

export const BottomCard = ({ entry, position, totalRankings, displayMetric = 'margin' }: BottomCardProps) => {
  const isLast = position === totalRankings
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
    <Card
      className={cn(
        "flex flex-col items-center gap-2 p-3 transition-all duration-300",
        "hover:scale-105 hover:shadow-lg",
        isLast
          ? "bg-gradient-to-b from-cold/20 via-cold-glow/20 to-cold/20 border-cold/30"
          : "bg-muted/30 border-muted"
      )}
    >
      <div
        className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs",
          isLast ? "bg-cold text-primary-foreground" : "bg-muted-foreground/20 text-foreground"
        )}
      >
        {position}
      </div>

      <GestionnaireBadge
        firstname={entry.user_firstname}
        lastname={entry.user_name?.split(' ').slice(1).join(' ')}
        color={entry.user_color}
        avatarUrl={entry.user_avatar_url}
        size="md"
        className="border-2 border-border"
        showBorder={true}
      />

      <div className="text-center space-y-1">
        <p className="font-semibold text-xs text-foreground flex items-center justify-center gap-1">
          {displayName}
          {isLast && <TrendingDown className="w-3 h-3 text-cold" />}
        </p>
        <p className={cn("text-sm font-bold", isLast ? "text-cold" : "text-foreground")}>
          {formatCurrency(displayValue)}
        </p>
      </div>
    </Card>
  )
}

