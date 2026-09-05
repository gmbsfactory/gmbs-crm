import { MAX_EMAIL_ATTACHMENTS_TOTAL_BYTES } from '@/lib/interventions/email-attachments'

/**
 * Résolution — et surtout REFUS — des sources de pièces jointes d'e-mail.
 *
 * Correctif de sécurité (SSRF avec exfiltration par e-mail). Jusqu'ici, une ligne
 * `intervention_attachments` dont l'`url` ne pointait pas dans le bucket `documents` était
 * téléchargée par un `fetch(row.url)` **sans aucune contrainte** : n'importe qui capable
 * d'écrire une URL dans cette table (import, route d'ajout de pièce, script) pouvait faire
 * lire au serveur un service interne — métadonnées d'instance, base interne, `file://` — et
 * recevoir la réponse **en pièce jointe d'un e-mail**, c'est-à-dire hors du système.
 *
 * Règle retenue : le chemin d'envoi ne fait plus AUCUNE requête HTTP sortante. Une pièce est
 * jointe uniquement si son URL désigne un objet du stockage Supabase **du projet** ; les octets
 * sont alors lus par le client Supabase (`storage.from(bucket).download(path)`), qui reste
 * dans le périmètre du projet et respecte les policies du bucket. Toute autre adresse est
 * refusée avec un motif explicite, journalisé côté serveur.
 *
 * Ce module est pur (ni Node, ni Supabase) : il reste importable depuis n'importe quel
 * contexte et testable sans réseau.
 */

/** Buckets dont une pièce peut partir en pièce jointe. Les pièces d'intervention y vivent. */
export const EMAIL_ATTACHMENT_ALLOWED_BUCKETS: readonly string[] = ['documents']

/** Délai maximal accordé au téléchargement d'UNE pièce, en millisecondes. */
export const EMAIL_ATTACHMENT_DOWNLOAD_TIMEOUT_MS = 15_000

/**
 * Taille maximale d'UNE pièce.
 *
 * Le plafond cumulé (`MAX_EMAIL_ATTACHMENTS_TOTAL_BYTES`) reste la limite du message ; ce
 * plafond-ci borne en plus chaque téléchargement pris isolément, pour qu'un objet inattendu
 * ne puisse pas gonfler la mémoire de la fonction avant que le cumul ne soit évalué.
 */
export const MAX_EMAIL_ATTACHMENT_BYTES = MAX_EMAIL_ATTACHMENTS_TOTAL_BYTES

/**
 * Alias internes de NOTRE propre passerelle Storage.
 *
 * Les téléversements passent par `getPublicUrl()`, qui rend `http://kong:8000/...` à
 * l'intérieur du réseau du projet ; le code de téléversement remplace ensuite cet hôte par
 * l'URL publique (`documentsApi.ts:207-212`, `supabase/functions/documents/index.ts:599-602`).
 * Une ligne écrite avant ce remplacement, ou avec `SUPABASE_PUBLIC_URL` absent, garde l'alias.
 * L'accepter ne rouvre rien : l'URL n'est JAMAIS appelée, seuls le bucket et le chemin en sont
 * extraits, et le téléchargement se fait par le client Supabase du projet.
 */
const TRUSTED_STORAGE_HOST_ALIASES: readonly string[] = ['kong:8000']

/** Préfixes d'URL du service Storage, du plus spécifique au plus général. */
const STORAGE_PATH_PREFIXES: readonly string[] = [
  '/storage/v1/object/public/',
  '/storage/v1/object/sign/',
  '/storage/v1/object/authenticated/',
  '/storage/v1/object/',
]

/** Motifs de refus. Volontairement énumérés : ils sont journalisés tels quels. */
export type EmailAttachmentRefusalReason =
  | 'url-vide'
  | 'url-illisible'
  | 'identifiants-dans-url'
  | 'stockage-non-configure'
  | 'schema-interdit'
  | 'adresse-ip-interdite'
  | 'hote-local-interdit'
  | 'hote-hors-stockage'
  | 'chemin-hors-stockage'
  | 'bucket-interdit'
  | 'chemin-traversant'

