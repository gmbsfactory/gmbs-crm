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

Téléphone : sur le même Wi-Fi, remplacer `localhost` par l'IP du Mac dans `PORTAL_BASE_URL` (CRM) et `CRM_BASE_URL` (portail) puis redémarrer les deux serveurs ; sinon utiliser le mode « appareil mobile » des outils de développement du navigateur.

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
| Recherche « DEMO-003 » vide dans la barre du CRM | Vue matérialisée de recherche non rafraîchie après le seed | Passer par la liste filtrée par agence « Agence Démo Portail », ou `refresh materialized view concurrently interventions_search_mv` |
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
