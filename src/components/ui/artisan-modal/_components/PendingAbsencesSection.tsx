"use client"

import { useCallback, useState } from "react"
import { Calendar, ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

const inputClass = "h-8 text-sm bg-background border-input/80 focus:border-primary focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/60"
const labelClass = "text-xs font-medium text-foreground/80"

export type PendingAbsence = {
  id: string
  start_date: string
  end_date: string
  reason: string
}

type Props = {
  absences: PendingAbsence[]
  onAdd: (absence: PendingAbsence) => void
  onRemove: (id: string) => void
}

export function PendingAbsencesSection({ absences, onAdd, onRemove }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [draft, setDraft] = useState({ start_date: "", end_date: "", reason: "" })

  const handleAdd = useCallback(() => {
    if (!draft.start_date || !draft.end_date) {
      toast.error("Veuillez renseigner les dates de début et de fin")
      return
    }

    onAdd({
      id: `pending-${Date.now()}`,
      start_date: draft.start_date,
      end_date: draft.end_date,
      reason: draft.reason,
    })
    setDraft({ start_date: "", end_date: "", reason: "" })
    toast.success("Absence ajoutée")
  }, [draft, onAdd])

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer py-3 px-4 hover:bg-muted/50">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4" />
              Gestion des absences
              {isOpen ? (
                <ChevronDown className="ml-auto h-4 w-4" />
              ) : (
                <ChevronRight className="ml-auto h-4 w-4" />
              )}
              {absences.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {absences.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="px-4 pb-4 pt-0 space-y-3">
            <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border/50">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className={labelClass}>Date de début</Label>
                  <Input
                    type="date"
                    className={inputClass}
                    value={draft.start_date}
                    onChange={(e) => setDraft(prev => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className={labelClass}>Date de fin</Label>
                  <Input
                    type="date"
                    className={inputClass}
                    value={draft.end_date}
                    onChange={(e) => setDraft(prev => ({ ...prev, end_date: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className={labelClass}>Motif (optionnel)</Label>
                <Input
                  placeholder="Ex: Congés, Maladie..."
                  className={inputClass}
                  value={draft.reason}
                  onChange={(e) => setDraft(prev => ({ ...prev, reason: e.target.value }))}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={handleAdd}
              >
                <Plus className="h-3 w-3 mr-1" />
                Ajouter une absence
              </Button>
            </div>

            {absences.length > 0 ? (
              <div className="space-y-1.5">
                {absences.map((absence) => (
                  <div
                    key={absence.id}
                    className="flex items-center justify-between p-2 rounded border text-xs bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3 text-amber-600" />
                      <span>
                        Du {new Date(absence.start_date).toLocaleDateString('fr-FR')} au {new Date(absence.end_date).toLocaleDateString('fr-FR')}
                      </span>
                      {absence.reason && (
                        <Badge variant="outline" className="text-[10px]">
                          {absence.reason}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-700">
                        En attente
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => onRemove(absence.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs italic text-muted-foreground text-center py-2">
                Aucune absence planifiée
              </p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
