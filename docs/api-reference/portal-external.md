# Portail artisans — API `portal-external` (contrat implémenté)

> Source : `app/api/portal-external/**`, `src/lib/portal-external/*`, routes internes `app/api/artisans/[id]/portal-link`, `app/api/interventions/[id]/portal-report[/review]`.
> Contrat de référence : [docs/architecture/portail-demo-contrat-api.md](../architecture/portail-demo-contrat-api.md) (fait foi). Scénario de démonstration : [docs/guides/demo-locale-portail.md](../guides/demo-locale-portail.md).

Le CRM est la seule source de vérité : le portail (`portal_gmbs`, sans base de données) relaie chaque écran vers ces routes.

---

## 1. Authentification

| Niveau | Mécanisme | Implémentation |
|---|---|---|
| Portail → CRM (machine à machine) | En-têtes `X-GMBS-Key-Id` et `X-GMBS-Secret` comparés en temps constant (`crypto.timingSafeEqual`, longueurs différentes → `false` sans exception) aux variables `GMBS_PORTAL_KEY_ID` / `GMBS_PORTAL_SECRET` | `validatePortalApiRequest()` — `503 {error:"Portal not configured"}` si les variables manquent, `401 {error:"Invalid credentials"}` si en-têtes absents ou faux |
| Identité de l'artisan | En-tête `X-Portal-Token` (64 hex) → SHA-256 → `artisan_portal_tokens.token_hash` avec `is_active = true`, `expires_at > now()`, artisan `is_active` ; met à jour `last_used_at` | `resolvePortalArtisan()` — `401 {error:"Token invalid" \| "Token expired" \| "Token revoked"}` ; erreur Supabase (base injoignable, clé `service_role` invalide) → `503 {error:"Portal unavailable"}`, jamais `401` (signal de supervision distinct d'un jeton faux) |
| Gestionnaire (routes internes) | Session Supabase du CRM (cookies `@supabase/ssr`) + `requirePermission(request, '<permission>')` | `src/lib/auth/permissions.ts` |

`authenticatePortalRequest()` enchaîne les deux premiers niveaux et renvoie l'artisan + le client `service_role` (`createServerSupabaseAdmin`). Les routes `api/portal-external/**` sont exclues du middleware ; aucune policy RLS `anon`/`authenticated` n'existe sur `artisan_portal_tokens`.

Erreurs : JSON `{ error: string }` ; `400` validation, `401` auth, `404` uniforme quand la ressource n'appartient pas à l'artisan (jamais `403`), `409` conflit d'état, `413` base64 > 4 Mo (ou `Content-Length` > 6 Mo, refusé **avant** la lecture du corps par `readJsonBody`), `415` MIME refusé ou octets magiques ≠ MIME déclaré, `503` non configuré / indisponible.

---

## 2. Routes appelées par le portail (`/api/portal-external/…`)

Toutes en `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`.

### `POST /tokens/validate`

Corps `{ token }` → `200 { valid: true, artisan }` ou `401 { valid: false, error }`.

`artisan = { id, prenom, nom, raison_sociale, email, telephone, statut_dossier, statut_code }` (`statut_code` = code de `artisan_statuses`).

### `GET /me`

```json
{
  "artisan": { "…": "comme ci-dessus" },
  "counters": { "missions_total": 6, "missions_terminees": 1, "missions_en_cours": 5 },
  "documents": { "required": 5, "present": 2 }
}
```

`missions_*` sont calculés sur les statuts visibles (ci-dessous) ; `documents.present` = nombre de types requis présents (`countRequiredDocuments`, `src/lib/artisans/dossierStatus.ts`).

### `GET /me/interventions`

`{ interventions: [...], count }`, filtrées par `intervention_artisans.artisan_id`, statuts visibles **`ACCEPTE`, `INTER_EN_COURS`, `SAV`, `INTER_TERMINEE`**, `is_active` uniquement, triées par `date_prevue` croissante.

