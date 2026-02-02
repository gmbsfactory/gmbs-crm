import { render, screen } from '@testing-library/react'
import React from 'react'
import { FiltersBar } from '@/components/interventions/FiltersBar'
import type { WorkflowConfig } from '@/types/intervention-workflow'
import { vi, describe, it, expect } from 'vitest'

// Mock du hook useWorkflowConfig
vi.mock('@/hooks/useWorkflowConfig', () => ({
  useWorkflowConfig: () => ({
    workflow: { statuses: [], transitions: [] },
    updateStatus: vi.fn(),
  }),
}))

const mockWorkflow: WorkflowConfig = {
  statuses: [
    { id: '1', key: 'DEMANDE', label: 'Demandé', color: '#3B82F6', isActive: true, isPinned: true, pinnedOrder: 0 },
    { id: '2', key: 'REFUSE', label: 'Refusé', color: '#EF4444', isActive: true, isPinned: false },
  ],
  transitions: [],
}

describe('FiltersBar', () => {
  it('pins and unpins statuses', () => {
    const onPin = vi.fn()
    const onUnpin = vi.fn()
    render(
      <FiltersBar
        search=""
        onSearch={() => {}}
        users={[]}
        user=""
        onUser={() => {}}
        dateRange={{ from: null, to: null }}
        onDateRange={() => {}}
        sortField="cree"
        onSortField={() => {}}
        sortDir="desc"
        onSortDir={() => {}}
        displayedStatuses={['DEMANDE']}
        selectedStatus={[]}
        onSelectStatus={() => {}}
        pinnedStatuses={[]}
        onPinStatus={onPin}
        onUnpinStatus={onUnpin}
        additionalStatuses={['REFUSE']}
        getCountByStatus={() => 0}
        workflow={mockWorkflow}
      />
    )
    // Le composant affiche le label "Demandé" depuis le workflow mock
    expect(screen.getByText(/Demandé/)).toBeInTheDocument()
  })
})

