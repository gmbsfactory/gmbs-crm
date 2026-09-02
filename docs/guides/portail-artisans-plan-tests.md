# Plan de tests de la connexion CRM ↔ portail artisans

> Date : 2026-09-02. Complète [docs/architecture/portail-artisans-v2.md](../architecture/portail-artisans-v2.md). Les commandes visent l'état **tel qu'implémenté en janvier 2026** (routes `app/api/portal-external/*` reprises depuis `origin/depose_docs` sur `deposedocsv2`, portail `portal_gmbs` `151bd14`) ; quand le comportement attendu diffère du comportement observé (bug connu), les deux sont indiqués. Placeholders entre `<…>` ; **aucune valeur de secret** ne doit être collée dans ce document ni dans un ticket.

---

## 1. Pré-requis

### 1.1 Deux serveurs locaux

| Application | Commande | Port | Source du port |
|---|---|---|---|
| CRM `gmbs-crm` | `npm run dev` (= `next dev`, `package.json` l. 6) ou preview `crm-dev` | **3000** | `.claude/launch.json` (`crm-dev`, `port: 3000`, `autoPort: true`) ; `playwright.config.ts` (racine ; `tests/e2e/playwright.config.ts` n'existe pas) l. 6-10 : `baseURL http://localhost:3000`, `webServer { command: "pnpm dev", port: 3000 }` — le `webServer` Playwright suppose `pnpm`, pas `npm run dev` |
| Portail `portal_gmbs` | `npx next dev -p 3001` (le script `dev` est `next dev` sans port, `package.json` l. 6 : par défaut 3000 → collision) | **3001** | choix de ce plan ; les scripts du portail supposent 3000 (`scripts/seed-test-tenant.ts` l. 85 imprime `GMBS_PORTAL_BASE_URL=http://localhost:3000/api/v1`, `scripts/test-webhook.sh` l. 25 `WEBHOOK_URL` par défaut `http://localhost:3000/...`) : **remplacer par 3001** |

Lancer le CRM avec `crm-dev` (Browser pane) ou `npm run dev` ; le portail avec `cd /Users/andrebertea/Projects/GMBS/portal_gmbs && npx next dev -p 3001`. `tsx` n'est pas dans les devDependencies du portail : les scripts se lancent avec `npx tsx scripts/<nom>.ts`. **Ils ne chargent pas `.env.local`** (aucun `dotenv` ni `--env-file` dans `scripts/` ou `package.json`) : ils lisent `process.env` et quittent en `process.exit(1)` si la variable manque (`seed-test-tenant.ts` l. 13-16, `setup-crm-tenant.ts` l. 14-18 et 27-31, `setup-storage.ts` l. 11-14, `check-data.ts` l. 10-12). Exporter d'abord : `set -a; source .env.local; set +a; npx tsx scripts/<nom>.ts` (ou `node --env-file=.env.local --import tsx scripts/<nom>.ts`).

### 1.2 Appariement des variables d'environnement (noms seulement)

Règle : une seule paire clé/secret, créée dans la base du portail (`api_keys.key_id`, `key_secret_hash` bcrypt) par `scripts/seed-test-tenant.ts` (tenant de test, clés `pk_test_`/`sk_test_`) ou `scripts/setup-crm-tenant.ts` (tenant « GMBS CRM Production », lit `CRM_API_KEY_ID`/`CRM_API_SECRET`). Toutes les variables ci-dessous pointent vers cette paire.

| Rôle | CRM `.env.local` | Portail `.env.local` | Contrainte |
|---|---|---|---|
| Identifiant de clé | `GMBS_PORTAL_KEY_ID` (entrant `src/lib/portal-external/auth.ts` ; sortant SDK) | `CRM_API_KEY_ID` (`api/portal/report/submit`) **et** `GMBS_PORTAL_KEY_ID` (`src/lib/crm/client.ts` l. 149, à ajouter tant que l'étape 8 du plan n'est pas faite) | tous identiques = `api_keys.key_id` |
| Secret | `GMBS_PORTAL_SECRET` | `CRM_API_SECRET` **et** `GMBS_PORTAL_SECRET` (`client.ts` l. 150, à ajouter) | identiques ; bcrypt = `api_keys.key_secret_hash` |
| Clé du proxy rapport CRM → portail | `PORTAL_API_KEY_ID`, `PORTAL_API_SECRET` | — | même paire (ou une seconde ligne `api_keys` active) |
| Origine du portail | `GMBS_PORTAL_BASE_URL` = `http://localhost:3001/api/v1` ; `PORTAL_GMBS_BASE_URL` = `http://localhost:3001` | `NEXT_PUBLIC_PORTAL_URL` = `http://localhost:3001` | même origine |
| Origine du CRM | — | `GMBS_CRM_BASE_URL` = `http://localhost:3000` **et** `CRM_API_URL` = `http://localhost:3000` (`client.ts` l. 148, à ajouter) | même origine |
| Base Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | **deux projets distincts** |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PORTAL_ARTISANS` ; `STRIPE_WEBHOOK_SECRET` (absent aujourd'hui, requis pour STRIPE-04) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (défini deux fois dans le fichier actuel : la seconde valeur gagne) | chaque application a son propre endpoint webhook et son propre secret `whsec_` |

Vérification sans lire les valeurs : `cut -d= -f1 .env.local | sort -u` dans chaque dépôt.

### 1.3 Bases de données

- **CRM** : le projet Supabase lié est la **production** (mémoire projet : `supabase db push --linked`, base = prod). Deux options, par ordre de préférence :
  1. **Branche Supabase** (preview branch) si le plan du projet le permet : `supabase branches create portail-tests` puis pointer `NEXT_PUBLIC_SUPABASE_URL`/clés du CRM local vers la branche ; sinon
  2. **Jeu de test dédié en prod** : un artisan `TEST PORTAIL A` et un artisan `TEST PORTAIL B` (`raison_sociale` explicite, `is_active=true`, statut `CANDIDAT` pour rester hors des compteurs), deux interventions `id_inter` préfixées `TEST-PORTAIL-…` en `INTER_EN_COURS` avec `assigned_user_id` = votre utilisateur, `intervention_artisans` : inter 1 → A (primary), inter 2 → B ; un coût `intervention_costs (cost_type='sst', artisan_order=1)` sur chacune. **Ne jamais** rejouer les tests d'écriture (DOC-02, REP-06, NOTIF-*, VALID-*) sur des données réelles. Nettoyage en fin de campagne : supprimer les interventions de test (cascade `intervention_artisans`, `intervention_attachments`, `intervention_reminders`, `comments`), les lignes `artisan_reports`, puis les artisans de test.
     **À scripter avant la campagne** (base = prod, cascades à respecter ; à écrire à l'étape 0, non présents dans le dépôt) : `scripts/portal-tests/seed.sql` — `INSERT INTO artisans (raison_sociale 'TEST PORTAIL A'/'B', statut = id de CANDIDAT, is_active=true)`, `INSERT INTO interventions (id_inter 'TEST-PORTAIL-001'/'002', statut_id = id de INTER_EN_COURS, assigned_user_id = :user, champs obligatoires du workflow)`, `INSERT INTO intervention_artisans (role='primary')`, `INSERT INTO intervention_costs (cost_type='sst', artisan_order=1)`, et qui termine par `SELECT` des quatre uuid prêts pour l'`export` de §1.4 ; `scripts/portal-tests/cleanup.sql` — `DELETE FROM interventions WHERE id_inter LIKE 'TEST-PORTAIL-%'` (cascades), `DELETE FROM artisan_reports WHERE artisan_id IN (…)`, `DELETE FROM artisan_attachments WHERE artisan_id IN (…)` + objets Storage `artisans/<uuid>/**`, puis `DELETE FROM artisans WHERE raison_sociale LIKE 'TEST PORTAIL %'`. Exécution via MCP Supabase (psql bloqué) ou `npx tsx scripts/seed-portal-test-data.ts` avec `SUPABASE_SERVICE_ROLE_KEY`.
  - Stack locale (`supabase start`, ports `supabase/config.toml` : API 54321 l. 10, DB 54322 l. 27, Studio 54323 l. 69, Inbucket 54324 l. 78) : utilisable pour les tests unitaires, mais **ne reproduit pas la prod** tant que les policies réelles de `intervention_attachments` (à lire dans `pg_policies`, elles ne sont versionnées nulle part sur `main`) et la migration `99076` ne sont pas versionnées (voir doc d'architecture §4.a et §4.d).
- **Portail** : projet Supabase propre (ref codée en dur dans `scripts/setup-crm-tenant.ts` l. 11 ; commentaire « Project: portal-gmbs-prod »). Pas de `config.toml` : pas de stack locale sans `supabase init` (prévu au §4.d-bis de la doc d'architecture : `supabase init` + `link` + `migration repair` de `001`/`002`, puis `supabase start` possible pour les tests unitaires du portail). Utiliser un **tenant de test** dans ce projet (`seed-test-tenant.ts` crée « GMBS CRM (Test) », `trial`, `pro`, 100 artisans) et ne pas toucher au tenant « GMBS CRM Production ».

### 1.4 Scripts de seed / outillage du portail

Rappel : exporter les variables avant chaque commande (`set -a; source .env.local; set +a`), les scripts ne lisent pas `.env.local` (§1.1).

| Script | Rôle | Env lues |
|---|---|---|
| `npx tsx scripts/seed-test-tenant.ts` | crée le tenant de test + une clé `pk_test_…/sk_test_…` et **imprime le secret en clair** (l. 76-77) : copier dans les `.env.local` (§1.2) puis effacer le terminal | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `npx tsx scripts/setup-crm-tenant.ts` | crée/met à jour le tenant « GMBS CRM Production » avec la paire fournie (ne pas utiliser pour les tests) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRM_API_KEY_ID`, `CRM_API_SECRET` |
| `npx tsx scripts/setup-storage.ts` | crée le bucket privé `artisan-uploads` (10 Mo, image + pdf) — idempotent | idem |
| `npx tsx scripts/check-data.ts` | dump lecture seule : tenants, api_keys, 10 derniers tokens / rapports / photos / submissions / documents — à utiliser comme « journal à consulter » | idem |
| `./scripts/test-webhook.sh {checkout,update,delete,payment,all,listen}` | wrapper `stripe trigger` / `stripe listen` ; exige Stripe CLI ; exporter `WEBHOOK_URL=http://localhost:3001/api/v1/webhooks/stripe` | `WEBHOOK_URL` |

Outils : `curl`, `jq`, `stripe` CLI (`brew install stripe/stripe-cli/stripe`), Supabase Studio (ou MCP Supabase) pour les vérifications en base, un cookie de session CRM valide pour les routes gestionnaire (récupérer le cookie `sb-<ref>-auth-token` depuis le navigateur après login ; ne pas le coller dans un ticket).

Variables de commodité pour les commandes ci-dessous :

```bash
export CRM=http://localhost:3000
export PORTAL=http://localhost:3001
export KEY_ID='<api_keys.key_id>'
export SECRET='<secret associé>'
# Ne pas figer un TS pour toute la campagne : le portail rejette tout X-GMBS-Timestamp présent
# dont l'écart dépasse 5 min (tenant-auth.ts l. 5 MAX_TIMESTAMP_DRIFT_MS, l. 58-68 → 401
# « Request timestamp too old or invalid »). Utiliser $(date +%s000) à chaque appel.
export ARTISAN_A='<uuid artisan A>' ; export ARTISAN_B='<uuid artisan B>'
export INTER_A='<uuid intervention assignée à A>' ; export INTER_B='<uuid intervention assignée à B>'
```

---

## 2. Matrice de tests par flux

Colonnes : **Pré-condition** · **Action** · **Attendu** (code HTTP + forme JSON) · **Table à vérifier** · **Journal**.

### 2.1 Auth machine-to-machine

#### CRM ← portail (`src/lib/portal-external/auth.ts`)

| Id | Pré-condition | Action | Attendu | Table | Journal |
|---|---|---|---|---|---|
| AUTH-01 | `GMBS_PORTAL_KEY_ID`/`SECRET` définis côté CRM, artisan A existe | `curl -s -i "$CRM/api/portal-external/artisan/$ARTISAN_A/interventions" -H "X-GMBS-Key-Id: $KEY_ID" -H "X-GMBS-Secret: $SECRET"` | `200` `{"interventions":[…],"count":n}` | — | console CRM (aucune erreur `[portal-external]`) |
| AUTH-02 | idem | même appel avec `-H "X-GMBS-Secret: mauvais"` | `401` `{"error":"Invalid credentials"}` | — | — |
| AUTH-03 | idem | même appel **sans** en-têtes `X-GMBS-*` | `401` `{"error":"Missing authentication headers"}` | — | — |
| AUTH-04 | CRM démarré **sans** `GMBS_PORTAL_KEY_ID` | appel AUTH-01 | observé `401` `{"error":"Portal not configured"}` ; attendu après étape 2 du plan : `503` | — | console CRM `[portal-external] Portal credentials not configured` |
| AUTH-05 | après étape 2 (timestamp obligatoire) | appel AUTH-01 avec `-H "X-GMBS-Timestamp: 1000"` | `401` (timestamp périmé) ; aujourd'hui : `200` (en-tête ignoré) | — | — |
| AUTH-07 (middleware) | après étape 2 (nettoyage `middleware.ts` : `'/portail'` retiré de `publicPaths` l. 23, `portail` et `api/portail/` retirés du matcher l. 71) | `curl -s -i "$CRM/portail/abc"` ; puis `curl -s -i "$CRM/api/portal-external/artisan/$ARTISAN_A/interventions"` sans cookie ni en-tête | `/portail/abc` → `307` vers `/login` (aujourd'hui : chemin exclu du middleware → `404` Next sans redirection) ; `/api/portal-external/…` → `401` de la route, **jamais** de `307` (route exclue du middleware) | — | test unitaire `tests/unit/middleware.test.ts` (étape 2) |
| AUTH-06 | après étape 2 (HMAC) | `TS=$(date +%s000)` calculé juste avant l'appel, puis appel AUTH-01 avec `X-GMBS-Timestamp: $TS` et `X-GMBS-Signature` calculée = `HMAC-SHA256(SECRET, "$TS.GET./api/portal-external/artisan/$ARTISAN_A/interventions.<sha256 du corps vide>")` | `200` ; signature altérée → `401` | — | — |

#### Portail ← CRM (`src/lib/auth/tenant-auth.ts`)

| Id | Pré-condition | Action | Attendu | Table | Journal |
|---|---|---|---|---|---|
| AUTH-10 | tenant de test `trial|active`, clé non révoquée | `curl -s -i "$PORTAL/api/v1/subscription/status" -H "X-GMBS-Key-Id: $KEY_ID" -H "X-GMBS-Secret: $SECRET" -H "X-GMBS-Timestamp: $(date +%s000)"` | `200` `{"active":true,"status":"trial","plan":"pro","limits":{"artisans":100},"usage":{"artisans":n},"features":[…]}` | `api_keys.last_used_at` mis à jour | — |
| AUTH-11 | idem | `-H "X-GMBS-Key-Id: pk_test_inconnu"` | `401` `{"error":"Invalid API key"}` (tenant inconnu) | — | — |
| AUTH-12 | idem | mauvais secret | `401` `{"error":"Invalid API secret"}` | — | — |
| AUTH-13 | idem | sans en-têtes | `401` `{"error":"Missing authentication headers (X-GMBS-Key-Id, X-GMBS-Secret)"}` | — | — |
| AUTH-14 | idem | `-H "X-GMBS-Timestamp: 1000"` | `401` `{"error":"Request timestamp too old or invalid"}` ; **sans** l'en-tête → `200` (anti-rejeu facultatif, `tenant-auth.ts` l. 58-68) | — | — |
| AUTH-15 | clé dont `scopes` ne contient pas `tokens:write` (UPDATE `api_keys SET scopes='{submissions:read}'`) | `POST $PORTAL/api/v1/tokens` (TOK-02) | `403` `{"error":"Missing required scope: tokens:write"}` | — | — |
| AUTH-16 | `UPDATE tenants SET subscription_status='expired'` sur le tenant de test | AUTH-10 | `403` `{"error":"Subscription expired. Please renew."}` ; remettre `trial` ensuite | `tenants` | — |
| AUTH-17 | `UPDATE api_keys SET revoked_at=now()` | AUTH-10 | `401` `{"error":"Invalid API key"}` ; remettre `NULL` | `api_keys` | — |

### 2.2 Génération du token / lien

| Id | Pré-condition | Action | Attendu | Table | Journal |
|---|---|---|---|---|---|
| TOK-01 | CRM avec `GMBS_PORTAL_BASE_URL=$PORTAL/api/v1` ; route `generate-link` portée ; session gestionnaire | `curl -s -X POST "$CRM/api/plugins/portal/generate-link" -H "Content-Type: application/json" -H "Cookie: <cookie session>" -d "{\"artisanId\":\"$ARTISAN_A\"}"` | `200` `{"token":"<64 hex>","portal_url":"$PORTAL/t/<token>","expires_at":"<+365 j>","created_at":…}` ; sans session → `401` | portail `portal_tokens` : nouvelle ligne `token_hash`, `token_prefix` (8 car.), `metadata{name,email,phone,company}`, `is_active=true` ; `audit_logs` `token.created` ; `tenant_usage.active_artisans_count` recalculé (trigger) | console CRM (SDK) |
| TOK-02 | clé avec scope `tokens:write` | `curl -s -X POST "$PORTAL/api/v1/tokens" -H "X-GMBS-Key-Id: $KEY_ID" -H "X-GMBS-Secret: $SECRET" -H "X-GMBS-Timestamp: $(date +%s000)" -H "Content-Type: application/json" -d "{\"crm_artisan_id\":\"$ARTISAN_A\",\"metadata\":{\"name\":\"Test A\"}}"` | `200` même forme ; noter `TOKEN_A` | idem | — |
| TOK-03 | TOK-02 fait | rejouer TOK-02 pour le même artisan | `200` nouveau token ; l'ancien passe `is_active=false` (rotation l. 69-76) ; `GET $PORTAL/api/v1/tokens/<ancien>/validate` → `401` `{"valid":false,"error":"Token revoked"}` | `portal_tokens` : une seule ligne active par (tenant, artisan) | — |
| TOK-04 | `UPDATE tenants SET allowed_artisans=1` ; A a un token actif | TOK-02 pour `ARTISAN_B` | `403` `{"error":"Artisan limit reached","limit":1,"current":1,"upgrade_url":"$PORTAL/pricing"}` (route `/pricing` inexistante) ; remettre `allowed_artisans` | — | — |
| TOK-05 | — | TOK-02 sans `crm_artisan_id` | `400` `{"error":"crm_artisan_id is required"}` ; corps non JSON → `400` `{"error":"Invalid JSON body"}` | — | — |
| TOK-06 | — | générer un token pour B (`TOKEN_B`) | `200` | — | — |

### 2.3 Validation du token

| Id | Pré-condition | Action | Attendu | Table | Journal |
|---|---|---|---|---|---|
| VAL-01 | `TOKEN_A` actif | `curl -s -i "$PORTAL/api/v1/tokens/$TOKEN_A/validate"` (public, sans en-tête) | `200` `{"valid":true,"artisan":{"crm_id":"$ARTISAN_A","name":"Test A"},"intervention_id":null}` | `portal_tokens.last_accessed_at` mis à jour | — |
| VAL-02 | `UPDATE portal_tokens SET expires_at = now() - interval '1 day' WHERE token_prefix='<8 premiers car.>'` | VAL-01 | `401` `{"valid":false,"error":"Token expired"}` ; remettre `expires_at` | — | — |
| VAL-03 | `UPDATE portal_tokens SET is_active=false …` | VAL-01 | `401` `{"valid":false,"error":"Token revoked"}` ; remettre | — | — |
| VAL-04 | — | `GET $PORTAL/api/v1/tokens/0000…/validate` (64 zéros) | `404` `{"valid":false,"error":"Token not found"}` | — | — |
| VAL-05 | token expiré (VAL-02) | `curl -s -i "$PORTAL/api/portal/report?token=$TOKEN_A&interventionId=$INTER_A"` | attendu `401` ; **observé** `200` (bug connu : `report/route.ts`, `report/submit/route.ts`, `photos/[photoId]/route.ts` ne vérifient pas `expires_at`) → à corriger (étape 8) | — | — |
| VAL-06 | token expiré | `GET $PORTAL/api/portal/crm/interventions?token=$TOKEN_A` | `401` `{"error":"Token expired"}` (cette route utilise `validatePortalToken`) | — | — |
| VAL-07 | — | même appel **sans** `?token=` | `401` `{"error":"Token required"}` | — | — |

### 2.4 Lecture des interventions de l'artisan et isolation

| Id | Pré-condition | Action | Attendu | Table | Journal |
|---|---|---|---|---|---|
| INT-01 | `TOKEN_A` ; portail configuré (`CRM_API_URL`, `GMBS_PORTAL_*`) ; `INTER_A` assignée à A | `curl -s "$PORTAL/api/portal/crm/interventions?token=$TOKEN_A" \| jq '.count, [.interventions[].id]'` | `200` ; `INTER_A` présente, `INTER_B` **absente** ; chaque élément a `id_inter, statusCode, cout_sst, assigned_user, owner, tenant` | — | console portail `[CRM Client] Request: $CRM/api/portal-external/artisan/$ARTISAN_A/interventions` |
| INT-02 (isolation) | `TOKEN_B` | même appel avec `TOKEN_B` | `INTER_B` présente, `INTER_A` absente | — | — |
| INT-03 (isolation, détail) | — | `curl -s -i "$PORTAL/api/portal/crm/interventions/$INTER_A?token=$TOKEN_B"` | proxy : `500` `{"error":"Not authorized - artisan not assigned to this intervention"}` (le proxy relaie l'erreur CRM en 500) ; direct CRM : `curl -s -i "$CRM/api/portal-external/intervention/$INTER_A?artisanId=$ARTISAN_B" -H "X-GMBS-Key-Id: $KEY_ID" -H "X-GMBS-Secret: $SECRET"` → `403` | — | — |
| INT-04 | — | direct CRM sans `artisanId` | `400` `{"error":"artisanId query parameter is required"}` | — | — |
| INT-05 | — | direct CRM avec un uuid d'intervention inexistant + `artisanId=$ARTISAN_A` | `403` (pas de ligne `intervention_artisans`) ; avec une ligne `intervention_artisans` orpheline → `404` `{"error":"Intervention not found"}` | — | — |
| INT-06 (faille) | — | `curl -s -i "$CRM/api/portal-external/intervention/$INTER_A/documents" -H "X-GMBS-Key-Id: $KEY_ID" -H "X-GMBS-Secret: $SECRET"` **sans** `artisanId` | **observé** `200` (documents lisibles sans vérification d'assignation, `documents/route.ts` l. 32) ; attendu après étape 3 : `400` | — | — |
| INT-07 (RGPD) | — | INT-01 puis `jq '.interventions[0] \| {owner, tenant, assigned_user}'` | observé : `owner.phone`, `tenant.phone`, `assigned_user.email` renvoyés quel que soit le statut ; attendu après étape 3 : `owner` absent, `tenant` seulement si statut ∈ `ACCEPTE/INTER_EN_COURS/SAV`, `assigned_user` sans email | — | — |
| INT-08 | artisan A inexistant (uuid aléatoire) | `GET $CRM/api/portal-external/artisan/<uuid>/interventions` (auth OK) | `404` `{"error":"Artisan not found"}` | — | — |
| INT-09 | A n'a aucune intervention | INT-01 | `200` `{"interventions":[],"count":0}` | — | — |

### 2.5 Lecture / dépôt des documents légaux de l'artisan

| Id | Pré-condition | Action | Attendu | Table | Journal |
|---|---|---|---|---|---|
| DOC-01 | `TOKEN_A` | `curl -s "$PORTAL/api/portal/crm/documents?token=$TOKEN_A" \| jq '.requiredDocuments, .documentsByKind'` | `200` `{"artisan":{id,name,email,phone,company},"documents":[…],"documentsByKind":{"kbis":null,…},"requiredDocuments":["kbis","assurance","cni_recto_verso","iban","decharge_partenariat"]}` | — | console portail `[CRM Client] Request: …/artisan/$ARTISAN_A/documents` |
| DOC-02 | un PDF de test `kbis.pdf` (~100 Ko) | `base64 -i kbis.pdf > kbis.b64 ; jq -n --rawfile b64 kbis.b64 '{kind:"kbis",filename:"kbis.pdf",mimeType:"application/pdf",base64Data:($b64\|gsub("\n";""))}' > payload.json ; curl -s -X POST "$PORTAL/api/portal/crm/documents?token=$TOKEN_A" -H "Content-Type: application/json" -d @payload.json` (corps écrit dans un fichier : un base64 passé en argument `-d "…$B64…"` dépasse `ARG_MAX` = 1 Mo sur macOS dès ~700 Ko de fichier, « argument list too long ») | `200` `{"success":true,"documentId":"<uuid>","url":"https://…/storage/v1/object/public/documents/artisans/$ARTISAN_A/kbis/<ts>-kbis.pdf","message":…}` ; l'URL est **publique** (bucket `documents`) | CRM `artisan_attachments` : ligne `kind='kbis'`, `file_size`, `mime_type` ; `artisans.statut_dossier` recalculé (`INCOMPLET` → `À compléter`) ; Storage `documents/artisans/$ARTISAN_A/kbis/…` | console CRM |
| DOC-03 | — | DOC-02 avec `"kind":"passeport"` | via le proxy portail : `500` `{"error":"Invalid document kind","details":"<stack>","artisanId":…,"crmUrl":…}` (le proxy ne vérifie pas `kind` ; `CRMClient.request` lève `Error(errorData.error)` sur tout `!res.ok`, `client.ts` l. 169-172, et le `catch` de `crm/documents/route.ts` l. 76-83 renvoie 500 avec la stack — fuite, cf. doc d'architecture §4.e) ; direct CRM `curl -s -i -X POST "$CRM/api/portal-external/artisan/$ARTISAN_A/documents" -H "X-GMBS-Key-Id: $KEY_ID" -H "X-GMBS-Secret: $SECRET" -H "Content-Type: application/json" -d @payload.json` (avec `kind=passeport`) : `400` `{"error":"Invalid document kind"}` (`DD: documents/route.ts` l. 129-131) | — | — |
| DOC-04 | — | DOC-02 sans `base64Data` | `400` `{"error":"Missing required fields"}` | — | — |
| DOC-05 (taille) | fichier de 6 Mo | DOC-02 (obligatoirement avec `-d @payload.json` : le base64 fait ~8 Mo) | en local : `200` (aucune limite côté CRM) ; sur Vercel : `413` (corps > 4,5 Mo) ; attendu après étape 3 : `413` explicite au-delà de 4 Mo | — | — |
| DOC-06 (MIME) | — | DOC-02 avec `"mimeType":"text/html"` et un corps HTML | **observé** `200` (aucun contrôle) ; attendu après étape 3 : `415` | — | — |
| DOC-07 (remplacement) | DOC-02 fait | rejouer DOC-02 (même `kind`) | `200` ; **observé** : UPDATE de la même ligne `artisan_attachments` (`documents/route.ts` l. 182), l'ancien fichier reste orphelin dans le Storage ; attendu après étape 3 : nouvelle ligne + `superseded_by` | `artisan_attachments` : 1 ligne `kbis` (observé) / 2 lignes (cible) | — |
| DOC-08 (route legacy portail) | bucket `artisan-uploads` créé | `curl -s -X POST "$PORTAL/api/portal/documents" -F "token=$TOKEN_A" -F "kind=iban" -F "file=@rib.pdf"` | `200` (stockage **portail**, table `artisan_documents`, `portal_submissions` type `document`) — route non utilisée par l'UI, à retirer ; fichier > 10 Mo → `400` ; MIME hors liste → `400` | portail `artisan_documents`, `portal_submissions` | — |

### 2.6 Soumission du rapport et des photos

| Id | Pré-condition | Action | Attendu | Table | Journal |
|---|---|---|---|---|---|
| REP-01 | bucket `artisan-uploads` ; `photo.jpg` (~500 Ko) | `curl -s -X POST "$PORTAL/api/portal/photos" -F "token=$TOKEN_A" -F "interventionId=$INTER_A" -F "comment=Après travaux" -F "file=@photo.jpg"` | `200` `{"photo":{"id":"<uuid>","url":"<URL signée 3600 s>","filename":…,"comment":"Après travaux"}}` | portail `intervention_photos` (`storage_path` `{tenant}/{artisan}/interventions/{inter}/photo_…`), `portal_submissions` type `photo` `synced_to_crm=false` | — |
| REP-02 | fichier de 11 Mo | REP-01 | `400` `{"error":"File too large. Max size: 10MB"}` | — | — |
| REP-03 | `doc.pdf` | REP-01 avec le PDF | `400` (MIME hors `image/jpeg,png,webp,heic,heif`, `photos/route.ts` l. 130-131) | — | — |
| REP-04 | — | `curl -s -X POST "$PORTAL/api/portal/report" -H "Content-Type: application/json" -d "{\"token\":\"$TOKEN_A\",\"interventionId\":\"$INTER_A\",\"content\":\"Remplacement du mitigeur.\"}"` | `200` `{"report":{"id":"<REPORT_ID>","content":…,"status":"draft",…}}` ; noter `REPORT_ID` | portail `intervention_reports` (`status='draft'`, `photo_ids` = photos de l'intervention) | aucun log en succès ; en erreur `Report insert error:` / `Report update error:` (`report/route.ts` l. 157, 178). Le préfixe `[portal-report]` appartient à la route v1 appelée par le CRM (REP-10) |
| REP-05 | aucune photo sur `INTER_B` | REP-04 avec `TOKEN_B`, `INTER_B` et `"content":""` | `400` `{"error":"Ajoutez au moins une photo avant de générer le rapport"}` ; avec une photo → `200` avec un **rapport mock** (`generateMockReport`, `report/route.ts` l. 129) : comportement à retirer | — | — |
| REP-06 | REP-01 + REP-04 faits ; CRM démarré ; `GMBS_CRM_BASE_URL`, `CRM_API_KEY_ID`, `CRM_API_SECRET` définis ; `INTER_A` en `INTER_EN_COURS` avec `assigned_user_id` | `curl -s -X POST "$PORTAL/api/portal/report/submit" -H "Content-Type: application/json" -d "{\"token\":\"$TOKEN_A\",\"interventionId\":\"$INTER_A\",\"reportId\":\"$REPORT_ID\"}"` | `200` `{"success":true,"message":"Rapport transmis avec succès"}` | portail : `intervention_reports.status='submitted'`, `submitted_at` ; `portal_submissions` type `report` ; `intervention_photos.synced_to_crm=true` (sans transfert). CRM : `interventions.has_portal_report=true` ; `intervention_reminders` ligne `user_id=assigned_user_id`, `note` commençant par `@<username> 📋 Rapport de l'inter #<id_inter> à vérifier`, `mentioned_user_ids=[assigned_user_id]`, `is_active=true` ; `comments` `comment_type='system'` « Rapport d'intervention reçu de l'artisan … » | console portail `[submit-report] CRM config: {baseUrl:✓,…}`, `[submit-report] CRM response: 200 {"success":true,…}` ; console CRM `[report-submitted] Success for intervention:` |
| REP-07 | — | REP-06 sans `reportId` | `400` `{"error":"Token, interventionId and reportId required"}` (c'est le bug UI du premier « Transmettre » sans brouillon préexistant, `InterventionReportTab.tsx` l. 106-121) | — | — |
| REP-08 (CRM injoignable) | CRM arrêté ou `GMBS_CRM_BASE_URL=http://localhost:9` | REP-06 sur un nouveau brouillon | **observé** `200` côté artisan (notification non bloquante), CRM jamais informé ; attendu cible : file d'attente + reprise | portail : rapport `submitted`, CRM : rien | console portail `[submit-report] Failed to notify CRM:` ou `CRM notification failed: <status>` |
| REP-09 (CRM lit le rapport) | REP-06 fait ; CRM avec `PORTAL_GMBS_BASE_URL=$PORTAL`, `PORTAL_API_KEY_ID`, `PORTAL_API_SECRET` | `curl -s "$CRM/api/portal-external/intervention/$INTER_A/report?artisanId=$ARTISAN_A"` **sans aucun en-tête** | **observé** `200` `{"report":{id,content,status:"submitted",…},"photos":[{id,url signée,filename,comment}]}` — route sans auth (faille) ; attendu après étape 4 : `401` sans session gestionnaire | — | console CRM `[get-report] Calling portal API:` |
| REP-10 (portail direct) | — | `curl -s -i "$PORTAL/api/v1/interventions/$INTER_A/report?artisanId=$ARTISAN_A" -H "X-GMBS-Key-Id: $KEY_ID" -H "X-GMBS-Secret: $SECRET"` | `200` même forme ; sans `artisanId` → `400` `{"error":"artisanId required"}` ; sans rapport soumis → `200` `{"report":null,"photos":[]}` (le portail ne renvoie jamais `404` pour un rapport absent : `report/route.ts` l. 59-60) ; sans en-têtes → `401` | — | console portail `[portal-report] Auth successful, tenant:` |
| REP-11 (405) | — | `curl -s -i -X POST "$CRM/api/portal-external/intervention/$INTER_A/report" -H "X-GMBS-Key-Id: $KEY_ID" -H "X-GMBS-Secret: $SECRET" -d '{}'` | `405` (route GET seulement ; `client.ts` l. 265 `submitInterventionReport` est donc inutilisable) ; attendu après étape 4 : `201` avec création `artisan_reports` | — | — |
| REP-12 (suppression photo) | photo non synchronisée | `curl -s -X DELETE "$PORTAL/api/portal/photos/<photoId>?token=$TOKEN_A"` | `200` ; après REP-06 (`synced_to_crm=true`) → refus (`4xx`) | `intervention_photos`, Storage | — |
| REP-13 (isolation, écriture croisée) | `TOKEN_A` ; `INTER_B` assignée à B seulement | `curl -s -i -X POST "$PORTAL/api/portal/report" -H "Content-Type: application/json" -d "{\"token\":\"$TOKEN_A\",\"interventionId\":\"$INTER_B\",\"content\":\"x\"}"` | **observé** `200` : `report/route.ts` l. 97-106 et l. 168-169 filtrent `intervention_reports` par (`crm_artisan_id` du token, `crm_intervention_id` fourni) sans jamais vérifier l'assignation côté CRM ; attendu après étape 8 : `403` (le portail doit appeler `GET …/intervention/{id}?artisanId=` — échange n° 6 — avant tout write dans `intervention_reports`/`intervention_photos`) | portail `intervention_reports` : ligne (A, `INTER_B`) créée (observé) / aucune (cible) | — |
| REP-14 (isolation, propagation CRM) | REP-13 fait ; CRM démarré | `curl -s -X POST "$PORTAL/api/portal/report/submit" -H "Content-Type: application/json" -d "{\"token\":\"$TOKEN_A\",\"interventionId\":\"$INTER_B\",\"reportId\":\"<id REP-13>\"}"` | **observé** `200` (`submit/route.ts` l. 45-48 idem, puis `report-submitted` CRM accepte un artisan non assigné, cf. NOTIF-04) : A pose `has_portal_report=true`, un reminder et un commentaire sur `INTER_B` ; attendu après étape 4 : `403` bloquant côté CRM, `INTER_B.has_portal_report` reste `false`, aucun `intervention_reminders` créé | CRM : `interventions.has_portal_report` de `INTER_B`, `intervention_reminders`, `comments` | console CRM `[report-submitted]` |

### 2.7 Notification CRM `report-submitted` (appel direct)

| Id | Pré-condition | Action | Attendu | Table | Journal |
|---|---|---|---|---|---|
| NOTIF-01 | `INTER_A` `INTER_EN_COURS`, `assigned_user_id` renseigné | `curl -s -i -X POST "$CRM/api/portal-external/intervention/$INTER_A/report-submitted" -H "X-GMBS-Key-Id: $KEY_ID" -H "X-GMBS-Secret: $SECRET" -H "Content-Type: application/json" -d "{\"artisanId\":\"$ARTISAN_A\",\"reportId\":\"<uuid>\",\"reportContent\":\"test\",\"photoCount\":2}"` | `200` `{"success":true,"message":"Report received and notification created"}` | `interventions.has_portal_report=true` ; `intervention_reminders` (1 ligne active pour `assigned_user_id`) ; `comments` système ; **pas** de ligne `artisan_reports` (observé) — attendu après étape 4 : 1 ligne `artisan_reports` | console CRM `[report-submitted] Success` ; UI CRM : sur `main`, **aucun toast** (créateur = mentionné, `useRemindersQuery.ts` l. 279-281) ; badge « À vérifier » seulement après étape 7 |
| NOTIF-02 | intervention sans `assigned_user_id` | NOTIF-01 | **observé** `200` ; `has_portal_report=true` ; **aucun reminder** (silencieux : `report-submitted/route.ts` l. 103 `if (intervention.assigned_user_id)`, personne n'est prévenu) ; commentaire créé. Attendu après étape 4 : reminder pour le repli — `mentioned_user_ids` = utilisateurs ayant `write_interventions` sur l'agence de l'intervention, ou `PORTAL_FALLBACK_USER_ID` | `intervention_reminders` (cible : 1 ligne, `mentioned_user_ids` non vide) | — |
| NOTIF-03 | — | NOTIF-01 sans `artisanId` | `400` `{"error":"artisanId required"}` ; intervention inexistante → `404` `{"error":"Intervention not found"}` ; sans en-têtes → `401` | — | — |
| NOTIF-04 (assignation) | `artisanId=$ARTISAN_B` sur `INTER_A` (B non assigné) | NOTIF-01 | **observé** `200` (vérification non bloquante, `maybeSingle` l. 55-70) ; attendu après étape 4 : `403` | — | — |
| NOTIF-05 (toast) | CRM ouvert dans le navigateur avec l'utilisateur assigné, patch `useRemindersQuery` (étape 7) | NOTIF-01 | toast sonner « Vous avez été identifié dans un reminder » avec la note, bouton « Voir » ouvrant le modal | — | realtime `intervention_reminders` |

### 2.8 Validation par le gestionnaire

| Id | Pré-condition | Action | Attendu | Table | Journal |
|---|---|---|---|---|---|
| VALID-01 | NOTIF-01 fait ; route `validate-report` portée avec `requirePermission('write_interventions')` ; session gestionnaire | `curl -s -i -X POST "$CRM/api/interventions/$INTER_A/validate-report" -H "Cookie: <cookie session>"` | `200` `{"success":true,"message":"Report validated, reminder deactivated"}` | `intervention_reminders.is_active=false` (observé : **tous** les reminders actifs de l'intervention ; attendu après étape 5 : uniquement celui du rapport) ; `comments` système « Rapport d'intervention validé par … » `author_id=<users.id>` ; après étape 5 : `artisan_reports.status='approved'`, `reviewed_by`, `reviewed_at` | console CRM |
| VALID-02 | intervention en `ACCEPTE` | VALID-01 | `400` `{"error":"Intervention is not in INTER_EN_COURS status"}` | — | — |
| VALID-03 | `has_portal_report=false` | VALID-01 | `400` `{"error":"No portal report found for this intervention"}` | — | — |
| VALID-04 | sans cookie | VALID-01 | `401` ; utilisateur sans `write_interventions` → `403` | — | — |
| VALID-05 (UI) | modal ouvert sur `INTER_A` | clic « Valider le rapport » puis « Enregistrer » avec commentaire | badge passe de « À vérifier » (violet) à « Terminée » ; `interventions.statut_id=INTER_TERMINEE` ; ligne `intervention_status_transitions` `INTER_EN_COURS → INTER_TERMINEE` ; `has_portal_report` reste `true` (sans effet visuel) | `interventions`, `intervention_status_transitions` | — |
| VALID-06 (abandon) | VALID-01 fait, modal fermé sans enregistrer | rouvrir le modal | statut toujours `INTER_EN_COURS`, badge « À vérifier » et bouton « Valider » de nouveau visibles alors que reminder clos et commentaire « validé » déjà écrit (incohérence connue) | — | — |

### 2.9 Idempotence

| Id | Pré-condition | Action | Attendu | Table | Journal |
|---|---|---|---|---|---|
| IDEMP-01 | REP-06 fait | rejouer REP-06 (même `reportId`) | portail : `400` `{"error":"Report already submitted"}` (`report/submit/route.ts` l. 55-59 : contrôle `status === 'submitted'` **avant** toute écriture `portal_submissions` l. 83-99 et avant l'appel CRM l. 133) ; aucune écriture, aucun appel CRM | portail : **0** nouvelle ligne `portal_submissions` ; CRM : toujours **1** reminder et **1** commentaire système. La non-idempotence côté CRM ne s'observe qu'en appel direct → IDEMP-02 | — |
| IDEMP-02 | — | NOTIF-01 deux fois de suite | `200` ×2 ; 1 reminder, 2 commentaires (observé) ; cible : 1 commentaire, 1 `artisan_reports` (clé `portal_report_id`) | `comments`, `intervention_reminders` | — |
| IDEMP-03 | — | TOK-02 deux fois (même artisan) | 2e appel : rotation (TOK-03), pas de doublon actif | `portal_tokens` | — |

### 2.10 Stripe (webhooks)

| Id | Pré-condition | Action | Attendu | Table | Journal |
|---|---|---|---|---|---|
| STRIPE-01 | Stripe CLI connecté ; `stripe listen --forward-to localhost:3001/api/v1/webhooks/stripe` (le `whsec_` affiché va dans `STRIPE_WEBHOOK_SECRET` du portail, puis redémarrer) | `WEBHOOK_URL=$PORTAL/api/v1/webhooks/stripe ./scripts/test-webhook.sh checkout` | `200` `{"received":true}` ; le script vérifie d'abord un `405` en GET | portail `tenants` (nouveau tenant `active`, plan par défaut `basic/10` car le prix du trigger n'est pas dans `PLAN_LIMITS`), `api_keys` (label `Production`), `audit_logs` `tenant.created_via_stripe` ; **secret loggé en clair** si pas d'email (l. 148) | console portail `[Stripe Webhook]` |
| STRIPE-02 | — | `curl -s -i -X POST "$PORTAL/api/v1/webhooks/stripe" -H "stripe-signature: t=1,v1=deadbeef" -d '{"type":"checkout.session.completed"}'` | `400` `{"error":"Invalid signature"}` ; sans en-tête → `400` `{"error":"Missing signature"}` | aucune écriture | — |
| STRIPE-03 | portail démarré **sans** `STRIPE_WEBHOOK_SECRET` | STRIPE-02 | **observé** `200` `{"error":"Webhook not configured"}` (masque une erreur de config) ; attendu : `500` | — | — |
| STRIPE-04 (CRM, faille) | CRM sans `STRIPE_WEBHOOK_SECRET` (état actuel), route `app/api/webhooks/stripe` portée | `curl -s -i -X POST "$CRM/api/webhooks/stripe" -H "Content-Type: application/json" -d '{"type":"customer.subscription.deleted","data":{"object":{"id":"sub_x","metadata":{"plugin_id":"portal_artisans"}}}}'` | **observé** `200` `{"received":true}` et `plugin_subscriptions.status='canceled'` **sans signature** (`route.ts` l. 25-38) ; attendu : `400` | `plugin_subscriptions` | — |
| STRIPE-05 (CRM, prix 0) | `STRIPE_PRICE_PORTAL_ARTISANS` = prix à 0 € ; session gestionnaire | `POST $CRM/api/plugins/portal_artisans/checkout` | `200` `{"activated":true}` ; `plugin_subscriptions` `status='active'`, `metadata.plan='starter'` ; prix payant → `{url}` Stripe Checkout mais `500` si la table `profiles` est absente | `plugin_subscriptions` | console CRM `[checkout]` (loggue la liste des cookies) |
| STRIPE-06 | `stripe trigger customer.subscription.updated` / `deleted` / `invoice.payment_failed` (script `update`, `delete`, `payment`) | `test-webhook.sh update` etc. | `200` ; `tenants.subscription_status` mis à jour ; `.single()` sur `stripe_customer_id` échoue si 0 ou > 1 tenant (erreur avalée, `200`) | `tenants`, `audit_logs` (`payment.failed`) | console portail |

### 2.11 Rate limiting, erreurs 5xx, CORS

| Id | Pré-condition | Action | Attendu | Table | Journal |
|---|---|---|---|---|---|
| RATE-01 | — | `for i in $(seq 1 60); do curl -s -o /dev/null -w "%{http_code}\n" "$PORTAL/api/v1/tokens/0000…/validate"; done \| sort \| uniq -c` | **observé** : 60 × `404` (aucun rate limit) ; attendu cible : `429` au-delà d'un seuil (Vercel Firewall / Upstash) | — | — |
| RATE-02 | — | même boucle sur `$CRM/api/portal-external/artisan/$ARTISAN_A/interventions` avec mauvais secret | 60 × `401` sans ralentissement (force brute possible) ; cible : `429` | — | — |
| ERR-01 | CRM arrêté | INT-01 | proxy portail `500` `{"error":"fetch failed"}` | — | console portail `[portal/crm/interventions] Error:` |
| ERR-02 | CRM renvoie `500` (ex. `SUPABASE_SERVICE_ROLE_KEY` absente → repli anon + RLS) | INT-01 | proxy `500` avec `error.message` du CRM relayé tel quel (fuite de détails `details/code/hint/table` de `interventions/route.ts` l. 60-68) | — | console CRM `[createServerSupabaseAdmin] SUPABASE_SERVICE_ROLE_KEY not set` |
| ERR-03 | portail arrêté | REP-09 | CRM `500` `{"error":…}` ou `{"report":null,"photos":[]}` selon le code ; le modal doit afficher « Aucun rapport » sans planter | — | console CRM `[get-report] Portal response status:` |
| ERR-04 | `PORTAL_GMBS_BASE_URL` absent côté CRM | REP-09 | `500` `{"error":"Portal configuration error"}` | — | console CRM `[get-report] Missing portal configuration` |
| CORS-01 | — | `curl -s -i -X OPTIONS "$PORTAL/api/v1/subscription/status" -H "Origin: https://evil.example" -H "Access-Control-Request-Method: GET"` | en local : aucun en-tête CORS (les en-têtes viennent de `vercel.json`, pas du code) ; sur Vercel : `Access-Control-Allow-Origin: *`, `Allow-Headers: Content-Type, X-GMBS-Key-Id, X-GMBS-Secret, X-GMBS-Timestamp` — trop large pour des routes serveur-à-serveur ; cible : supprimer le bloc `headers` de `vercel.json` (ou le restreindre à l'origine de l'app artisan) | — | — |
| CORS-02 | — | même appel sur `$CRM/api/portal-external/artisan/$ARTISAN_A/interventions` | aucun en-tête CORS (serveur-à-serveur) : conforme | — | — |
| CORS-03 (navigateur) | page `/t/<token>` ouverte sur `$PORTAL` | onglet Réseau : appels `/api/portal/*` | même origine, pas de préflight ; aucun appel direct du navigateur vers `$CRM` | — | DevTools |

### 2.12 Rotation de la paire M2M (étape 0 du plan, procédure §5.1 de la doc d'architecture)

| Id | Pré-condition | Action | Attendu | Table | Journal |
|---|---|---|---|---|---|
| ROT-01 | nouvelle paire créée via `setup-crm-tenant.ts` (2e ligne `api_keys` active), variables mises à jour des deux côtés et redéployées, **puis** `UPDATE api_keys SET revoked_at=now()` sur l'ancienne ligne | AUTH-10 et AUTH-01 avec la **nouvelle** paire ; AUTH-10 avec l'**ancienne** paire | nouvelle paire : `200` ×2 ; ancienne : `401` `{"error":"Invalid API key"}` (AUTH-17) ; REP-06 complet (portail → CRM) toujours `200` ; `vercel logs` des deux projets sans occurrence de l'ancien ni du nouveau secret | `api_keys` : exactement 1 ligne active pour le tenant « GMBS CRM Production » | — |

---

## 3. Tests automatisés à écrire

### 3.1 Côté CRM (Vitest, `tests/unit/**`, conventions `docs/guides/writing-tests.md`)

Pattern à copier : `tests/unit/api/auth-presence.test.ts` l. 5-17 (`vi.hoisted` + `vi.mock('@/lib/auth/permissions')` + `vi.mock('@/lib/supabase-admin')`, import direct du handler, `new NextRequest(...)`). Pour les routes `portal-external`, mocker `@/lib/supabase/server` (`createServerSupabaseAdmin`) avec `SupabaseMockBuilder` de `tests/__mocks__/supabase.ts`.

| Fichier | Cas |
|---|---|
| `tests/unit/lib/portal-external/auth.test.ts` | en-têtes absents → `{success:false}` ; mauvais secret → refus ; secret de longueur différente → refus **sans exception** (`timingSafeEqual` protégé) ; env absentes → code « non configuré » ; timestamp absent / périmé / futur → refus quand obligatoire ; signature HMAC valide → succès ; signature altérée → refus ; espaces autour des valeurs d'env (`.trim()`) |
| `tests/unit/api/portal-external/artisan-interventions.test.ts` | 401 sans en-têtes ; 404 artisan inconnu ; 200 liste filtrée par `intervention_artisans.artisan_id` ; `count` ; champs sensibles absents (`owner.phone`, `assigned_user.email`) ; `tenant` présent seulement pour `ACCEPTE/INTER_EN_COURS/SAV` ; `cout_sst` = `intervention_costs.cost_type='sst'` |
| `tests/unit/api/portal-external/intervention-detail.test.ts` | 400 sans `artisanId` ; 403 non assigné ; 404 inexistante ; 200 avec `documents.photos/devis/facturesArtisans` uniquement (jamais `facturesGMBS`) |
| `tests/unit/api/portal-external/intervention-documents.test.ts` | 400 sans `artisanId` (après correctif) ; 403 ; 200 kinds filtrés |
| `tests/unit/api/portal-external/artisan-documents.test.ts` | GET : forme `documentsByKind` avec les 5 kinds requis ; POST : 400 kind invalide, 400 champs manquants, 413 > limite, 415 MIME interdit, 200 insertion (nouvelle ligne, pas d'écrasement), chemin Storage attendu |
| `tests/unit/api/portal-external/report-submitted.test.ts` | 401 ; 400 sans `artisanId` ; 404 intervention ; 403 non assigné ; effets : `interventions.update({has_portal_report:true})`, reminder créé si aucun actif / mis à jour sinon, `mentioned_user_ids=[assigned_user_id]`, commentaire système ; sans `assigned_user_id` → reminder pour le repli (`write_interventions` de l'agence ou `PORTAL_FALLBACK_USER_ID`, après étape 4) ; idempotence : deux appels avec le même `portal_report_id` → une seule insertion `artisan_reports` |
| `tests/unit/api/portal-external/report-get.test.ts` | 401 sans session (`requirePermission('read_interventions')` mocké) ; 200 lecture `artisan_reports` + photos `intervention_attachments` ; `{report:null}` si aucun |
| `tests/unit/api/portal-external/events.test.ts` | 401 sans en-têtes ; 400 sans `Idempotency-Key` ; `account.activated` → `artisans.portal_account_status='active'` ; **double envoi avec la même `Idempotency-Key` → un seul effet, `200` les deux fois** (`portal_inbound_events` : 1 ligne) |
| `tests/unit/api/interventions/validate-report.test.ts` | 401/403 ; 400 statut ≠ `INTER_EN_COURS` ; 400 sans rapport ; 200 : seuls les reminders du rapport désactivés, commentaire avec `author_id`, `artisan_reports.status='approved'` ; rejet → `has_portal_report` retombe à `false` (trigger `trg_artisan_reports_sync_flag`, la route n'écrit pas le drapeau) |
| `tests/unit/lib/interventions/status-display.test.ts` (nouveau, fichier aujourd'hui exclu de la couverture dans `vitest.config.ts`) | `getStatusDisplay('INTER_EN_COURS', {hasPortalReport:true})` → `{label:'À vérifier', color:'#9333EA'}` ; autre statut + flag → label DB inchangé ; priorité `statusFromDb` conservée sans flag |
| `tests/unit/lib/common-utils.test.ts` (extension) | `mapInterventionRecord` : `statusLabel`/`statusColor` « À vérifier » si `INTER_EN_COURS && has_portal_report`, `has_portal_report` conservé |
| `tests/unit/hooks/useRemindersQuery.test.ts` | toast affiché si `mentioned_user_ids` contient l'utilisateur même s'il est `user_id` ; pas de toast sinon |
| `tests/unit/components/interventions/PortalReportSection.test.tsx` | états : sans artisan / sans rapport / rapport chargé ; bouton « Valider » visible seulement si `INTER_EN_COURS && hasPortalReport && report` |
| `tests/unit/lib/workflow/*` (existants) | doivent rester verts : aucune transition ajoutée |

Playwright (optionnel, `tests/e2e/portail-artisans.playwright.ts`) : scénario bout en bout avec les deux serveurs (`webServer` supplémentaire sur 3001) : login gestionnaire → génération du lien (ou seed direct d'un `portal_tokens`) → ouverture `/t/<token>` → dépôt d'un Kbis → photo + rapport → « Transmettre » → retour CRM : badge « À vérifier » → « Valider le rapport » → « Enregistrer » → statut Terminée. À exécuter uniquement contre une branche Supabase ou le jeu de test dédié.

### 3.2 Côté portail (aucune suite aujourd'hui) — Vitest minimal

Installer `vitest` + `@vitest/coverage-v8` en devDependencies, scripts `"test": "vitest run"` et `"typecheck": "tsc --noEmit"`, `vitest.config.ts` (`environment: 'node'`, alias `@/`). **Intégration continue** (aucune aujourd'hui : pas de `.github/` dans `portal_gmbs`, `package.json` l. 5-10 limité à `dev/build/start/lint`) : `.github/workflows/ci.yml` (`npm ci` → `npm run lint` → `npm run typecheck` → `npm test` → `npm run build`) et protection de branche ou « Ignored Build Step » sur Vercel, sinon ces tests ne seront jamais exécutés avant un déploiement (étape 8 de la doc d'architecture).

| Fichier | Cas |
|---|---|
| `tests/crypto-tokens.test.ts` | `generateToken()` : 64 hex, `hash = sha256(token)`, `prefix` 8 car. ; `hashToken` déterministe ; `computeHmacSignature` stable (vecteur connu) ; `verifyApiSecret` vrai/faux |
| `tests/tenant-auth.test.ts` (mock `getSupabaseAdmin`) | 401 sans en-têtes ; 401 clé inconnue / révoquée ; 401 mauvais secret (bcrypt mocké) ; 403 scope manquant ; 403 tenant `expired` ; 401 timestamp hors fenêtre ; 200 → `{tenant, apiKey}` |
| `tests/portal-token.test.ts` | token en query / body → succès ; en-tête `X-Portal-Token` **seul** → `400 Token required` (régression du bug : `validatePortalToken` l. 27-37 ne lit que `?token=` puis le corps JSON ; seul `getTokenFromRequest` l. 109-120 lit l'en-tête, et les proxys `api/portal/crm/*` ne l'utilisent que pour le test de présence, ex. `crm/interventions/route.ts` l. 13-19 — à corriger à l'étape 8 en faisant lire l'en-tête par `validatePortalToken`, puis inverser l'attendu) ; `Token revoked` ; `Token expired` ; `requireIntervention` |
| `tests/api-v1-tokens.test.ts` | quota `allowed_artisans` ; rotation ; `portal_url` construit avec `NEXT_PUBLIC_PORTAL_URL` |
| `tests/report-submit.test.ts` (mock `fetch`) | appel CRM avec `GMBS_CRM_BASE_URL`/`CRM_API_KEY_ID`/`CRM_API_SECRET` et corps `{artisanId, reportId, reportContent, photoCount}` ; absence de config → pas d'appel + succès ; erreur CRM → succès + log ; **artisan non assigné** (le `GET …/intervention/{id}?artisanId=` préalable répond `403`) → `403` sans écriture `intervention_reports`/`portal_submissions` ni appel `report-submitted` (régression REP-13/REP-14) |
| `tests/crm-client.test.ts` (mock `fetch`) | base URL = `GMBS_CRM_BASE_URL` + `/api/portal-external` (après unification) ; en-têtes `X-GMBS-*` (+ timestamp/signature après étape 8) ; `!res.ok` → `Error(errorData.error)` |
| `tests/routes-expiry.test.ts` | les routes `photos/[photoId]`, `report`, `report/submit` refusent un token expiré (régression VAL-05) |

---

## 4. Smoke test staging (Vercel preview)

1. Déployer une preview de chaque application : `vercel` (CRM, projet lié) et `vercel` dans `portal_gmbs` (projet `portal_gmbs`). Noter les deux URL `*.vercel.app`.
2. Variables **Preview** (noms) — CRM : `GMBS_PORTAL_KEY_ID`, `GMBS_PORTAL_SECRET`, `GMBS_PORTAL_BASE_URL` (= `https://<preview-portail>/api/v1`), `PORTAL_API_KEY_ID`, `PORTAL_API_SECRET`, `PORTAL_GMBS_BASE_URL` (= `https://<preview-portail>`), et si Stripe : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PORTAL_ARTISANS` ; portail : `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_PORTAL_URL` (= `https://<preview-portail>`), `GMBS_CRM_BASE_URL` (= `https://<preview-crm>`), `CRM_API_KEY_ID`, `CRM_API_SECRET`, `CRM_API_URL`, `GMBS_PORTAL_KEY_ID`, `GMBS_PORTAL_SECRET` (tant que l'étape 8 n'est pas faite), `STRIPE_*`. Vérifier avec `vercel env ls preview` (noms seulement). Attention : les previews CRM pointent sur la base **prod** sauf branche Supabase.
3. Checklist :
   - [ ] `GET https://<preview-portail>/api/v1/subscription/status` avec la paire de test → `200` (AUTH-10)
   - [ ] `GET https://<preview-crm>/api/portal-external/artisan/<A>/interventions` → `200` (AUTH-01) ; mauvais secret → `401`
   - [ ] génération d'un lien depuis le modal artisan (TOK-01) et ouverture de `/t/<token>` : onglets « Mes Documents » / « Interventions » chargés (INT-01, DOC-01)
   - [ ] dépôt d'un document ≤ 4 Mo → `200` ; 6 Mo → `413` (limite Vercel) (DOC-02, DOC-05)
   - [ ] photo + rapport + « Transmettre » → `200` ; reminder + commentaire créés côté CRM (REP-06) ; journaux Vercel `[submit-report] CRM response: 200`
   - [ ] modal CRM : rapport et photos visibles (REP-09) ; « Valider » puis « Enregistrer » → Terminée (VALID-05)
   - [ ] `GET https://<preview-portail>/api/portal/crm/debug?token=…` → **doit être 404** (route supprimée) ; idem `https://<preview-crm>/api/portal-external/debug`
   - [ ] `OPTIONS` sur une route `/api/v1/*` du portail : en-têtes CORS conformes à la décision (CORS-01)
   - [ ] Stripe : `stripe listen --forward-to https://<preview-portail>/api/v1/webhooks/stripe` + `test-webhook.sh checkout` → `200` et tenant créé (STRIPE-01) ; signature invalide → `400` (STRIPE-02)
   - [ ] aucun secret (clé, token, cookie) dans les journaux Vercel des deux projets (`vercel logs`)
   - [ ] rollback : supprimer le tenant/token/artisan de test créés pendant le smoke test

---

## 5. Journal de bord

| Test id | Date | Environnement (local / preview) | Résultat (OK / KO / N-A) | Notes (code HTTP observé, ticket, correctif) |
|---|---|---|---|---|
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |


---

## Compléments — revue du 2026-09-02 (démo locale, branche `deposedocsv2`)

Cas ajoutés après la revue du code backend ; en-têtes `H` et variables comme dans `docs/guides/demo-locale-portail.md` §4.

| Id | Pré-condition | Action | Attendu | Test unitaire |
|---|---|---|---|---|
| AUTH-08 (panne) | Supabase locale arrêtée (`supabase stop`) | `POST /api/portal-external/tokens/validate` avec un jeton bien formé | `503` `{valid:false, error:"Portal unavailable"}` — jamais `401` | `auth.test.ts` « 503 Portal unavailable » |
| LINK-01 (config) | CRM démarré en production **sans** `PORTAL_BASE_URL` | `POST /api/artisans/$KARIM/portal-link` | `503` `{error:"Portal not configured"}` ; aucun jeton désactivé ni créé (`select count(*) from artisan_portal_tokens where artisan_id=$KARIM and is_active` inchangé) | `portal-link.test.ts` |
| DOC-09 (SVG) | — | 9b avec `mimeType: image/svg+xml` | `415` `{error:"Unsupported media type"}` (liste fermée : PDF, JPEG, PNG, WebP) | `documents.test.ts`, `uploads.test.ts` |
| DOC-10 (octets) | — | 9b avec `mimeType: application/pdf` et un corps HTML en base64 | `415` `{error:"File content does not match mimeType"}` ; rien dans Storage ni `artisan_attachments` | `documents.test.ts` |
| DOC-11 (Content-Length) | — | 9b avec `-H "Content-Length: 7000000"` (corps quelconque) | `413` `{error:"Payload too large"}` avant lecture du corps | `http.test.ts` |
| PHO-03 (octets) | — | 4 avec `mimeType: image/png` et un PDF en base64 | `415` `{error:"File content does not match mimeType"}` | `photos.test.ts` |
| REP-10 (course) | DEMO-004 sans rapport | deux `POST …/report` simultanés avec deux `portal_report_id` différents (`curl … & curl … ; wait`) | un `201`, un `409` `{error:"Report already submitted"}` — jamais `500` ; une seule ligne `artisan_reports` | `report.test.ts` « 23505 → 409 » |
| DB-01 (suppression) | rapport `submitted` sur DEMO-003 (`has_portal_report = true`) | `delete from artisan_reports where intervention_id = $DEMO003` | `has_portal_report = false` (trigger sur `DELETE`) | simulation SQL (migration 99076) |
| DB-02 (prod) | base locale, transaction annulée | DDL `00065`/`00066`/`00068` de `origin/depose_docs` + 3 rapports legacy sur le même couple (dont 2 avec le même `portal_report_id`) + 1 jeton en clair, puis `\i supabase/migrations/99076_portal_demo_convergence.sql` deux fois | versions `1,2,3` ; un seul `portal_report_id` conservé (le plus récent) ; `token = NULL`, `token_hash = sha256(clair)` ; second rejeu sans erreur | — |
