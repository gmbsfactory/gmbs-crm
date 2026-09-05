# Portail artisans — contrat d'API de la démo locale (v0)

> Démo locale du 2026-09-02. CRM sur la branche `deposedocsv2` (port 3000, Supabase **locale** `http://127.0.0.1:54321`), portail `portal_gmbs` sur la branche `demo-local` (port 3001). **Le CRM est la seule source de vérité** : le portail est sans base de données, il relaie vers le CRM. Ce contrat est la référence commune des équipes ; toute divergence se règle en modifiant ce fichier d'abord.

## 1. Authentification

| Sens | Mécanisme | Env côté CRM | Env côté portail |
|---|---|---|---|
| portail → CRM (machine à machine) | en-têtes `X-GMBS-Key-Id` et `X-GMBS-Secret`, comparés en temps constant (`crypto.timingSafeEqual`) ; `503 {error:"Portal not configured"}` si les variables manquent ; `401 {error:"Invalid credentials"}` sinon | `GMBS_PORTAL_KEY_ID`, `GMBS_PORTAL_SECRET`, `PORTAL_BASE_URL` (= `http://localhost:3001`) | `CRM_BASE_URL` (= `http://localhost:3000`), `CRM_API_KEY_ID`, `CRM_API_SECRET`, `NEXT_PUBLIC_PORTAL_URL` |
| identité de l'artisan | en-tête `X-Portal-Token` = jeton de 64 caractères hexadécimaux reçu dans le lien `/t/{token}` ; le CRM le hache (SHA-256) et le cherche dans `artisan_portal_tokens` (`is_active = true`, `expires_at > now()`) → `artisan_id` ; jamais d'`artisanId` fourni par le client ; erreur d'infrastructure côté CRM → `503 {error:"Portal unavailable"}` (jamais `401`) | — | le portail garde le jeton dans un cookie `httpOnly` `portal_token` (chemin `/`, `SameSite=Lax`) posé par `/t/{token}` ; sur un `401` du CRM (jeton inconnu, expiré ou révoqué par un nouveau lien), le proxy du portail **supprime le cookie** dans la même réponse et le navigateur purge le cache hors-ligne avant d'afficher `/lien-invalide` (précision du 2026-09-02) |
| gestionnaire (routes internes du CRM) | session Supabase du CRM + `requirePermission(request, '<permission>')` (`src/lib/auth/permissions.ts`) | — | — |

Réponses : JSON ; erreurs `{ error: string }` ; `400` validation, `401` auth, `404` uniforme pour une ressource qui n'appartient pas à l'artisan (jamais `403` révélateur), `409` conflit d'état, `413` corps trop grand (base64 > 4 Mo, ou `Content-Length` > 6 Mo refusé avant lecture), `415` MIME refusé ou octets magiques ≠ MIME déclaré, `503` portail non configuré / indisponible.

Secret partagé de la démo : généré le 2026-09-02, présent dans `.env.demo.local` des deux dépôts (jamais commité, jamais celui de production).

## 2. Routes CRM appelées par le portail — `app/api/portal-external/…` (exclues du middleware)

