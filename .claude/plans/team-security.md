# Team SECURITY - Tracker de Taches

> **Equipe :** Securite & Conformite
> **Branche :** `fix/audit-security`
> **Base :** `main`
> **Lead :** agent-security-lead
> **Statut global :** completed
> **Progression :** 6/7 (SEC-008 deleguee DEVOPS)

---

## Locks Actifs

| Fichier | Agent | Depuis | Tache |
|---------|-------|--------|-------|
| _(aucun)_ | | | |

---

## Taches

### Wave 2 - Corrections Securite

<!-- TASK:SEC-004 STATUS:completed OWNER:agent-sec-004:2026-02-10T21:40:00Z PRIORITY:critical WAVE:2 DEPENDS:none EFFORT:0.5d LOCKS:next.config.mjs -->
#### SEC-004 : Ajouter les headers HTTP de securite

**Description :** Ajouter les headers de securite manquants dans la configuration Next.js. Actuellement : 0 header de securite.

**Fichiers a modifier :**
- `next.config.mjs` - Ajouter la section `headers()`

**Headers a ajouter :**
```javascript
headers: async () => [{
  source: '/(.*)',
  headers: [
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-XSS-Protection', value: '1; mode=block' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    {
      key: 'Content-Security-Policy',
      value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co; connect-src 'self' https://*.supabase.co wss://*.supabase.co; font-src 'self' data:; frame-ancestors 'none';"
    },
    { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  ]
}]
```

**Criteres d'acceptation :**
- [x] 7 headers de securite configures dans next.config.mjs
- [x] CSP n'empeche pas le fonctionnement de l'app (Supabase, styles inline)
- [x] `npm run build` reussit
- [x] Verifiable avec `curl -I` sur le serveur de dev
- [x] Pas de regression fonctionnelle

**Commit :** `5b26de6` — 14 tests unitaires

---

<!-- TASK:SEC-005 STATUS:completed OWNER:agent-sec-005:2026-02-10T21:41:00Z PRIORITY:critical WAVE:2 DEPENDS:none EFFORT:0.5d -->
#### SEC-005 : Corriger le CORS wildcard sur les Edge Functions

**Description :** Remplacer `Access-Control-Allow-Origin: *` par une whitelist de domaines autorises dans les 3 Edge Functions encore en wildcard.

**Fichiers modifies :**
- `supabase/functions/interventions-v2/index.ts` — wildcard remplace par `getCorsHeaders(req)`
- `supabase/functions/interventions-v2-admin-dashboard-stats/index.ts` — idem
- `supabase/functions/interventions-v1-deprecated/index.ts` — idem

**Note :** Les 5 autres fonctions (artisans, artisans-v2, comments, documents, users, process-avatar) utilisaient deja `getCorsHeaders()` via `_shared/cors.ts`. push/pull sont des scripts Node.js server-side sans CORS.

**Criteres d'acceptation :**
- [x] 8 Edge Functions avec CORS restrictif (5 deja OK + 3 corrigees)
- [x] Whitelist configurable via variable d'environnement (SITE_URL)
- [x] Requetes OPTIONS (preflight) gerees correctement
- [x] Application fonctionne toujours depuis les domaines autorises
- [x] Requetes cross-origin non autorisees rejetees

**Commit :** `cdba0eb`

---

<!-- TASK:SEC-006 STATUS:completed OWNER:agent-sec-006:2026-02-10T21:43:00Z PRIORITY:critical WAVE:2 DEPENDS:none EFFORT:0.25d LOCKS:src/lib/api/permissions.ts -->
#### SEC-006 : Corriger le fail-open des permissions

**Description :** Dans `permissions.ts:172-196`, quand l'appel RPC echoue, le systeme accorde silencieusement les permissions (fail-open). Doit etre fail-secure (refuser par defaut).

**Fichiers modifies :**
- `src/lib/api/permissions.ts` — ajout `else if (error) { loadedFromDb = true }` (deny-all)

**Criteres d'acceptation :**
- [x] Erreur RPC = permissions minimales (deny-all)
- [x] Log d'erreur pour debugging
- [x] Pas de regression pour les cas nominaux (RPC fonctionne)
- [x] Test unitaire du comportement fail-secure (14 tests)
- [x] `npm run test` passe

**Commit :** `457a216` (cherry-pick de `3704c59`)

---

<!-- TASK:SEC-007 STATUS:completed OWNER:agent-sec-007:2026-02-10T21:42:00Z PRIORITY:high WAVE:2 DEPENDS:none EFFORT:0.25d LOCKS:app/api/auth/resolve/route.ts -->
#### SEC-007 : Proteger contre l'enumeration d'utilisateurs

**Description :** L'endpoint `/api/auth/resolve` revele si un email existe ou non dans le systeme (messages d'erreur differents). Doit retourner le meme message dans les deux cas.

**Fichiers modifies :**
- `app/api/auth/resolve/route.ts` — reponse uniforme + delai constant anti-timing

