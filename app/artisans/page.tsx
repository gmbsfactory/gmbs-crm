"use client"

import React from "react"
import type { ReactElement } from "react"
import { ArtisanViewTabs } from "@/components/artisans/ArtisanViewTabs"
import { PageSearchBar } from "@/components/ui/page-search-bar"
import Loader from "@/components/ui/Loader"
import { PagePresenceProvider, usePagePresenceContext } from "@/contexts/PagePresenceContext"
import { PagePresenceAvatars } from "@/components/ui/PagePresenceAvatars"
import { useArtisanPageState } from "./_lib/useArtisanPageState"
import { ArtisanTable } from "./_components/ArtisanTable"
import { ArtisanFilterDropdown } from "./_components/ArtisanFilterDropdown"
import { ArtisanDeleteDialog } from "./_components/ArtisanDeleteDialog"

// ---------------------------------------------------------------------------
// Page presence helper (must be rendered inside PagePresenceProvider)
// ---------------------------------------------------------------------------
function PagePresenceSection() {
  const ctx = usePagePresenceContext()
  if (!ctx) return null
  return <PagePresenceAvatars viewers={ctx.viewers} />
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function ArtisansPage(): ReactElement {
  const state = useArtisanPageState()

  // --- Permission loading ---
  if (state.permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader />
      </div>
    )
  }

  // --- Access denied ---
  if (!state.canReadArtisans) {
    return <AccessDenied permission="read_artisans" />
  }

  // --- Error state ---
  if (state.error) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="flex-1 p-6">
          <div className="text-center">
            <h2 className="mb-4 text-2xl font-bold text-red-600">Erreur de chargement</h2>
            <p className="mb-4 text-gray-600">{state.error}</p>
            <button
              onClick={() => window.location.reload()}
              className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
            >
              Réessayer
            </button>
          </div>
        </div>
      </div>
    )
  }

  // --- Loading state ---
  if (state.loading) {
    return (
      <div className="flex min-h-[calc(100vh-200px)] items-center justify-center">
        <div style={{ transform: "scale(1.25)" }}>
          <Loader />
        </div>
      </div>
    )
  }

  // --- Prepare filter-dropdown items ---
  const statusItems = state.filteredStatuses.map((s) => ({
    key: s.label,
    label: s.label,
  }))

  const statusActiveItems = state.activeStatuses.map((s) => ({
    key: s.label,
    label: s.label,
  }))

  const metierItems = state.filteredMetiers.map((m) => ({
    key: m,
    label: m,
  }))

  const metierActiveItems = state.activeMetiers.map((m) => ({
    key: m,
    label: m,
  }))

  // --- Main render ---
  return (
    <PagePresenceProvider pageName="artisans">
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div className="flex-1 space-y-0 px-6 pt-4 pb-2 overflow-hidden flex flex-col min-h-0">
        {/* View tabs + filters */}
        {state.isReady && (
          <div className="flex items-center justify-between gap-4 flex-shrink-0">
            <div className="flex items-end gap-3">
              <ArtisanViewTabs
                views={state.views}
                activeViewId={state.activeViewId}
                onSelect={state.setActiveView}
                artisanCounts={{
                  ...state.viewCounts,
                  ...(state.activeViewId && state.totalCount !== undefined
                    ? { [state.activeViewId]: state.totalCount }
                    : {}),
                }}
              />
              <PagePresenceSection />
            </div>

            <div className="flex items-center gap-3">
              {/* Status filter */}
              <ArtisanFilterDropdown
                label="Statut"
                title="Filtrer par statut"
                open={state.statusFilterOpen}
                onOpenChange={state.setStatusFilterOpen}
                searchQuery={state.statusSearchQuery}
                onSearchQueryChange={state.setStatusSearchQuery}
                items={statusItems}
                selectedKeys={state.selectedStatuses}
                activeItems={statusActiveItems}
                hasFilter={state.hasStatusFilter}
                onToggle={state.handleToggleStatus}
                onClear={state.handleClearStatus}
                getCount={state.getContactCountByStatus}
              />

              {/* Metier filter */}
              <ArtisanFilterDropdown
                label="Métier"
                title="Filtrer par métier"
                open={state.metierFilterOpen}
                onOpenChange={state.setMetierFilterOpen}
                searchQuery={state.metierSearchQuery}
                onSearchQueryChange={state.setMetierSearchQuery}
                items={metierItems}
                selectedKeys={state.selectedMetiers}
                activeItems={metierActiveItems}
                hasFilter={state.hasMetierFilter}
                onToggle={state.handleToggleMetier}
                onClear={state.handleClearMetier}
                getCount={state.getContactCountByMetier}
              />

              {/* Search bar */}
              <PageSearchBar
                value={state.searchTerm}
                onChange={state.setSearchTerm}
                placeholder="Rechercher artisans..."
                enableShortcut
                shortcutId="artisans"
              />
            </div>
          </div>
        )}

        {/* Table */}
        <ArtisanTable
          contacts={state.viewFilteredContacts}
          searchTerm={state.searchTerm}
          metierColorMap={state.metierColorMap}
          canDeleteArtisans={state.canDeleteArtisans}
          onViewDetails={state.handleViewDetails}
          onDelete={state.handleDeleteContact}
          totalCount={state.totalCount}
          totalPages={state.totalPages}
          currentPage={state.currentPage}
          onPageChange={state.goToPage}
          onNext={state.nextPage}
          onPrevious={state.previousPage}
        />
      </div>

      {/* Delete confirmation dialog */}
      <ArtisanDeleteDialog
        open={state.showDeleteDialog}
        onOpenChange={state.setShowDeleteDialog}
        contact={state.contactToDelete}
        onConfirm={state.handleConfirmDelete}
        onCancel={state.handleCancelDelete}
      />
    </div>
    </PagePresenceProvider>
  )
}

// ---------------------------------------------------------------------------
// Access denied
// ---------------------------------------------------------------------------

function AccessDenied({ permission }: { permission: string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-2">
        <h1 className="text-xl font-semibold text-foreground">Accès refusé</h1>
        <p className="text-sm text-muted-foreground">
          Vous n&apos;avez pas les permissions nécessaires pour accéder à cette page.
        </p>
        <p className="text-xs text-muted-foreground">Permission requise : {permission}</p>
      </div>
    </div>
  )
}
