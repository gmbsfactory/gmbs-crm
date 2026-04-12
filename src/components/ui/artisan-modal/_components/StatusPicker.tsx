"use client"

import { Controller, type Control } from "react-hook-form"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const inputClass = "h-8 text-sm bg-background border-input/80 focus:border-primary focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/60"
const labelClass = "text-xs font-medium text-foreground/80"

export type StatusOption = {
  id: string
  code: string
  label: string
  color: string | null
}

type Props = {
  control: Control<any>
  name?: string
  options: StatusOption[]
  fallbackStatusId?: string
  readOnly?: boolean
  readOnlyFallback?: StatusOption | null
}

export function StatusPicker({
  control,
  name = "statut_id",
  options,
  fallbackStatusId,
  readOnly = false,
  readOnlyFallback = null,
}: Props) {
  return (
    <div className="space-y-1">
      <Label className={labelClass}>Statut</Label>
      {readOnly ? (
        <ReadOnlyStatus status={readOnlyFallback} />
      ) : (
        <Controller
          name={name}
          control={control}
          render={({ field }) => {
            const selectedStatusId = field.value || fallbackStatusId || ""
            const selectedStatus =
              options.find((s) => s.id === selectedStatusId) ||
              (readOnlyFallback && readOnlyFallback.id === selectedStatusId ? readOnlyFallback : null)

            return (
              <Select value={selectedStatusId} onValueChange={field.onChange}>
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder="Sélectionner un statut...">
                    {selectedStatus ? (
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: selectedStatus.color ?? '#6B7280' }}
                        />
                        <span>{selectedStatus.label}</span>
                      </div>
                    ) : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {options.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: status.color ?? '#6B7280' }}
                        />
                        <span>{status.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )
          }}
        />
      )}
    </div>
  )
}

function ReadOnlyStatus({ status }: { status: StatusOption | null }) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2 h-8 text-sm">
      {status ? (
        <>
          <span
            className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: status.color ?? '#6B7280' }}
          />
          <span className="truncate">{status.label}</span>
        </>
      ) : (
        <span className="text-muted-foreground">Non défini</span>
      )}
    </div>
  )
}