| Méthode et chemin | Corps → réponse |
|---|---|
| `POST /api/portal-external/tokens/validate` | `{token}` → `200 {valid:true, artisan:{id, prenom, nom, raison_sociale, email, telephone, statut_dossier, statut_code}}` ; jeton inconnu/expiré/inactif → `401 {valid:false, error:"Token invalid"|"Token expired"|"Token revoked"}` ; met à jour `last_used_at` |
| `GET /api/portal-external/me` | → `{artisan:{…comme ci-dessus}, counters:{missions_total, missions_terminees, missions_en_cours}, documents:{required:5, present:n}}` |
| `GET /api/portal-external/me/interventions` | → `{interventions:[{id, id_inter, statut_code, statut_label, statut_color, date_prevue, date, adresse, code_postal, ville, latitude, longitude, metier, contexte, consigne, consigne_second_artisan, role ('primary'\|'secondary'), tenant:{nom, telephone} \| null (seulement si statut ∈ ACCEPTE, INTER_EN_COURS, SAV), cout_sst, photos_count, report:{status, version} \| null}], count}` — filtrées par `intervention_artisans.artisan_id`, statuts visibles : `ACCEPTE`, `INTER_EN_COURS`, `SAV`, `INTER_TERMINEE` ; triées par `date_prevue` |
| `GET /api/portal-external/me/interventions/{id}` | → `{intervention:{…idem + agence:{nom}}, documents:{photos:[{id, url, filename, created_at, created_by_display, metadata}], devis:[{id, url, filename}]}, report:{id, status, version, travaux_realises, duree_minutes, materiel_utilise, reste_a_faire, reste_a_faire_detail, anomalies, client_present, submitted_at, review_comment, reviewed_at, attachment_ids} \| null}` ; `404` si non assigné |
| `POST /api/portal-external/me/interventions/{id}/photos` | `{filename, mimeType ('image/jpeg'\|'image/png'\|'image/webp'), base64Data, phase:'avant'\|'apres', comment?}` → `201 {attachment:{id, url, filename, metadata}}` ; stockage bucket `documents`, chemin `intervention/{id}/photos/portal-{timestamp}-{filename}` ; ligne `intervention_attachments (kind='photos', created_by=NULL, created_by_display='<Prénom Nom> (artisan)', metadata {source:'portal', phase, comment, artisan_id})` ; limite 4 Mo base64 |
| `POST /api/portal-external/me/interventions/{id}/report` | `{portal_report_id (uuid généré par le portail), travaux_realises (≤ 2000 car., requis), duree_minutes?, materiel_utilise?, reste_a_faire (bool), reste_a_faire_detail?, anomalies?, client_present (bool), attachment_ids:[uuid]}` → `201 {report:{id, status:'submitted', version, submitted_at}}` (le portail ne met dans `attachment_ids` que les photos `metadata.source='portal'` dont `metadata.artisan_id` est l'artisan du jeton ; le CRM ne conserve que celles de l'intervention) ; **idempotent** : même `portal_report_id` → `200` avec le même rapport ; effets : `artisan_reports` (nouvelle version si un rapport `rejected` existe), `interventions.has_portal_report = true` (trigger), `intervention_reminders` pour `assigned_user_id` (note `@<username> 📋 Rapport de l'inter #<id_inter> à vérifier`, `mentioned_user_ids=[assigned_user_id]`) ou repli sur `PORTAL_FALLBACK_USER_ID`, commentaire `comments (comment_type='system')` « Rapport d'intervention reçu de <artisan> … » ; `409` si le statut n'est ni `ACCEPTE` ni `INTER_EN_COURS` ni `SAV` ; `409 {error:"Report already submitted"|"Report already approved"}` si un rapport `submitted` ou `approved` existe déjà pour le couple (intervention, artisan) avec un autre `portal_report_id` — seule la resoumission après `rejected` ouvre la version n+1 (règle actée le 2026-09-02, appliquée à l'identique par le CRM et par le mode mock du portail) |
| `GET /api/portal-external/me/interventions/{id}/report` | → `{report \| null}` |
| `GET /api/portal-external/me/documents` | → `{requiredDocuments:['kbis','assurance','cni_recto_verso','iban','decharge_partenariat'], documents:[{id, kind, filename, url, mime_type, file_size, created_at, review_status, metadata}], documentsByKind:{kind → document \| null}}` |
| `POST /api/portal-external/me/documents` | `{kind (∈ requis + 'autre'), filename, mimeType ('application/pdf'\|'image/jpeg'\|'image/png'\|'image/webp' — liste fermée, octets magiques vérifiés, revue 2026-09-02), base64Data}` → `201 {document:{id, kind, url}}` ; bucket `documents`, chemin `artisans/{artisanId}/{kind}/{timestamp}-{filename}` ; nouvelle ligne `artisan_attachments` (jamais d'écrasement) avec `review_status='pending'`, `metadata {source:'portal'}` |
| `POST /api/portal-external/me/documents/decharge/sign` | `{signer_name, consent:true, signature_png_base64}` → `201 {document:{id, url}, signed_at}` ; démo « signature simple » : PNG du tracé déposé en `artisan_attachments (kind='decharge_partenariat', metadata {source:'portal', signed_at, signer_name, ip, user_agent, consent_text, sha256})` ; `ip` / `user_agent` = ceux du **navigateur de l'artisan**, que le portail relaie au CRM dans `X-Forwarded-For` (première IP) et `User-Agent` sur toutes les routes relayées (QA 2026-09-02) ; `400` si `consent` faux |

## 3. Routes internes du CRM (session gestionnaire)

| Méthode et chemin | Permission | Corps → réponse |
|---|---|---|
| `POST /api/artisans/{id}/portal-link` | `write_artisans` | → `200 {url:"${PORTAL_BASE_URL}/t/<token>", expires_at}` ; génère 32 octets aléatoires (hex), stocke `sha256` dans `artisan_portal_tokens.token_hash`, désactive les jetons précédents de l'artisan, expiration +30 j ; `503 {error:"Portal not configured"}` sans `PORTAL_BASE_URL` en production (repli `http://localhost:3001` hors production) |
| `GET /api/interventions/{id}/portal-report` | `read_interventions` | → `{report \| null, photos:[…intervention_attachments kind='photos' avec metadata.source='portal'], artisan:{id, nom, prenom}}` ; `report` = rapport **en attente** (`submitted`) s'il en existe un, sinon le plus récent (version puis `submitted_at` décroissantes), tous artisans confondus — sur une intervention à deux artisans, le rapport du second reste visible et traitable après validation de celui du premier (QA 2026-09-02) |
| `POST /api/interventions/{id}/portal-report/review` | `write_interventions` | `{decision:'approved'\|'rejected', comment?}` → `200 {report}` ; met `artisan_reports.status`, `reviewed_by`, `reviewed_at`, `review_comment` ; traite le rapport `submitted` (jamais « le plus récent », cf. `GET`) ; clôt **uniquement** le reminder du rapport (note commençant par `@… 📋 Rapport`) et seulement s'il ne reste aucun autre rapport `submitted` ; commentaire système « Rapport validé par … » / « Rapport refusé par … : … » ; sur `rejected` le trigger remet `has_portal_report = false` ; ne change **pas** le statut de l'intervention |

## 4. Base locale (migration `supabase/migrations/99076_portal_demo_convergence.sql`, idempotente)

- `artisan_portal_tokens` : `CREATE TABLE IF NOT EXISTS` compatible avec la DDL de `origin/depose_docs` (`00065`, `00066`) **plus** `ADD COLUMN IF NOT EXISTS token_hash text`, index `(token_hash)`, `last_used_at` ; **aucune policy `anon`** ; lecture/écriture par `service_role` uniquement (les routes utilisent `createServerSupabaseAdmin`).
- `artisan_reports` : `CREATE TABLE IF NOT EXISTS` (base `00068`) + `ADD COLUMN IF NOT EXISTS` : `portal_report_id uuid UNIQUE`, `version int DEFAULT 1`, `status text CHECK (status IN ('submitted','approved','rejected')) DEFAULT 'submitted'`, `travaux_realises text`, `duree_minutes int`, `materiel_utilise text`, `reste_a_faire boolean DEFAULT false`, `reste_a_faire_detail text`, `anomalies text`, `client_present boolean`, `submitted_from text DEFAULT 'web'`, `attachment_ids uuid[] DEFAULT '{}'`, `submitted_at timestamptz DEFAULT now()`, `reviewed_by uuid REFERENCES public.users(id)`, `reviewed_at timestamptz`, `review_comment text` ; index unique `(intervention_id, artisan_id, version)` ; RLS : SELECT `authenticated`, écriture `service_role`.
- `interventions.has_portal_report boolean DEFAULT false` (`ADD COLUMN IF NOT EXISTS`) ; `intervention_attachments.metadata jsonb DEFAULT '{}'` ; `artisan_attachments.review_status text DEFAULT 'approved'` et `metadata jsonb DEFAULT '{}'` (`ADD COLUMN IF NOT EXISTS`).
- Trigger `trg_artisan_reports_sync_flag` (`AFTER INSERT OR UPDATE OF status OR DELETE ON artisan_reports`) : `interventions.has_portal_report = EXISTS(… status = 'submitted')`.
- Reprise de la production avant les index uniques : versions renumérotées par couple (intervention, artisan), `portal_report_id` dédoublonné, jetons `token` en clair hachés dans `token_hash` (clair effacé).
- `DROP POLICY IF EXISTS "Anonymous can validate tokens" ON artisan_portal_tokens` ; pas de RPC.
- Colonne `has_portal_report` ajoutée à `DEFAULT_INTERVENTION_COLUMNS` de `supabase/functions/interventions-v2/_lib/helpers.ts` (fonction servie localement par `supabase start`).

## 5. Données de démo (`supabase/seeds/seed_demo_portail.sql`, idempotent, chargé par `scripts/demo/load-seed.sh` sur la base locale uniquement)

3 artisans (UUID fixes ; plombier « Karim Benali », électricien « Sofia Martins », serrurier « Yanis Roux », e-mail et mobile fictifs, statut CONFIRME, `is_active = true`), 1 agence / 1 propriétaire / 1 locataire fictifs, 8 interventions `DEMO-001…008` (3 `ACCEPTE`, 3 `INTER_EN_COURS`, 2 `INTER_TERMINEE`, adresses parisiennes géocodées), `intervention_artisans` (6 pour Karim dont une en `secondary`, 2 pour Sofia), `intervention_costs (cost_type='sst')`, `assigned_user_id` = utilisateur `badr@gmbs.fr` (seed local `seed_admin_auth.sql`, mot de passe local `badr123`). Comptes locaux : `admin@gmbs.fr` / `admin`.

## 6. Portail (branche `demo-local`)

Next.js 16 sans Supabase, sans Stripe. Pages : `/t/{token}` (valide via le CRM, pose le cookie, redirige) → `/app/missions`, `/app/missions/{id}` (onglets Infos · Photos · Rapport), `/app/dossier` (5 pièces + signature de la décharge), `/app/compte` ; barre d'onglets en bas (Missions, Dossier, Compte). Routes serveur `/api/portal/*` = proxys qui ajoutent `X-GMBS-Key-Id/Secret` (jamais exposés au navigateur) et `X-Portal-Token` lu dans le cookie ; `POST /api/portal/logout` supprime le cookie (déconnexion depuis l'écran Compte et après un `401`) ; aucun autre proxy sans cookie (l'ancienne route `POST /api/portal/tokens/validate` a été retirée le 2026-09-02 : seul `/t/{token}` — route serveur GET → validation → cookie → `303` — pose le cookie). Dépôt du dossier : limite portail **3 Mo par fichier** (marge sous les 4 Mo de base64 du CRM), images compressées sur le téléphone avant envoi, PDF trop gros refusé avant l'appel. PWA : `manifest.webmanifest`, icônes, service worker minimal (app-shell uniquement : jamais de mise en cache de `/api/`, réponse `503 {error:"Hors ligne"}` directe hors connexion ; cache purgé à la déconnexion), `theme_color` GMBS. Design : mobile d'abord (360-430 px), couleurs et logo du CRM (`app/globals.css`, `public/gmbs-logo.svg`, `public/logoGM.png`), cibles tactiles ≥ 44 px, français.

## 7. Temps réel (dans les deux sens)

### 7.1 Portail → CRM : ce que l'artisan envoie apparaît sans rechargement

Migration `99077_portal_realtime.sql` : `intervention_attachments`, `artisan_reports` et `artisan_attachments` sont ajoutées à la publication `supabase_realtime` (ajout conditionnel, donc rejouable et applicable en production) avec `REPLICA IDENTITY FULL` — sans quoi les événements `DELETE` ne portent ni `intervention_id` ni `artisan_id`. La RLS de `intervention_attachments` est laissée **telle quelle** (désactivée) : vérifié, les événements sont bien délivrés à un utilisateur `authenticated`, et l'activer sans policy suffisante verrouillerait le CRM (mémoire projet).

Côté CRM, `src/hooks/usePortalLiveSync.ts` (monté une fois par `src/components/layout/PortalLiveSync.tsx` dans `app/layout.tsx`) ouvre le canal `portail-live` **sur une connexion Supabase dédiée** : `supabase-js` partage une seule socket entre tous les canaux d'un client, et le canal central `crm-sync` la referme quand il se rabat sur du sondage — une socket isolée garantit que les photos et les rapports arrivent quand même. Le canal se réabonne seul (2, 5, 10 puis 30 s) et porte le jeton de l'utilisateur (`realtime.setAuth`).

| Événement reçu | Condition | Effet |
|---|---|---|
| `intervention_attachments` | `metadata.source = 'portal'` | invalide `interventionKeys.portalReport(id)`, `documentKeys.byEntity('intervention', id)`, `interventionKeys.detail(id)`, les listes ; annonce « Nouvelle photo de l'artisan » |
| `artisan_reports` | toujours | mêmes invalidations ; annonce « Rapport reçu de l'artisan » au passage à `submitted` |
| `artisan_attachments` | `metadata.source = 'portal'` | invalide `documentKeys.byEntity('artisan', id)` et `artisanKeys.detail(id)` ; annonce « Pièce reçue de l'artisan » |

Les événements reçus à moins de 600 ms d'intervalle sont regroupés en une seule annonce. `usePortalReportQuery` passe à `staleTime: 0` puisque le canal l'invalide.

Le badge « À vérifier » remontait déjà seul : il vient de `interventions.has_portal_report`, posé par un trigger, et `interventions` est publiée depuis longtemps.

### 7.2 CRM → portail : les décisions du gestionnaire arrivent sur le téléphone

Le portail n'a pas de base de données : c'est le CRM qui pousse, par un flux SSE.

| Méthode et chemin | Rôle |
|---|---|
| `GET /api/portal-external/me/stream` (CRM) | flux `text/event-stream` authentifié comme les autres routes (clé/secret + `X-Portal-Token`). Le CRM s'abonne côté serveur au temps réel de sa base (clé service role) et n'émet que des événements minimaux, sans donnée de tiers : `ready`, `report` `{intervention_id, status, version, review_comment}`, `document` `{kind, review_status}`, `intervention` `{intervention_id, statut_id, date_prevue, has_portal_report}`, `assignment` `{intervention_id, action}`, plus `ping` toutes les 25 s. Fermeture propre sur déconnexion du client, durée de vie plafonnée à 30 min (le client se reconnecte). Les interventions visibles sont tenues en mémoire et rechargées à chaque changement d'affectation, le filtre serveur ne sachant pas suivre une jointure. |
| `GET /api/portal/stream` (portail) | relaie le flux tel quel, sans mise en tampon, en ajoutant les en-têtes d'authentification (jamais exposés au navigateur) ; `401` → cookie `portal_token` effacé ; `503` sans configuration ; flux factice en mode `PORTAL_MOCK=1`. |

Côté application, `src/lib/live-updates.tsx` (`LiveUpdatesProvider`, monté dans `src/app/app/layout.tsx`) ouvre un `EventSource`, se reconnecte avec un repli plafonné à 30 s, se ferme quand l'onglet passe en arrière-plan et se rouvre au retour. Chaque événement incrémente une « révision » globale que `usePortalQuery` surveille : tous les écrans rechargent leurs données. L'artisan voit donc « Rapport validé » et le commentaire du gestionnaire sans rien rafraîchir.

---

## 8. Vision v2 — socle et routes ajoutées

> Section ouverte par le **lot L0** (2026-09-05). Spécification : [portail-vision-spec.md](portail-vision-spec.md) · Plan de lots : [portail-vision-plan-lots.md](../guides/portail-vision-plan-lots.md).
> **Règle de coexistence** : ce fichier est partagé entre les trois équipes. Un lot **ajoute un bloc de lignes** au tableau §8.2, il ne réécrit jamais le fichier ni les lignes d'un autre lot.

### 8.1 Socle base de données (lot L0)

Deux migrations, jouées **uniquement en local** pendant toute la réalisation (`psql -v ON_ERROR_STOP=1 -f`, puis `supabase db reset`) ; l'application en production relève du plan de bascule.

| Migration | Ce qu'elle pose | Ce dont dépendent les lots suivants |
|---|---|---|
| `99078_portal_v2_socle.sql` | `artisan_reports` : `version` NOT NULL, état `superseded`, `superseded_at`/`superseded_by`, `started_at`, index unique partiel `ux_artisan_reports_one_open` · `intervention_artisans` : `price_response`, `price_responded_at`, `price_accepted_amount`, `price_refused_reason`, `price_response_source`, `price_response_by`, `work_started_at`, `work_started_from`, `work_started_by`, `payment_status`, `paid_at`, `payment_updated_by`, `payment_updated_at` · **RLS + policies `authenticated` + `REVOKE ALL FROM anon` sur `intervention_artisans`** · `artisan_attachments` : `reviewed_by`, `reviewed_at`, `review_comment` · `artisans` : `pieces_a_verifier`, `dossier_validated_at`, `dossier_validated_by` · `calculate_artisan_dossier_status` corrigée · `fn_artisan_dossier_sync` / `trg_artisan_dossier_sync` en remplacement des deux triggers de `00008` | L1 (prix, démarrage), L2 (N rapports), L3 (versions et supersession), L5 (vérification des pièces), L6 (paiement) |
| `99079_artisan_portal_actions.sql` | Journal append-only `artisan_portal_actions` (acteur, `source`, `action_type` sous CHECK fermé, `payload`, `occurred_at`/`recorded_at`, `event_uid`). Lecture seule pour `authenticated`, écriture `service_role`. **Aucun trigger, aucune publication temps réel.** | L1 (helper `recordArtisanAction`), L6 (`GET /api/artisans/{id}/timeline`) |

Conséquences pour toutes les routes portail à venir :

- **Enveloppe d'idempotence obligatoire** sur toute écriture portail : `{ event_uid, occurred_at? }`. Un `event_uid` déjà connu renvoie `200` avec le résultat déjà enregistré, **jamais** `409`. `occurred_at` est borné à `[now − 7 j, now + 5 min]` ; hors bornes, la valeur brute part dans `payload.occurred_at_declared`, `occurred_at` s'aligne sur `recorded_at` et `payload.clock_skew` passe à `true`. Un fait n'est jamais rejeté pour une horloge fausse.
- **`intervention_artisans` n'est plus lisible avec la clé anon.** Toute route serveur doit utiliser `createServerSupabaseAdmin` **avec** `SUPABASE_SERVICE_ROLE_KEY` renseignée : sans elle, le client retombe silencieusement sur la clé anon (`src/lib/supabase/server.ts`) et la lecture échouerait désormais au lieu de dégrader.
- **`payment_status` et les libellés de paiement se calculent côté CRM** (principe P1) : le portail affiche ce qu'il reçoit, il ne rejoue aucune règle.
- Le CRM ne doit **jamais** dériver le paiement d'un artisan de `intervention_payments.is_received` : c'est un encaissement *client*, et `acompte_sst` n'a pas d'`artisan_order`.

Tests de non-régression livrés avec le socle (base **locale** ; ils se désactivent d'eux-mêmes si elle est arrêtée) : `tests/integration/migrations/99078-socle.test.ts` et `tests/integration/security/anon-access.test.ts`.

### 8.2 Routes ajoutées par la vision v2

| Lot | Méthode et chemin | Corps → réponse |
|---|---|---|
| L0 | *(aucune route : socle base de données uniquement)* | — |
