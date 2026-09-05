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

Quatre migrations (99078, 99079, puis les deux correctifs de revue 99081 et 99082), jouées **uniquement en local** pendant toute la réalisation (`psql -v ON_ERROR_STOP=1 -f`, puis `supabase db reset`) ; l'application en production relève du plan de bascule.

| Migration | Ce qu'elle pose | Ce dont dépendent les lots suivants |
|---|---|---|
| `99078_portal_v2_socle.sql` | `artisan_reports` : `version` NOT NULL, état `superseded`, `superseded_at`/`superseded_by`, `started_at`, index unique partiel `ux_artisan_reports_one_open` · `intervention_artisans` : `price_response`, `price_responded_at`, `price_accepted_amount`, `price_refused_reason`, `price_response_source`, `price_response_by`, `work_started_at`, `work_started_from`, `work_started_by`, `payment_status`, `paid_at`, `payment_updated_by`, `payment_updated_at` · **RLS + policies `authenticated` + `REVOKE ALL FROM anon` sur `intervention_artisans`** · `artisan_attachments` : `reviewed_by`, `reviewed_at`, `review_comment` · `artisans` : `pieces_a_verifier`, `dossier_validated_at`, `dossier_validated_by` · `calculate_artisan_dossier_status` corrigée · `fn_artisan_dossier_sync` / `trg_artisan_dossier_sync` en remplacement des deux triggers de `00008` | L1 (prix, démarrage), L2 (N rapports), L3 (versions et supersession), L5 (vérification des pièces), L6 (paiement) |
| `99079_artisan_portal_actions.sql` | Journal append-only `artisan_portal_actions` (acteur, `source`, `action_type` sous CHECK fermé, `payload`, `occurred_at`/`recorded_at`, `event_uid`). Lecture seule pour `authenticated`, écriture `service_role`. **Aucun trigger, aucune publication temps réel.** | L1 (helper `recordArtisanAction`), L6 (`GET /api/artisans/{id}/timeline`) |
| `99081_actor_resolution_lecture_seule.sql` | `get_current_user_id()` ne fait plus d'`UPDATE` (elle est `STABLE`) et le mapping `users.auth_user_id` est rattrapé. Sans ça, **toute écriture d'un client authentifié** sur `intervention_artisans` échoue en `0A000` « UPDATE is not allowed in a non-volatile function » via la chaîne d'audit. | L1 (prix, démarrage), L5 (dépôt de pièce), L6 (paiement) — tout ce qui écrit sous session gestionnaire |
| `99082_rls_tables_enfant_intervention.sql` | RLS + policies `authenticated` + `REVOKE ALL FROM anon` sur `intervention_costs` et `intervention_attachments` (le `REVOKE` de 99078 ne déplaçait la fuite que d'une table : `intervention_costs.amount` **est** la valeur que `price_accepted_amount` recopie). Plus : `ALTER DEFAULT PRIVILEGES … REVOKE ALL ON TABLES FROM anon` pour que les tables futures ne repartent plus grantées. | tous les lots : une table créée après cette migration n'est plus lisible par `anon` |

Conséquences pour toutes les routes portail à venir :

- **Enveloppe d'idempotence obligatoire** sur toute écriture portail : `{ event_uid, occurred_at? }`. Un `event_uid` déjà connu renvoie `200` avec le résultat déjà enregistré, **jamais** `409`. `occurred_at` est borné à `[now − 7 j, now + 5 min]` ; hors bornes, la valeur brute part dans `payload.occurred_at_declared`, `occurred_at` s'aligne sur `recorded_at` et `payload.clock_skew` passe à `true`. Un fait n'est jamais rejeté pour une horloge fausse.
- **`intervention_artisans` n'est plus lisible avec la clé anon.** Toute route serveur doit utiliser `createServerSupabaseAdmin` **avec** `SUPABASE_SERVICE_ROLE_KEY` renseignée : sans elle, `createServerSupabaseAdmin` **lève une erreur explicite** depuis la revue du socle (`src/lib/supabase/server.ts`) — auparavant il retombait silencieusement sur la clé anon, ce qui ne dégradait plus mais cassait la route en production.
- **`payment_status` et les libellés de paiement se calculent côté CRM** (principe P1) : le portail affiche ce qu'il reçoit, il ne rejoue aucune règle.
- Le CRM ne doit **jamais** dériver le paiement d'un artisan de `intervention_payments.is_received` : c'est un encaissement *client*, et `acompte_sst` n'a pas d'`artisan_order`.

Règles d'écriture imposées par le socle (revue du 2026-09-05) — à respecter dans **toutes** les routes des lots suivants :

- **Supersession d'un rapport, ordre obligatoire dans UNE seule transaction** : `UPDATE artisan_reports SET status='superseded', superseded_at=now() WHERE id=<v(n)>` → `INSERT` de la version n+1 en `submitted` → `UPDATE … SET superseded_by=<v(n+1)> WHERE id=<v(n)>`. L'index `ux_artisan_reports_one_open` n'est pas *deferrable* : insérer la v(n+1) avant de superseder la v(n) lève `23505`, et `superseded_by` est une clé étrangère vérifiée immédiatement, donc elle ne peut être posée qu'après l'insertion.
- **Idempotence : le lookup est `(artisan_id, event_uid)`**, jamais `event_uid` seul. La clé est générée par le téléphone : globalement unique, deux appareils produisant la même chaîne se bloqueraient, et le `200` de rejeu rendrait la trace d'un artisan à un autre.
- **`occurred_at` est borné EN BASE** à `[recorded_at − 7 j, recorded_at + 5 min]` : les routes recalent la valeur **avant** l'insertion (`payload.occurred_at_declared` + `payload.clock_skew`), la contrainte n'est qu'un filet. Un fait n'est jamais rejeté pour une horloge fausse.
- **Une action `source='crm'` doit porter son acteur** : `actor_user_id` renseigné **ou** `payload.actor` (e-mail ou nom). C'est une contrainte `CHECK`, pas une convention — et c'est ce qui fait survivre l'attribution à la suppression du compte (`actor_user_id` est `ON DELETE SET NULL`).
- **Le journal est append-only, garanti par trigger** : le seul `UPDATE` toléré est la neutralisation d'une clé étrangère par `ON DELETE SET NULL`. Toute autre modification lève `42501`. Les routes **dénormalisent** dans `payload` la référence lisible de l'intervention (`id`, `id_inter`, adresse), car `intervention_id` passe à `NULL` quand l'intervention est supprimée.
- **`SUPABASE_SERVICE_ROLE_KEY` est désormais obligatoire** : `createServerSupabaseAdmin` **lève** au lieu de retomber sur la clé anon (le repli ne dégradait plus, il produisait un `permission denied` à chaque requête).
- **`USING (true)` sur `intervention_artisans`** : tout compte authentifié lit et modifie `price_accepted_amount`, `payment_status` et `paid_at`. C'est cohérent avec `artisans` et `interventions`, mais ces colonnes-là sont financières et nouvelles : au **lot L6**, restreindre leur `UPDATE` par une policy adossée au rôle (`has_permission`) ou n'autoriser leur écriture que par `service_role` via une route serveur.

Tests de non-régression livrés avec le socle (base **locale** ; ils se désactivent d'eux-mêmes si elle est arrêtée) : `tests/integration/migrations/99078-socle.test.ts` et `tests/integration/security/anon-access.test.ts`.

### 8.2 Routes ajoutées par la vision v2

| Lot | Méthode et chemin | Corps → réponse |
|---|---|---|
| L0 | *(aucune route : socle base de données uniquement)* | — |
| L1 | `GET /api/portal-external/me/interventions` **(élargie)** | Chaque élément gagne `groupe` (`a_accepter｜en_cours｜terminee`), `price:{response, responded_at, accepted_amount, amount, can_accept, refused_reason}`, `work:{started_at, can_start}` et `payment:{state, label, tone, amount, paid_at}｜null` (présent **seulement** en `INTER_TERMINEE`, montant = **son** `cout_sst`, libellé calculé côté CRM). Statuts visibles : `DEVIS_ENVOYE` (uniquement si un coût SST est posé pour cet artisan), `ACCEPTE`, `INTER_EN_COURS`, `SAV`, `INTER_TERMINEE`, plus `STAND_BY` (groupe `en_cours`) et `REFUSE`/`ANNULE` pendant 7 jours après la transition (groupe `terminee`). `tenant` reste `null` hors `ACCEPTE`/`INTER_EN_COURS`/`SAV` — **jamais** en `DEVIS_ENVOYE`. |
| L1 | `GET /api/portal-external/me/interventions/{id}` **(élargie)** | Mêmes champs ; `404` uniforme si la mission n'est pas visible pour cet artisan (y compris `DEVIS_ENVOYE` sans coût SST et abandon de plus de 7 jours). |
| L1 | `GET /api/portal-external/me` **(compteurs recalés)** | `counters:{missions_total, missions_a_accepter, missions_en_cours, missions_terminees}` — comptés par **groupe**, plus par liste de statuts. `missions_en_cours` inclut donc `STAND_BY`, `missions_terminees` inclut les abandons encore visibles. |
| L1 | `POST /api/portal-external/me/interventions/{id}/price` **(nouvelle)** | `{event_uid, occurred_at?, response:'accepted'｜'refused', amount_seen, reason?}` → `200 {price:{response, responded_at, accepted_amount, refused_reason, source}}`. Écrit `price_response`, `price_responded_at`, `price_accepted_amount` (**montant gelé**, `null` sur un refus), `price_refused_reason`, `price_response_source='portal'`, plus une ligne `artisan_portal_actions` (`PRICE_ACCEPTED`｜`PRICE_REFUSED`). Un refus ouvre un reminder `💶 Prix` pour le gestionnaire assigné (« à proposer à un autre artisan »). Erreurs : `400` enveloppe ou corps invalide · `404` non affecté · `409 status_not_allowed` hors `DEVIS_ENVOYE` · `409 price_unavailable` sans coût SST · `409 price_changed` avec `current_amount` si `amount_seen` ≠ coût courant · `409 price_already_answered` (§7.3 : l'artisan ne reprend jamais sa réponse). Rejeu du même `(artisan, event_uid)` → `200 {price, replayed:true}`. **Ne change jamais le statut de l'intervention.** |
| L1 | `POST /api/portal-external/me/interventions/{id}/start` **(nouvelle)** | `{event_uid, occurred_at?}` → `200 {work:{started_at, from}, statut_code, status_advanced, missing_fields:[{key, label}]}`. **Règle P3** : `work_started_at`, `work_started_from='portal'` et la ligne `WORK_STARTED` du journal sont écrits **toujours** ; la bascule `ACCEPTE → INTER_EN_COURS` n'est qu'une tentative — son échec se lit dans `status_advanced:false` et `missing_fields`, jamais dans un code d'erreur. `date_prevue` n'est posée à J+7 que si elle est absente (jamais écrasée). Erreurs : `409 status_not_allowed` hors `ACCEPTE` · `409 price_not_accepted` · `404` non affecté. Idempotent **par le fait** : un second appel, même avec une autre clé, renvoie la date déjà posée. |
| L1 | `PATCH /api/interventions/{id}/artisans/{artisanId}/price` **(nouvelle, `write_interventions`)** | Repli gestionnaire « accepté / refusé par téléphone » : `{response, amount, reason?}` → `200 {price:{…, source:'crm'}}`. Mêmes gardes et même verrou optimiste que la route portail, à deux différences : la réécriture d'une réponse déjà donnée est **autorisée** (Q5) et `price_response_by` porte le gestionnaire. Journal `source='crm'`, `actor_user_id` **et** `payload.actor` (identité immuable : la clé étrangère est `ON DELETE SET NULL`). |
| L1 | `PATCH /api/interventions/{id}/artisans/{artisanId}/start` **(nouvelle, `write_interventions`)** | Repli gestionnaire « chantier démarré » : `{started_at?}` → `200 {work:{started_at, from:'crm'}, statut_code, status_advanced, missing_fields}`. `started_at` absent = maintenant. Le gestionnaire est le seul à pouvoir **antidater** : le fait garde sa date, la trace au journal reste bornée à `[recorded_at − 7 j, recorded_at + 5 min]` avec la valeur brute dans `payload.occurred_at_declared`. |
| L1 | `GET /api/portal-external/me/stream` **(événements nommés)** | Les écritures sur `intervention_artisans` n'arrivent plus sous un seul `assignment` : `price {intervention_id, response, responded_at, accepted_amount}`, `work {intervention_id, started_at}`, `payment {intervention_id, state, paid_at}`. `assignment {intervention_id, action:'added'｜'removed'｜'updated'}` reste émis sur un `INSERT`/`DELETE` (la liste visible change, elle est rechargée) et en repli quand une colonne non couverte bouge. |
| L2 | `GET /api/interventions/{id}/portal-report` **(élargie, rétro-compatible)** | → `{report, photos, artisan, reports[], photosByReport{}, assignments[]}`. `report` / `photos` / `artisan` **inchangés** (`report` = `pickPortalReport`). `reports[]` = tous les rapports de l'intervention, tous artisans et toutes versions, chacun avec `started_at`, `superseded_at`, `superseded_by`, `artisan:{id, nom, prenom}` et `artisan_id` ; ordre : rapport `submitted` en tête, puis `submitted_at` décroissant, la version la plus haute départageant. `photosByReport` = `{reportId: [attachmentId…]}` bâti sur `attachment_ids` filtré par les photos existantes, les orphelines sous la clé `_hors_rapport`. `assignments[]` = un élément par ligne `intervention_artisans` (principal d'abord) : `{artisan, artisan_id, is_primary, cout_sst (résolu par artisan_order), price:{response, responded_at, accepted_amount, source, refused_reason, drift}, work:{started_at, from}, payment:{state, paid_at}, report_ids[]}` ; `drift` vaut `true` quand `price_accepted_amount` diffère du `cout_sst` courant. Permission `read_interventions`. |
| L2 | `POST /api/interventions/{id}/portal-report/review` **(modifiée)** | `{decision, comment?, report_id?, reopen_intervention?}` → `200 {report, intervention:{statut_code}}`. `report_id` vise explicitement un rapport — indispensable dès qu'une intervention en porte plusieurs ; sans lui, sélection historique (`pickPortalReport`). `409` si le `report_id` n'appartient pas à l'intervention, `409` si le rapport n'est pas `submitted`. **`comment` obligatoire au refus** : `400` sans motif. `reopen_intervention:true` ramène une intervention `INTER_TERMINEE` en `INTER_EN_COURS` (transition journalisée par le trigger de `00010`) ; sans effet depuis tout autre statut. Reminder, commentaire système et non-modification du statut : inchangés. Permission `write_interventions`. |
| L7 | `POST /api/interventions/{id}/send-email` **(modifiée)** | `{type:'devis'\|'intervention', artisanId, artisanEmail?, subject, htmlContent, attachmentIds?:[uuid]}` → `200 {success, data:{messageId, accepted[], rejected[], logId, attachmentIds[]}}`. **Le corps ne transporte plus aucun contenu de fichier** : `attachments[{filename, contentType, content(base64)}]` est remplacé par `attachmentIds`, des identifiants de lignes `intervention_attachments` de **cette** intervention ; le serveur lit les octets dans le bucket `documents` (`storage.download`, repli `fetch` pour une pièce hébergée hors bucket). Conséquence : le plafond Vercel de ~3,2 Mo disparaît, un PDF de 8 Mo passe ; plafond restant **20 Mo cumulés** (marge sous les 25 Mo de Gmail après encodage MIME) et **5 pièces**. Erreurs : `404` pour une pièce qui n'appartient pas à l'intervention, `400` pour une nature interdite (`facturesGMBS`, jamais envoyée à un sous-traitant) ou plus de 5 pièces, `413` au-delà du plafond cumulé, `502` si un fichier est introuvable dans le stockage — dans tous ces cas **l'e-mail n'est pas envoyé**. Effets : `email_logs.attachment_ids` = la liste exacte des pièces de cet envoi ; après un envoi réussi, `intervention_attachments.sent_to_artisan_at` / `sent_to_artisan_email_log_id` sont posées **sur les seules pièces jamais envoyées**. Permission : session gestionnaire (inchangée). Gabarits d'e-mail et comportement d'envoi inchangés par ailleurs. |
| L4 | `POST /api/portal-external/me/profile-photo` **(nouvelle)** | `{event_uid, filename, mime_type, content_base64}` → `201 {avatar:{url, sizes:{40,80,160}}}` ; `{event_uid, mode:'initials'}` → `200 {avatar:null}` (la photo est supprimée, le repli déterministe des initiales reprend). Enveloppe d'idempotence : un `event_uid` déjà connu renvoie `200` avec l'avatar déjà enregistré, **jamais `409`**. `415` hors `image/jpeg｜png｜webp`, `413` au-delà de 4 Mo de base64. **Une seule ligne `photo_profil`** après deux envois, et **jamais `review_status='pending'`** : une photo de profil n'est pas une pièce du dossier, elle ne doit pas créer de tâche fantôme au gestionnaire. Côté portail : proxy `POST /api/portal/me/profile-photo` et doublure complète dans `src/lib/mock/api.ts`. |
| L4 | `GET /api/portal-external/me` **(champs consommés par le portail)** | Le portail lit `documents:{present, required, pending, rejected}`, `avatar` et `dossier_validated_at`. `pending`, `rejected`, `avatar` et `dossier_validated_at` sont **facultatifs** dans les types du portail : tant que le CRM ne les envoie pas, la pastille du bouton Profil ne s'allume que sur `present < required` et la phrase « Dossier complet validé le … » reste masquée. `present` compte les pièces **déposées** (l'écran distingue « 5 / 5 déposées » et « 3 validées · 2 en vérification »). |
| L4 | `GET /api/portal-external/me/interventions` **(champ consommé)** | Le portail range chaque mission dans un onglet d'après `groupe` (`a_accepter｜en_cours｜terminee`). Repli local sur `statut_code` tant que la projection n'est pas déployée, avec la règle §7.6 : `STAND_BY` dans « En cours » (bandeau « Mission en pause »), `REFUSE` / `ANNULE` dans « Terminées » (mention « Annulée »). `payment.label` est affiché **tel quel** : le portail n'invente ni état ni libellé de paiement. |
| L5 | `POST /api/artisans/{id}/documents/{attachmentId}/review` **(nouvelle)** | `{decision:'approved'｜'rejected', comment?, valid_until?}` → `200 {document:{id, artisan_id, kind, filename, url, mime_type, file_size, created_at, review_status, reviewed_at, review_comment, metadata}, artisan:{statut_dossier, pieces_a_verifier, dossier_validated_at}}`. Permission **`write_artisans`**, écriture par `createServerSupabaseAdmin`. **`comment` obligatoire au refus** : `400 {error:"Un motif est obligatoire pour refuser une pièce"}` — sans motif l'artisan redépose la même pièce. `404` uniforme (« Pièce introuvable ») si la pièce n'appartient pas à l'artisan de l'URL, ou si l'un des deux identifiants n'est pas un UUID (sinon Postgres répondrait `22P02` et la route rendrait un `500`). `valid_until` = date `AAAA-MM-JJ` existante, rangée dans `metadata.valid_until` **sans perdre `metadata.source`** ; format invalide ⇒ `400`. **La route n'écrit ni `statut_dossier`, ni `pieces_a_verifier`, ni `dossier_validated_at`** : `trg_artisan_dossier_sync` (99078) en est le seul écrivain, on les relit après coup. Journal : `DOCUMENT_APPROVED` / `DOCUMENT_REJECTED`, `source='crm'`, `actor_user_id` + `payload.actor`. **Pourquoi une route Next et pas l'Edge Function `documents`** : son `PUT` n'accepte que `kind / filename / mime_type / file_size / created_by*`, il est impossible d'y écrire `review_status` — et la garde ne peut pas venir de la base, `99057` donnant à `authenticated` un `UPDATE USING(true)` complet sur `artisan_attachments`. |
| L5 | `POST /api/artisans/{id}/dossier/validate` **(nouvelle)** | *(sans corps)* → `200 {artisan:{statut_dossier, pieces_a_verifier, dossier_validated_at, dossier_validated_by}}`. Permission `write_artisans`. Pose **`dossier_validated_by`** — le gestionnaire qui endosse le dossier — et **rien d'autre** : `dossier_validated_at` reste l'affaire du trigger. `409` tant que `statut_dossier <> 'COMPLET'` : valider un dossier auquel il manque une pièce validée rendrait le badge menteur, ce que corrige justement `calculate_artisan_dossier_status`. `404` pour un artisan inconnu. |
| L5 | `POST /api/portal-external/me/profile-photo` **(implémentation CRM)** | Moitié CRM du contrat déclaré par L4 ci-dessus. Précisions livrées : **idempotence P5 réelle** — un `event_uid` déjà présent dans `artisan_portal_actions` pour **ce** couple `(artisan_id, event_uid)` renvoie `200` avec l'avatar déjà enregistré, **sans redéposer le fichier ni supprimer la photo en place** (un rejeu ne doit jamais effacer ce qu'il vient de poser). La ligne est insérée **sans `review_status`** : le DEFAULT `'approved'` garde l'avatar hors du compteur « pièces à vérifier », et `photo_profil` n'étant pas une pièce requise, `statut_dossier` n'en dépend pas. L'ancienne `photo_profil` est supprimée **avant** l'insertion (une seule ligne par artisan). `process-avatar` est **attendu** (`await`), puis la ligne est relue pour renvoyer `derived_sizes` ; son échec n'est **pas** fatal — réponse `201` avec `sizes:{}` et `Avatar.tsx` retombe sur l'URL de base. Journal : `AVATAR_CHANGED`, `source='portal'`, acteur = « Prénom Nom (artisan) ». |
| L5 | Edge Function `documents` — `GET ?entity_type=artisan` **(select élargi)** | Ajout de `review_status`, `reviewed_at`, `review_comment` et `metadata` au `select` de la branche `artisan_attachments`, et des mêmes champs à `AttachmentRecord` (`src/components/documents/types.ts`). Sans eux la fiche artisan ne peut ni afficher l'état d'une pièce, ni son motif de refus, ni sa date de validité. Branche `intervention_attachments` **inchangée**. |
| L5 | Temps réel `portail-live` **(invalidation ajoutée)** | `usePortalLiveSync` invalide désormais `artisanKeys.lists()` en plus de `artisanKeys.detail(id)` et `documentKeys.byEntity('artisan', id)` sur tout événement `artisan_attachments` venu du portail. Sans elle, la pastille « n à vérifier » de la colonne Dossier et le compteur de la puce ne bougeaient qu'au rechargement de la page Artisans — le critère de recette du lot l'interdit. |