Chaque élément : `id, id_inter, statut_code, statut_label, statut_color, date_prevue, date, adresse, code_postal, ville, latitude, longitude, metier, contexte, consigne, consigne_second_artisan, role ('primary'|'secondary'), tenant ({nom, telephone} | null), cout_sst, photos_count, report ({status, version} | null)`.

Minimisation RGPD (`src/lib/portal-external/interventions.ts`) :

- **jamais** : téléphone/identité du propriétaire, e-mail du gestionnaire, `commentaire_agent`, factures GMBS ;
- `tenant` seulement si le statut ∈ `ACCEPTE`, `INTER_EN_COURS`, `SAV` ;
- `cout_sst` = coût `intervention_costs (cost_type='sst')` de l'`artisan_order` correspondant au rôle (1 principal, 2 secondaire).

### `GET /me/interventions/{id}`

`{ intervention: {…idem + agence:{nom}}, documents: { photos: [{id, url, filename, created_at, created_by_display, metadata}], devis: [{id, url, filename}] }, report: {…} | null }`.
`report` = dernière version du rapport **de cet artisan** : `id, status, version, travaux_realises, duree_minutes, materiel_utilise, reste_a_faire, reste_a_faire_detail, anomalies, client_present, submitted_at, review_comment, reviewed_at, attachment_ids`. `404 {error:"Intervention not found"}` si non affecté ou statut non visible.

### `POST /me/interventions/{id}/photos`

Corps `{ filename, mimeType ('image/jpeg'|'image/png'|'image/webp'), base64Data, phase: 'avant'|'apres', comment? }` → `201 { attachment: { id, url, filename, metadata } }`.

- Stockage : bucket `documents`, chemin `intervention/{id}/photos/portal-{timestamp}-{filename}` (nom assaini), URL publique ;
- ligne `intervention_attachments` : `kind='photos'`, `created_by=NULL`, `created_by_display='<Prénom Nom> (artisan)'`, `metadata={source:'portal', phase, comment, artisan_id}` ;
- `400` champ manquant / phase invalide, `413` base64 > 4 Mo, `415` MIME hors liste ou octets magiques (JPEG `FF D8 FF`, PNG, WebP `RIFF…WEBP`) ne correspondant pas au MIME déclaré (`File content does not match mimeType`), `404` non affecté.

### `POST /me/interventions/{id}/report`

Corps `{ portal_report_id (uuid généré par le portail), travaux_realises (≤ 2000 car., requis), duree_minutes?, materiel_utilise?, reste_a_faire (bool), reste_a_faire_detail?, anomalies?, client_present (bool), attachment_ids: [uuid] }`.

| Cas | Réponse |
|---|---|
| création | `201 { report: {…rapport complet, status:'submitted', version} }` |
| rejeu du même `portal_report_id` (même artisan, même intervention) | `200 { report }` identique, aucun effet secondaire |
| artisan non affecté / intervention inactive | `404` |
| statut ∉ `ACCEPTE`, `INTER_EN_COURS`, `SAV` | `409 {error:"Intervention status does not allow a report"}` |
| un rapport `submitted` ou `approved` existe déjà | `409 {error:"Report already submitted" \| "Report already approved"}` |
| rapport précédent `rejected` | création en `version = n + 1` |

Effets (`src/lib/portal-external/report.ts`) :

