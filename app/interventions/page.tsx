"use client"

import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import Loader from "@/components/ui/Loader"
import { ViewTabs } from "@/components/interventions/views/ViewTabs"
import ColumnConfigurationModal from "@/components/interventions/views/ColumnConfigurationModal"
import { PageSearchBar } from "@/components/ui/page-search-bar"
import { InterventionRealtimeProvider } from "@/components/interventions/InterventionRealtimeProvider"
import { FilterMappersProvider } from "@/contexts/FilterMappersContext"
import { GenieEffectProvider } from "@/contexts/GenieEffectContext"
import { usePermissions } from "@/hooks/usePermissions"
import { usePageKeyboardShortcuts } from "@/hooks/usePageKeyboardShortcuts"
import { VISIBLE_VIEW_LAYOUTS } from "./_lib/constants"

import { useInterventionPageState } from "./_lib/useInterventionPageState"
import InterventionsPlusMenu from "./_components/InterventionsPlusMenu"
import InterventionsStatusFilter from "./_components/InterventionsStatusFilter"
import InterventionsViewRenderer from "./_components/InterventionsViewRenderer"

// ---------------------------------------------------------------------------
// Page entry point: permissions check + providers
// ---------------------------------------------------------------------------
export default function Page() {
  const { can, isLoading } = usePermissions()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader />
      </div>
    )
  }

  if (!can("read_interventions")) {
    return <AccessDenied permission="read_interventions" />
  }

  return (
    <InterventionRealtimeProvider>
      <GenieEffectProvider>
        <PageContent />
      </GenieEffectProvider>
    </InterventionRealtimeProvider>
  )
}