### 8.4 Lot L4 — navigation, profil et dossier déplacé (portail)

Aucune migration. Dépôt `portal_gmbs`, branche `vision-deposedocs`.

| Sujet | Contrat côté portail |
|---|---|
| Navigation | **Une seule route pour les trois onglets** : `/app/missions?vue=attente｜encours｜terminees`. `usePortalQuery` n'a ni cache ni déduplication et son effet dépend de `[path, tick, revision]` — trois routes distinctes tripleraient les appels au CRM à chaque bascule **et** à chaque événement SSE. Le filtrage se fait en mémoire (`src/lib/mission-views.ts`), prouvé par un test qui compte les chargements. Sans `?vue=`, la vue « En cours » s'affiche (URL précachée par le service worker). |
| Écrans déplacés | `/app/dossier` → `/app/profil/dossier`, `/app/dossier/decharge` → `/app/profil/dossier/decharge`, `/app/compte` → `/app/profil/compte`. Les trois anciennes adresses **redirigent en `307`** : une app déjà installée sur un écran d'accueil ne tombe pas sur un 404. `VERSION` du service worker passée à `gmbs-artisans-v3` et `/app/profil` ajouté au précache — sans cela l'artisan garde l'ancienne coquille de navigation. |
| Bouton Profil | Slot `action` du `PageHeader`, en haut à droite de la liste des missions. Avatar (dérivée 40 px) ou initiales, avec une **pastille** si `documents.pending > 0 ｜｜ documents.rejected > 0 ｜｜ documents.present < documents.required`. |
| Dossier | Motif de refus affiché **en entier** sous une pièce `rejected` (`review_comment`), date de vérification sous une pièce `approved` (`reviewed_at`), bandeau « Dossier complet validé le … » quand `dossier_validated_at` est renseignée. Ces trois champs sont facultatifs côté portail ; le portail n'en déduit aucun de son côté. |
| Avatar | Feuille du bas à trois entrées — appareil photo (`capture="environment"`), galerie (c'est par là que passe le logo d'entreprise), initiales. `compressImage()` re-encode en JPEG côté canvas (640 px, puis 400 px si nécessaire) : **c'est ce qui règle le HEIC/HEIF de l'iPhone**, refusé par la liste MIME fermée du CRM et par le sniff d'octets magiques. Affichage en `<img>` : le `next.config.ts` du portail n'a aucun bloc `images`, donc aucun domaine distant n'est autorisé. |
| Couleur `DEVIS_ENVOYE` | Ajoutée **aux deux endroits** : jeton `--color-status-quoted` de `globals.css` et `STATUS_STYLES` de `src/lib/status.ts`. Déclinaison lisible du `#8B5CF6` du CRM (`hsl(258 74% 50%)` sur `hsl(258 90% 97%)`), **identique dans les deux fichiers** — en oublier un produit l'incohérence silencieuse déjà connue côté CRM. |

