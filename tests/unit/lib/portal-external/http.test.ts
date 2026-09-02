import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { MAX_JSON_BODY_BYTES, readJsonBody } from '@/lib/portal-external/http'

function post(body: string, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/portal-external/me/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  })
}

describe('portal-external/http readJsonBody', () => {
  it('renvoie 413 sur Content-Length trop grand SANS lire le corps', async () => {
    const request = post('{}', { 'content-length': String(MAX_JSON_BODY_BYTES + 1) })
    const json = vi.spyOn(request, 'json')
    const result = await readJsonBody(request)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.response.status).toBe(413)
    expect(await result.response.json()).toEqual({ error: 'Payload too large' })
    expect(json).not.toHaveBeenCalled()
  })

  it('accepte un corps sous le plafond', async () => {
    const result = await readJsonBody(post('{"kind":"kbis"}', { 'content-length': String(MAX_JSON_BODY_BYTES) }))
    expect(result).toEqual({ ok: true, body: { kind: 'kbis' } })
  })

  it('renvoie 400 pour un JSON illisible ou qui n’est pas un objet', async () => {
    const broken = await readJsonBody(post('{pas du json'))
    expect(!broken.ok && broken.response.status).toBe(400)
    const array = await readJsonBody(post('[1,2]'))
    expect(!array.ok && array.response.status).toBe(400)
  })
})
