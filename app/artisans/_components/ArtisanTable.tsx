"use client"

import React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Pagination } from "@/components/ui/pagination"
import type { Contact } from "@/types/artisan-page"
import { ArtisanTableRow } from "./ArtisanTableRow"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ArtisanTableProps {
  contacts: Contact[]
  searchTerm: string
  metierColorMap: Record<string, { color: string | null; label: string }>
  canDeleteArtisans: boolean
  onViewDetails: (contact: Contact) => void
  onDelete: (contact: Contact) => void
  // pagination
  totalCount: number | undefined
  totalPages: number
  currentPage: number
  onPageChange: (page: number) => void
  onNext: () => void
  onPrevious: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ArtisanTable({
  contacts,
  searchTerm,
  metierColorMap,
  canDeleteArtisans,
  onViewDetails,
  onDelete,
  totalCount,
  totalPages,
  currentPage,
  onPageChange,
  onNext,
  onPrevious,
}: ArtisanTableProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <Card className="border-2 shadow-sm flex flex-col flex-1 min-h-0 rounded-tl-none border-t-primary/40">
        <CardContent className="p-0 flex flex-col flex-1 min-h-0">
          <div className="overflow-auto flex-1 min-h-0">
            <table className="min-w-full divide-y-2 divide-border text-xs">
              <thead className="sticky top-0 z-10 bg-primary/15 border-b-2 border-primary/40">
                <tr>
                  <th className="px-2.5 py-1.5 text-left text-xs font-semibold uppercase tracking-wider text-primary w-[140px]">
                    Artisan
                  </th>
                  <th className="px-2.5 py-1.5 text-left text-xs font-semibold uppercase tracking-wider text-primary">
                    Entreprise
                  </th>
                  <th className="px-2.5 py-1.5 text-left text-xs font-semibold uppercase tracking-wider text-primary">
                    Métier
                  </th>
                  <th className="px-2.5 py-1.5 text-left text-xs font-semibold uppercase tracking-wider text-primary">
                    Contact
                  </th>
                  <th className="px-2.5 py-1.5 text-center text-xs font-semibold uppercase tracking-wider text-primary">
                    Gest.
                  </th>
                  <th className="px-2.5 py-1.5 text-left text-xs font-semibold uppercase tracking-wider text-primary">
                    Adresse siège
                  </th>
                  <th className="px-2.5 py-1.5 text-center text-xs font-semibold uppercase tracking-wider text-primary w-[100px]">
                    Dossier
                  </th>
                  <th className="px-2.5 py-1.5 text-center text-xs font-semibold uppercase tracking-wider text-primary w-[100px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-background">
                {contacts.map((contact, index) => (
                  <ArtisanTableRow
                    key={contact.id}
                    contact={contact}
                    index={index}
                    searchTerm={searchTerm}
                    metierColorMap={metierColorMap}
                    canDeleteArtisans={canDeleteArtisans}
                    onViewDetails={onViewDetails}
                    onDelete={onDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalCount != null && totalCount > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={100}
          onPageChange={onPageChange}
          onNext={onNext}
          onPrevious={onPrevious}
          canGoNext={currentPage < totalPages}
          canGoPrevious={currentPage > 1}
          className="border-t bg-background mt-2"
        />
      )}
    </div>
  )
}
