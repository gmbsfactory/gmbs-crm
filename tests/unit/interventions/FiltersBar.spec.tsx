import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { FiltersBar } from '@/components/interventions/FiltersBar'

describe('FiltersBar', () => {
  it('pins and unpins statuses', () => {
    const onPin = vi.fn(); const onUnpin = vi.fn();
    render(<FiltersBar search="" onSearch={()=>{}} users={[]} user="" onUser={()=>{}} dateRange={{from:null,to:null}} onDateRange={()=>{}} sortField="cree" onSortField={()=>{}} sortDir="desc" onSortDir={()=>{}} displayedStatuses={["Demandé"]} selectedStatus="" onSelectStatus={()=>{}} pinnedStatuses={[]} onPinStatus={onPin} onUnpinStatus={onUnpin} additionalStatuses={["Refusé"]} getCountByStatus={()=>0} />)
    expect(screen.getByText('Demandé (0)')).toBeInTheDocument()
  })
})

