import '@testing-library/jest-dom/vitest'
import React from 'react'
// Vitest environment requires React on the global scope for legacy JSX runtime
globalThis.React = React
import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mocks pour Next.js App Router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/interventions',
}))

// Mock du hook useInterventionModal
vi.mock('@/hooks/useInterventionModal', () => ({
  useInterventionModal: () => ({
    openModal: vi.fn(),
    closeModal: vi.fn(),
    isOpen: false,
  }),
}))

// Mock du hook useModal
vi.mock('@/hooks/useModal', () => ({
  useModal: () => ({
    openModal: vi.fn(),
    closeModal: vi.fn(),
  }),
}))

// Mock du composant InterventionContextMenu et son contenu
vi.mock('@/components/interventions/InterventionContextMenu', () => ({
  InterventionContextMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  InterventionContextMenuContent: () => null,
}))

import InterventionCard from '@/features/interventions/components/InterventionCard'

const base = {
  id: '1',
  date: new Date().toISOString(),
  agence: 'Paris',
  contexteIntervention: 'Test',
  adresse: '1 rue',
  codePostal: '75000',
  ville: 'Paris',
  type: 'Plomberie',
  statut: 'En_cours',
  acompteSSTRecu: false,
  acompteClientRecu: false,
} as any

// Wrapper avec QueryClientProvider
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('InterventionCard', () => {
  it('renders the intervention card without crashing', () => {
    const { container } = render(
      <InterventionCard intervention={base} />,
      { wrapper: createWrapper() }
    )
    // Vérifier que le composant se rend sans erreur
    expect(container).toBeTruthy()
    // Vérifier qu'une carte est bien rendue
    expect(container.querySelector('[class*="card"]')).toBeTruthy()
  })
})

