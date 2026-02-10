"use client"

/**
 * The "Plus" dropdown menu for the interventions page header.
 * Contains: new view creation, filter toggles, table style options,
 * display mode switcher, and global settings.
 *
 * All imports use `@/` paths or same-directory `./` paths.
 */

import {
  Check,
  Filter,
  Hash,
  MoreHorizontal,
  Palette,
  Plus,
  Settings,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ModeIcons } from "@/components/ui/mode-selector/ModeIcons"
import { MODE_OPTIONS } from "@/components/ui/mode-selector/ModeSelector"
import { cn } from "@/lib/utils"

import type { InterventionsPlusMenuProps } from "./types"

// Constants inlined to avoid `../` imports to _lib
const CREATABLE_VIEW_LAYOUTS = ["table"] as const
const VIEW_LAYOUT_LABELS: Record<string, string> = {
  table: "Tableau",
  cards: "Cartes",
  gallery: "Galerie",
  kanban: "Kanban",
  calendar: "Calendrier",
  timeline: "Chronologie",
}
const VIEW_LAYOUT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  table: () => null, // placeholder — overridden below
}

import {
  CalendarRange,
  GanttChart,
  KanbanSquare,
  LayoutGrid,
  SquareStack,
  Table,
} from "lucide-react"

const LAYOUT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  table: Table,
  cards: SquareStack,
  gallery: LayoutGrid,
  kanban: KanbanSquare,
  calendar: CalendarRange,
  timeline: GanttChart,
}

const NEW_VIEW_MENU_CHOICES = CREATABLE_VIEW_LAYOUTS.map((layout) => ({
  layout,
  label: VIEW_LAYOUT_LABELS[layout],
  Icon: LAYOUT_ICONS[layout],
}))

const ROW_DENSITY_OPTIONS: Array<{ value: "default" | "dense" | "ultra-dense"; label: string }> = [
  { value: "default", label: "Standard" },
  { value: "dense", label: "Dense" },
  { value: "ultra-dense", label: "Ultra-dense" },
]