/** Explication en français, destinée au gestionnaire qui a coché la pièce. */
const REFUSAL_MESSAGES: Record<EmailAttachmentRefusalReason, string> = {
  'url-vide': "son adresse de stockage est vide",
  'url-illisible': "son adresse de stockage est illisible",
  'identifiants-dans-url': "son adresse contient des identifiants",
  'stockage-non-configure': "le stockage du CRM n'est pas configuré sur ce serveur",
  'schema-interdit': "son adresse n'utilise pas le protocole du stockage du CRM",
  'adresse-ip-interdite': "son adresse désigne une machine par son IP, hors du stockage du CRM",
  'hote-local-interdit': "son adresse désigne une machine locale ou interne",
  'hote-hors-stockage': "son adresse ne pointe pas vers le stockage du CRM",
  'chemin-hors-stockage': "son adresse ne désigne pas un fichier du stockage du CRM",
  'bucket-interdit': "son fichier n'est pas rangé dans un espace autorisé pour l'e-mail",
  'chemin-traversant': "son chemin de fichier est malformé",
}

/** Objet du stockage Supabase : ce que l'on télécharge réellement. */
export interface EmailAttachmentStorageObject {
  bucket: string
  path: string
}

export type EmailAttachmentSourceResolution =
  | { ok: true; object: EmailAttachmentStorageObject }
  | { ok: false; reason: EmailAttachmentRefusalReason; detail: string }

export interface ResolveEmailAttachmentSourceOptions {
  /** Origine du stockage. Par défaut `NEXT_PUBLIC_SUPABASE_URL` (ou `SUPABASE_URL`). */
  supabaseUrl?: string | null
  /** Autorise un stockage sur machine locale (développement, démo). Jamais en production. */
  allowLocalStorageHost?: boolean
}

/** Phrase complète de refus, pour la réponse HTTP et le journal. */
export function emailAttachmentRefusalMessage(
  reason: EmailAttachmentRefusalReason,
  label: string,
): string {
  return (
    `Le fichier « ${label} » ne peut pas être joint : ${REFUSAL_MESSAGES[reason]}. ` +
    `Reversez le fichier dans l'intervention, puis recochez-le.`
  )
}

/** Hôte désigné par une IP littérale (v4 ou v6 entre crochets) ? */
export function isIpLiteralHost(hostname: string): boolean {
  if (hostname.startsWith('[')) return true
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)
}

/** Hôte local, de lien-local, de réseau privé ou de service de métadonnées ? */
export function isLocalOrPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase()

  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.home.arpa')
  ) {
    return true
  }

  if (host.startsWith('[')) {
    const inner = host.slice(1, -1)
    // Boucle locale, non spécifiée, lien-local (fe80::/10) et unique-local (fc00::/7).
    return (
      inner === '::1' ||
      inner === '::' ||
      inner.startsWith('fe8') ||
      inner.startsWith('fe9') ||
      inner.startsWith('fea') ||
      inner.startsWith('feb') ||
      inner.startsWith('fc') ||
      inner.startsWith('fd')
    )
  }

  const octets = host.split('.')
  if (octets.length !== 4 || !octets.every((part) => /^\d{1,3}$/.test(part))) return false
  const [a, b] = octets.map(Number)
  if (a === 127 || a === 0 || a === 10) return true
  if (a === 169 && b === 254) return true // lien-local, dont 169.254.169.254 (métadonnées)
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  return false
}

/** 127.0.0.1, ::1 et localhost désignent la même machine : on les compare comme un seul hôte. */
function normalizeHost(hostname: string): string {
  const host = hostname.toLowerCase()
  if (host === '127.0.0.1' || host === '[::1]') return 'localhost'
  return host
}

/** Origine du stockage du projet, telle que configurée. `null` si absente ou illisible. */
function readConfiguredStorageUrl(explicit?: string | null): URL | null {
  const raw = String(
    explicit ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '',
  ).trim()
  if (!raw) return null
  try {
    return new URL(raw)
  } catch {
    return null
  }
}

/**
 * Résout l'URL d'une pièce en objet de stockage téléchargeable, ou explique le refus.
 *
 * Contrôles, dans cet ordre : URL lisible et sans identifiants ; stockage configuré ; schéma
 * `https` (ou `http` seulement si le stockage lui-même est local, en développement) ; hôte
 * **strictement** égal à celui du stockage du projet — une IP littérale ou un hôte local sont
 * nommément refusés ; chemin `/storage/v1/object/…` ; bucket autorisé ; aucun segment
 * traversant (`..`), y compris échappé (`%2e%2e`).
 */
