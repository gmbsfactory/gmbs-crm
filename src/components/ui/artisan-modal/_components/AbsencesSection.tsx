"use client"

import { Calendar, ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatDate } from "@/components/ui/artisan-modal/_lib/format"

type Absence = {
  id: string
  startDate: string | null
  endDate: string | null
  reason: string | null
  isConfirmed: boolean | null
}

type NewAbsence = {
  start_date: string
  end_date: string
  reason: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  absences: Absence[]
  newAbsence: NewAbsence
  setNewAbsence: React.Dispatch<React.SetStateAction<NewAbsence>>
  onAdd: () => void
  onDelete: (id: string) => void
  inputClass: string
  labelClass: string
}

export function AbsencesSection({
  open,
  onOpenChange,
  absences,
  newAbsence,
  setNewAbsence,
  onAdd,
  onDelete,
  inputClass,
  labelClass,
}: Props) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer py-3 px-4 hover:bg-muted/50">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4" />
              Gestion des absences
              {open ? (
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
                    value={newAbsence.start_date}
                    onChange={(e) =>
                      setNewAbsence((prev) => ({ ...prev, start_date: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className={labelClass}>Date de fin</Label>
                  <Input
                    type="date"
                    className={inputClass}
                    value={newAbsence.end_date}
                    onChange={(e) =>
                      setNewAbsence((prev) => ({ ...prev, end_date: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className={labelClass}>Motif (optionnel)</Label>
                <Input
                  placeholder="Ex: Congés, Maladie..."
                  className={inputClass}
                  value={newAbsence.reason}
                  onChange={(e) =>
                    setNewAbsence((prev) => ({ ...prev, reason: e.target.value }))
                  }
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={onAdd}
              >
                <Plus className="h-3 w-3 mr-1" />
                Ajouter une absence
              </Button>
            </div>

            {absences.length > 0 && (
              <div className="space-y-1.5">
                {absences.map((absence) => (
                  <div
                    key={absence.id}
                    className="flex items-center justify-between p-2 rounded border bg-background border-border text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <span>
                        Du {formatDate(absence.startDate)} au {formatDate(absence.endDate)}
                      </span>
                      {absence.reason && (
                        <Badge variant="outline" className="text-[10px]">
                          {absence.reason}
                        </Badge>
                      )}
                      {absence.isConfirmed ? (
                        <Badge variant="secondary" className="text-[10px]">
                          Confirmée
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          Proposée
                        </Badge>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={() => onDelete(absence.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {absences.length === 0 && (
              <p className="text-xs italic text-muted-foreground text-center py-2">
                Aucune absence enregistrée
              </p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