**Criteres d'acceptation :**
- [x] Reponse identique pour email existant et inexistant
- [x] Meme code HTTP (200) dans les deux cas
- [x] Meme temps de reponse approximatif (eviter timing attack)
- [x] Test unitaire verifiant le comportement (7 tests)
- [x] `npm run test` passe

**Commit :** `74743a5`

---

<!-- TASK:SEC-008 STATUS:pending OWNER:none PRIORITY:high WAVE:1 DEPENDS:none EFFORT:0.5d -->
#### SEC-008 : Corriger les vulnerabilites npm

**Description :** 38 vulnerabilites npm (34 high, 3 moderate, 1 low). Executer `npm audit fix` et mettre a jour les packages problematiques.

**Note :** Cette tache est executee par l'equipe DEVOPS en Wave 1 car elle touche `package.json`.

**Criteres d'acceptation :**
- [ ] `npm audit` rapporte 0 vulnerabilite high/critical
- [ ] Pas de breaking changes introduits
- [ ] `npm run build` reussit
- [ ] `npm run test` passe

**Delegation :** Executee par DEVOPS (Wave 1, package.json exclusif a DEVOPS).

---

<!-- TASK:SEC-009 STATUS:completed OWNER:agent-sec-009:2026-02-10T21:43:00Z PRIORITY:high WAVE:2 DEPENDS:none EFFORT:0.25d LOCKS:src/components/interventions/EmailEditModal.tsx -->
#### SEC-009 : Ajouter DOMPurify contre les XSS email

**Description :** Le composant `EmailEditModal.tsx` (ligne ~489) utilise `dangerouslySetInnerHTML` sans sanitization pour le rendu d'emails. Risque XSS.

**Fichiers modifies :**
- `src/components/interventions/EmailEditModal.tsx` — import DOMPurify + sanitize()

**Criteres d'acceptation :**
- [x] `dompurify` installe (deja en dependance)
- [x] Tout usage de `dangerouslySetInnerHTML` sanitize avec DOMPurify
- [x] Test unitaire verifiant que le HTML malicieux est nettoye (16 tests)
- [x] Rendu email toujours fonctionnel (HTML legitime preserve)
- [x] `npm run test` passe

**Commits :** `a5da542` (test) + `1d68732` (fix, cherry-pick de `6342142`)

---

<!-- TASK:SEC-010 STATUS:completed OWNER:agent-sec-010:2026-02-10T21:41:00Z PRIORITY:medium WAVE:2 DEPENDS:none EFFORT:0.25d LOCKS:app/api/auth/session/route.ts -->
#### SEC-010 : Reduire la duree de vie des tokens

**Description :** Les tokens de session ont une duree de vie trop longue. Reduire a des valeurs raisonnables.

**Fichiers modifies :**
- `app/api/auth/session/route.ts` — sameSite strict + maxAge corrige (access 1h, refresh 7j)

**Criteres d'acceptation :**
- [x] Token d'acces : duree <= 1 heure
- [x] Refresh token : duree <= 7 jours
- [x] SameSite strict sur tous les cookies
- [x] Pas de regression sur le login/logout
- [x] `npm run test` passe (4 tests)

**Commit :** `19d048e`

---

## Taches Wave 5 (Partielles - voir HANDOFF.md)

<!-- TASK:SEC-002 STATUS:pending OWNER:none PRIORITY:critical WAVE:5 DEPENDS:SEC-001 TYPE:partial -->
#### SEC-002 : JWT Auth sur Edge Functions (Partielle)
Voir HANDOFF.md pour les instructions de deploiement humain.

<!-- TASK:SEC-003 STATUS:pending OWNER:none PRIORITY:critical WAVE:5 DEPENDS:none TYPE:partial -->
#### SEC-003 : Restriction RLS (Partielle)
Voir HANDOFF.md pour les instructions de deploiement humain.

<!-- TASK:SEC-011 STATUS:pending OWNER:none PRIORITY:medium WAVE:5 DEPENDS:TEST-007 TYPE:partial -->
#### SEC-011 : Rate Limiting (Partielle)
Voir HANDOFF.md pour les instructions de deploiement humain.

---

## Historique

| Date | Tache | Action | Agent |
|------|-------|--------|-------|
| 2026-02-10 | ALL | Initialisation tracker | orchestrator |
| 2026-02-10 | SEC-004 | completed — 7 headers HTTP + 14 tests | agent-sec-004 |
| 2026-02-10 | SEC-005 | completed — CORS whitelist 3 fonctions | agent-sec-005 |
| 2026-02-10 | SEC-010 | completed — SameSite strict + maxAge fix | agent-sec-010 |
| 2026-02-10 | SEC-007 | completed — anti-enumeration + timing fix | agent-sec-007 |
| 2026-02-10 | SEC-009 | completed — DOMPurify sanitize + 16 tests | agent-sec-009 |
| 2026-02-10 | SEC-006 | completed — fail-secure permissions + 14 tests | agent-sec-006 |
| 2026-02-10 | ALL | Verification finale — 55 tests passent | security-lead |