// ---------------------------------------------------------------------------
// Main content orchestrator
// ---------------------------------------------------------------------------
function PageContent() {
  const state = useInterventionPageState()

  const {
    router,
    isAdmin,
    views,
    activeView,
    activeViewId,
    setActiveView,
    reorderViews,
    updateViewConfig,
    updateLayoutOptions,
    resetViewToDefault,
    isReady,
    viewStatusColors,
    activeViewColor,
    combinedViewCounts,
    search,
    setSearch,
    selectedStatuses,
    isReorderMode,
    setIsReorderMode,
    columnConfigViewId,
    setColumnConfigViewId,
    showStatusFilter,
    activeTableLayoutOptions,
    activeRowDensity,
    preferredMode,
    setPreferredMode,
    workflowConfig,
    displayedStatuses,
    isCheckFilterActive,
    normalizedInterventions,
    filteredInterventions,
    viewInterventions,
    loading,
    error,
    page,
    effectiveTotalCount,
    effectiveTotalPages,
    handleGoToPage,
    handleNextPage,
    handlePreviousPage,
    handleSelectStatus,
    handleStatusChange,
    handleNavigateToDetail,
    handleCreateView,
    handleRenameView,
    handleDuplicateView,
    handleDeleteView,
    handleLayoutOptionsPatch,
    updateFilterForProperty,
    updateSorts,
    getCountByStatus,
    getCheckCount,
    loadDistinctValues,
  } = state

  // ←/→ entre pastilles de vue (le hook gère aussi Shift+←/→ pour la pagination,
  // mais la pagination effective est dans useTableKeyboardNavigation via le composant TableView)
  const visibleViewIds = useMemo(
    () => views.filter((v) => VISIBLE_VIEW_LAYOUTS.includes(v.layout)).map((v) => v.id),
    [views],
  )

  usePageKeyboardShortcuts({
    viewIds: visibleViewIds,
    activeViewId,
    onViewChange: setActiveView,
  })

  return (
    <FilterMappersProvider>
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 space-y-0 px-6 pt-4 pb-2 overflow-hidden flex flex-col min-h-0">
          {/* View tabs + action bar */}
          <div className="space-y-1.5 flex-shrink-0">
            {isReorderMode && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsReorderMode(false)}
                  className="animate-pulse bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                >
                  ESC
                </Button>
                <span>Reorganisez vos vues, puis appuyez sur ESC</span>
              </div>
            )}
            <div className="flex flex-wrap items-end gap-4 overflow-visible pt-3">
              <div className="flex-1 min-w-0 overflow-visible">
                <ViewTabs
                  views={views}
                  activeViewId={activeViewId ?? ""}
                  onSelect={setActiveView}
                  onReorder={reorderViews}
                  onRenameView={handleRenameView}
                  onDuplicateView={handleDuplicateView}
                  onDeleteView={handleDeleteView}
                  onResetDefault={resetViewToDefault}
                  onConfigureColumns={setColumnConfigViewId}
                  onToggleBadge={(id) =>
                    updateViewConfig(id, {
                      showBadge: !views.find((v) => v.id === id)?.showBadge,
                    })
                  }
                  isReorderMode={isReorderMode}
                  onEnterReorderMode={() => setIsReorderMode(true)}
                  interventionCounts={combinedViewCounts}
                  viewStatusColors={viewStatusColors}
                  isAdmin={isAdmin}
                />
              </div>
              {!isReorderMode && (
                <div className="flex items-center gap-3">
                  <PageSearchBar
                    value={search}
                    onChange={setSearch}
                    placeholder="Rechercher interventions..."
                    enableShortcut
                    shortcutId="interventions"
                  />
                  <InterventionsPlusMenu
                    activeView={activeView}
                    activeTableLayoutOptions={activeTableLayoutOptions}
                    activeRowDensity={activeRowDensity}
                    showStatusFilter={showStatusFilter}
                    preferredMode={preferredMode}
                    isAdmin={isAdmin}
                    handleCreateView={handleCreateView}
                    handleLayoutOptionsPatch={handleLayoutOptionsPatch}
                    updateViewConfig={updateViewConfig}
                    updateLayoutOptions={updateLayoutOptions}
                    setPreferredMode={setPreferredMode}
                    setColumnConfigViewId={setColumnConfigViewId}
                    router={router}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Status filter bar (conditional) */}
          <InterventionsStatusFilter
            showStatusFilter={showStatusFilter}
            selectedStatuses={selectedStatuses}
            displayedStatuses={displayedStatuses}
            isCheckFilterActive={isCheckFilterActive}
            workflowConfig={workflowConfig}
            getCountByStatus={getCountByStatus}
            getCheckCount={getCheckCount}
            handleSelectStatus={handleSelectStatus}
            updateFilterForProperty={updateFilterForProperty}
          />

          {/* Main content area */}
          <div className="flex flex-col flex-1 min-h-0">
            <InterventionsViewRenderer
              activeView={activeView}
              viewInterventions={viewInterventions}
              filteredInterventions={filteredInterventions}
              loading={loading}
              error={error}
              search={search}
              page={page}
              effectiveTotalCount={effectiveTotalCount}
              effectiveTotalPages={effectiveTotalPages}
              activeViewColor={activeViewColor}
              selectedStatuses={selectedStatuses}
              displayedStatuses={displayedStatuses}
              normalizedInterventions={normalizedInterventions}
              loadDistinctValues={loadDistinctValues}
              handleNavigateToDetail={handleNavigateToDetail}
              handleLayoutOptionsPatch={handleLayoutOptionsPatch}
              updateFilterForProperty={updateFilterForProperty}
              handleGoToPage={handleGoToPage}
              handleNextPage={handleNextPage}
              handlePreviousPage={handlePreviousPage}
              handleStatusChange={handleStatusChange}
              handleSelectStatus={handleSelectStatus}
              getCountByStatus={getCountByStatus}
              updateSorts={updateSorts}
            />
          </div>
        </div>

        <ColumnConfigurationModal
          view={views.find((view) => view.id === columnConfigViewId) ?? null}
          onUpdateColumns={(viewId, visibleProperties) => {
            updateViewConfig(viewId, { visibleProperties })
            if (viewId === activeViewId) {
              setColumnConfigViewId(null)
            }
          }}
          onUpdateLayoutOptions={(viewId, patch) => {
            updateLayoutOptions(viewId, patch)
          }}
          onClose={() => setColumnConfigViewId(null)}
        />
      </div>
    </FilterMappersProvider>
  )
}

// ---------------------------------------------------------------------------
// Access denied fallback
// ---------------------------------------------------------------------------
function AccessDenied({ permission }: { permission: string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-2">
        <h1 className="text-xl font-semibold text-foreground">Acces refuse</h1>
        <p className="text-sm text-muted-foreground">
          Vous n&apos;avez pas les permissions necessaires pour acceder a cette page.
        </p>
        <p className="text-xs text-muted-foreground">Permission requise : {permission}</p>
      </div>
    </div>
  )
}
