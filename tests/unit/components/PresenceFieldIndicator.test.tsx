import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock framer-motion (same pattern as PresenceAvatars tests)
vi.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef<HTMLDivElement, React.HTMLProps<HTMLDivElement>>(
      ({ children, ...props }, ref) => (
        <div ref={ref} {...props}>
          {children}
        </div>
      )
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}))

// ─── Mock FieldPresenceContext ───────────────────────────────────────────────

const mockFieldLockMap = vi.hoisted(() => ({
  current: {} as Record<string, { userId: string; name: string; color: string | null; avatarUrl: string | null; joinedAt: string; activeField: string | null; fieldLockedAt: string | null }>,
}))

vi.mock('@/contexts/FieldPresenceContext', () => ({
  useFieldLock: vi.fn((fieldName: string) => {
    const locker = mockFieldLockMap.current[fieldName] ?? null
    return { isLocked: locker !== null, locker }
  }),
}))

import { PresenceFieldIndicator } from '@/components/ui/intervention-modal/PresenceFieldIndicator'
import { TooltipProvider } from '@/components/ui/tooltip'

function Wrapper({ children }: { children: React.ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('PresenceFieldIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFieldLockMap.current = {}
  })

  it('should render children as-is when field is NOT locked', () => {
    render(
      <Wrapper>
        <PresenceFieldIndicator fieldName="coutSST">
          <input data-testid="my-input" />
        </PresenceFieldIndicator>
      </Wrapper>
    )

    const input = screen.getByTestId('my-input')
    expect(input).toBeDefined()
    // No wrapper div with ring styles
    expect(input.parentElement?.classList.contains('relative')).toBe(false)
  })

  it('should wrap children with lock indicator when field IS locked', () => {
    mockFieldLockMap.current = {
      coutSST: {
        userId: 'user-other',
        name: 'Marie C',
        color: '#ef4444',
        avatarUrl: null,
        joinedAt: '2025-01-01T10:00:00Z',
        activeField: 'coutSST',
        fieldLockedAt: new Date().toISOString(),
      },
    }

    const { container } = render(
      <Wrapper>
        <PresenceFieldIndicator fieldName="coutSST">
          <input data-testid="my-input" />
        </PresenceFieldIndicator>
      </Wrapper>
    )

    // Should have a relative wrapper (inside the TooltipProvider)
    const wrapper = container.querySelector('.relative') as HTMLElement
    expect(wrapper).not.toBeNull()

    // Should have the lock ring div with pointer-events-none
    const ringDiv = wrapper.querySelector('.pointer-events-none')
    expect(ringDiv).not.toBeNull()
  })

  it('should render children normally for a different locked field', () => {
    mockFieldLockMap.current = {
      adresse: {
        userId: 'user-other',
        name: 'Marie C',
        color: '#ef4444',
        avatarUrl: null,
        joinedAt: '2025-01-01T10:00:00Z',
        activeField: 'adresse',
        fieldLockedAt: new Date().toISOString(),
      },
    }

    render(
      <Wrapper>
        <PresenceFieldIndicator fieldName="coutSST">
          <input data-testid="my-input" />
        </PresenceFieldIndicator>
      </Wrapper>
    )

    const input = screen.getByTestId('my-input')
    // Not locked — should render normally (no relative wrapper)
    expect(input.parentElement?.classList.contains('relative')).toBe(false)
  })

  it('should apply the locker color as ring color', () => {
    mockFieldLockMap.current = {
      coutSST: {
        userId: 'user-other',
        name: 'Marie C',
        color: '#ef4444',
        avatarUrl: null,
        joinedAt: '2025-01-01T10:00:00Z',
        activeField: 'coutSST',
        fieldLockedAt: new Date().toISOString(),
      },
    }

    const { container } = render(
      <Wrapper>
        <PresenceFieldIndicator fieldName="coutSST">
          <input data-testid="my-input" />
        </PresenceFieldIndicator>
      </Wrapper>
    )

    const ringDiv = container.querySelector('.pointer-events-none') as HTMLElement
    expect(ringDiv).not.toBeNull()
    expect(ringDiv.style.getPropertyValue('--tw-ring-color')).toBe('#ef4444')
  })

  it('should fallback to gray when locker has no color', () => {
    mockFieldLockMap.current = {
      coutSST: {
        userId: 'user-other',
        name: 'Marie C',
        color: null,
        avatarUrl: null,
        joinedAt: '2025-01-01T10:00:00Z',
        activeField: 'coutSST',
        fieldLockedAt: new Date().toISOString(),
      },
    }

    const { container } = render(
      <Wrapper>
        <PresenceFieldIndicator fieldName="coutSST">
          <input data-testid="my-input" />
        </PresenceFieldIndicator>
      </Wrapper>
    )

    const ringDiv = container.querySelector('.pointer-events-none') as HTMLElement
    expect(ringDiv.style.getPropertyValue('--tw-ring-color')).toBe('#6b7280')
  })
})
