import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PresenceUser } from '@/types/presence'

// Mock framer-motion to avoid animation complexity in jsdom
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

import { PresenceAvatars } from '@/components/ui/intervention-modal/PresenceAvatars'

function makeViewer(
  id: string,
  name: string,
  color: string | null = '#3b82f6'
): PresenceUser {
  return {
    userId: id,
    name,
    color,
    avatarUrl: null,
    joinedAt: new Date().toISOString(),
  }
}

describe('PresenceAvatars', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render nothing when viewers is empty', () => {
    const { container } = render(<PresenceAvatars viewers={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('should render one avatar for one viewer', () => {
    render(<PresenceAvatars viewers={[makeViewer('u1', 'Marie Curie')]} />)

    // GestionnaireBadge renders with title={displayName}
    expect(screen.getByTitle('Marie Curie')).toBeDefined()
  })

  it('should render multiple avatars up to MAX_VISIBLE (3)', () => {
    const viewers = [
      makeViewer('u1', 'Alice A'),
      makeViewer('u2', 'Bob B'),
      makeViewer('u3', 'Carol C'),
    ]
    const { container } = render(<PresenceAvatars viewers={viewers} />)

    expect(screen.getByTitle('Alice A')).toBeDefined()
    expect(screen.getByTitle('Bob B')).toBeDefined()
    expect(screen.getByTitle('Carol C')).toBeDefined()
    // No overflow badge
    expect(container.textContent).not.toMatch(/\+\d/)
  })

  it('should show overflow badge when more than 3 viewers', () => {
    const viewers = [
      makeViewer('u1', 'Alice A'),
      makeViewer('u2', 'Bob B'),
      makeViewer('u3', 'Carol C'),
      makeViewer('u4', 'Dave D'),
    ]
    render(<PresenceAvatars viewers={viewers} />)

    // First 3 visible
    expect(screen.getByTitle('Alice A')).toBeDefined()
    expect(screen.getByTitle('Bob B')).toBeDefined()
    expect(screen.getByTitle('Carol C')).toBeDefined()

    // +1 overflow badge
    expect(screen.getByText('+1')).toBeDefined()

    // Dave not rendered as avatar
    expect(screen.queryByTitle('Dave D')).toBeNull()
  })

  it('should show correct count for multiple overflow viewers', () => {
    const viewers = Array.from({ length: 7 }, (_, i) =>
      makeViewer(`u${i}`, `User ${i}`)
    )
    render(<PresenceAvatars viewers={viewers} />)

    expect(screen.getByText('+4')).toBeDefined()
  })

  it('should have accessible aria-label for singular', () => {
    const viewers = [makeViewer('u1', 'Alice')]
    const { container } = render(<PresenceAvatars viewers={viewers} />)
    const wrapper = container.firstElementChild as HTMLElement

    expect(wrapper.getAttribute('aria-label')).toBe(
      '1 autre en train de consulter'
    )
  })

  it('should have accessible aria-label for plural', () => {
    const viewers = [
      makeViewer('u1', 'Alice'),
      makeViewer('u2', 'Bob'),
    ]
    const { container } = render(<PresenceAvatars viewers={viewers} />)
    const wrapper = container.firstElementChild as HTMLElement

    expect(wrapper.getAttribute('aria-label')).toBe(
      '2 autres en train de consulter'
    )
  })

  it('should pass className to the wrapper', () => {
    const viewers = [makeViewer('u1', 'Alice')]
    const { container } = render(
      <PresenceAvatars viewers={viewers} className="ml-2" />
    )
    const wrapper = container.firstElementChild as HTMLElement

    expect(wrapper.className).toContain('ml-2')
  })
})
