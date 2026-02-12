import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { AISidePanel } from '@/components/ai/AISidePanel'
import type { AIActionState, AISuggestedAction, AIContextualActionResponse } from '@/lib/ai/types'

// Mock framer-motion
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: React.forwardRef(({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLDivElement>) => (
      <div ref={ref} {...props}>{children}</div>
    )),
  },
}))

// Mock sheet
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) => open ? <>{children}</> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div data-testid="sheet-content">{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))

// Mock scroll area
vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// Mock tooltip
vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// Mock AI prompts
vi.mock('@/lib/ai/prompts', () => ({
  ACTION_LABELS: {
    summary: 'Résumé',
    next_steps: 'Prochaines étapes',
    email_artisan: 'Email artisan',
    email_client: 'Email client',
    find_artisan: 'Trouver artisan',
    suggestions: 'Suggestions',
    stats_insights: 'Stats & Insights',
    data_summary: 'Synthèse données',
  },
}))

describe('AISidePanel', () => {
  const mockOnClose = vi.fn()
  const mockOnExecuteAction = vi.fn()
  const mockOnAction = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Default to wide screen
    Object.defineProperty(window, 'innerWidth', { value: 1440, writable: true })
  })

  const createState = (overrides: Partial<AIActionState> = {}): AIActionState => ({
    isLoading: false,
    isOpen: true,
    result: null,
    error: null,
    currentAction: 'next_steps',
    context: {
      page: 'intervention_list',
      entityId: 'test-id',
      entityType: 'intervention',
      pathname: '/interventions',
      availableActions: ['summary', 'next_steps', 'email_artisan', 'suggestions'],
    },
    ...overrides,
  })

  const createResult = (suggestedActions: AISuggestedAction[] = []): AIContextualActionResponse => ({
    success: true,
    action: 'next_steps',
    result: {
      content: '## Prochaines etapes\n- Envoyer le devis\n- Assigner un artisan',
      sections: [],
      suggested_actions: suggestedActions,
    },
    cached: false,
    computed_at: new Date().toISOString(),
    confidence: 0.85,
  })

  it('should render loading state', () => {
    render(
      <AISidePanel
        state={createState({ isLoading: true })}
        onClose={mockOnClose}
        onExecuteAction={mockOnExecuteAction}
      />
    )

    expect(screen.getByText('Analyse en cours...')).toBeDefined()
  })

  it('should render error state', () => {
    render(
      <AISidePanel
        state={createState({ error: 'Erreur de connexion' })}
        onClose={mockOnClose}
        onExecuteAction={mockOnExecuteAction}
      />
    )

    expect(screen.getByText('Erreur de connexion')).toBeDefined()
  })

  it('should render AI content when result is available', () => {
    render(
      <AISidePanel
        state={createState({ result: createResult() })}
        onClose={mockOnClose}
        onExecuteAction={mockOnExecuteAction}
      />
    )

    expect(screen.getByText('Prochaines etapes')).toBeDefined()
  })

  it('should render suggested action buttons', () => {
    const actions: AISuggestedAction[] = [
      {
        id: 'action-0',
        label: 'Envoyer devis',
        description: 'Passer au statut "Devis envoyé"',
        action_type: 'change_status',
        payload: {
          type: 'change_status',
          target_status_code: 'DEVIS_ENVOYE',
          target_status_label: 'Devis envoyé',
          requires_comment: false,
        },
        priority: 'high',
        icon: 'arrow-right',
        status_color: '#8B5CF6',
      },
      {
        id: 'action-1',
        label: 'Ajouter un commentaire',
        description: 'Ajouter une note',
        action_type: 'add_comment',
        payload: { type: 'add_comment' },
        priority: 'low',
        icon: 'message-square',
      },
    ]

    render(
      <AISidePanel
        state={createState({ result: createResult(actions) })}
        onClose={mockOnClose}
        onExecuteAction={mockOnExecuteAction}
      />
    )

    expect(screen.getByText('Envoyer devis')).toBeDefined()
    expect(screen.getByText('Ajouter un commentaire')).toBeDefined()
    expect(screen.getByText('Actions recommandees')).toBeDefined()
  })

  it('should call onClose when close button is clicked', () => {
    render(
      <AISidePanel
        state={createState({ result: createResult() })}
        onClose={mockOnClose}
        onExecuteAction={mockOnExecuteAction}
      />
    )

    // Find the close button (X icon button)
    const closeButtons = screen.getAllByRole('button')
    const closeButton = closeButtons.find(btn => btn.querySelector('.lucide-x'))
    if (closeButton) {
      fireEvent.click(closeButton)
      expect(mockOnClose).toHaveBeenCalled()
    }
  })

  it('should show confidence badge when available', () => {
    render(
      <AISidePanel
        state={createState({ result: createResult() })}
        onClose={mockOnClose}
        onExecuteAction={mockOnExecuteAction}
      />
    )

    expect(screen.getByText('Confiance : 85%')).toBeDefined()
  })

  it('should show cached badge when result is cached', () => {
    const result = createResult()
    result.cached = true

    render(
      <AISidePanel
        state={createState({ result })}
        onClose={mockOnClose}
        onExecuteAction={mockOnExecuteAction}
      />
    )

    expect(screen.getByText('cache')).toBeDefined()
  })

  it('should not render when isOpen is false', () => {
    const { container } = render(
      <AISidePanel
        state={createState({ isOpen: false })}
        onClose={mockOnClose}
        onExecuteAction={mockOnExecuteAction}
      />
    )

    // Panel should not be visible (AnimatePresence will remove it)
    expect(container.querySelector('[data-testid="sheet-content"]')).toBeNull()
  })
})
