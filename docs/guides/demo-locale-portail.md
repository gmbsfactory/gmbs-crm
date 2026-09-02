# Démo locale du portail artisans — scénario pas à pas

> Date : 2026-09-02. CRM sur la branche `deposedocsv2` (port 3000), portail `portal_gmbs` sur la branche `demo-local` (port 3001), Supabase **locale** uniquement (Docker, `http://127.0.0.1:54321`). Contrat d'API : [portail-demo-contrat-api.md](../architecture/portail-demo-contrat-api.md) ; contrat implémenté : [api-reference/portal-external.md](../api-reference/portal-external.md).

**Règle absolue pendant la démo : rien ne touche la production.** Aucune commande `--linked`, `db push`, `functions deploy`, `vercel`, `git push`. Le dossier `supabase/.temp` (lien vers le projet distant) est retiré ; les scripts `scripts/demo/*.sh` refusent toute URL non locale.

---

## 1. Ce que Gabriel va voir

| Côté | Écran | Ce qui se passe |
|---|---|---|
| CRM (ordinateur) | Fiche artisan **Karim Benali** → « Lien portail » | Le CRM génère un lien `http://localhost:3001/t/<jeton>` valable 30 jours |
| Téléphone / navigateur mobile | Ouvre le lien | Le portail valide le jeton auprès du CRM, pose un cookie et affiche **Missions** : les 6 missions de Karim (pas celles de Sofia ni Yanis) |
| Téléphone | Mission **DEMO-003** (Inter en cours) → onglet Photos | Envoie une photo « avant » puis « après » |
| Téléphone | Onglet Rapport | Remplit le rapport (travaux réalisés, durée, reste à faire…) et l'envoie |
| CRM | Liste / kanban des interventions | DEMO-003 passe en **« À vérifier »** (violet) sans changer de statut ; Badr reçoit un reminder « @badr 📋 Rapport de l'inter #DEMO-003 à vérifier » et un commentaire système apparaît |
| CRM | Détail DEMO-003 → rapport de l'artisan | Badr lit le rapport et les photos, **Valide** (ou refuse avec un commentaire) |
| Téléphone | Mission DEMO-003 → Rapport | Le statut du rapport devient « Validé » (ou « À corriger » : l'artisan renvoie une version 2) |
| Téléphone | **Dossier** | Dépose un Kbis (PDF), signe la décharge de partenariat au doigt |
| CRM | Fiche artisan → Documents | Les pièces déposées apparaissent avec le statut « à vérifier » (`review_status = pending`) |

### 1 bis. Déroulé de démonstration (≈ 10 minutes, ordre conseillé)

Pré-requis : les deux serveurs lancés (§3), base remise à zéro (§6) et téléphone (ou navigateur en mode « appareil mobile ») prêt.

| # | Où | Action | Ce qu'il faut montrer |
|---|---|---|---|
| 1 | CRM, ordinateur | Se connecter en `badr@gmbs.fr` / `badr123` | Le gestionnaire assigné aux 8 interventions de démo |
| 2 | CRM | Artisans → fiche **Karim Benali** → bouton **« Lien portail »** → **Copier** | Lien personnel `http://localhost:3001/t/<jeton>` valable 30 jours ; un nouveau lien révoque le précédent |
| 3 | Téléphone / navigateur | Ouvrir le lien | Écran **Missions** : 6 missions de Karim (DEMO-001…006, dont DEMO-006 « 2ᵉ artisan »), rien de Sofia ni Yanis |
| 4 | Téléphone | Mission **DEMO-003** (Inter en cours) → onglet **Photos** → « Avant travaux » → Photo/Galerie | La photo est compressée puis envoyée ; elle apparaît dans la galerie « Avant » |
| 5 | Téléphone | Onglet **Rapport** → travaux réalisés « Remplacement du mitigeur », durée, client présent → **Envoyer le rapport** | Bandeau « Envoyé, en attente de validation (version 1) » |
| 6 | CRM | Liste / kanban des interventions | DEMO-003 affichée **« À vérifier »** (violet) sans changement de statut ; toast + reminder « @badr 📋 Rapport de l'inter #DEMO-003 à vérifier » ; commentaire système « Rapport d'intervention reçu de Karim Benali » |
| 7 | CRM | Ouvrir DEMO-003 → section **« Rapport de l'artisan »** | Champs du rapport, photo « avant », artisan, version ; boutons **Valider le rapport** / **Demander une correction** |
| 8 | CRM | **Valider le rapport** | Toast, badge « À vérifier » retiré, reminder clos, commentaire « Rapport validé par … » |
| 9 | Téléphone | Mission DEMO-003 → Rapport | Bandeau **« Rapport validé le … »** |
| 10 | (variante refus) | Sur **DEMO-004** : envoyer un rapport, puis dans le CRM **Demander une correction** avec un commentaire (« Photos manquantes ») | Téléphone : bandeau « Rapport refusé, à corriger » + commentaire → **Corriger et renvoyer** → version 2 ; CRM : de nouveau « À vérifier » |
| 11 | Téléphone | Onglet **Dossier** → Kbis → **Déposer** (PDF ou photo) | Pièce « Déposée » (en attente de vérification), compteur 1 / 5 ; PDF > 3 Mo refusé avant envoi |
| 12 | Téléphone | Dossier → **Décharge de partenariat** → lire, cocher le consentement, signer au doigt → **Signer** | « Décharge signée le … » ; compteur 2 / 5 ; Compte affiche « 2 / 5 pièces » |
| 13 | CRM | Fiche artisan Karim → Documents | Kbis et décharge présents avec `review_status = pending` |
| 14 | (optionnel) | Fiche artisan **Sofia Martins** → Lien portail → ouvrir dans un autre navigateur | 2 missions seulement (DEMO-006, DEMO-007) ; un lien bidon → page « Lien invalide ou expiré » |

Astuces : régénérer le lien de Karim pendant la démo montre la révocation (l'ancien téléphone est renvoyé sur « Lien invalide », cookie supprimé) ; la recherche « DEMO-003 » dans la barre du CRM retrouve l'intervention (vues de recherche rafraîchies par le seed).

---

## 2. Comptes et données locales

| Élément | Valeur |
|---|---|
| Gestionnaire (assigné aux 8 interventions) | `badr@gmbs.fr` / `badr123` |
| Administrateur | `admin@gmbs.fr` / `admin` |
| Artisans de démo | Karim Benali (plombier, 6 missions dont 1 en second), Sofia Martins (électricienne, 2), Yanis Roux (serrurier, 1) |
| Interventions | `DEMO-001`, `DEMO-002`, `DEMO-008` : Accepté · `DEMO-003`, `DEMO-004`, `DEMO-006` : Inter en cours · `DEMO-005`, `DEMO-007` : Inter terminée |
| Agence | « Agence Démo Portail » |

Identifiants fixes utiles (seed `supabase/seeds/seed_demo_portail.sql`) :

| Objet | UUID |
|---|---|
| Karim Benali | `d0000000-0000-4000-8000-00000000a001` |
| Sofia Martins | `d0000000-0000-4000-8000-00000000a002` |
| DEMO-003 (Karim, Inter en cours) | `d0000000-0000-4000-8000-000000010003` |
| DEMO-004 (Karim, Inter en cours) | `d0000000-0000-4000-8000-000000010004` |
| DEMO-005 (Karim, Inter terminée → rapport refusé 409) | `d0000000-0000-4000-8000-000000010005` |
| DEMO-007 (Sofia seule → 404 avec le jeton de Karim) | `d0000000-0000-4000-8000-000000010007` |

---

## 3. Lancement (dans l'ordre)

```bash
cd /Users/andrebertea/Projects/gmbs-crm

# 1. Supabase locale (pile allégée : studio, analytics, inbucket désactivés)
supabase start
supabase db reset            # SANS option : migrations (dont 99076) + seeds locaux, ~3 min

# 2. Données de démo (idempotent, rejouable)
scripts/demo/load-seed.sh

# 3. CRM (lit .env.demo.local, refuse toute URL non locale)
scripts/demo/start-crm.sh    # http://localhost:3000

# 4. Portail (dépôt portal_gmbs, branche demo-local)
cd /Users/andrebertea/Projects/GMBS/portal_gmbs && scripts/demo/start-portal.sh   # http://localhost:3001
```

Variables de `.env.demo.local` du CRM (noms seulement) : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL`, `GMBS_PORTAL_KEY_ID`, `GMBS_PORTAL_SECRET`, `PORTAL_BASE_URL` (= `http://localhost:3001`), `PORTAL_FALLBACK_USER_ID`. Les clés locales s'obtiennent avec `supabase status -o env`. **Ne jamais copier les valeurs dans un fichier commité.**

Téléphone : sur le même Wi-Fi, remplacer `localhost` par l'IP du Mac (`ipconfig getifaddr en0`) dans `PORTAL_BASE_URL` (CRM) et `CRM_BASE_URL` (portail) puis redémarrer les deux serveurs ; sinon utiliser le mode « appareil mobile » des outils de développement du navigateur.

**Limite connue (pas de correctif prévu pour la démo)** : les URL des photos et des pièces renvoyées par le CRM pointent sur le Storage de la Supabase locale, `http://127.0.0.1:54321/storage/v1/object/public/documents/…`. Elles s'affichent depuis le navigateur du Mac (vérifié : `200 image/png`, `200 application/pdf`) mais pas depuis un téléphone, pour qui `127.0.0.1` est lui-même. Depuis un téléphone sur le même Wi-Fi, remplacer `127.0.0.1` par l'IP du Mac dans l'URL (ou montrer les vignettes et la section « Rapport de l'artisan » depuis le navigateur du Mac). Une vraie mise en service utiliserait l'URL publique du projet Supabase.

---

## 4. Vérification technique bout en bout (curl)

Résultat obtenu le 2026-09-02 contre le CRM local (`scripts/demo/start-crm.sh`) après `supabase db reset` + `load-seed.sh`. Placeholders : `<KEY_ID>`, `<SECRET>` (valeurs de `.env.demo.local`), `<COOKIE>` (session de badr), `<TOKEN>` (jeton reçu à l'étape 1).

```bash
export CRM=http://localhost:3000
export KARIM=d0000000-0000-4000-8000-00000000a001
export DEMO003=d0000000-0000-4000-8000-000000010003
H=(-H "X-GMBS-Key-Id: <KEY_ID>" -H "X-GMBS-Secret: <SECRET>" -H "Content-Type: application/json")
```

**Session gestionnaire pour curl.** Les routes internes lisent la session dans les cookies `@supabase/ssr` (`sb-127-auth-token`, éventuellement découpé en `.0`, `.1`) et le middleware exige le cookie `crm_session_date` = date du jour (Europe/Paris). Le plus simple : se connecter dans le navigateur en `badr@gmbs.fr` et copier l'en-tête `Cookie` d'une requête vers `/api/...` (outils de développement → Réseau). Sans session, ces routes répondent `307` vers `/login`.

| # | Commande | Résultat obtenu |
|---|---|---|
| 1 | `curl -X POST $CRM/api/artisans/$KARIM/portal-link -H "Cookie: <COOKIE>"` | **200** `{url:"http://localhost:3001/t/<64 hex>", expires_at}` ; sans session : **307** |
| 2 | `curl -X POST $CRM/api/portal-external/tokens/validate "${H[@]}" -d '{"token":"<TOKEN>"}'` | **200** `{valid:true, artisan:{prenom:"Karim", nom:"Benali", statut_code:"CONFIRME", …}}` |
| 2b | idem avec un jeton inconnu | **401** `{valid:false, error:"Token invalid"}` |
| 2c | idem avec un mauvais secret | **401** `{error:"Invalid credentials"}` |
| 3 | `curl $CRM/api/portal-external/me "${H[@]}" -H "X-Portal-Token: <TOKEN>"` | **200** `counters {missions_total:6, missions_terminees:1, missions_en_cours:5}`, `documents {required:5, present:0}` |
| 3b | `curl $CRM/api/portal-external/me/interventions …` | **200** `count=6` : DEMO-005, 003, 006 (role secondary), 004, 001, 002 — locataire absent sur DEMO-005 (terminée), aucun champ propriétaire / `commentaire_agent` / e-mail gestionnaire |
| 3c | `curl $CRM/api/portal-external/me/interventions/<DEMO-007> …` (mission de Sofia) | **404** `{error:"Intervention not found"}` |
| 3d | `curl $CRM/api/portal-external/me/interventions/$DEMO003 …` | **200** `agence.nom="Agence Démo Portail"`, `documents.photos=[]`, `report=null` |
| 4 | `curl -X POST …/me/interventions/$DEMO003/photos … -d '{"filename":"avant.png","mimeType":"image/png","base64Data":"<PNG base64>","phase":"avant","comment":"Fuite visible"}'` | **201** `{attachment:{id, url, filename, metadata:{source:"portal", phase:"avant", …}}}` ; l'URL publique Storage répond **200** |
| 4c | idem avec `mimeType: image/gif` | **415** `{error:"Unsupported media type"}` |
| 5 | `curl -X POST …/me/interventions/$DEMO003/report … -d '{"portal_report_id":"<uuid>","travaux_realises":"…","duree_minutes":90,"reste_a_faire":false,"client_present":true,"attachment_ids":["<id photo>"]}'` | **201** `{report:{status:"submitted", version:1, …}}` ; en base : `has_portal_report = true`, reminder actif `@badr 📋 Rapport de l'inter #DEMO-003 à vérifier - soumis par Karim Benali. 1 photo(s) jointe(s).`, commentaire système « Rapport d'intervention reçu de Karim Benali. En attente de validation. » |
| 5b | même corps rejoué (même `portal_report_id`) | **200** même rapport (`version 1`) |
| 5c | même corps sur DEMO-005 (Inter terminée) | **409** `{error:"Intervention status does not allow a report"}` |
| 5d | même corps sur DEMO-007 (non affecté) | **404** |
| 6 | `curl $CRM/api/interventions/$DEMO003/portal-report -H "Cookie: <COOKIE>"` | **200** `report.status="submitted"`, `photos.length=1`, `artisan.prenom="Karim"` |
| 7 | `curl -X POST $CRM/api/interventions/$DEMO003/portal-report/review -H "Cookie: <COOKIE>" -H "Content-Type: application/json" -d '{"decision":"approved","comment":"Bon travail"}'` | **200** `report.status="approved"`, `reviewed_at` renseigné ; en base : `has_portal_report = false`, 0 reminder actif, commentaire « Rapport validé par … : Bon travail » |
| 7b | review rejouée | **409** `{error:"Ce rapport a déjà été traité"}` |
| 8 | `curl $CRM/api/portal-external/me/interventions/$DEMO003/report …` | **200** `report.status="approved"`, `review_comment="Bon travail"` |
| 9 | `curl $CRM/api/portal-external/me/documents …` | **200** `documents=[]` |
| 9b | `curl -X POST …/me/documents … -d '{"kind":"kbis","filename":"kbis.pdf","mimeType":"application/pdf","base64Data":"<PDF base64>"}'` | **201** `{document:{id, kind:"kbis", url}}` |
| 9c | idem avec `kind: passeport` | **400** `{error:"Invalid document kind"}` |
| 9d | `curl -X POST …/me/documents/decharge/sign … -d '{"signer_name":"Karim Benali","consent":true,"signature_png_base64":"<PNG base64>"}'` | **201** `{document:{id, url}, signed_at}` |
| 9e | idem avec `consent:false` | **400** `{error:"consent must be true"}` |
| 9f | `curl $CRM/api/portal-external/me …` | **200** `documents {required:5, present:2}` |

Cycle rejet → resoumission (DEMO-004) : rapport v1 **201** (`has_portal_report = true`) → second envoi avec un autre `portal_report_id` **409** « Report already submitted » → review `rejected` **200** (`has_portal_report = false`, reminder clos, commentaire « Rapport refusé par … : Photos manquantes ») → nouvel envoi **201** `version 2` (`has_portal_report = true`).

Vérifications SQL (base locale) :

```bash
DB=$(supabase status -o env | sed -n 's/^DB_URL="\(.*\)"/\1/p')
psql "$DB" -c "select id_inter, has_portal_report from interventions where id_inter like 'DEMO-%' order by 1"
psql "$DB" -c "select intervention_id, version, status, reviewed_at from artisan_reports order by submitted_at"
psql "$DB" -c "select note, is_active from intervention_reminders where note like '%📋 Rapport%'"
```

---

## 4 bis. Ce qui a été vérifié le 2026-09-02 **par le portail** (intégration)

Même base et mêmes serveurs que §4, mais chaque appel passe par le portail (`http://localhost:3001`, pot de cookies curl `-c/-b`) qui relaie vers le CRM ; les routes internes sont appelées avec la session de badr fabriquée par `@supabase/ssr`. Rejoué à l'identique après les correctifs de revue (cookie supprimé sur 401, service worker, limite du dossier).

| Étape | Appel | Résultat obtenu |
|---|---|---|
| a | `POST` CRM `/api/artisans/{Karim}/portal-link` (badr) | **200** `{url: http://localhost:3001/t/<64 hex>, expires_at: +30 j}` |
| b | `GET` portail `/t/{token}` | **303** → `/app/missions`, cookie `portal_token` posé (HttpOnly) |
| c | `GET /app/missions` avec le cookie | **200** `text/html` (app-shell ; la liste est chargée côté client via l'étape d) ; sans cookie : **307** → `/lien-invalide` |
| d | `GET /api/portal/me/interventions` | **200** `count = 6` : DEMO-005 (terminée), 003, 006 (2ᵉ artisan), 004, 001, 002 |
| e | `GET /api/portal/me/interventions/{DEMO-003}` | **200** agence « Agence Démo Portail », 0 photo, `report = null`, locataire présent |
| f | `POST …/{DEMO-003}/photos` (PNG 1×1, phase avant) | **201** `metadata.artisan_id = Karim` ; URL Storage → **200** `image/png` |
| g | `POST …/{DEMO-003}/report` (« Remplacement du mitigeur », client présent, 1 photo) | **201** `submitted v1` ; rejeu même `portal_report_id` → **200** `v1` ; base : `has_portal_report = true`, 1 reminder actif, commentaire système |
| h | `GET` CRM `/api/interventions/{DEMO-003}/portal-report` (badr) | **200** `submitted`, 1 photo (`url`), artisan Karim Benali ; Edge Function `interventions-v2?search=DEMO-003` → `has_portal_report = true` (les 7 autres à `false`) |
| i | `POST` CRM `…/portal-report/review` `{approved, "Bon travail"}` | **200** `approved` ; base : `has_portal_report = false`, reminder clos |
| j | `GET` portail `…/{DEMO-003}/report` | **200** `approved`, `review_comment = "Bon travail"` |
| k | Cycle refus sur DEMO-004 | rapport v1 **201** → second envoi (autre `portal_report_id`) **409** « Report already submitted » → review `rejected` + « Photos manquantes » **200** → portail voit `rejected` + commentaire **200** → nouveau rapport **201** `v2` ; base : `1:rejected 2:submitted`, `has_portal_report = true` |
| l | Dossier | `GET /api/portal/me/documents` **200** (0 / 5) → `POST` kbis (PDF) **201** (URL → **200** `application/pdf`) → `POST decharge/sign` (PNG) **201** `signed_at` → `GET /api/portal/me` **200** `documents {required 5, present 2}` |
| m | Lien de Sofia | portal-link **200**, `/t/` **303**, missions **200** `count = 2` (DEMO-007, DEMO-006) ; DEMO-003 avec le jeton de Sofia → **404** |
| n | Jeton bidon | `/t/<64 zéros>` **303** → `/lien-invalide` sans cookie ; `/t/abc` **303** → `/lien-invalide` (**200** en suivant) |
| n' | Ancien jeton de Karim après régénération du lien | **401** « Token revoked » + `Set-Cookie: portal_token=; Expires=1970` (cookie supprimé par le proxy) |

Recherche : `search_global('DEMO-003')` (RPC utilisée par la barre de recherche, appelée via PostgREST avec la session de badr) renvoie l'intervention DEMO-003 après `load-seed.sh` (le seed rafraîchit désormais `interventions_search_mv`, `artisans_search_mv` et `global_search_mv`).

---

## 5. Dépannage

| Symptôme | Cause probable | Correctif |
|---|---|---|
| `scripts/demo/start-crm.sh` refuse de démarrer | `NEXT_PUBLIC_SUPABASE_URL` non locale ou `supabase/.temp/project-ref` présent | Corriger `.env.demo.local` ; retirer `supabase/.temp` (ne pas relier la prod) |
| `503 Portal not configured` | `GMBS_PORTAL_KEY_ID` / `GMBS_PORTAL_SECRET` absents du shell du CRM | Vérifier `.env.demo.local` puis relancer `start-crm.sh` |
| `401 Invalid credentials` | Clé/secret du portail ≠ ceux du CRM | Même paire dans les deux `.env.demo.local` (`CRM_API_KEY_ID`/`CRM_API_SECRET` côté portail) |
| `401 Token invalid / expired / revoked` | Lien ancien (un nouveau lien désactive les précédents), > 30 j, artisan désactivé | Régénérer le lien depuis la fiche artisan |
| `503 Portal unavailable` | Supabase locale arrêtée ou `SUPABASE_SERVICE_ROLE_KEY` incorrecte (le CRM ne confond pas une panne avec un jeton faux) | `supabase start`, vérifier les clés avec `supabase status -o env` |
| `415 File content does not match mimeType` | Les octets du fichier ne correspondent pas au `mimeType` déclaré (liste fermée : PDF, JPEG, PNG, WebP) | Envoyer le bon type (pas de SVG/HEIC/GIF dans la démo) |
| Le portail affiche 0 mission | Seed non chargé, ou jeton d'un autre artisan | `scripts/demo/load-seed.sh` ; vérifier `select count(*) from intervention_artisans where artisan_id='d0000000-0000-4000-8000-00000000a001'` (= 6) |
| Photo `500 Upload failed` | Bucket `documents` absent ou type MIME non autorisé par le bucket | `select id, public from storage.buckets` ; recréer via `supabase db reset` |
| `409` à l'envoi du rapport | Statut ∉ Accepté / Inter en cours / SAV, ou rapport déjà soumis / validé | Choisir DEMO-003/004/006, ou refuser le rapport côté CRM pour ouvrir une version 2 |
| « À vérifier » n'apparaît pas dans le CRM | Edge Function locale sans `has_portal_report` | `supabase functions serve` recharge `supabase/functions/interventions-v2/_lib/helpers.ts` ; sinon `supabase stop && supabase start` |
| Recherche « DEMO-003 » vide dans la barre du CRM | Vues matérialisées de recherche non rafraîchies (seed chargé avec une ancienne version) | Relancer `scripts/demo/load-seed.sh` (rafraîchit les vues en fin de seed) ou `refresh materialized view interventions_search_mv` |
| Le téléphone affiche « Lien invalide » juste après un nouveau lien | Comportement attendu : un nouveau lien révoque les précédents (401 « Token revoked », cookie supprimé) | Ouvrir le nouveau lien |
| Photo ou PDF non affichés depuis le téléphone | URL Storage `127.0.0.1:54321` (limite connue, §3) | Remplacer `127.0.0.1` par l'IP du Mac dans l'URL, ou montrer depuis le Mac |
| « Fichier trop volumineux » sur le dossier | Limite portail 3 Mo par fichier (CRM : 4 Mo de base64) ; les images sont compressées automatiquement, pas les PDF | Réduire le PDF ou le photographier |
| Routes internes répondent `307` en curl | Pas de session (cookies) ou `crm_session_date` absent | Copier l'en-tête `Cookie` du navigateur (§4) |
| `supabase db reset` échoue sur 99076 | Objet portail créé à la main avec une DDL différente | `drop table artisan_reports, artisan_portal_tokens cascade` puis relancer (base locale uniquement) |

---

## 6. Remise à zéro entre deux répétitions

```bash
DB=$(supabase status -o env | sed -n 's/^DB_URL="\(.*\)"/\1/p')
psql "$DB" -c "delete from artisan_reports; delete from artisan_portal_tokens;
  delete from intervention_attachments where metadata->>'source' = 'portal';
  delete from artisan_attachments where metadata->>'source' = 'portal';
  delete from intervention_reminders where note like '%📋 Rapport%';
  delete from comments where comment_type = 'system' and content like 'Rapport%';"
```

(`has_portal_report` est recalculé par trigger ; les fichiers Storage restent, sans impact.) Pour repartir de zéro : `supabase db reset` puis `scripts/demo/load-seed.sh`.