export function resolveEmailAttachmentSource(
  url: string | null | undefined,
  options: ResolveEmailAttachmentSourceOptions = {},
): EmailAttachmentSourceResolution {
  const raw = String(url ?? '').trim()
  if (!raw) return { ok: false, reason: 'url-vide', detail: '' }

  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return { ok: false, reason: 'url-illisible', detail: raw.slice(0, 120) }
  }

  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'identifiants-dans-url', detail: parsed.hostname }
  }

  const storage = readConfiguredStorageUrl(options.supabaseUrl)
  if (!storage) return { ok: false, reason: 'stockage-non-configure', detail: parsed.hostname }

  const storageIsLocal = isLocalOrPrivateHost(storage.hostname)
  const allowLocal = options.allowLocalStorageHost ?? process.env.NODE_ENV !== 'production'
  // Garde-fou : même si la configuration désignait une machine locale, la production ne
  // téléchargera jamais depuis une adresse interne.
  if (storageIsLocal && !allowLocal) {
    return { ok: false, reason: 'hote-local-interdit', detail: parsed.hostname }
  }

  // L'alias interne de notre propre passerelle est reconnu avant le schéma : il est servi en
  // `http` par construction, à l'intérieur du réseau du projet.
  const trustedAlias = TRUSTED_STORAGE_HOST_ALIASES.includes(parsed.host.toLowerCase())

  const expectedProtocol = storage.protocol === 'http:' && storageIsLocal ? 'http:' : 'https:'
  const protocolAccepted = trustedAlias
    ? parsed.protocol === 'http:' || parsed.protocol === 'https:'
    : parsed.protocol === expectedProtocol
  if (!protocolAccepted) {
    return { ok: false, reason: 'schema-interdit', detail: parsed.protocol }
  }

  const sameHost = normalizeHost(parsed.hostname) === normalizeHost(storage.hostname)
  const samePort = parsed.port === storage.port
  if ((!sameHost || !samePort) && !trustedAlias) {
    if (isIpLiteralHost(parsed.hostname)) {
      return { ok: false, reason: 'adresse-ip-interdite', detail: parsed.host }
    }
    if (isLocalOrPrivateHost(parsed.hostname)) {
      return { ok: false, reason: 'hote-local-interdit', detail: parsed.host }
    }
    return { ok: false, reason: 'hote-hors-stockage', detail: parsed.host }
  }

  const prefix = STORAGE_PATH_PREFIXES.find((candidate) => parsed.pathname.startsWith(candidate))
  if (!prefix) {
    return { ok: false, reason: 'chemin-hors-stockage', detail: parsed.pathname.slice(0, 120) }
  }

  const rawSegments = parsed.pathname.slice(prefix.length).split('/')
  const segments: string[] = []
  for (const rawSegment of rawSegments) {
    if (!rawSegment) return { ok: false, reason: 'chemin-traversant', detail: parsed.pathname }
    let segment: string
    try {
      segment = decodeURIComponent(rawSegment)
    } catch {
      return { ok: false, reason: 'chemin-traversant', detail: parsed.pathname }
    }
    // `..` échappé (`%2e%2e`) et séparateurs réintroduits par le décodage : un chemin décodé
    // segment par segment ne peut plus sortir du préfixe du bucket.
    if (segment === '.' || segment === '..' || /[/\\\0]/.test(segment)) {
      return { ok: false, reason: 'chemin-traversant', detail: parsed.pathname }
    }
    segments.push(segment)
  }

  const [bucket, ...rest] = segments
  if (!EMAIL_ATTACHMENT_ALLOWED_BUCKETS.includes(bucket)) {
    return { ok: false, reason: 'bucket-interdit', detail: bucket }
  }
  if (rest.length === 0) {
    return { ok: false, reason: 'chemin-hors-stockage', detail: parsed.pathname.slice(0, 120) }
  }

  return { ok: true, object: { bucket, path: rest.join('/') } }
}
