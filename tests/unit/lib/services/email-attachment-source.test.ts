import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  emailAttachmentRefusalMessage,
  isIpLiteralHost,
  isLocalOrPrivateHost,
  resolveEmailAttachmentSource,
} from '@/lib/services/email-attachment-source'

const PROJET = 'https://projet.supabase.co'
const LOCAL = 'http://127.0.0.1:54321'

/** URL publique d'un objet du bucket `documents`, sur l'hôte donné. */
function objectUrl(origin: string, path = 'intervention/i-1/devis.pdf'): string {
  return `${origin}/storage/v1/object/public/documents/${path}`
}

describe('email-attachment-source', () => {
  const previous = process.env.NEXT_PUBLIC_SUPABASE_URL

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = PROJET
  })

  afterEach(() => {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previous
  })

  describe('resolveEmailAttachmentSource', () => {
    it('should accepter un objet du stockage du projet et n\'en garder que bucket et chemin', () => {
      const result = resolveEmailAttachmentSource(objectUrl(PROJET))

      expect(result).toEqual({ ok: true, object: { bucket: 'documents', path: 'intervention/i-1/devis.pdf' } })
    })

    it('should décoder les caractères échappés du nom de fichier', () => {
      const result = resolveEmailAttachmentSource(objectUrl(PROJET, 'intervention/i-1/devis%20final.pdf'))

      expect(result).toMatchObject({ ok: true, object: { path: 'intervention/i-1/devis final.pdf' } })
    })

    it('should ignorer la query et le fragment d\'une URL signée', () => {
      const result = resolveEmailAttachmentSource(
        `${PROJET}/storage/v1/object/sign/documents/intervention/i-1/d.pdf?token=abc#page=2`,
      )

      expect(result).toMatchObject({ ok: true, object: { bucket: 'documents', path: 'intervention/i-1/d.pdf' } })
    })

    it('should refuser une URL hors du stockage du projet (cœur de la faille SSRF)', () => {
      const result = resolveEmailAttachmentSource(objectUrl('https://exfiltration.invalid'))

      expect(result).toEqual({ ok: false, reason: 'hote-hors-stockage', detail: 'exfiltration.invalid' })
    })

    it("should accepter l'alias interne de notre propre passerelle Storage", () => {
      // `kong:8000` est l'hôte rendu par getPublicUrl() dans le réseau du projet : l'URL n'est
      // pas appelée, seuls bucket et chemin en sont extraits.
      const result = resolveEmailAttachmentSource(objectUrl('http://kong:8000'))

      expect(result).toMatchObject({ ok: true, object: { bucket: 'documents' } })
    })

    it('should refuser une adresse IP littérale, dont le service de métadonnées', () => {
      const result = resolveEmailAttachmentSource(objectUrl('https://169.254.169.254'))

      expect(result).toMatchObject({ ok: false, reason: 'adresse-ip-interdite' })
    })

    it('should refuser un hôte local quand le stockage du projet est distant', () => {
      expect(resolveEmailAttachmentSource(objectUrl('https://localhost:54321'))).toMatchObject({
        ok: false,
        reason: 'hote-local-interdit',
      })
      expect(resolveEmailAttachmentSource(objectUrl('https://redis.internal'))).toMatchObject({
        ok: false,
        reason: 'hote-local-interdit',
      })
    })

    it('should refuser tout schéma autre que celui du stockage', () => {
      expect(resolveEmailAttachmentSource('file:///etc/passwd')).toMatchObject({
        ok: false,
        reason: 'schema-interdit',
      })
      expect(resolveEmailAttachmentSource('gopher://projet.supabase.co/1')).toMatchObject({
        ok: false,
        reason: 'schema-interdit',
      })
      expect(resolveEmailAttachmentSource(objectUrl('http://projet.supabase.co'))).toMatchObject({
        ok: false,
        reason: 'schema-interdit',
      })
    })

    it('should refuser un port différent de celui du stockage', () => {
      expect(resolveEmailAttachmentSource(objectUrl('https://projet.supabase.co:8443'))).toMatchObject({
        ok: false,
        reason: 'hote-hors-stockage',
      })
    })

    it('should refuser des identifiants glissés dans l\'URL', () => {
      const result = resolveEmailAttachmentSource(
        'https://admin:secret@projet.supabase.co/storage/v1/object/public/documents/a/b.pdf',
      )

      expect(result).toMatchObject({ ok: false, reason: 'identifiants-dans-url' })
    })

    it('should refuser un chemin qui ne désigne pas un objet du stockage', () => {
      expect(resolveEmailAttachmentSource(`${PROJET}/rest/v1/users?select=*`)).toMatchObject({
        ok: false,
        reason: 'chemin-hors-stockage',
      })
      expect(resolveEmailAttachmentSource(`${PROJET}/storage/v1/object/public/documents/`)).toMatchObject({
        ok: false,
        reason: 'chemin-traversant',
      })
    })

    it('should refuser un bucket non autorisé pour l\'e-mail', () => {
      const result = resolveEmailAttachmentSource(`${PROJET}/storage/v1/object/public/avatars/a.png`)

      expect(result).toEqual({ ok: false, reason: 'bucket-interdit', detail: 'avatars' })
    })

    it('should refuser une traversée de chemin, échappée comme normalisée', () => {
      // `%2e%2e` est résolu par le parseur d'URL : le chemin sort du bucket `documents` et
      // retombe sur un autre espace, donc refusé au titre du bucket.
      expect(
        resolveEmailAttachmentSource(`${PROJET}/storage/v1/object/public/documents/%2e%2e/secrets/k.txt`),
      ).toMatchObject({ ok: false, reason: 'bucket-interdit' })

      // `%2F` survit au parseur : c'est le décodage segment par segment qui l'attrape.
      expect(
        resolveEmailAttachmentSource(`${PROJET}/storage/v1/object/public/documents/i-1%2F..%2Fautre.pdf`),
      ).toMatchObject({ ok: false, reason: 'chemin-traversant' })
    })

    it('should refuser quand le stockage n\'est pas configuré (échec fermé)', () => {
      const result = resolveEmailAttachmentSource(objectUrl(PROJET), { supabaseUrl: '' })

      expect(result).toMatchObject({ ok: false, reason: 'stockage-non-configure' })
    })

    it('should refuser une URL vide ou illisible', () => {
      expect(resolveEmailAttachmentSource('')).toMatchObject({ ok: false, reason: 'url-vide' })
      expect(resolveEmailAttachmentSource(null)).toMatchObject({ ok: false, reason: 'url-vide' })
      expect(resolveEmailAttachmentSource('pas une url')).toMatchObject({ ok: false, reason: 'url-illisible' })
    })

    it('should accepter le stockage local en développement, 127.0.0.1 et localhost confondus', () => {
      const options = { supabaseUrl: LOCAL, allowLocalStorageHost: true }

      expect(resolveEmailAttachmentSource(objectUrl(LOCAL), options)).toMatchObject({ ok: true })
      expect(resolveEmailAttachmentSource(objectUrl('http://localhost:54321'), options)).toMatchObject({
        ok: true,
      })
    })

    it('should refuser un stockage local en production, même s\'il est configuré ainsi', () => {
      const result = resolveEmailAttachmentSource(objectUrl(LOCAL), {
        supabaseUrl: LOCAL,
        allowLocalStorageHost: false,
      })

      expect(result).toMatchObject({ ok: false, reason: 'hote-local-interdit' })
    })
  })

  describe('emailAttachmentRefusalMessage', () => {
    it('should nommer le fichier et le motif dans une phrase lisible', () => {
      const message = emailAttachmentRefusalMessage('hote-hors-stockage', 'devis.pdf')

      expect(message).toContain('devis.pdf')
      expect(message).toContain('stockage du CRM')
    })
  })

  describe('isIpLiteralHost / isLocalOrPrivateHost', () => {
    it('should reconnaître les IP littérales v4 et v6', () => {
      expect(isIpLiteralHost('10.0.0.1')).toBe(true)
      expect(isIpLiteralHost('[::1]')).toBe(true)
      expect(isIpLiteralHost('projet.supabase.co')).toBe(false)
    })

    it('should reconnaître les hôtes locaux, privés et de lien-local', () => {
      for (const host of ['localhost', '127.0.0.1', '10.1.2.3', '172.16.0.9', '192.168.1.4', '169.254.169.254', '[::1]', 'db.internal']) {
        expect(isLocalOrPrivateHost(host)).toBe(true)
      }
      expect(isLocalOrPrivateHost('projet.supabase.co')).toBe(false)
      expect(isLocalOrPrivateHost('172.32.0.1')).toBe(false)
    })
  })
})
