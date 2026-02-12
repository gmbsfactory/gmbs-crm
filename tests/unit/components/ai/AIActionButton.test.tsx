import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { AIActionButton } from '@/components/ai/AIActionButton'
import type { AISuggestedAction } from '@/lib/ai/types'

// Mock tooltip since it relies on Radix provider
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip">{children}</div>,
}))

describe('AIActionButton', () => {
  const mockExecute = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createAction = (overrides: Partial<AISuggestedAction> = {}): AISuggestedAction => ({
    id: 'action-0',
    label: 'Test Action',
    description: 'Test description',
    action_type: 'change_status',
    payload: {
      type: 'change_status',
      target_status_code: 'ACCEPTE',
      target_status_label: 'Accepté',
      requires_comment: false,
    },
    priority: 'high',
    icon: 'arrow-right',
    status_color: '#10B981',
    ...overrides,
  })

  it('should render the action label and description', () => {
    render(<AIActionButton action={createAction()} onExecute={mockExecute} />)

    expect(screen.getByText('Test Action')).toBeDefined()
    expect(screen.getByText('Test description')).toBeDefined()
  })

  it('should call onExecute when clicked', () => {
    const action = createAction()
    render(<AIActionButton action={action} onExecute={mockExecute} />)

    fireEvent.click(screen.getByRole('button'))
    expect(mockExecute).toHaveBeenCalledWith(action)
  })

  it('should render disabled button when action is disabled', () => {
    const action = createAction({
      disabled: true,
      disabled_reason: 'Prerequis manquant',
    })
    render(<AIActionButton action={action} onExecute={mockExecute} />)

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
  })

  it('should not call onExecute when disabled button is clicked', () => {
    const action = createAction({ disabled: true })
    render(<AIActionButton action={action} onExecute={mockExecute} />)

    fireEvent.click(screen.getByRole('button'))
    expect(mockExecute).not.toHaveBeenCalled()
  })

  it('should render change_status action with status color', () => {
    const action = createAction({
      action_type: 'change_status',
      status_color: '#8B5CF6',
    })
    render(<AIActionButton action={action} onExecute={mockExecute} />)

    const button = screen.getByRole('button')
    expect(button).toBeDefined()
  })

  it('should render assign_artisan action', () => {
    const action = createAction({
      id: 'action-1',
      label: 'Assigner artisan',
      description: 'Rechercher un artisan',
      action_type: 'assign_artisan',
      payload: { type: 'assign_artisan', metier_code: 'PLOMBERIE' },
      icon: 'user-plus',
    })
    render(<AIActionButton action={action} onExecute={mockExecute} />)

    expect(screen.getByText('Assigner artisan')).toBeDefined()
  })

  it('should render add_comment action', () => {
    const action = createAction({
      id: 'action-2',
      label: 'Ajouter un commentaire',
      description: 'Ajouter une note',
      action_type: 'add_comment',
      payload: { type: 'add_comment' },
      icon: 'message-square',
      priority: 'low',
    })
    render(<AIActionButton action={action} onExecute={mockExecute} />)

    expect(screen.getByText('Ajouter un commentaire')).toBeDefined()
  })

  it('should render send_email action', () => {
    const action = createAction({
      id: 'action-3',
      label: 'Email client',
      description: 'Envoyer un email au client',
      action_type: 'send_email',
      payload: { type: 'send_email', email_type: 'client' },
      icon: 'mail',
      priority: 'medium',
    })
    render(<AIActionButton action={action} onExecute={mockExecute} />)

    expect(screen.getByText('Email client')).toBeDefined()
  })
})
