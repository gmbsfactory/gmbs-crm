"use client"

import type { ReactNode } from "react"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { SearchableBadgeSelect } from "@/components/ui/searchable-badge-select"
import { PresenceFieldIndicator } from "@/components/ui/intervention-modal/PresenceFieldIndicator"
import { cn } from "@/lib/utils"
import { STATUS_SORT_ORDER } from "@/lib/interventions/form-constants"
import type { InterventionFormData } from "@/lib/interventions/form-types"
import type { ReferenceData } from "@/lib/reference-api"

interface InterventionHeaderFieldsProps {
  formData: InterventionFormData
  onChange: (field: keyof InterventionFormData, value: string | null) => void
  refData: ReferenceData | null
  showReferenceField: boolean
  requiresDefinitiveId: boolean
  /** Render prop for the user assignment badge (left-most item in the header grid) */
  renderUserBadge: () => ReactNode
  /** When true, wraps fields in PresenceFieldIndicator */
  withPresence?: boolean
  onPopoverOpenChange?: (isOpen: boolean) => void
}

/** Shared header row: user badge, status, agency, reference, metier, id_inter */
export function InterventionHeaderFields({
  formData,
  onChange,
  refData,
  showReferenceField,
  requiresDefinitiveId,
  renderUserBadge,
  withPresence = false,
  onPopoverOpenChange,
}: InterventionHeaderFieldsProps) {
  const Presence = withPresence ? PresenceFieldIndicator : PassThrough

  return (
    <Card className="legacy-form-card" style={{ gridArea: "1 / 1 / 2 / 5" }}>
      <CardContent className="py-0.5 px-3">
        <div
          className="grid gap-2 items-end"
          style={{
            gridTemplateColumns: showReferenceField
              ? "auto 1fr 1fr 1fr 1fr 1fr"
              : "auto 1fr 1fr 1fr 1fr",
          }}
        >
          {/* Badge utilisateur assigné */}
          {renderUserBadge()}

          {/* Statut */}
          <Presence fieldName="statut_id">
            <SearchableBadgeSelect
              label="Statut"
              required
              hideLabel
              value={formData.statut_id}
              onChange={(value) => onChange("statut_id", value)}
              placeholder="Statut"
              onOpenChange={onPopoverOpenChange}
              searchPlaceholder="Rechercher un statut..."
              sortAlphabetically={false}
              presenceFieldName={withPresence ? "statut_id" : undefined}
              options={(refData?.interventionStatuses || [])
                .map((s) => ({
                  id: s.id,
                  label: s.label,
                  color: s.color,
                  code: s.code || "",
                }))
                .sort((a, b) => {
                  const orderA = STATUS_SORT_ORDER[a.code] || 999
                  const orderB = STATUS_SORT_ORDER[b.code] || 999
                  if (orderA !== orderB) return orderA - orderB
                  return (a.label || "").localeCompare(b.label || "", "fr")
                })}
            />
          </Presence>

          {/* Agence */}
          <Presence fieldName="agence_id">
            <SearchableBadgeSelect
              label="Agence"
              hideLabel
              value={formData.agence_id}
              onChange={(value) => onChange("agence_id", value)}
              placeholder="Agence *"
              onOpenChange={onPopoverOpenChange}
              searchPlaceholder="Rechercher une agence..."
              presenceFieldName={withPresence ? "agence_id" : undefined}
              options={(refData?.agencies || [])
                .filter((a) => a.is_active)
                .map((a) => ({
                  id: a.id,
                  label: a.label,
                  color: a.color,
                }))}
            />
          </Presence>

          {/* Réf. agence (conditionnel) */}
          {showReferenceField && (
            <Presence fieldName="reference_agence">
              <div className="flex items-center">
                <Input
                  id="reference_agence"
                  name="reference_agence"
                  value={formData.reference_agence}
                  onChange={(event) => onChange("reference_agence", event.target.value)}
                  placeholder="Réf. agence *"
                  className="h-7 text-xs rounded-full px-3"
                  autoComplete="off"
                  required
                />
              </div>
            </Presence>
          )}

          {/* Métier */}
          <Presence fieldName="metier_id">
            <SearchableBadgeSelect
              label="Métier"
              hideLabel
              value={formData.metier_id}
              onChange={(value) => onChange("metier_id", value)}
              placeholder="Métier *"
              minWidth="100px"
              onOpenChange={onPopoverOpenChange}
              searchPlaceholder="Rechercher un métier..."
              presenceFieldName={withPresence ? "metier_id" : undefined}
              options={(refData?.metiers || []).map((m) => ({
                id: m.id,
                label: m.label,
                color: m.color,
              }))}
            />
          </Presence>

          {/* ID Intervention */}
          <Presence fieldName="idIntervention">
            <div className="flex items-center relative">
              <Input
                id="idIntervention"
                value={formData.id_inter}
                onChange={(event) => onChange("id_inter", event.target.value)}
                placeholder={requiresDefinitiveId ? "ID Inter. *" : "ID Inter. (Auto)"}
                className={cn(
                  "h-7 text-xs rounded-full px-3",
                  requiresDefinitiveId &&
                    (!formData.id_inter?.trim() || formData.id_inter.toLowerCase().includes("auto")) &&
                    "border-orange-400 focus-visible:ring-orange-400",
                )}
                required={requiresDefinitiveId}
                pattern={requiresDefinitiveId ? "^(?!.*(?:[Aa][Uu][Tt][Oo])).+$" : undefined}
                title={requiresDefinitiveId ? "ID définitif requis (sans 'AUTO')" : undefined}
                autoComplete="off"
              />
              {requiresDefinitiveId &&
                (!formData.id_inter?.trim() || formData.id_inter.toLowerCase().includes("auto")) && (
                  <span
                    className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-orange-500 animate-pulse"
                    title="ID définitif requis"
                  />
                )}
            </div>
          </Presence>
        </div>
      </CardContent>
    </Card>
  )
}

/** No-op wrapper when presence is disabled */
function PassThrough({ children }: { fieldName: string; children: ReactNode }) {
  return <>{children}</>
}