**Outillage de test du portail** (livré avec ce lot) : jsdom + Testing Library. Les tests de composants vivent dans `portal_gmbs/tests/unit/components/` et portent l'en-tête `// @vitest-environment jsdom` ; les tests de contrat restent en environnement `node`. Doublures communes dans `tests/helpers/` : `next-doubles.tsx` (`next/link`, `next/navigation`) et `portal-api.tsx`, qui compte les chargements de `usePortalQuery`.

Tests livrés : `portal_gmbs/tests/unit/lib/mission-views.test.ts`, `tests/unit/lib/dossier.test.ts`, `tests/unit/components/tab-bar.test.tsx`, `tests/unit/components/missions-screen.test.tsx`, `tests/unit/components/profil-screen.test.tsx`, `tests/unit/components/dossier-screen.test.tsx`, `tests/unit/mock/profil-vision.test.ts`.

**Ce que L4 ne fait pas** : l'implémentation CRM de `POST /me/profile-photo` (Edge Function `documents` + `await` sur `process-avatar`) et les compteurs `pending` / `rejected` de `GET /me` relèvent de la moitié CRM du même lot ; l'écran « Mes documents » du profil (`GET /me/library`) et les totaux mensuels de l'onglet « Terminées » relèvent de **L6** ; l'acceptation du prix et le démarrage du chantier depuis l'écran mission relèvent de **L1**.

### 8.3 Lot L7 — marque d'envoi exposable par l'API portail

Migration `supabase/migrations/99083_email_attachments_intervention.sql` (idempotente, appliquée en local uniquement).

