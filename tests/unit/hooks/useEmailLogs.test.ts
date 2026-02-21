import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

// Mock Supabase client
const mockSelect = vi.fn()
const mockEq = vi.fn()
const mockOrder = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase-client', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

import { useEmailLogs } from '@/hooks/useEmailLogs'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

const mockLogs = [
  {
    id: 'log-1',
    intervention_id: 'inter-1',
    artisan_id: 'art-1',
    sent_by: 'user-1',
    recipient_email: 'artisan@example.com',
    subject: 'Demande de devis - Intervention #123',
    email_type: 'devis',
    status: 'sent',
    error_message: null,
    smtp_message_id: '<abc@gmail.com>',
    attachments_count: 2,
    sent_at: '2026-02-21T10:00:00Z',
    sender: { firstname: 'Jean', lastname: 'Dupont' },
  },
  {
    id: 'log-2',
    intervention_id: 'inter-1',
    artisan_id: 'art-2',
    sent_by: 'user-2',
    recipient_email: 'artisan2@example.com',
    subject: "Demande d'intervention - Intervention #456",
    email_type: 'intervention',
    status: 'failed',
    error_message: 'SMTP connection timeout',
    smtp_message_id: null,
    attachments_count: 1,
    sent_at: '2026-02-20T15:30:00Z',
    sender: { firstname: 'Alice', lastname: 'Martin' },
  },
]

describe('useEmailLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Setup fluent chain: from().select().eq().order()
    mockOrder.mockResolvedValue({ data: mockLogs, error: null })
    mockEq.mockReturnValue({ order: mockOrder })
    mockSelect.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ select: mockSelect })
  })

  it('should fetch email logs for a given intervention id', async () => {
    const { result } = renderHook(() => useEmailLogs('inter-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockFrom).toHaveBeenCalledWith('email_logs')
    expect(mockEq).toHaveBeenCalledWith('intervention_id', 'inter-1')
    expect(mockOrder).toHaveBeenCalledWith('sent_at', { ascending: false })
  })

  it('should map raw data to EmailLog shape with sender names', async () => {
    const { result } = renderHook(() => useEmailLogs('inter-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const logs = result.current.data!
    expect(logs).toHaveLength(2)

    // First log
    expect(logs[0].sender_firstname).toBe('Jean')
    expect(logs[0].sender_lastname).toBe('Dupont')
    expect(logs[0].smtp_message_id).toBe('<abc@gmail.com>')
    expect(logs[0].status).toBe('sent')

    // Second log
    expect(logs[1].sender_firstname).toBe('Alice')
    expect(logs[1].sender_lastname).toBe('Martin')
    expect(logs[1].status).toBe('failed')
    expect(logs[1].error_message).toBe('SMTP connection timeout')
  })

  it('should return logs sorted by sent_at descending (as returned by Supabase)', async () => {
    const { result } = renderHook(() => useEmailLogs('inter-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const logs = result.current.data!
    // First log should be the most recent
    expect(new Date(logs[0].sent_at).getTime()).toBeGreaterThan(
      new Date(logs[1].sent_at).getTime()
    )
  })

  it('should not fetch when enabled is false', () => {
    renderHook(() => useEmailLogs('inter-1', { enabled: false }), {
      wrapper: createWrapper(),
    })

    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('should not fetch when interventionId is empty', () => {
    renderHook(() => useEmailLogs(''), {
      wrapper: createWrapper(),
    })

    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('should handle Supabase errors', async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: 'Permission denied' } })

    const { result } = renderHook(() => useEmailLogs('inter-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeTruthy()
  })

  it('should handle null sender gracefully', async () => {
    mockOrder.mockResolvedValue({
      data: [
        {
          ...mockLogs[0],
          sender: null,
        },
      ],
      error: null,
    })

    const { result } = renderHook(() => useEmailLogs('inter-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const logs = result.current.data!
    expect(logs[0].sender_firstname).toBeNull()
    expect(logs[0].sender_lastname).toBeNull()
  })
})
