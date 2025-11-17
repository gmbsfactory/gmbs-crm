import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import { useGestionnaires } from "@/hooks/useGestionnaires"
import { useQuery } from "@tanstack/react-query"
import { referenceApi } from "@/lib/reference-api"
import { enumsApi } from "@/lib/supabase-api-v2"

interface FilterBarProps {
  onPeriodChange: (period: string) => void
  onAgenceChange?: (agence: string) => void
  onGestionnaireChange?: (gestionnaire: string) => void
  onMetierChange?: (metier: string) => void
}

export function FilterBar({ 
  onPeriodChange, 
  onAgenceChange, 
  onGestionnaireChange, 
  onMetierChange 
}: FilterBarProps) {
  // Charger les gestionnaires depuis la BDD
  const { data: gestionnaires, isLoading: isLoadingGestionnaires } = useGestionnaires()
  
  // Charger les agences depuis la BDD
  const { data: agences, isLoading: isLoadingAgences } = useQuery({
    queryKey: ["agences"],
    queryFn: async () => {
      return await referenceApi.getAgencies()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
  
  // Charger les métiers depuis la BDD
  const { data: metiers, isLoading: isLoadingMetiers } = useQuery({
    queryKey: ["metiers"],
    queryFn: async () => {
      return await enumsApi.getMetiers()
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  return (
    <Card className="border border-border rounded-lg p-4 mb-6 shadow-sm">
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium text-foreground mb-2 block">Période</label>
          <Select defaultValue="mois" onValueChange={onPeriodChange}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner une période" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="jour">Jour</SelectItem>
              <SelectItem value="mois">Mois</SelectItem>
              <SelectItem value="annee">Année</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {onAgenceChange && (
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium text-foreground mb-2 block">Agence</label>
            <Select onValueChange={onAgenceChange} disabled={isLoadingAgences}>
              <SelectTrigger>
                <SelectValue placeholder={isLoadingAgences ? "Chargement..." : "Toutes les agences"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les agences</SelectItem>
                {agences?.map((agence) => (
                  <SelectItem key={agence.id} value={agence.id}>
                    {agence.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {onGestionnaireChange && (
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium text-foreground mb-2 block">Gestionnaire</label>
            <Select onValueChange={onGestionnaireChange} disabled={isLoadingGestionnaires}>
              <SelectTrigger>
                <SelectValue placeholder={isLoadingGestionnaires ? "Chargement..." : "Tous les gestionnaires"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les gestionnaires</SelectItem>
                {gestionnaires?.map((gestionnaire) => (
                  <SelectItem key={gestionnaire.id} value={gestionnaire.id}>
                    {gestionnaire.firstname} {gestionnaire.lastname}
                    {gestionnaire.code_gestionnaire && ` (${gestionnaire.code_gestionnaire})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {onMetierChange && (
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium text-foreground mb-2 block">Métier</label>
            <Select onValueChange={onMetierChange} disabled={isLoadingMetiers}>
              <SelectTrigger>
                <SelectValue placeholder={isLoadingMetiers ? "Chargement..." : "Tous les métiers"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les métiers</SelectItem>
                {metiers?.map((metier) => (
                  <SelectItem key={metier.id} value={metier.id}>
                    {metier.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </Card>
  )
}