| Colonne | Sens | Ce que le portail peut en faire |
|---|---|---|
| `intervention_attachments.sent_to_artisan_at` | date du **premier** envoi de cette pièce à un artisan par la modale e-mail ; `NULL` = jamais envoyée. Jamais réécrite par un renvoi (le filtre d'écriture est `… AND sent_to_artisan_at IS NULL`, ce qui borne aussi le WAL d'une table en `REPLICA IDENTITY FULL`) | filtrer `documents.devis[]` et `GET /me/library` sur « ce que l'e-mail a réellement envoyé », et afficher « reçue le … » à côté de la pièce |
| `intervention_attachments.sent_to_artisan_email_log_id` | `email_logs.id` de cet envoi, `ON DELETE SET NULL` — supprimer un journal d'e-mail ne supprime jamais la pièce ni sa date | remonter au sujet et à la date de l'e-mail dans le CRM ; **jamais exposé au portail** (données de gestion) |
| `email_logs.attachment_ids uuid[]` | la liste **exacte** des pièces de chaque envoi, là où `attachments_count` ne disait que « 3 pièces » | audit et historique d'envoi côté CRM |

**Ce que L7 ne fait pas** : la projection de ces champs dans `GET /me/interventions/{id}` et `GET /me/library` appartient à `src/lib/portal-external/interventions.ts` (équipes L1 / L6). L7 garantit seulement que la donnée existe, est juste, et n'est écrite qu'une fois par pièce.

