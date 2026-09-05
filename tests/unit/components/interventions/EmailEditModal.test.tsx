import React from 'react'
// Vitest (runtime JSX historique) requiert React sur le scope global
globalThis.React = React

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const h = vi.hoisted(() => ({
  getAll: vi.fn(),
  upload: vi.fn(),
  upsertCost: vi.fn(),
  getSession: vi.fn(),
  fetchMock: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  documentsApi: { getAll: h.getAll, upload: h.upload },
  interventionsApi: { upsertCost: h.upsertCost },
}))
vi.mock('@/lib/supabase-client', () => ({
  supabase: { auth: { getSession: h.getSession } },
}))
vi.mock('@/hooks/useEmailLogs', () => ({
  useEmailLogsByType: () => ({ data: [], isLoading: false }),
}))
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    data: { id: 'user-1', firstname: 'Badr', lastname: 'Boujimal', code_gestionnaire: 'BB', color: '#000' },
  }),
}))
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(() => 'toast-1'),
    dismiss: vi.fn(),
  }),
}))

import { EmailEditModal } from '@/components/interventions/EmailEditModal'

const INTERVENTION_ID = 'i-0001'

const templateData = {
  nomClient: 'Mme Dupont',
  telephoneClient: '06 00 00 00 00',
  adresse: '1 rue des Lilas, Paris',
  idIntervention: 'GMBS-2026-0001',
  consigneArtisan: 'Sonner avant',
  commentaire: '',
  datePrevue: '2026-09-15',
  coutSST: '320',
}

function attachment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'att-devis',
    kind: 'devis',
    url: 'http://127.0.0.1:54321/storage/v1/object/public/documents/intervention/i-0001/devis.pdf',
    filename: 'devis-plomberie.pdf',
    mime_type: 'application/pdf',
    file_size: 2048,
    created_at: '2026-09-01T10:00:00.000Z',
    sent_to_artisan_at: null,
    ...overrides,
  }
}

function renderModal(props: Record<string, unknown> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <EmailEditModal
        isOpen
        onClose={vi.fn()}
        emailType="devis"
        artisanId="art-1"
        artisanEmail="karim@example.invalid"
        interventionId={INTERVENTION_ID}
        templateData={templateData}
        {...props}
      />
    </QueryClientProvider>,
  )
}

describe('EmailEditModal — pièces jointes issues de l\'intervention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.getAll.mockResolvedValue({ data: [attachment()] })
    h.getSession.mockResolvedValue({ data: { session: { access_token: 'jeton' } } })
    h.fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { messageId: 'm-1', accepted: [], rejected: [], attachmentIds: [] } }),
    })
    vi.stubGlobal('fetch', h.fetchMock)
  })

  it('should lister les pièces de l\'intervention et non des fichiers du disque', async () => {
    renderModal()

    await waitFor(() => expect(h.getAll).toHaveBeenCalledWith({
      entity_type: 'intervention',
      entity_id: INTERVENTION_ID,
    }))

    expect(await screen.findByText('devis-plomberie.pdf')).toBeInTheDocument()
    expect(screen.getByLabelText(/Nature du fichier ajouté/i)).toBeInTheDocument()
  })

  it('should masquer les factures GMBS : elles ne partent jamais chez l\'artisan', async () => {
    h.getAll.mockResolvedValue({
      data: [attachment(), attachment({ id: 'att-gmbs', kind: 'facturesGMBS', filename: 'facture-client.pdf' })],
    })

    renderModal()

    expect(await screen.findByText('devis-plomberie.pdf')).toBeInTheDocument()
    expect(screen.queryByText('facture-client.pdf')).not.toBeInTheDocument()
  })

  it('should envoyer les identifiants des pièces cochées, sans base64 dans le corps', async () => {
    renderModal()
    const checkbox = await screen.findByRole('checkbox')

    fireEvent.click(checkbox)
    fireEvent.click(screen.getByRole('button', { name: /Envoyer/i }))

    await waitFor(() => expect(h.fetchMock).toHaveBeenCalled())

    const [url, init] = h.fetchMock.mock.calls[0]
    expect(url).toBe(`/api/interventions/${INTERVENTION_ID}/send-email`)
    const body = JSON.parse(init.body)
    expect(body.attachmentIds).toEqual(['att-devis'])
    expect(body.attachments).toBeUndefined()
    expect(init.body).not.toContain('"content"')
  })

  it('should déposer un fichier du disque comme pièce de l\'intervention avant de le joindre', async () => {
    h.upload.mockResolvedValue({ id: 'att-nouveau' })
    h.getAll
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValue({ data: [attachment({ id: 'att-nouveau', filename: 'nouveau-devis.pdf' })] })

    renderModal()
    await waitFor(() => expect(h.getAll).toHaveBeenCalledTimes(1))

    // La modale est rendue dans un portail Radix : chercher dans le document, pas dans le container.
    const input = document.querySelector('#file-upload') as HTMLInputElement
    const file = new File(['contenu'], 'nouveau-devis.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(h.upload).toHaveBeenCalledTimes(1))
    expect(h.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: 'intervention',
        entity_id: INTERVENTION_ID,
        kind: 'devis',
        filename: 'nouveau-devis.pdf',
        mime_type: 'application/pdf',
        created_by: 'user-1',
      }),
    )

    // La pièce créée est rechargée puis cochée automatiquement.
    await waitFor(() => expect(h.getAll).toHaveBeenCalledTimes(2))
    const checkbox = await screen.findByRole('checkbox')
    await waitFor(() => expect(checkbox).toBeChecked())
  })

  it('should envoyer sans pièce jointe quand rien n\'est coché (non-régression)', async () => {
    renderModal()
    await screen.findByText('devis-plomberie.pdf')

    fireEvent.click(screen.getByRole('button', { name: /Envoyer/i }))

    await waitFor(() => expect(h.fetchMock).toHaveBeenCalled())
    const body = JSON.parse(h.fetchMock.mock.calls[0][1].body)
    expect(body.attachmentIds).toEqual([])
  })
})
