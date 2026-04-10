"use client"

/**
 * Renders the correct view component based on `activeView.layout`.
 * Supports: table, kanban, gallery, calendar, timeline, and fallback cards.
 *
 * All imports use `@/` paths or same-directory `./` paths.
 */

import Interventions from "@/components/interventions/Interventions"
import CalendarView from "@/components/interventions/views/CalendarView"
import GalleryView from "@/components/interventions/views/GalleryView"
import KanbanView from "@/components/interventions/views/KanbanView"
import TableView from "@/components/interventions/views/TableView"
import TimelineView from "@/components/interventions/views/TimelineView"
import Loader from "@/components/ui/Loader"

import type { InterventionsViewRendererProps } from "./types"

// Derive the config types from each view component's props
type GalleryViewConfig = Parameters<typeof GalleryView>[0]["view"]
type CalendarViewConfig = Parameters<typeof CalendarView>[0]["view"]
type TimelineViewConfig = Parameters<typeof TimelineView>[0]["view"]
type TableViewConfig = Parameters<typeof TableView>[0]["view"]
type KanbanViewConfig = Parameters<typeof KanbanView>[0]["view"]

const VISIBLE_VIEW_LAYOUTS = ["table", "cards", "calendar"] as const

export default function InterventionsViewRenderer({
  activeView,
  viewInterventions,
  filteredInterventions,
  loading,
  error,
  search,
  page,
  effectiveTotalCount,
  effectiveTotalPages,
  activeViewColor,
  selectedStatuses,
  displayedStatuses,
  normalizedInterventions,
  loadDistinctValues,
  handleNavigateToDetail,
  handleLayoutOptionsPatch,
  updateFilterForProperty,
  handleGoToPage,
  handleNextPage,
  handlePreviousPage,
  handleStatusChange,
  handleSelectStatus,
  getCountByStatus,
  updateSorts,
}: InterventionsViewRendererProps) {
  // Loading state (no existing data)
  if (loading && normalizedInterventions.length === 0) {
    return (
      <div className="flex min-h-[calc(100vh-200px)] items-center justify-center">
        <div style={{ transform: "scale(1.25)" }}>
          <Loader />
        </div>
      </div>
    )
  }

  if (!activeView) return null
  if (!(VISIBLE_VIEW_LAYOUTS as readonly string[]).includes(activeView.layout)) return null

  switch (activeView.layout) {
    case "table":
      return (
        <TableView
          view={activeView as TableViewConfig}
          interventions={viewInterventions}
          allInterventions={filteredInterventions}
          loading={loading}
          error={error}
          loadDistinctValues={loadDistinctValues}
          onInterventionClick={handleNavigateToDetail}
          onLayoutOptionsChange={(options) => handleLayoutOptionsPatch(options)}
          onPropertyFilterChange={updateFilterForProperty}
          totalCount={effectiveTotalCount ?? undefined}
          currentPage={page}
          totalPages={effectiveTotalPages}
          onPageChange={handleGoToPage}
          onNextPage={handleNextPage}
          onPreviousPage={handlePreviousPage}
          searchQuery={search}
          headerColor={activeViewColor}
          onSortChange={(sorts) => {
            if (activeView) updateSorts(activeView.id, sorts)
          }}
        />
      )
    case "kanban":
      return (
        <KanbanView
          view={activeView as KanbanViewConfig}
          interventions={viewInterventions}
          loading={loading}
          error={error}
          onStatusChange={handleStatusChange}
        />
      )
    case "gallery":
      return (
        <GalleryView
          view={activeView as GalleryViewConfig}
          interventions={viewInterventions}
          loading={loading}
          error={error}
          onInterventionClick={handleNavigateToDetail}
          onLayoutOptionsChange={(options) => handleLayoutOptionsPatch(options)}
        />
      )
    case "calendar":
      return (
        <CalendarView
          view={activeView as CalendarViewConfig}
          interventions={viewInterventions}
          loading={loading}
          error={error}
          onInterventionClick={handleNavigateToDetail}
          onLayoutOptionsChange={(options) => handleLayoutOptionsPatch(options)}
        />
      )
    case "timeline":
      return (
        <TimelineView
          view={activeView as TimelineViewConfig}
          interventions={viewInterventions}
          loading={loading}
          error={error}
          onInterventionClick={handleNavigateToDetail}
          onLayoutOptionsChange={(options) => handleLayoutOptionsPatch(options)}
        />
      )
    default:
      return (
        <Interventions
          interventions={viewInterventions}
          loading={loading}
          error={error}
          selectedStatus={selectedStatuses.length > 0 ? selectedStatuses[0] : null}
          displayedStatuses={displayedStatuses}
          onSelectStatus={handleSelectStatus}
          getCountByStatus={getCountByStatus}
          onStatusChange={handleStatusChange}
        />
      )
  }
}