**Nature de pièce et cohérence mail / application** : le sélecteur de la modale et la route refusent `facturesGMBS` — c'est la facture de GMBS à son client, que l'API portail exclut déjà de `documents`. Sans ce refus, l'e-mail et l'application diraient deux choses différentes, ce que ce lot supprime précisément. Un fichier ajouté depuis le disque est **d'abord déposé comme pièce de l'intervention** (même chemin que l'onglet Documents, nature choisie dans la modale, `devis` par défaut pour un e-mail de devis) puis coché comme les autres.

Tests livrés : `tests/unit/lib/interventions/email-attachments.test.ts`, `tests/unit/lib/services/email-attachment-loader.test.ts`, `tests/unit/api/interventions/send-email.test.ts`, `tests/unit/components/interventions/EmailEditModal.test.tsx`, `tests/integration/migrations/99083-email-attachments.test.ts`.

### 8.5 Lot L1 — visibilité, prix, démarrage (CRM)

Aucune migration : tout est posé par le socle L0 (le numéro `99080` réservé au lot n'a pas été consommé).

| Sujet | Règle appliquée |
|---|---|
| Constantes de visibilité | `src/lib/portal-external/interventions.ts` expose **six listes littérales**, jamais des alias : `PORTAL_VISIBLE_STATUSES`, `PORTAL_TENANT_STATUSES`, `PORTAL_REPORT_STATUSES`, `PORTAL_ONGOING_STATUSES`, `PORTAL_PRICE_STATUSES` (`DEVIS_ENVOYE`), `PORTAL_START_STATUSES` (`ACCEPTE`), plus `PORTAL_PAUSED_STATUSES` et `PORTAL_CANCELLED_STATUSES` pour §7.6. Aucune n'est un seuil d'ordre : `sort_order` place `ACCEPTE` (2) **avant** `DEVIS_ENVOYE` (3). |
| Règle de visibilité | statut listé **et** (`statut ≠ 'DEVIS_ENVOYE'` **ou** coût SST posé pour cet artisan) **et**, pour un abandon, moins de 7 jours depuis la transition (lue dans `intervention_status_transitions`, pas sur `updated_at` que le moindre commentaire bouscule). `cout_sst = 0` (travaux offerts) reste une proposition valable ; seule l'**absence** de coût masque la mission. |
| Libellés de paiement | Module pur `src/lib/interventions/payment-status.ts` (`not_applicable` → rien, `awaiting_invoice` → « En attente de votre facture », `in_progress` → « Paiement en cours », `paid` → « Payé le JJ/MM », fuseau `Europe/Paris`). Un état inconnu retombe sur `not_applicable` : l'artisan ne voit rien plutôt qu'un libellé faux. |
| Enveloppe d'idempotence | `src/lib/portal-external/actions.ts`. Lookup sur **(artisan_id, event_uid)**. `occurred_at` recalé **avant** l'insertion, `payload.occurred_at_declared` + `payload.clock_skew` conservés. `recordArtisanAction` n'échoue jamais l'appelant : le fait métier est déjà écrit et ne doit pas être perdu parce que sa trace n'a pas pu l'être. |
| Écart assumé avec la spécification §7.7 | Elle demande d'appeler `transitionStatus`. Impossible en l'état : `assertBusinessRules` exige un `artisanId` pour `INTER_EN_COURS`, et le passer fait écrire `interventions.artisan_id` — **colonne inexistante** dans le schéma (PostgREST `PGRST204`, vérifié sur la base locale). On appelle donc `interventionsApi.update`, la fonction à laquelle `transitionStatus` délègue : mêmes triggers d'historisation, même recalcul des statuts artisans. |
| Champs manquants | `missing_fields` est dérivé de `VALIDATION_RULES` (règles d'entrée de `INTER_EN_COURS` **plus** celles de ses prédécesseurs sur la chaîne cumulative), jamais redéclaré — les redéclarer, c'est les voir diverger. |

**Ce que L1 ne fait pas** : les écrans du portail (bandeau prix, feuille de confirmation, refus en trois taps, bouton « Démarrer »), leurs proxys et la réplique des règles dans `portal_gmbs/src/lib/mock/api.ts` relèvent de la moitié portail du lot. Le badge CRM « Démarré · n champs manquants » relève de L2, la saisie du `payment_status` de L6.

Tests livrés : `tests/unit/lib/portal-external/interventions.test.ts` (visibilité, non-fuite du locataire, projections), `price.test.ts`, `start.test.ts`, `tests/unit/lib/interventions/payment-status.test.ts`, `tests/unit/api/interventions/artisan-price-fallback.test.ts`, `tests/unit/api/portal-external/stream-assignment-events.test.ts`.

### 8.5 Lot L5 — vérification des pièces (CRM)

Aucune migration : tout ce dont le lot a besoin est posé par `99078` (`artisan_attachments.reviewed_by / reviewed_at / review_comment`, `artisans.pieces_a_verifier / dossier_validated_at / dossier_validated_by`, `calculate_artisan_dossier_status` corrigée, `trg_artisan_dossier_sync`) et `99079` (journal). Le numéro `99081` initialement réservé à ce lot avait déjà été consommé par un correctif de revue du socle ; il n'a pas été nécessaire.

**Chaîne complète, vérifiée sur la base locale** : dépôt portail des 5 pièces (`pending`) ⇒ `pieces_a_verifier = 5`, `statut_dossier = INCOMPLET` → 4 validations ⇒ `1` / `À compléter` → 5ᵉ validation ⇒ `0` / `COMPLET` et `dossier_validated_at` posée → refus d'une pièce ⇒ retour à `À compléter` et **date effacée** → dépôt d'un `photo_profil` ⇒ **compteur inchangé**.

**Une seule couleur pour un seul geste** : la pastille violette de la colonne Dossier, la puce de filtre et le badge d'état d'une pièce `pending` partagent `#9333EA` (`PIECES_A_VERIFIER_COLOR`), celui du badge « À vérifier » des rapports.

**Ce que L5 ne fait pas** : le motif de refus affiché en entier et la phrase « Dossier complet validé le … » **côté portail** relèvent de **L4** (déjà livrés) ; l'événement SSE `document` filtré par `artisan_id` et sa doublure dans le SSE mock du portail restent à brancher (L8) ; l'onglet « Journal » du modal artisan et `GET /api/artisans/{id}/timeline` relèvent de **L6** — `recordArtisanDocumentAction` écrit déjà les lignes que cette route lira.

**Point d'environnement (démo locale)** : `process-avatar` ne démarre pas en local — `Module not found "https://esm.sh/sharp-wasm@0.31.0"` au boot du worker Deno. C'est antérieur à ce lot et cela concerne aussi l'envoi d'avatar par l'Edge Function `documents`. Conséquence pour la démo : `derived_sizes` reste vide et `Avatar.tsx` affiche l'URL de base — l'avatar apparaît bien dans le CRM, sans les dérivées 40/80/160.

### 8.6 Emplacement des symboles partagés du panneau « Rapport » (correctif build)

Le JSON de `GET /api/interventions/{id}/portal-report` est **inchangé** (§8.2, ligne L2) : `report`, `photos`, `artisan`, `reports[]`, `photosByReport{}` et `assignments[]` gardent exactement la même forme, clé `_hors_rapport` comprise. Seul l'endroit où vivent deux symboles change.

`app/api/interventions/[id]/portal-report/route.ts` exportait `PHOTOS_HORS_RAPPORT` et `sortPortalReports`. L'App Router de Next.js n'autorise dans un `route.ts` que les handlers HTTP et quelques constantes de configuration (`runtime`, `dynamic`, …) : tout autre export fait échouer `npm run typecheck` **et** `npm run build` (`TS2344 … is not assignable to type 'never'`). Les deux symboles sont donc désormais dans **`src/lib/interventions/portal-report-view.ts`**, module pur (ni React, ni accès base) :

| Symbole | Rôle | Consommateurs |
|---|---|---|
| `PHOTOS_HORS_RAPPORT` (`'_hors_rapport'`) | Clé de `photosByReport` regroupant les photos rattachées à aucune version | la route (production du JSON), `src/hooks/usePortalReport.ts` (qui la **ré-exporte**, l'import `@/hooks/usePortalReport` de `ReportsPanel.tsx` reste donc valable) |
| `sortPortalReports<T>()` | Ordre d'affichage : rapports `submitted` en tête, puis `submitted_at` décroissant, la version la plus haute départageant | la route ; disponible pour l'UI et les tests |

La constante n'a plus qu'**une seule définition** : elle était écrite deux fois (route + hook), deux valeurs libres de diverger de part et d'autre du même contrat.

Tests livrés : `tests/unit/lib/interventions/portal-report-view.test.ts` (ordre, départage par version, dates absentes ou illisibles, non-mutation de l'entrée, valeur de la clé). `tests/unit/api/interventions/portal-report-get.test.ts` continue de couvrir le JSON de bout en bout, inchangé.

### 8.7 Correctif de sécurité — pièces jointes de l'e-mail (SSRF)

**Bloc additif : il précise la ligne L7 de §8.2 sans en changer le contrat d'appel.** Le corps de
`POST /api/interventions/{id}/send-email`, ses champs de réponse, ses plafonds (5 pièces, 20 Mo
cumulés) et ses effets (`email_logs.attachment_ids`, `sent_to_artisan_at`) sont **inchangés**.

Ce qui change est le **transport interne** : la mention « repli `fetch` pour une pièce hébergée
hors bucket » de la ligne L7 ne décrit plus le comportement. Ce repli était une faille — une ligne
`intervention_attachments` dont l'`url` visait un service interne faisait lire sa réponse par le
serveur et repartir en pièce jointe. **Le chemin d'envoi ne fait plus aucune requête HTTP
sortante** : l'URL n'est plus qu'une source de `bucket` + `chemin`, et les octets sont lus par le
client Supabase du projet.

| Sujet | Règle appliquée |
|---|---|
| Acceptation | Origine strictement égale à `NEXT_PUBLIC_SUPABASE_URL` (plus l'alias interne `kong:8000`, jamais contacté), schéma `https` — `http` seulement pour un stockage local de développement —, bucket `documents`, chemin `/storage/v1/object/{public｜sign｜authenticated}/…` sans segment traversant. |
| Refus | Hôte tiers, IP littérale, hôte local ou interne, `file://`, bucket non listé, chemin malformé, stockage non configuré. Réponse **`400`** avec une phrase nommant le fichier, refus journalisé avec un motif énuméré. **L'e-mail n'est pas envoyé.** |
| Nouveaux codes | `413` s'ajoute pour **une** pièce au-delà de 20 Mo (le cumul le renvoyait déjà) ; `504` si la lecture d'une pièce dépasse 15 s. |
| Conséquence fonctionnelle | Une pièce historique hébergée **hors** du stockage du projet n'est plus jointe : elle doit être reversée dans l'intervention. C'est le prix du correctif, et le message d'erreur le dit au gestionnaire. |
| Même motif, côté SMTP | `sendEmailToArtisan` refuse toute pièce portant un chemin de fichier **local** (`Attachment.path`) : nodemailer lirait le disque du serveur. Seul le logo GMBS, construit dans le service, l'utilise ; les pièces métier passent par `content`. |

Modules : `src/lib/services/email-attachment-source.ts` (règle pure, motifs de refus),
`src/lib/services/email-attachment-loader.ts` (téléchargement, délai, plafonds),
`src/lib/services/email-service.ts` (garde SMTP). `parseDocumentsStoragePath` disparaît de
`src/lib/interventions/email-attachments.ts` : ce parseur acceptait n'importe quel hôte, il est
remplacé par `resolveEmailAttachmentSource`.

Tests livrés : `tests/unit/lib/services/email-attachment-source.test.ts` (20 cas : hôte hors
stockage, IP littérale, hôte local, `file://`, port, identifiants dans l'URL, bucket, traversée,
stockage non configuré), `tests/unit/lib/services/email-service.test.ts`, et les cas ajoutés à
`tests/unit/lib/services/email-attachment-loader.test.ts` et
`tests/unit/api/interventions/send-email.test.ts`.

---

### 8.8 Correctif §10.1 — le CRM garde la main sur les statuts, et le badge sort du modal

**Bloc additif : il rectifie une règle de §8.5 (lot L1) et complète le point 7 du lot L2. Le contrat
d'appel de `POST /me/interventions/{id}/start` est inchangé** — mêmes en-têtes, même corps
`{ event_uid, occurred_at }`, mêmes champs de réponse (`work`, `statut_code`, `status_advanced`,
`missing_fields`, `replayed`), mêmes codes 200 / 404 / 409 / 500. Ce qui change est **quand**
`status_advanced` vaut `true`.

Le lot L1 appelait `tryAdvanceToInProgress` **inconditionnellement** : le statut basculait en
`INTER_EN_COURS` même avec des champs obligatoires manquants, conformément à l'arbitrage initial de
la spécification §7.7. La décision client du 2026-09-05 (spécification **§10.1**) prime : l'artisan
déclare un **fait**, le CRM reste **seul propriétaire du statut**.

| Sujet | Règle appliquée |
|---|---|
| Deux gardes, distinctes | **Recevabilité de la déclaration** — statut `ACCEPTE`, artisan affecté, `price_response = 'accepted'` quelle qu'en soit la source : non tenue ⇒ `409`, rien n'est écrit. **Avancée du statut** — les 14 champs d'entrée d'`INTER_EN_COURS` : non tenue ⇒ `200`, le fait est écrit, le statut reste `ACCEPTE`. |
| Réponse quand la fiche est incomplète | `200` avec `status_advanced: false`, `statut_code: "ACCEPTE"` et `missing_fields` renseigné. **`tryAdvanceToInProgress` n'est même pas appelée.** L'artisan ne voit aucune erreur : son démarrage est enregistré. |
| Le fait, toujours | `intervention_artisans.work_started_at`, `work_started_from`, `work_started_by` et la ligne `artisan_portal_actions` (`WORK_STARTED`, `payload.missing_fields_count`) sont écrits **avant** toute projection, dans les deux branches. Règle P3 inchangée. |
| Liberté du gestionnaire (§10.1 point 1) | Rien n'est ajouté qui empêche une transition manuelle : le sélecteur du modal liste **tous** les statuts, sans filtre ni `disabled` ; la policy RLS `interventions_update_authorized` ne regarde que le rôle ; aucun trigger ne lit les colonnes du portail avant d'autoriser un `UPDATE` sur `interventions`. Aucune route du portail n'écrit `interventions.statut_id` en dehors de cette bascule. |

**Migration `99084_portal_work_started_flag.sql`** (idempotente, rejouable, aucune table nouvelle,
RLS inchangée) — la liste et le kanban lisent les colonnes **directes** de `interventions`, alors que
le démarrage vit sur `intervention_artisans` :

| Colonne | Écrite par | Rôle |
|---|---|---|
| `intervention_artisans.work_start_missing_count` | la route de démarrage (`work-start.ts`) | Dette de saisie constatée à la déclaration. Le compte vient de `VALIDATION_RULES` (TypeScript) ; **la base ne le recalcule jamais** — redire les 14 règles en SQL, c'est les voir diverger. |
| `interventions.portal_work_started_at` | trigger `trg_intervention_artisans_sync_work_start`, et lui seul | Plus ancien `work_started_at` de l'intervention. |
| `interventions.portal_work_missing_count` | le même trigger | Le compte de l'affectation qui a démarré la première. |

Même mécanique que `has_portal_report` (99076) : une projection de lecture, un trigger unique
propriétaire de l'écriture, un index partiel, et les deux colonnes ajoutées à
`DEFAULT_INTERVENTION_COLUMNS` de l'Edge Function `interventions-v2`.
**Ordre de déploiement** : la migration **avant** l'Edge Function, sinon la liste demande des
colonnes qui n'existent pas encore.

**Badge « Démarré · n champs manquants »**, désormais visible en **liste** et en **kanban** :

| Sujet | Règle appliquée |
|---|---|
| Source unique | `src/lib/interventions/portal-work-status.ts` — pendant exact de `portal-report-status.ts` : `PORTAL_WORK_STARTED_STATUSES` (`ACCEPTE` seul), `PORTAL_WORK_STARTED_COLOR` (`#D97706`, ambre), `isPortalWorkStartedToShow`, `portalWorkStartedLabel`. Module pur, aucun React. **Aucune surface ne redéclare la couleur ni le libellé** — le modal (`ReportsPanel`), la cellule de liste, la carte de kanban et `mapInterventionRecord` importent tous ce module. |
| Priorité d'affichage | `getStatusDisplay` : `hasPortalReport` (« À vérifier », violet) **puis** `portalWorkStartedAt` (ambre) **puis** `statusFromDb` → workflow → legacy. Un rapport reçu passe devant : il y a alors plus urgent à faire que saisir. |
| Portée | `ACCEPTE` uniquement. Dès que le statut a suivi, il n'y a plus d'écart à signaler. |
| Libellé | « Démarré · 3 champs manquants », « Démarré · 1 champ manquant », et « Démarré · statut non avancé » quand le compte est nul ou inconnu (démarrage antérieur à 99084). |
| Couleur | Ambre, **volontairement distincte** du violet d'« À vérifier » : les deux badges peuvent se succéder sur la même intervention et ne disent pas la même chose — l'un réclame une vérification, l'autre une saisie. |

Tests livrés : `tests/unit/lib/portal-external/start.test.ts` (les **deux branches** : fiche complète
⇒ statut avancé ; fiche incomplète ⇒ `tryAdvance` jamais appelée, fait écrit, `200` sans erreur ;
compte enregistré et tracé), `tests/unit/lib/interventions/portal-work-status.test.ts`,
`tests/unit/lib/interventions/status-display.test.ts`, `tests/unit/lib/common-utils.test.ts`
(`mapInterventionRecord`), `tests/unit/components/interventions/views/table/StatusCell.test.tsx`
(liste), `tests/unit/components/interventions/InterventionsKanbanBadges.test.tsx` (kanban),
`tests/unit/components/interventions/form-sections/InterventionHeaderFields.statut.test.tsx`
(non-régression §10.1 point 1 : le sélecteur de statut reste libre, en avant comme en arrière).

### 8.6 Lot L1 — moitié portail : proxys, écrans de prix et de démarrage

Dépôt `portal_gmbs`, branche `vision-deposedocs`. Aucune migration, aucun changement côté CRM : ce bloc décrit ce que l'application artisan fait des deux routes livrées par la moitié CRM du même lot (§8.5).

| Proxy portail | Cible CRM | Ce qu'il fait, et rien d'autre |
|---|---|---|
| `POST /api/portal/me/interventions/{id}/price` | `POST /me/interventions/{id}/price` | relaie corps, code HTTP et JSON d'erreur **tels quels** — `409 price_changed` **et son `current_amount`** compris. Sans ce montant, le verrou optimiste serait inexploitable côté écran |
| `POST /api/portal/me/interventions/{id}/start` | `POST /me/interventions/{id}/start` | idem ; `status_advanced: false` et `missing_fields` arrivent dans un **`200`** et ne sont jamais traités comme une erreur |

Les deux routes suivent `portalProxy` à la lettre : cookie `portal_token` (`401` sans lui, sans appeler le CRM), en-têtes `X-GMBS-Key-Id` / `X-GMBS-Secret` / `X-Portal-Token`, relais de l'IP et du user-agent du téléphone, `cache: 'no-store'`, `503` si l'environnement CRM est incomplet, `502` si le CRM est injoignable, suppression du cookie sur un `401` du CRM.

**Ce que l'artisan voit** (spécification §6.4)

| État | Écran |
|---|---|
| `DEVIS_ENVOYE`, `price.can_accept` | bloc « GMBS vous propose **480 € HT** » **au-dessus des onglets**, deux boutons `J'accepte` / `Je refuse`. Le coût sous-traitance n'est plus répété dans la carte d'en-tête |
| acceptation | **feuille de confirmation obligatoire** — un seul appui n'envoie rien : « Vous vous engagez à réaliser cette mission pour 480 € HT », puis le bouton porte le montant (`J'accepte 480 €`). C'est un engagement financier, pas un tap de camionnette |
| refus | feuille à quatre motifs pré-remplis (*Trop loin*, *Prix trop bas*, *Pas disponible*, *Pas mon métier*) + précision libre facultative. Motif final = `motif — précision` |
| `409 price_changed` | **jamais une erreur** : la feuille reste ouverte sur le **nouveau** montant, « Montant révisé : 520 € HT. Confirmez-vous ? », et le second envoi porte `amount_seen = 520` |
| réponse déjà donnée | l'état enregistré s'affiche **sans aucun bouton pour le reprendre** (§7.3) ; le motif de refus est montré en entier |
| `ACCEPTE`, `work.can_start` | bouton « Démarrer le chantier », **précédé d'une confirmation** ; après appui, « Démarrée à 08 h 14 » |
| `status_advanced: false` | **rien ne change pour l'artisan** : l'heure s'affiche, aucune erreur, et `missing_fields` n'est **jamais** montré — c'est une dette de saisie du gestionnaire, pas une faute de l'artisan (§10.1) |

Le bloc de démarrage reste monté sur `ACCEPTE`, `INTER_EN_COURS` et `SAV` tant qu'une date est posée : sans cela, « Démarrée à 08 h 14 » s'effacerait à la seconde où le CRM fait basculer le statut, c'est-à-dire juste après le geste.

**Enveloppe d'idempotence** : `event_uid` généré par le téléphone (`src/lib/event-uid.ts`) et **conservé d'un essai à l'autre pour une même intention** — un renvoi après coupure réseau ne compte jamais deux fois. `occurred_at` est posé à l'envoi.

**Deux corrections d'infrastructure entraînées par ce lot**
1. `PortalApiError` porte désormais le **corps JSON** de l'erreur (`error.body`). Un code seul ne suffisait pas : `current_amount` vit dans le corps.
2. La feuille du bas (`src/components/ui/sheet.tsx`, nouveau) passe par un **portail vers `document.body`**. Les écrans sont enveloppés dans `.fade-in`, dont l'animation porte un `transform` avec `animation-fill-mode: both` : le transform survit à l'animation et fait de cet élément le bloc conteneur de tout `position: fixed` descendant. `inset-0` ne valait alors plus le viewport et le bouton de confirmation passait **sous** la barre d'onglets, hors d'atteinte. Piège à connaître pour toute surface flottante ajoutée ensuite.

**Mode mock** (`src/lib/mock/api.ts`) : les deux routes sont rejouées avec les **mêmes gardes, dans le même ordre et avec les mêmes codes** que le CRM — rejeu, affectation, statut, réponse déjà donnée, prix absent, puis verrou optimiste. Deux points de fidélité qui comptent :
- la route `price` **ne change jamais le statut** : après acceptation, la mission reste `DEVIS_ENVOYE` avec « Prix accepté ». C'est le gestionnaire qui fera avancer le statut (§10.1) ;
- la route `start` **n'avance le statut que si la fiche porte une `date_prevue`** — une règle d'entrée représentative tenant lieu des quatorze que le CRM vérifie. Sans elle, `200` + `status_advanced: false` + `missing_fields` : c'est exactement le cas que l'application doit traiter sans montrer d'erreur, et il est donc démontrable hors connexion.
- `price` et `work` sont **recalculés à chaque lecture** (`projectPrice` / `projectWork`), jamais lus depuis la fixture : un `can_accept` figé rouvrirait un geste déjà joué.

**Ce que la moitié portail de L1 ne fait pas** : les totaux mensuels de l'onglet « Terminées » et l'écran « Mes documents » relèvent de **L6** ; les versions de rapport modifiables côté portail, de **L3** ; l'événement SSE nommé `price` / `work` et sa doublure dans le SSE mock, de **L8**.

Tests livrés : `portal_gmbs/tests/unit/api/price-start-proxies.test.ts` (en-têtes, relais des codes, `409` + `current_amount`, `401` sans cookie, `502`/`503`, encodage de l'id), `tests/unit/mock/price-start.test.ts`, `tests/unit/lib/price.test.ts`, `tests/unit/components/mission-price-panel.test.tsx` (confirmation obligatoire, verrou optimiste, refus, réponse non reprise), `tests/unit/components/mission-start-panel.test.tsx` (confirmation, **aucune erreur sur `status_advanced: false`**), `tests/unit/components/mission-detail-screen.test.tsx`. Doublure de test étendue : `tests/helpers/portal-api.tsx` expose `setNextError` pour rejouer un geste après un `409`.

---

### 8.9 Lot L3 — versions du rapport : modification, remplacement, historique

Aucune migration : le socle (`99078`) porte déjà `superseded` / `superseded_at` / `superseded_by`, la colonne `started_at` et l'index partiel `ux_artisan_reports_one_open`.

**Règle de version (spécification §7.3), appliquée telle quelle**

> Une nouvelle version est permise si aucun rapport `submitted` n'est en attente, **et** que le dernier rapport est `rejected`, **ou** que l'intervention est repassée par `INTER_EN_COURS` ou `SAV` depuis la validation.

Le repassage est lu dans `intervention_status_transitions` (`to_status_code ∈ {INTER_EN_COURS, SAV}` et `transition_date > reviewed_at`), jamais sur `interventions.updated_at`, que le moindre commentaire bouscule (trigger `00082`). Sans date de décision lisible, la réponse est « non rouvert » : mieux vaut un `409` que l'ouverture d'une version sur un rapport que personne n'a rouvert. Toute la règle tient dans une fonction pure, `decideNewVersion`.

**Routes CRM**

| Méthode et chemin | Corps | Réponse | Erreurs |
|---|---|---|---|
| `POST /me/interventions/{id}/report` | inchangé **+ `replaces?`** (uuid du rapport en attente) **+ enveloppe facultative** | `201 {report}` ; rejeu du même `portal_report_id` ⇒ `200` | `409 report_pending` (un rapport attend, sans `replaces`) · `409 report_not_replaceable` (`replaces` ne désigne pas le rapport en attente, ou le gestionnaire a tranché entre-temps) · `409 report_already_approved` (validé, rien de rouvert) |
| `PATCH /me/interventions/{id}/report` | **tous champs facultatifs**, au moins un ; enveloppe facultative | `200 {report}` — **même version, même identifiant** | `400 no field to update` · `404` (aucun rapport) · `409 report_already_approved` · `409 report_not_editable` (rapport refusé : la correction passe par une nouvelle version) |
| `GET /me/interventions/{id}/reports` | — | `200 {reports:[{id, version, status, submitted_at, started_at, reviewed_at, review_comment, superseded_at, photos_count, is_current}], current_report_id}` | `404` si l'artisan n'est pas affecté |

Les corps d'erreur portent désormais des **codes** (`report_pending`…) et non des phrases : le libellé se calcule côté portail, comme pour le prix (P1). Deux messages historiques changent en conséquence — `Report already submitted` devient `report_pending`, `Report already approved` devient `report_already_approved`.

**Supersession — ordre d'écriture imposé.** PostgREST n'ouvre pas de transaction multi-requêtes, et l'index partiel n'est pas différable. `submitPortalReport` écrit donc, dans cet ordre : (1) `UPDATE … SET status='superseded' WHERE id=<v(n)> AND status='submitted'` — zéro ligne touchée ⇒ `409 report_not_replaceable` ; (2) `INSERT` de v(n+1) ; (3) `UPDATE … SET superseded_by=<v(n+1)>`, après l'insertion parce que c'est une clé étrangère. **Si l'insertion échoue, l'étape 1 est compensée** (`superseded` → `submitted`) : sans cela, le rapport en attente de l'artisan disparaîtrait pour cause de disque plein.

**Deux artisans** : les versions sont lues par couple `(intervention, artisan)`. Le rapport en attente de l'un ne bloque jamais l'autre — l'index partiel porte sur le couple, ce que vérifie un test d'intégration contre la base locale.

**`started_at`** est recopié depuis `intervention_artisans.work_started_at` à l'envoi : la durée réelle (`submitted_at − started_at`) reste juste même si le gestionnaire corrige ensuite l'heure de démarrage.

**Journal** : `REPORT_SUBMITTED` pour une version neuve, `REPORT_REPLACED` pour un remplacement **et** pour un `PATCH` (`payload.mode = 'patch'`, `payload.fields` = champs touchés — l'événement « rapport modifié » du §1.3, sans historique champ à champ). L'enveloppe `{event_uid, occurred_at}` est **acceptée mais facultative** sur ces deux routes : `portal_report_id` porte déjà l'idempotence de l'envoi depuis la première version du portail, et l'exiger casserait les téléphones non mis à jour.

**Ce que l'artisan voit** (spécification §6.5)

| État | Écran |
|---|---|
| rapport en attente | bandeau « Envoyé, en attente de validation (version n) », **« Modifier mon rapport »** (renvoi complet avec `replaces` ⇒ v(n+1), la précédente devient « Remplacée ») |
| photos envoyées après le rapport | **« Joindre N nouvelle(s) photo(s) »** ⇒ `PATCH {attachment_ids}`, **sans** nouvelle version : ajouter une photo n'est pas refaire un rapport |
| rapport refusé | motif du gestionnaire **en entier**, puis « Corriger et renvoyer » ⇒ `POST` sans `replaces` (la version refusée appartient à l'historique) |
| rapport validé | lecture seule, **aucun bouton** — proposer un geste qui recevrait un `409` est pire que ne rien proposer |
| historique | carte « Versions du rapport » : `Version 3 · En attente`, `Version 2 · Remplacée`, `Version 1 · Correction demandée` avec le commentaire déplié |

Libellé de `superseded` : **« Remplacée »** des deux côtés (`report-parts.tsx` du CRM, `reportVersionLabel` du portail). Deux vocabulaires pour un même état, c'est un appel téléphonique au gestionnaire.

**Mode mock** : `latestReport` cesse d'aplatir (`MockState.reports` est déjà un tableau par intervention) et devient `currentReport` — la version en attente, sinon la plus récente, exactement comme `pickPortalReport` côté CRM. `replaces`, `PATCH` et `GET …/reports` y rejouent les mêmes gardes et les mêmes codes. La réouverture après validation s'y lit dans `MockState.reopenedAt`, qui tient lieu de journal des transitions : vide par défaut, donc **un rapport validé est verrouillé en démo** — ce qui est précisément le comportement à montrer.

**Tests livrés** — CRM : `tests/unit/lib/portal-external/report.test.ts` (règle pure et validation, 23), `tests/unit/api/portal-external/report.test.ts` (29, dont refus ⇒ v2, validé sans réouverture ⇒ `409`, réouverture ⇒ v2, SAV, ordre d'écriture de la supersession, compensation, deux artisans, journal), `tests/unit/api/portal-external/reports.test.ts` (5), `tests/integration/portal/l3-report-versions.test.ts` (5, base locale : un seul `submitted` par couple, deux artisans indépendants, ordre inverse ⇒ `23505`). Portail : `tests/unit/components/mission-report-tab.test.tsx` (9), `tests/unit/mock/report-versions.test.ts` (16), `tests/unit/api/report-proxies.test.ts` (8), `tests/unit/lib/status-report.test.ts` (5).

### 8.9 Lot L6 — documents, paiement, journal d'actions

Dépôts : `gmbs-crm` (branche `visiondeposedocs`) et `portal_gmbs` (branche `vision-deposedocs`).
Migration : **`99085_portal_payment_states.sql`** (idempotente, appliquée en local uniquement).

#### Routes ajoutées ou complétées

| Méthode et chemin | État | Réponse | Erreurs | Garde |
|---|---|---|---|---|
| `GET /api/portal-external/me/library` | **nouvelle** | `{groups:[{intervention:{id, id_inter, adresse, ville, statut_code, date}, documents:[{id, kind, filename, mime_type, file_size, created_at, url}], payment}], counts:{devis, factures}}` | `401`, `503` | jeton portail ; `kind` ∈ `devis, facturesArtisans` — **jamais `facturesGMBS`** |
| `GET /api/portal-external/me` | **complétée** | + `documents:{required, present, pending, rejected}`, + `avatar:{url, sizes}｜null`, + `dossier_validated_at` | `401`, `503` | jeton portail |
| `GET /api/portal-external/me/interventions/{id}` | **complétée** | `documents.devis[]` porte `kind, mime_type, file_size, created_at` ; **`documents.factures[]`** ajouté (`facturesArtisans` seules) | `404` | jeton ; affectation |
| `POST /api/portal-external/me/documents` | **complétée** | inchangée | — | + écrit `DOCUMENT_UPLOADED` au journal |
| `PATCH /api/interventions/{id}/artisans/{artisanId}/payment` | **nouvelle** | `{payment:{state, label, tone, paid_at, updated_at}}` | `400` valeur hors CHECK · `400` `paid_at` manquant pour `paid` · **`404` uniforme** si l'artisan n'est pas affecté | `write_interventions` |
| `GET /api/artisans/{id}/timeline?limit=&before=` | **nouvelle** | `{events:[{id, action_type, occurred_at, recorded_at, source, actor, intervention:{id, id_inter}, report_id, attachment_id, payload}], next_before}` | `404` artisan inconnu | `read_artisans` |
| `GET /api/portal/me/library` (portail) | **nouvelle** | proxy de trois lignes | — | cookie `portal_token` |

#### Les six états de paiement (migration 99085)

`intervention_artisans.payment_status` passe de quatre à six valeurs. Les deux ajouts ne sont pas
des nuances de présentation : sans `invoice_received`, un artisan qui **vient d'envoyer sa facture**
continue de lire « en attente de votre facture » et rappelle le gestionnaire — précisément le coup de
téléphone que le portail doit supprimer ; sans `disputed`, un litige se range dans « paiement en
cours », ce qui est faux, ou dans « en attente de facture », ce qui fait redéposer la facture.

| Code | Libellé artisan (CRM, module pur) | Libellé gestionnaire | Ton |
|---|---|---|---|
| `not_applicable` | *(rien)* | Non renseigné | neutral |
| `awaiting_invoice` | En attente de votre facture | Attente facture | warning |
| `invoice_received` | Facture reçue | Facture reçue | info |
| `in_progress` | Paiement en cours | Programmé | info |
| `paid` | Payé le 20/09 | Payé | success |
| `disputed` | En litige | Litige | danger |

« Programmé » n'ajoute **pas** un code : c'est `in_progress`, dont le libellé artisan est fixé par la
spécification §6.3 et déjà livré. Renommer un libellé pour un synonyme n'apporte rien à l'artisan.
Les libellés vivent **uniquement** dans `src/lib/interventions/payment-status.ts` et voyagent dans la
réponse (principe P1) ; le portail ne mappe que le *ton* d'affichage.

**`intervention_payments.is_received` n'est ni lu ni écrit par ce lot**, et c'est la règle qui compte :
c'est un encaissement **client**. En dériver le paiement de l'artisan afficherait « payé » parce que
le client a réglé GMBS. `acompte_sst` n'a d'ailleurs pas d'`artisan_order` : il est faux dès qu'une
intervention porte deux artisans — d'où la saisie **par ligne d'affectation**.

#### Espace documentaire : pourquoi une route dédiée

Le portail ne reçoit `documents` que dans la réponse *détail* d'une mission, et `usePortalQuery` n'a
ni cache ni déduplication (`api-client.ts:106`). Agréger « tous mes devis » côté écran coûterait une
requête par mission, **rejouée à chaque événement SSE**. `GET /me/library` relit les missions via
`listPortalInterventions` : la règle de visibilité (§7.1) et la projection de paiement sont ainsi
héritées, jamais réécrites. Le filtre `kind` est appliqué **deux fois** — dans le `.in()` SQL et à la
projection : une requête modifiée par mégarde ne doit pas suffire à faire fuiter une facture GMBS.

#### Journal des actions : deux sources, une frise

`GET /api/artisans/{id}/timeline` lit `artisan_portal_actions` (99079) **et** dérive les envois de
rapport d'`artisan_reports.submitted_at` pour ceux que le journal ne porte pas (rapports antérieurs à
sa mise en service). Sans ce repli, la frise afficherait « prix accepté » sans jamais « rapport
envoyé » sur les dossiers existants. La dérivation est une **lecture** : elle n'écrit rien, et un
rapport déjà journalisé est écarté par déduplication sur `report_id` (`source: 'derived'` la
distingue à l'affichage). L'acteur se résout dans cet ordre : compte joint, puis copie immuable
`payload.actor` (la clé étrangère est `ON DELETE SET NULL` — c'est la dérive d'`artisan_audit_log`,
92 % de lignes sans acteur), puis repli explicite. `before` est un curseur sur `occurred_at`, pas un
décalage : le journal est append-only, une pagination par offset sauterait des lignes.

Côté CRM, la carte « Journal des actions » est repliée par défaut dans la fiche artisan (colonne de
gauche, sous « Vérification des pièces ») et ne charge sa requête qu'à l'ouverture. Elle affiche
l'acteur, l'horodatage, la **source** — `Portail` (geste de l'artisan) ou `CRM` (saisie du
gestionnaire) — et signale une horloge recalée (`payload.clock_skew`, §4.1). La distinction de source
est ce qui donne sa valeur au journal : « l'artisan m'a dit oui au téléphone » et une acceptation
faite depuis l'application n'ont pas la même portée en cas de litige.

#### Page Comptabilité

Nouvelle colonne **« Paiement SST »**, une pastille par artisan de l'intervention ; le clic ouvre une
saisie par artisan (six états + date). La date est **obligatoire pour « Payé »** : « Payé le 20/09 »
est ce que lit l'artisan. Elle est effacée dès que l'état n'est plus `paid` — une date de paiement
survivant à un retour en litige serait un faux souvenir. Une seule requête par **page**
d'interventions (`comptaApi.getArtisanPayments`), pas une par ligne. L'écriture passe par la route
Next : `authenticated` a un `UPDATE USING(true)` sur `intervention_artisans`, la garde ne peut donc
pas venir de la base.

#### Côté portail

- **Écran « Mes documents »** (`/app/profil/documents`) : devis reçus et factures déposées, groupés
  par mission, avec la pastille de paiement calculée par le CRM. Une seule requête, `/me/library`.
- **Onglet « Terminées »** : bandeau de total par mois — « septembre 2026 · 2 missions · 700 € ».
  C'est la vraie question de l'artisan (« combien on me doit »), à laquelle aucune ligne isolée ne
  répond. Le montant retenu est le `payment.amount` du CRM, sinon le montant **gelé à l'acceptation**,
  sinon `cout_sst` : uniquement **son** coût sous-traitant, jamais le CA, jamais la marge.
- **Mode mock** : `/me/library` est rejoué avec la même règle (groupes vides écartés, tri identique,
  `facturesGMBS` inexistante dans les fixtures — le portail ne la voit jamais, il n'a donc rien à
  filtrer), et le détail de mission renvoie désormais `devis` **et** `factures`.

#### Ce que le lot L6 ne fait pas

Le journal n'est **pas** publié en temps réel (99079 ne touche à aucune publication : le WAL logique
n'a pas à porter une frise consultée à la demande). Le paiement n'écrit **aucune** ligne de journal :
le CHECK d'`action_type` (99079) est fermé et ne porte pas d'action de paiement — l'auteur et la date
de la saisie vivent dans `payment_updated_by` / `payment_updated_at`. Enfin, l'envoi d'un rapport est
**dérivé** en lecture, pas journalisé à l'écriture : instrumenter `POST /me/interventions/{id}/report`
appartient au périmètre du lot qui possède `src/lib/portal-external/report.ts`.

Tests livrés — CRM : `tests/unit/lib/portal-external/library.test.ts` (liste blanche, groupement,
tri, montant = son `cout_sst`), `tests/unit/api/portal-external/library.test.ts` (route, `.in(kind)`,
`facturesGMBS` jamais rendue), `tests/unit/lib/portal-external/dossier-summary.test.ts` (compteurs sur
la **dernière** pièce de chaque type, avatar le plus récent), `tests/unit/api/portal-external/me.test.ts`,
`tests/unit/lib/portal-external/intervention-documents.test.ts`, `tests/unit/api/portal-external/documents-journal.test.ts`,
`tests/unit/api/interventions/artisan-payment.test.ts` (valeur hors CHECK ⇒ `400`, `paid_at` requis
pour `paid`, `404` uniforme, `intervention_payments` jamais touchée),
`tests/unit/lib/artisans/portal-timeline.test.ts`, `tests/unit/api/artisans/timeline.test.ts`,
`tests/unit/lib/interventions/payment-status.test.ts` (recalé sur six états).
Portail : `tests/unit/api/library-proxy.test.ts`, `tests/unit/mock/library.test.ts`,
`tests/unit/components/documents-screen.test.tsx`, `tests/unit/components/missions-terminees-totaux.test.tsx`,
`tests/unit/lib/library-and-months.test.ts`.

---

### 8.10 Correctifs de recette (2026-09-05)

Bloc **ajouté** à la suite de la recette de la vague 1. Il ne réécrit aucune ligne des sections
précédentes : il les précise là où le contrat était muet ou en retrait par rapport au code.

#### Corps attendu par la route de paiement

La ligne `PATCH /api/interventions/{id}/artisans/{artisanId}/payment` de §8.9 ne documentait que sa
**réponse**. Elle attend en entrée :

```json
{ "payment_status": "awaiting_invoice | invoice_received | in_progress | paid | disputed | not_applicable",
  "paid_at": "2026-09-20 (obligatoire pour paid, ignoré sinon)" }
```

`state` est le nom de **sortie** (`{payment:{state, label, tone, paid_at, updated_at}}`), jamais celui
d'entrée : envoyer `state` fait répondre `400 « payment_status attendu parmi : … »` pour les six
valeurs, `paid` comprise. Source : `src/lib/interventions/artisan-payment.ts`.

#### Statuts recevables par le repli gestionnaire du prix

`PATCH /api/interventions/{id}/artisans/{artisanId}/price` accepte désormais `DEVIS_ENVOYE`
**et** `ACCEPTE`, là où §8.2 ne mentionnait que le statut du portail. La garde du portail
(`POST /me/interventions/{id}/price`) reste inchangée : `DEVIS_ENVOYE` seul.

Motif : le repli sert précisément quand le gestionnaire décroche son téléphone, c'est-à-dire le plus
souvent sur une intervention déjà passée en `ACCEPTE`. Tant que la garde était partagée, ces
interventions répondaient `409 status_not_allowed`, puis `409 price_not_accepted` au démarrage — plus
aucun chantier ne pouvait être démarré depuis l'application. Le geste est branché dans le panneau
« Rapport » du modal d'intervention (« Réponse par téléphone », puis « Démarré par téléphone »).

#### Champs de vérification renvoyés à l'artisan

`GET /api/portal-external/me/documents` renvoie désormais `reviewed_at` et `review_comment` sur
chaque pièce, en plus de `review_status`. Sans eux, le motif de refus promis par §8.4 n'arrivait
jamais au portail et l'artisan redéposait la même pièce. Les colonnes existent depuis `99078`.

#### Compteur de champs manquants réévalué

`POST /me/interventions/{id}/start` et son repli CRM renvoient, sur une affectation **déjà démarrée**,
la liste réelle des champs manquants et remettent `work_start_missing_count` à jour (le trigger de
`99084` propage vers `interventions.portal_work_missing_count`). Le compteur était jusqu'ici figé à sa
valeur du premier appel : le badge « Démarré · n champs manquants » annonçait une dette déjà soldée.
Le statut, lui, reste sous la main du gestionnaire (§10.1) : aucune bascule n'est retentée.

#### Un changement de statut sans `dueAt` ne touche plus `date_prevue`

`POST /api/interventions/{id}/status` sans `dueAt` laisse `date_prevue` intacte. Auparavant la colonne
était effacée — y compris par le menu contextuel (« Passer en devis envoyé », « Passer en accepté »),
qui n'envoie pas de date. Le démarrage de chantier de l'artisan répondait ensuite « La date prévue
doit être renseignée pour passer en cours », sur un champ que le CRM venait d'effacer.
`dueAt: null` reste le moyen explicite de la vider.

Tests livrés : `tests/unit/lib/api/interventions/due-date.test.ts`,
`tests/unit/lib/portal-external/start.test.ts` (dette réévaluée),
`tests/unit/api/interventions/artisan-price-fallback.test.ts` (`ACCEPTE` accepté, `INTER_TERMINEE`
toujours refusé), `tests/unit/components/interventions/ReportsPanel.test.tsx` (les deux gestes
« au téléphone »).