1. `artisan_reports` : ligne `status='submitted'`, `submitted_from='portal'`, `content` = copie de `travaux_realises` (compatibilité), `attachment_ids` restreints aux pièces de l'intervention ;
2. `interventions.has_portal_report = true` par le **trigger** `trg_artisan_reports_sync_flag` (la route n'écrit jamais ce drapeau) ;
3. `intervention_reminders` pour le gestionnaire : `assigned_user_id`, sinon `PORTAL_FALLBACK_USER_ID`, sinon le premier utilisateur `admin` ; note `@<username> 📋 Rapport de l'inter #<id_inter> à vérifier - soumis par <artisan>. N photo(s) jointe(s).`, `mentioned_user_ids=[user]` (un reminder de rapport actif existant est réutilisé, jamais les autres reminders) ;
4. `comments (comment_type='system', is_internal=true)` : « Rapport d'intervention reçu de <artisan>[ (version n)]. En attente de validation. ».

### `GET /me/interventions/{id}/report`

`{ report | null }` (dernière version de l'artisan), `404` si non affecté.

### `GET /me/documents`

```json
{
  "requiredDocuments": ["kbis", "assurance", "cni_recto_verso", "iban", "decharge_partenariat"],
  "documents": [{ "id": "…", "kind": "kbis", "filename": "…", "url": "…", "mime_type": "…", "file_size": 1, "created_at": "…", "review_status": "pending", "metadata": {} }],
  "documentsByKind": { "kbis": { "…": "le plus récent" }, "assurance": null, "…": null, "autre": null }
}
```

### `POST /me/documents`

Corps `{ kind (∈ requis + 'autre'), filename, mimeType ('application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp'), base64Data }` → `201 { document: { id, kind, url } }`.
Liste MIME **fermée** (`DOCUMENT_MIME_TYPES`, plus restrictive que le « image/* » du contrat initial : pas de SVG ni de HTML servi comme image depuis le bucket public) et octets magiques vérifiés (`%PDF-`, JPEG, PNG, WebP) : `415 {error:"File content does not match mimeType"}` sinon.
Bucket `documents`, chemin `artisans/{artisanId}/{kind}/{timestamp}-{filename}` ; **nouvelle** ligne `artisan_attachments` à chaque dépôt (jamais d'écrasement), `review_status='pending'`, `metadata={source:'portal'}`, `created_by_display='<Prénom Nom> (artisan)'`. `400` kind invalide, `413`, `415`.

### `POST /me/documents/decharge/sign`

Corps `{ signer_name, consent: true, signature_png_base64 }` → `201 { document: { id, url }, signed_at }`.
« Signature simple » : le PNG du tracé (en-tête PNG vérifié, sinon `415`) est déposé en `artisan_attachments (kind='decharge_partenariat', review_status='pending')` avec `metadata={source:'portal', signed_at, signer_name, ip, user_agent, consent_text, sha256}` (`ip` = première IP de `X-Forwarded-For` sinon `X-Real-IP`, `user_agent` = en-tête `User-Agent` ; le portail relaie ceux du navigateur de l'artisan). `400` si `consent` ≠ `true` ou `signer_name` vide.

---

## 3. Routes internes du CRM (session gestionnaire)

| Route | Permission | Comportement |
|---|---|---|
| `POST /api/artisans/{id}/portal-link` | `write_artisans` | `200 { url: "${PORTAL_BASE_URL}/t/<token>", expires_at }` ; 32 octets aléatoires en hex, `sha256` stocké dans `artisan_portal_tokens.token_hash`, jetons précédents désactivés, expiration +30 j ; `404` artisan inconnu, `409` artisan désactivé. Sans `PORTAL_BASE_URL` : `503 {error:"Portal not configured"}` en production (vérifié **avant** toute écriture : aucun jeton désactivé ni créé), repli `http://localhost:3001` hors production (démo). |
| `GET /api/interventions/{id}/portal-report` | `read_interventions` | `{ report \| null, photos: [intervention_attachments kind='photos' et metadata.source='portal'], artisan: {id, nom, prenom} }` — rapport **en attente** (`submitted`) s'il en existe un, sinon le plus récent (`pickPortalReport`, `src/lib/portal-external/interventions.ts`), tous artisans confondus ; sans rapport, `artisan` = artisan principal. |
| `POST /api/interventions/{id}/portal-report/review` | `write_interventions` | `{ decision: 'approved' \| 'rejected', comment? }` → `200 { report }`. Traite le rapport `submitted` de l'intervention (sur une intervention à deux artisans, celui du second même si celui du premier est déjà validé). Met à jour `status`, `reviewed_by` (utilisateur courant), `reviewed_at`, `review_comment` ; clôt **uniquement** le reminder de rapport (`note ILIKE '@%📋 Rapport%'`), et seulement s'il ne reste aucun autre rapport `submitted` ; commentaire système « Rapport validé par <Prénom Nom>[ : commentaire] » / « Rapport refusé par … : … » ; `404` sans rapport, `409` déjà traité. Ne change pas le statut de l'intervention ; sur `rejected` le trigger remet `has_portal_report = false`. |

Sans session, ces routes passent par le middleware du CRM : réponse `307` vers `/login` (et non `401`).

---

## 4. Affichage côté CRM

`interventions.has_portal_report` est exposé par l'Edge Function `interventions-v2` (`DEFAULT_INTERVENTION_COLUMNS`) et interprété par `src/lib/interventions/portal-report-status.ts` : pour `ACCEPTE`, `INTER_EN_COURS`, `SAV`, l'intervention s'affiche « À vérifier » (violet) sans changement de statut.

---

## 5. Variables d'environnement (noms seulement)

| Côté CRM | Rôle |
|---|---|
| `GMBS_PORTAL_KEY_ID`, `GMBS_PORTAL_SECRET` | paire attendue dans `X-GMBS-Key-Id` / `X-GMBS-Secret` |
| `PORTAL_BASE_URL` | origine du portail pour construire le lien `/t/{token}` ; obligatoire en production (`503` sinon), repli `http://localhost:3001` hors production |
| `PORTAL_FALLBACK_USER_ID` | gestionnaire de repli pour le reminder quand `assigned_user_id` est NULL |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | client `service_role` des routes |

---

## 6. Tests

- `tests/unit/lib/portal-external/auth.test.ts` — en-têtes absents, mauvais secret, longueurs différentes, env absentes (503), jeton inconnu / expiré / révoqué / valide (+ `last_used_at`), erreur Supabase → 503 « Portal unavailable » ;
- `tests/unit/lib/portal-external/uploads.test.ts` — liste MIME fermée, octets magiques (PDF, JPEG, PNG, WebP, SVG refusé), décodage base64 (413/400), noms de fichiers ;
- `tests/unit/lib/portal-external/http.test.ts` — `Content-Length` > 6 Mo → 413 sans lecture du corps, JSON invalide → 400 ;
- `tests/unit/api/portal-external/report.test.ts` — 401, 404, 409, 201 (reminder + commentaire), 200 idempotent, version 2 après rejet, repli `PORTAL_FALLBACK_USER_ID`, course sur la version (23505) → 409, autre erreur d'insertion → 500 ;
- `tests/unit/api/portal-external/documents.test.ts` — kind invalide 400, 413, 415 (MIME hors liste, SVG, octets ≠ MIME), 201, GET par type ;
- `tests/unit/api/portal-external/photos.test.ts` — 415 SVG, 415 octets ≠ MIME, 400 phase invalide ;
- `tests/unit/api/artisans/portal-link.test.ts` — 503 sans `PORTAL_BASE_URL` en production (aucune écriture), 200 (hachage seul stocké), repli local hors production, 404, 409, permission refusée ;
- `tests/unit/api/interventions/portal-report-review.test.ts` — 401/403, approved, rejected, 404, 409, deux artisans (rapport `submitted` du second traité, reminder conservé tant qu'un rapport attend).
- `tests/unit/api/interventions/portal-report-get.test.ts` — 401, 404, sans rapport (artisan principal), dernier rapport, deux artisans.
- `tests/unit/lib/portal-external/interventions.test.ts` — `pickPortalReport`.

Mock partagé : `tests/__mocks__/portal-external-client.ts` (client Supabase « planifié », résultats consommés table par table).
