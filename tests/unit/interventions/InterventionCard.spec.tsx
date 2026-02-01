import { render, screen } from '@testing-library/react'
import React from 'react'
import InterventionCard from '@/features/interventions/components/InterventionCard'

const base = {
  id: '1', date: new Date().toISOString(), agence: 'Paris', contexteIntervention: 'Test',
  adresse: '1 rue', codePostal: '75000', ville: 'Paris', type: 'Plomberie', statut: 'En_cours',
  acompteSSTRecu: false, acompteClientRecu: false
} as any

describe('InterventionCard', () => {
  it('renders overdue/due-soon badges depending on date', () => {
    render(<InterventionCard intervention={{ ...base, dateIntervention: new Date(Date.now()-86400000).toISOString() }} />)
    expect(screen.getByText(/Retard/)).toBeInTheDocument()
  })
})

