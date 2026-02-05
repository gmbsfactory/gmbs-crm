"use client"

import { useMemo } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { CheckSquare, Layers, Pin, Plus, Settings2, Trash2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { AUTO_ACTIONS } from "@/config/workflow-rules"
import { useWorkflowConfig } from "@/hooks/useWorkflowConfig"
import { cn } from "@/lib/utils"
import type { AutoAction, TransitionCondition, WorkflowStatus, WorkflowTransition } from "@/types/intervention-workflow"
import WorkflowVisualizer from "@/components/interventions/WorkflowVisualizer"
import ColorPicker from "@/components/interventions/ColorPicker"

type WorkflowAdminModalProps = {
  isOpen: boolean
  onClose: () => void
}

export function WorkflowAdminModal({ isOpen, onClose }: WorkflowAdminModalProps) {
  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          key="workflow-admin"
          className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0, 0, 0, 0.20)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="glass-modal-premium h-[80vh] w-[90vw] max-w-7xl overflow-hidden p-0 rounded-2xl"
            style={{
              background: "rgba(255, 255, 255, 0.25)",
              backdropFilter: "blur(16px) saturate(1.4)",
              WebkitBackdropFilter: "blur(16px) saturate(1.4)",
              border: "1px solid rgba(255, 255, 255, 0.4)",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.6)",
            }}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            transition={{ type: "spring", duration: 0.3 }}
            onClick={(event) => event.stopPropagation()}
          >
            <WorkflowEditor onClose={onClose} />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export function WorkflowEditor({ onClose }: { onClose?: () => void }) {
  const {
    workflow,
    selectedStatus,
    selectedTransition,
    selectedStatusId,
    selectedTransitionId,
    selectStatus,
    selectTransition,
    addStatus,
    updateStatus,
    updateStatusMetadata,
    togglePinStatus,
    updateStatusPosition,
    removeStatus,
    addTransition,
    updateTransition,
    updateTransitionConditions,
    updateTransitionAutoActions,
    removeTransition,
    saveWorkflow,
  } = useWorkflowConfig()

  const orderedStatuses = useMemo(
    () =>
      [...workflow.statuses].sort((a, b) => {
        if (a.position.y === b.position.y) return a.position.x - b.position.x
        return a.position.y - b.position.y
      }),
    [workflow.statuses],
  )

  return (
    <div className="flex h-full">
      <aside className="w-72 border-r border-border/60 bg-muted/10">
        <div className="flex items-center justify-between border-b border-border/60 p-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Statuts</span>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" onClick={() => addStatus()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ajouter un statut</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <ScrollArea className="h-full">
          <div className="space-y-1 p-3">
            {orderedStatuses.map((status) => (
              <button
                key={status.id}
                className={cn(
                  "flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition",
                  selectedStatusId === status.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-transparent bg-background hover:border-border/60 hover:bg-muted/40",
                )}
                onClick={() => selectStatus(status.id)}
              >
                <span className="flex items-center gap-2">
                  <span className="inline-block h-2 w-6 rounded-full" style={{ backgroundColor: status.color }} />
                  {status.label}
                </span>
                <div className="flex items-center gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className={cn(
                            "h-6 w-6",
                            status.isPinned
                              ? "text-amber-500 hover:text-amber-600"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                          onClick={(event) => {
                            event.stopPropagation()
                            togglePinStatus(status.id)
                          }}
                        >
                          <Pin className={cn("h-4 w-4", status.isPinned && "fill-current")} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {status.isPinned ? "Désépingler du filtre" : "Épingler dans le filtre"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={(event) => {
                      event.stopPropagation()
                      removeStatus(status.id)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </aside>

      <main className="flex flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border/60 bg-background/80 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Settings2 className="h-4 w-4" />
            <span>Editeur de workflow</span>
          </div>
          <div className="flex items-center gap-2">
            {onClose ? (
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 p-4">
            <WorkflowVisualizer
              workflow={workflow}
              selectedStatusId={selectedStatusId}
              selectedTransitionId={selectedTransitionId}
              onSelectStatus={(id) => selectStatus(id)}
              onSelectTransition={(id) => selectTransition(id)}
              onStatusPositionChange={updateStatusPosition}
              onAddStatus={() => addStatus()}
              onAddTransition={() => addTransition()}
              onSave={saveWorkflow}
              onRemoveStatus={removeStatus}
            />
          </div>
          <aside className="w-80 border-l border-border/60 bg-muted/5 p-4">
            <PropertiesPanel
              selectedStatus={selectedStatus}
              selectedTransition={selectedTransition}
              updateStatus={updateStatus}
              updateStatusMetadata={updateStatusMetadata}
              updateTransition={updateTransition}
              updateTransitionConditions={updateTransitionConditions}
              updateTransitionAutoActions={updateTransitionAutoActions}
              removeTransition={removeTransition}
            />
          </aside>
        </div>
      </main>
    </div>
  )
}

type PropertiesPanelProps = {
  selectedStatus: WorkflowStatus | null
  selectedTransition: WorkflowTransition | null
  updateStatus: (statusId: string, patch: Partial<WorkflowStatus>) => void
  updateStatusMetadata: (statusId: string, patch: Partial<WorkflowStatus["metadata"]>) => void
  updateTransition: (transitionId: string, patch: Partial<WorkflowTransition>) => void
  updateTransitionConditions: (transitionId: string, conditions: TransitionCondition[]) => void
  updateTransitionAutoActions: (transitionId: string, actions: AutoAction[]) => void
  removeTransition: (transitionId: string) => void
}

function PropertiesPanel({
  selectedStatus,
  selectedTransition,
  updateStatus,
  updateStatusMetadata,
  updateTransition,
  updateTransitionConditions,
  updateTransitionAutoActions,
  removeTransition,
}: PropertiesPanelProps) {
  if (!selectedStatus && !selectedTransition) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Sélectionnez un statut ou une transition pour afficher ses propriétés.
      </div>
    )
  }

  if (selectedStatus) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold">Configuration du statut</h3>
          <p className="text-xs text-muted-foreground">Personnalisez le comportement et l&apos;apparence du statut.</p>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nom</Label>
            <Input value={selectedStatus.label} onChange={(event) => updateStatus(selectedStatus.id, { label: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={selectedStatus.description ?? ""}
              onChange={(event) => updateStatus(selectedStatus.id, { description: event.target.value })}
              rows={3}
            />
          </div>
          <ColorPicker value={selectedStatus.color} onChange={(color) => updateStatus(selectedStatus.id, { color })} />
          <StatusRequirementsEditor status={selectedStatus} onChange={(metadata) => updateStatusMetadata(selectedStatus.id, metadata)} />
        </div>
      </div>
    )
  }

  if (selectedTransition) {
    return (
      <div className="flex h-full flex-col gap-6">
        <div>
          <h3 className="text-sm font-semibold">Configuration de la transition</h3>
          <p className="text-xs text-muted-foreground">Définissez les règles conditionnant cette transition.</p>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nom</Label>
            <Input
              value={selectedTransition.label}
              onChange={(event) => updateTransition(selectedTransition.id, { label: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={selectedTransition.description ?? ""}
              rows={3}
              onChange={(event) => updateTransition(selectedTransition.id, { description: event.target.value })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Transition active</Label>
              <p className="text-xs text-muted-foreground">Désactivez pour bloquer la transition dans le workflow.</p>
            </div>
            <Switch
              checked={selectedTransition.isActive}
              onCheckedChange={(checked) => updateTransition(selectedTransition.id, { isActive: checked })}
            />
          </div>
          <div className="space-y-3">
            <Label>Conditions</Label>
            <TransitionConditionsEditor
              conditions={selectedTransition.conditions}
              onChange={(next) => updateTransitionConditions(selectedTransition.id, next)}
            />
          </div>
          <div className="space-y-3">
            <Label>Actions automatiques</Label>
            <AutoActionsEditor
              actions={selectedTransition.autoActions ?? []}
              onChange={(next) => updateTransitionAutoActions(selectedTransition.id, next)}
            />
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={() => removeTransition(selectedTransition.id)} className="gap-2">
          <Trash2 className="h-4 w-4" /> Supprimer la transition
        </Button>
      </div>
    )
  }

  return null
}

type StatusRequirementsEditorProps = {
  status: WorkflowStatus
  onChange: (metadata: Partial<WorkflowStatus["metadata"]>) => void
}

function StatusRequirementsEditor({ status, onChange }: StatusRequirementsEditorProps) {
  return (
    <div className="space-y-4 rounded-lg border border-border/60 bg-background p-3">
      <div className="flex items-center gap-2">
        <CheckSquare className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Prérequis</span>
      </div>
      <RequirementToggle
        label="Artisan requis"
        description="Bloque la transition si aucun artisan n'est assigné"
        checked={Boolean(status.metadata?.requiresArtisan)}
        onChange={(checked) => onChange({ requiresArtisan: checked })}
      />
      <RequirementToggle
        label="Facture requise"
        description="Bloque la transition si aucune facture n'est rattachée"
        checked={Boolean(status.metadata?.requiresFacture)}
        onChange={(checked) => onChange({ requiresFacture: checked })}
      />
      <RequirementToggle
        label="Propriétaire requis"
        description="Bloque la transition si aucun propriétaire n'est renseigné"
        checked={Boolean(status.metadata?.requiresProprietaire)}
        onChange={(checked) => onChange({ requiresProprietaire: checked })}
      />
      <RequirementToggle
        label="Commentaire requis"
        description="Bloque la transition si aucun commentaire n'est renseigné"
        checked={Boolean(status.metadata?.requiresCommentaire)}
        onChange={(checked) => onChange({ requiresCommentaire: checked })}
      />
      <RequirementToggle
        label="ID devis requis"
        description="L'identifiant du devis doit correspondre à l'intervention"
        checked={Boolean(status.metadata?.requiresDevisId)}
        onChange={(checked) => onChange({ requiresDevisId: checked })}
      />
    </div>
  )
}

type RequirementToggleProps = {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function RequirementToggle({ label, description, checked, onChange }: RequirementToggleProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Checkbox checked={checked} onCheckedChange={(next) => onChange(Boolean(next))} />
    </div>
  )
}

type TransitionConditionsEditorProps = {
  conditions: TransitionCondition[]
  onChange: (conditions: TransitionCondition[]) => void
}

function TransitionConditionsEditor({ conditions, onChange }: TransitionConditionsEditorProps) {
  const addCondition = () => {
    onChange([
      ...conditions,
      {
        type: "field_required",
        field: "",
        value: "",
        message: "Condition non satisfaite",
      },
    ])
  }

  const updateCondition = (index: number, patch: Partial<TransitionCondition>) => {
    const next = conditions.map((condition, i) => (i === index ? { ...condition, ...patch } : condition))
    onChange(next)
  }

  const removeCondition = (index: number) => {
    onChange(conditions.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        {conditions.map((condition, index) => (
          <div key={`${condition.type}-${index}`} className="space-y-2 rounded-md border border-border/60 p-3">
            <div className="flex items-center justify-between">
              <Select
                value={condition.type}
                onValueChange={(value) =>
                  updateCondition(index, { type: value as TransitionCondition["type"] })
                }
              >
                <SelectTrigger className="w-40 text-xs">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="field_required">Champ requis</SelectItem>
                  <SelectItem value="field_equals">Champ = valeur</SelectItem>
                  <SelectItem value="custom_validation">Validation personnalisée</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={() => removeCondition(index)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            {condition.type !== "custom_validation" ? (
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs">Champ</Label>
                  <Input
                    value={condition.field ?? ""}
                    onChange={(event) => updateCondition(index, { field: event.target.value })}
                    className="text-xs"
                  />
                </div>
                {condition.type === "field_equals" ? (
                  <div className="space-y-1">
                    <Label className="text-xs">Valeur</Label>
                    <Input
                      value={String(condition.value ?? "")}
                      onChange={(event) => updateCondition(index, { value: event.target.value })}
                      className="text-xs"
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="space-y-1">
              <Label className="text-xs">Message</Label>
              <Input
                value={condition.message}
                onChange={(event) => updateCondition(index, { message: event.target.value })}
                className="text-xs"
              />
            </div>
          </div>
        ))}
      </div>
      <Button variant="secondary" size="sm" className="gap-2" onClick={addCondition}>
        <Plus className="h-4 w-4" /> Ajouter une condition
      </Button>
    </div>
  )
}

type AutoActionsEditorProps = {
  actions: AutoAction[]
  onChange: (actions: AutoAction[]) => void
}

function AutoActionsEditor({ actions, onChange }: AutoActionsEditorProps) {
  const addActionFromLibrary = (key: string) => {
    const action = AUTO_ACTIONS[key]
    if (!action) return
    onChange([...actions, JSON.parse(JSON.stringify(action))])
  }

  const updateAction = (index: number, patch: Partial<AutoAction>) => {
    const next = actions.map((action, i) => (i === index ? { ...action, ...patch } : action))
    onChange(next)
  }

  const updateConfig = (index: number, configString: string) => {
    try {
      const parsed = JSON.parse(configString)
      updateAction(index, { config: parsed })
    } catch (error) {
      console.warn("Invalid JSON for auto action config", error)
    }
  }

  const removeAction = (index: number) => {
    onChange(actions.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        {actions.map((action, index) => (
          <div key={`${action.type}-${index}`} className="space-y-2 rounded-md border border-border/60 p-3">
            <div className="flex items-center justify-between">
              <Select
                value={action.type}
                onValueChange={(value) => updateAction(index, { type: value as AutoAction["type"] })}
              >
                <SelectTrigger className="w-44 text-xs">
                  <SelectValue placeholder="Type d'action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="send_email">Envoi email</SelectItem>
                  <SelectItem value="generate_invoice">Générer facture</SelectItem>
                  <SelectItem value="create_task">Créer tâche</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={() => removeAction(index)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Configuration (JSON)</Label>
              <Textarea
                className="h-24 text-xs"
                defaultValue={JSON.stringify(action.config, null, 2)}
                onBlur={(event) => updateConfig(index, event.target.value)}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-2 rounded-md border border-dashed border-border/60 p-3">
        <p className="text-xs font-medium text-muted-foreground">Actions rapides</p>
        <div className="flex flex-wrap gap-2">
          {Object.keys(AUTO_ACTIONS).map((key) => (
            <Button key={key} size="sm" variant="outline" onClick={() => addActionFromLibrary(key)}>
              {key}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default WorkflowAdminModal