export default function InterventionsPlusMenu({
  activeView,
  activeTableLayoutOptions,
  activeRowDensity,
  showStatusFilter,
  preferredMode,
  isAdmin,
  handleCreateView,
  handleLayoutOptionsPatch,
  updateViewConfig,
  updateLayoutOptions,
  setPreferredMode,
  setColumnConfigViewId,
  router,
}: InterventionsPlusMenuProps) {
  if (!isAdmin) return null

  const currentModeOption = MODE_OPTIONS.find((o) => o.mode === preferredMode) ?? MODE_OPTIONS[0]
  const CurrentModeIcon = ModeIcons[currentModeOption.mode]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0">
          <MoreHorizontal className="h-4 w-4 mr-2" /> Plus
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-[80vh] overflow-y-auto">
        <div className="px-2 py-1.5">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Actions globales
          </div>
        </div>

        {/* New view sub-menu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>Nouvelle vue</span>
            </div>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-64">
            {NEW_VIEW_MENU_CHOICES.map(({ layout, label, Icon }) => (
              <DropdownMenuItem
                key={layout}
                onSelect={(event) => {
                  event.preventDefault()
                  handleCreateView(layout)
                }}
              >
                <Icon className="mr-2 h-4 w-4" />
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Badge toggle */}
        {activeView && (
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault()
              updateViewConfig(activeView.id, { showBadge: !activeView.showBadge })
            }}
          >
            <Hash className="mr-2 h-4 w-4" />
            {activeView.showBadge ? "Masquer la pastille" : "Afficher la pastille"}
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        {/* Filters section */}
        <div className="px-2 py-1.5">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Filtres
          </div>
        </div>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span>Afficher les filtres</span>
            </div>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-64">
            <DropdownMenuCheckboxItem
              checked={showStatusFilter}
              disabled={activeView?.layout !== "table"}
              onCheckedChange={(checked) => {
                if (!activeView || activeView.layout !== "table") return
                updateLayoutOptions(activeView.id, { showStatusFilter: checked === true })
              }}
            >
              Statut
            </DropdownMenuCheckboxItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Table-specific options */}
        {activeView?.layout === "table" && (
          <>
            <DropdownMenuSeparator />

            <div className="px-2 py-1.5">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Vue Tableau
              </div>
            </div>

            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault()
                if (!activeView) return
                setColumnConfigViewId(activeView.id)
              }}
            >
              <Settings className="mr-2 h-4 w-4" />
              Configurer les colonnes...
            </DropdownMenuItem>

            {/* Style sub-menu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  <span>Style</span>
                </div>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-72">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Bordure &amp; Ombrage
                </DropdownMenuLabel>

                {/* Status border */}
                <DropdownMenuCheckboxItem
                  checked={activeTableLayoutOptions?.showStatusBorder ?? false}
                  onCheckedChange={(checked) =>
                    handleLayoutOptionsPatch({ showStatusBorder: checked === true })
                  }
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-primary rounded-sm" />
                    Bordure coloree par statut
                  </div>
                </DropdownMenuCheckboxItem>

                {(activeTableLayoutOptions?.showStatusBorder ?? false) && (
                  <div className="px-2 py-2 ml-6">
                    <div className="text-xs text-muted-foreground mb-1.5">Largeur</div>
                    <div className="flex gap-1">
                      {(["s", "m", "l"] as const).map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => handleLayoutOptionsPatch({ statusBorderSize: size })}
                          className={cn(
                            "flex-1 px-2 py-1.5 text-xs rounded border transition-colors",
                            (activeTableLayoutOptions?.statusBorderSize ?? "m") === size
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background hover:bg-muted border-border",
                          )}
                        >
                          {size.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <DropdownMenuSeparator className="my-1" />

                {/* Colored shadow */}
                <DropdownMenuCheckboxItem
                  checked={activeTableLayoutOptions?.coloredShadow ?? false}
                  onCheckedChange={(checked) =>
                    handleLayoutOptionsPatch({ coloredShadow: checked === true })
                  }
                >
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-gradient-to-br from-primary/50 to-transparent rounded-sm" />
                    Ombrage colore par statut
                  </div>
                </DropdownMenuCheckboxItem>

                {(activeTableLayoutOptions?.coloredShadow ?? false) && (
                  <div className="px-2 py-2 ml-6">
                    <div className="text-xs text-muted-foreground mb-1.5">Intensite</div>
                    <div className="flex gap-1">
                      {(["subtle", "normal", "strong"] as const).map((intensity) => (
                        <button
                          key={intensity}
                          type="button"
                          onClick={() => handleLayoutOptionsPatch({ shadowIntensity: intensity })}
                          className={cn(
                            "flex-1 px-2 py-1.5 text-xs rounded border transition-colors",
                            (activeTableLayoutOptions?.shadowIntensity ?? "normal") === intensity
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background hover:bg-muted border-border",
                          )}
                        >
                          {intensity === "subtle" ? "Subtil" : intensity === "normal" ? "Normal" : "Fort"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <DropdownMenuSeparator />

                {/* Row appearance */}
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Apparence des lignes
                </DropdownMenuLabel>

                {/* Stripes */}
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault()
                    handleLayoutOptionsPatch({ rowDisplayMode: "stripes" })
                  }}
                  className="flex items-start gap-2"
                >
                  <div className="flex items-center gap-2 flex-1">
                    {(activeTableLayoutOptions?.rowDisplayMode ?? "stripes") === "stripes" ? (
                      <div className="w-4 h-4 rounded-full border-2 border-primary flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-border" />
                    )}
                    <span>Stripes alternees</span>
                  </div>
                </DropdownMenuItem>

                {(activeTableLayoutOptions?.rowDisplayMode ?? "stripes") === "stripes" && (
                  <div className="px-2 py-1 ml-8">
                    <button
                      type="button"
                      onClick={() =>
                        handleLayoutOptionsPatch({
                          useAccentColor: !(activeTableLayoutOptions?.useAccentColor ?? false),
                        })
                      }
                      className="flex items-center gap-2 text-xs hover:text-foreground transition-colors"
                    >
                      <div
                        className={cn(
                          "w-3.5 h-3.5 rounded border flex items-center justify-center",
                          activeTableLayoutOptions?.useAccentColor
                            ? "bg-primary border-primary"
                            : "border-border",
                        )}
                      >
                        {activeTableLayoutOptions?.useAccentColor && (
                          <Check className="h-2.5 w-2.5 text-primary-foreground" />
                        )}
                      </div>
                      <span className="text-muted-foreground">Avec couleur d&apos;accentuation</span>
                    </button>
                  </div>
                )}

                {/* Gradient */}
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault()
                    handleLayoutOptionsPatch({ rowDisplayMode: "gradient" })
                  }}
                  className="flex items-start gap-2"
                >
                  <div className="flex items-center gap-2 flex-1">
                    {activeTableLayoutOptions?.rowDisplayMode === "gradient" ? (
                      <div className="w-4 h-4 rounded-full border-2 border-primary flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-border" />
                    )}
                    <span>Degrade par colonne</span>
                  </div>
                </DropdownMenuItem>

                {activeTableLayoutOptions?.rowDisplayMode === "gradient" && (
                  <div className="px-2 py-1 ml-8">
                    <button
                      type="button"
                      onClick={() =>
                        handleLayoutOptionsPatch({
                          useAccentColor: !(activeTableLayoutOptions?.useAccentColor ?? false),
                        })
                      }
                      className="flex items-center gap-2 text-xs hover:text-foreground transition-colors"
                    >
                      <div
                        className={cn(
                          "w-3.5 h-3.5 rounded border flex items-center justify-center",
                          activeTableLayoutOptions?.useAccentColor
                            ? "bg-primary border-primary"
                            : "border-border",
                        )}
                      >
                        {activeTableLayoutOptions?.useAccentColor && (
                          <Check className="h-2.5 w-2.5 text-primary-foreground" />
                        )}
                      </div>
                      <span className="text-muted-foreground">Avec couleur d&apos;accentuation</span>
                    </button>
                  </div>
                )}

                <DropdownMenuSeparator className="my-1" />

                {/* Row density */}
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Densite des lignes
                </DropdownMenuLabel>
                <div className="px-2 py-2">
                  <div className="flex flex-col gap-1">
                    {ROW_DENSITY_OPTIONS.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          handleLayoutOptionsPatch({
                            rowDensity: value,
                            dense: value === "dense" || value === "ultra-dense",
                          })
                        }
                        className={cn(
                          "w-full px-2 py-1.5 text-xs rounded border text-left transition-colors",
                          activeRowDensity === value
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted border-border",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        )}

        <DropdownMenuSeparator />

        {/* Global settings */}
        <div className="px-2 py-1.5">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Parametres globaux
          </div>
        </div>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <div className="flex items-center gap-2">
              <CurrentModeIcon className="h-4 w-4" />
              <span>Mode d&apos;affichage</span>
            </div>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-64">
            {MODE_OPTIONS.map((option) => {
              const OptionIcon = ModeIcons[option.mode]
              const isActiveMode = preferredMode === option.mode
              return (
                <DropdownMenuItem
                  key={option.mode}
                  onSelect={(event) => {
                    event.preventDefault()
                    setPreferredMode(option.mode)
                  }}
                  className={isActiveMode ? "bg-muted" : undefined}
                >
                  <div className="flex items-start gap-3">
                    <OptionIcon />
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium leading-none">{option.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
                    </div>
                  </div>
                </DropdownMenuItem>
              )
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault()
                router.push("/settings/interface")
              }}
            >
              <Settings className="mr-2 h-4 w-4" />
              Modifier la vue par defaut
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
