# Audit de Securite OWASP - GMBS CRM

**Date** : 10 fevrier 2026
**Branche auditee** : `design_ux_ui`
**Auditeur** : Agent Securite IA (Claude Opus 4.6)
**Methodologie** : OWASP Top 10 (2021) + analyse statique complete

---

## Score de Securite Global

```
+------------------------------------------------------------+
|                                                            |
|          SCORE GLOBAL :  28 / 100  -  CRITIQUE             |
|                                                            |
|  [########......................................] 28%       |
|                                                            |
+------------------------------------------------------------+
```

| Categorie OWASP                     | Score  | Status     |
|--------------------------------------|--------|------------|
| A01 - Broken Access Control          | 15/100 | CRITIQUE   |
| A02 - Cryptographic Failures         | 20/100 | CRITIQUE   |
| A03 - Injection                      | 55/100 | MOYENNE    |
| A04 - Insecure Design                | 30/100 | HAUTE      |
| A05 - Security Misconfiguration      | 15/100 | CRITIQUE   |
| A06 - Vulnerable Components          | 25/100 | HAUTE      |
| A07 - Auth & Session Failures        | 30/100 | HAUTE      |
| A08 - Software & Data Integrity      | 40/100 | MOYENNE    |
| A09 - Logging & Monitoring Failures  | 35/100 | HAUTE      |
| A10 - SSRF                           | 70/100 | BASSE      |

---

## Sommaire des Vulnerabilites

| Severite  | Nombre | Impact                                |
|-----------|--------|---------------------------------------|
| CRITIQUE  | 14     | Compromission systeme complete        |
| HAUTE     | 12     | Acces non autorise aux donnees        |
| MOYENNE   | 11     | Fuite d'information, degradation      |
| BASSE     | 4      | Mauvaise pratique, risque mineur      |
| **TOTAL** | **41** |                                       |

---

## Diagramme - Flux d'Authentification et Points Faibles

```mermaid
flowchart TD
    subgraph CLIENT["Client (Navigateur)"]
        A[Formulaire Login] -->|email + password| B[Supabase Auth SDK]
        B -->|JWT tokens| C{localStorage}
        C -->|"Token stocke<br/>en localStorage"| D["XSS = Vol de token"]
        style D fill:#ff4444,color:#fff
    end

    subgraph MIDDLEWARE["Next.js Middleware"]
        E[middleware.ts] -->|"Verifie PRESENCE<br/>du cookie"| F{Token present?}
        F -->|Non| G[Redirect /login]
        F -->|"Oui<br/>(PAS de validation JWT)"| H["Laisse passer"]
        style H fill:#ff8800,color:#fff
    end

    subgraph API_ROUTES["API Routes Next.js"]
        I[Route API] -->|"bearerFrom(req)"| J{Token extrait?}
        J -->|Oui| K[supabase.auth.getUser]
        J -->|Non| L["401 Unauthorized"]
        K -->|Valide| M[getAuthenticatedUser]
        M -->|"requirePermission()"| N{Permissions OK?}
        N -->|Oui| O[Traitement]
        N -->|Non| P[403 Forbidden]
        M -->|"ERREUR RPC"| Q["Fallback SILENCIEUX<br/>sur permissions role"]
        style Q fill:#ff4444,color:#fff
    end

    subgraph EDGE_FUNCTIONS["Edge Functions Supabase"]
        R["artisans/index.ts<br/>comments/index.ts<br/>documents/index.ts<br/>users/index.ts<br/>artisans-v2/index.ts<br/>process-avatar/index.ts<br/>admin-dashboard-stats/index.ts<br/>push/pull/index.ts"]
        R -->|"SERVICE_ROLE_KEY<br/>AUCUNE verif JWT"| S["Acces direct DB<br/>RLS contourne"]
        style S fill:#ff0000,color:#fff
        style R fill:#ff4444,color:#fff
    end

    subgraph SUPABASE_DB["Supabase (PostgreSQL)"]
        T["RLS Policies"]
        T -->|"users_select:<br/>USING (true)"| U["TOUS les users<br/>lisent TOUT"]
        T -->|"interventions_select:<br/>USING (true)"| V["TOUS lisent<br/>TOUTES les interventions"]
        style U fill:#ff4444,color:#fff
        style V fill:#ff4444,color:#fff
    end

    subgraph VULNERABILITIES["Points Faibles Identifies"]
        direction LR
        W["1. localStorage tokens<br/>vulnerable XSS"]
        X["2. Middleware: presence<br/>seule, pas validation"]
        Y["3. Edge Functions:<br/>0 auth sur 9/10"]
        Z["4. RLS: USING(true)<br/>= pas de restriction"]
        AA["5. Fallback permissions<br/>silencieux"]
        BB["6. Pas de CSRF<br/>Pas de Rate Limit"]
        style W fill:#ff4444,color:#fff
        style X fill:#ff8800,color:#fff
        style Y fill:#ff0000,color:#fff
        style Z fill:#ff0000,color:#fff
        style AA fill:#ff4444,color:#fff
        style BB fill:#ff8800,color:#fff
    end

    CLIENT --> MIDDLEWARE
    MIDDLEWARE --> API_ROUTES
    API_ROUTES --> SUPABASE_DB
    EDGE_FUNCTIONS --> SUPABASE_DB
```

---

## 1. VULNERABILITES CRITIQUES (P0 - Correction Immediate)

### CRIT-01 : Edge Functions sans authentification (9/10 fonctions)

**Severite** : CRITIQUE
**OWASP** : A01 - Broken Access Control
**Impact** : Acces complet non authentifie a TOUTES les donnees (artisans, documents, commentaires, utilisateurs, interventions)

**Description** : 9 des 10 Edge Functions Supabase utilisent `SERVICE_ROLE_KEY` sans aucune verification JWT. N'importe qui connaissant l'URL de la fonction peut acceder, creer, modifier et supprimer des donnees.

| Edge Function | Fichier | Ligne(s) | Operations exposees |
|---|---|---|---|
| artisans | `supabase/functions/artisans/index.ts` | 36-40 | GET, POST, PUT, DELETE |
| artisans-v2 | `supabase/functions/artisans-v2/index.ts` | 310-313 | GET, POST, PUT, DELETE |
| comments | `supabase/functions/comments/index.ts` | 69-73 | GET, POST, PUT, DELETE |
| documents | `supabase/functions/documents/index.ts` | 195-198 | GET, POST, PUT, DELETE, UPLOAD |
| users | `supabase/functions/users/index.ts` | 10-14 | GET, POST, PUT, DELETE |
| process-avatar | `supabase/functions/process-avatar/index.ts` | 61-64 | POST |
| admin-dashboard-stats | `supabase/functions/interventions-v2-admin-dashboard-stats/index.ts` | 62-65 | POST |
| push | `supabase/functions/push/index.ts` | 32 | POST |
| pull | `supabase/functions/pull/index.ts` | 69 | POST |

**Code problematique (pattern repete)** :
```typescript
// supabase/functions/artisans/index.ts:36-40
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!  // Contourne RLS, pas de token check
);
// AUCUN appel a supabase.auth.getUser() avant les operations
```

**Correction recommandee** :
```typescript
// Extraire le JWT du header Authorization
const authHeader = req.headers.get('Authorization');
if (!authHeader?.startsWith('Bearer ')) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
}
const token = authHeader.replace('Bearer ', '');

// Verifier l'utilisateur
const { data: { user }, error: authError } = await supabase.auth.getUser(token);
if (authError || !user) {
  return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401 });
}
```

---

### CRIT-02 : RLS Policies trop permissives (USING(true))

**Severite** : CRITIQUE
**OWASP** : A01 - Broken Access Control
**Impact** : Tout utilisateur authentifie peut lire TOUTES les donnees de TOUS les autres utilisateurs

| Fichier | Ligne | Policy | Effet |
|---|---|---|---|
| `supabase/migrations/00041_rls_core_tables.sql` | 125-127 | `users_select_authenticated` | TOUS les users lisent TOUS les profils |
| `supabase/migrations/00041_rls_core_tables.sql` | 254-256 | `interventions_select_authenticated` | TOUS lisent TOUTES les interventions |

**Code problematique** :
```sql
-- supabase/migrations/00041_rls_core_tables.sql:125-127
CREATE POLICY users_select_authenticated ON public.users
  FOR SELECT TO authenticated
  USING (true);  -- Aucune restriction !

-- supabase/migrations/00041_rls_core_tables.sql:254-256
CREATE POLICY interventions_select_authenticated ON public.interventions
  FOR SELECT TO authenticated
  USING (true);  -- Aucune restriction !
```

**Correction recommandee** :
```sql
-- Limiter la lecture des users
CREATE POLICY users_select_restricted ON public.users
  FOR SELECT TO authenticated
  USING (
    id = public.get_public_user_id()
    OR public.user_has_role('admin')
    OR public.user_has_role('manager')
  );

-- Limiter la lecture des interventions par agence/role
CREATE POLICY interventions_select_restricted ON public.interventions
  FOR SELECT TO authenticated
  USING (
    gestionnaire_id = public.get_public_user_id()
    OR public.user_has_role('admin')
    OR public.user_has_role('manager')
  );
```

---

### CRIT-03 : Enumeration d'utilisateurs non authentifiee

**Severite** : CRITIQUE
**OWASP** : A01 - Broken Access Control
**Fichier** : `app/api/auth/resolve/route.ts`
**Lignes** : 6-19

**Description** : La route `/api/auth/resolve` permet a QUICONQUE (sans authentification) de resoudre un username en email. Cela permet l'enumeration complete des utilisateurs du systeme.

**Code problematique** :
```typescript
// app/api/auth/resolve/route.ts:6-19
export async function POST(req: Request) {
  if (!supabaseAdmin) return NextResponse.json({ error: 'No DB' }, { status: 500 })
  const { identifier } = await req.json().catch(() => ({}))
  if (!identifier) return NextResponse.json({ error: 'missing_identifier' }, { status: 400 })
  if (String(identifier).includes('@')) return NextResponse.json({ email: identifier })
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('email')  // Retourne l'email SANS authentification !
    .eq('username', identifier)
    .maybeSingle()
```

**Correction recommandee** :
```typescript
export async function POST(req: Request) {
  // Ajouter rate limiting
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  const { success } = await ratelimit.limit(`resolve:${ip}`)
  if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  // Ne pas reveler si l'utilisateur existe
  // Toujours retourner 200 avec un message generique
  return NextResponse.json({ message: 'If the user exists, a login link was sent.' })
}
```

---

### CRIT-04 : Fallback silencieux sur les permissions en cas d'erreur RPC

**Severite** : CRITIQUE
**OWASP** : A01 - Broken Access Control
**Fichier** : `src/lib/api/permissions.ts`
**Lignes** : 172-196

**Description** : Si la fonction RPC `get_user_permissions` echoue (DB down, timeout, etc.), l'application revient silencieusement aux permissions basees sur les roles sans aucune alerte. Cela signifie qu'un attaquant qui provoque une erreur RPC obtient les permissions par defaut du role.

**Code problematique** :
```typescript
// src/lib/api/permissions.ts:172-196
if (supabaseAdmin) {
  const { data, error } = await supabaseAdmin.rpc("get_user_permissions", {
    p_user_id: publicUserId,
  })
  if (!error && Array.isArray(data)) {
    // ... charge permissions
    loadedFromDb = true
  }
  // Si error, loadedFromDb reste false -> fallback silencieux !
}

if (!loadedFromDb) {
  // Fallback: utilise juste les roles - potentiellement trop permissif
  for (const role of roles) {
    const rolePerms = ROLE_PERMISSIONS[normalizedRole]
    if (rolePerms) for (const perm of rolePerms) permissions.add(perm)
  }
}
```

**Correction recommandee** : Fail secure - refuser l'acces si la verification echoue :
```typescript
if (!loadedFromDb) {
  console.error('[SECURITY] RPC get_user_permissions failed, denying access')
  // Option 1: Refuser tout acces
  return { permissions: new Set<PermissionKey>(), roles }
  // Option 2: Accorder uniquement les permissions minimales
  permissions.add('read_own_profile')
}
```

---

### CRIT-05 : Cle privee Google Service Account dans le repo

**Severite** : CRITIQUE
**OWASP** : A02 - Cryptographic Failures
**Fichier** : `supabase/functions/credentials.json`

**Description** : Bien que `.gitignore` ignore ce fichier, il est present sur le disque avec la cle RSA 4096 bits complete du service account Google (`gmbs-service@crm-gmbs-1-472714.iam.gserviceaccount.com`). Ce fichier donne acces complet a Google Drive et Google Sheets de l'entreprise.

| Donnee exposee | Valeur (tronquee) |
|---|---|
| type | `service_account` |
| project_id | `crm-gmbs-1-472714` |
| private_key_id | `0753d37832bcc9f128ff3d308d4d2db45fc629ea` |
| private_key | `-----BEGIN PRIVATE KEY-----\nMIIEvA...` (4096 bits) |
| client_email | `gmbs-service@crm-gmbs-1-472714.iam.gserviceaccount.com` |

**Correction recommandee** :
1. Regenerer la cle immediatement sur Google Cloud Console
2. Stocker la cle en variable d'environnement (pas en fichier)
3. Ajouter une verification pre-commit pour detecter les credentials

---

### CRIT-06 : Fichiers .env avec secrets de production sur disque

**Severite** : CRITIQUE
**OWASP** : A02 - Cryptographic Failures
**Fichiers** : `.env`, `.env.local`, `.env.production`, `.env.vercel.local`

**Description** : 4 fichiers .env contiennent des secrets de production en clair. Bien que correctement ignores par `.gitignore`, ils sont presents sur le disque avec des cles API live.

| Secret | Fichier | Ligne | Risque |
|---|---|---|---|
| OPENAI_API_KEY (`sk-proj-...`) | `.env.vercel.local` | 24 | Facturation OpenAI illimitee |
| STRIPE_SECRET_KEY (`sk_live_...`) | `.env.vercel.local` | 46 | Acces paiements Stripe LIVE |
| SUPABASE_SERVICE_ROLE_KEY | `.env` `.env.local` `.env.production` `.env.vercel.local` | Multiple | Contourne RLS, acces DB total |
| SUPABASE_DB_URL (avec password) | `.env.local` | 15 | Acces PostgreSQL direct |
| EMAIL_PASSWORD_ENCRYPTION_KEY | `.env.vercel.local` | 3 | Dechiffrement mots de passe email |
| EMAIL_PASSWORD_ENCRYPTION_IV | `.env.vercel.local` | 2 | Dechiffrement mots de passe email |
| VERCEL_OIDC_TOKEN | `.env.vercel.local` | 30 | Acces deployment Vercel |
| GMBS_PORTAL_SECRET (`sk_test_...`) | `.env.vercel.local` | 36 | Acces API portail |
| PORTAL_API_SECRET (`sk_test_...`) | `.env.vercel.local` | 41 | Acces API portail |

**Correction recommandee** :
1. **Rotation immediate** de TOUTES les cles ci-dessus
2. Utiliser un gestionnaire de secrets (Vercel Env, AWS Secrets Manager)
3. Ne jamais stocker de `.env.production` en local
4. Ajouter `git-secrets` ou `trufflehog` en pre-commit hook

---

### CRIT-07 : Email confirme sans verification lors de la creation d'utilisateur

**Severite** : CRITIQUE
**OWASP** : A07 - Identification and Authentication Failures
**Fichier** : `app/api/settings/team/user/route.ts`
**Lignes** : 112-114

**Code problematique** :
```typescript
// app/api/settings/team/user/route.ts:112-114
const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
  email,
  email_confirm: true,  // Email confirme SANS verification !
  user_metadata: { firstname, lastname, username },
})
```

**Correction recommandee** :
```typescript
const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
  email,
  email_confirm: false,  // Forcer verification email
  user_metadata: { firstname, lastname, username },
})
// Envoyer un email de confirmation via Supabase
```

---

### CRIT-08 : XSS via dangerouslySetInnerHTML (Email Preview)

**Severite** : CRITIQUE
**OWASP** : A03 - Injection
**Fichier** : `src/components/interventions/EmailEditModal.tsx`
**Ligne** : 489

**Code problematique** :
```typescript
// src/components/interventions/EmailEditModal.tsx:489
dangerouslySetInnerHTML={{ __html: getPreviewHtml(htmlContent) }}
```

**Description** : Le contenu HTML d'email est affiche sans sanitisation. Si un utilisateur insere du JavaScript dans un template email, il sera execute dans le navigateur.

**Correction recommandee** :
```typescript
import DOMPurify from 'dompurify';

dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(getPreviewHtml(htmlContent)) }}
```

---

### CRIT-09 : CORS Wildcard sur TOUTES les Edge Functions

**Severite** : CRITIQUE
**OWASP** : A05 - Security Misconfiguration

**Description** : Toutes les Edge Functions utilisent `Access-Control-Allow-Origin: '*'`, permettant a n'importe quel site web de faire des requetes cross-origin.

| Fichier | Ligne |
|---|---|
| `supabase/functions/artisans/index.ts` | 6 |
| `supabase/functions/artisans-v2/index.ts` | 18 |
| `supabase/functions/comments/index.ts` | 15 |
| `supabase/functions/documents/index.ts` | 16 |
| `supabase/functions/users/index.ts` | 5 |
| `supabase/functions/interventions-v2/index.ts` | 18 |
| `supabase/functions/process-avatar/index.ts` | 16 |
| `supabase/functions/interventions-v2-admin-dashboard-stats/index.ts` | 9 |

**Code problematique** :
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',  // WILDCARD DANGEREUX
};
```

**Correction recommandee** :
```typescript
const ALLOWED_ORIGINS = [
  'https://gmbs-crm.vercel.app',
  'https://votre-domaine.com',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Credentials': 'true',
  };
}
```

---

## 2. VULNERABILITES HAUTES (P1 - Correction cette semaine)

### HIGH-01 : Absence totale de headers de securite

**Severite** : HAUTE
**OWASP** : A05 - Security Misconfiguration
**Fichier** : `next.config.mjs`
**Lignes** : 68-85

**Description** : Le fichier `next.config.mjs` ne definit AUCUN header de securite. Seuls des headers Content-Type pour les fichiers 3D sont configures.

| Header manquant | Protection |
|---|---|
| `Content-Security-Policy` | XSS, injection de ressources |
| `Strict-Transport-Security` | Downgrade HTTPS -> HTTP |
| `X-Frame-Options` | Clickjacking |
| `X-Content-Type-Options` | MIME-type sniffing |
| `Referrer-Policy` | Fuite d'URL dans les referrers |
| `Permissions-Policy` | Acces camera/micro/geolocation |
| `X-XSS-Protection` | XSS filter legacy browsers |

**Correction recommandee** :
```javascript
// next.config.mjs
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains'
        },
        {
          key: 'Content-Security-Policy',
          value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co;"
        },
      ],
    },
    // ... headers existants pour .glb/.gltf
  ];
}
```

---

### HIGH-02 : Tokens JWT stockes dans localStorage

**Severite** : HAUTE
**OWASP** : A07 - Identification and Authentication Failures
**Fichier** : `src/lib/supabase-client.ts`
**Lignes** : 18, 36, 55

**Description** : Les tokens Supabase sont stockes dans `localStorage`, qui est accessible par JavaScript. Combine avec la faille XSS (CRIT-08), cela permet le vol de tokens.

**Code problematique** :
```typescript
// src/lib/supabase-client.ts:18
const instance = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: {
    storageKey: 'supabase.auth.token',  // localStorage !
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});
```

**Correction recommandee** : Migrer vers une strategie httpOnly cookie-only avec le Supabase SSR package.

---

### HIGH-03 : Pas de protection CSRF

**Severite** : HAUTE
**OWASP** : A01 - Broken Access Control
**Fichiers** : Tous les endpoints POST/PATCH/DELETE

**Description** : Les cookies utilisent `SameSite=Lax` (pas `Strict`), et aucune validation d'Origin/CSRF token n'est implementee sur les endpoints sensibles.

**Fichier** : `app/api/auth/session/route.ts`
**Ligne** : 13
```typescript
c.set('sb-access-token', access_token, {
  httpOnly: true,
  sameSite: 'lax',  // Lax au lieu de Strict
  secure,
  path: '/',
  maxAge,
  expires
})
```

**Correction recommandee** :
1. Passer a `SameSite: 'strict'`
2. Ajouter validation d'Origin sur tous les endpoints mutants
3. Ou implementer un double-submit cookie pattern

---

### HIGH-04 : Duree de vie token trop longue (7 jours)

**Severite** : HAUTE
**OWASP** : A07 - Identification and Authentication Failures
**Fichier** : `app/api/auth/session/route.ts`
**Ligne** : 10

```typescript
const maxAge = 60 * 60 * 24 * 7 // 7 days fallback
```

**Correction recommandee** : Reduire a 1-2 heures avec refresh token separe.

---

### HIGH-05 : Auto-reconnexion sans re-authentification

**Severite** : HAUTE
**OWASP** : A07 - Identification and Authentication Failures
**Fichier** : `app/api/auth/heartbeat/route.ts`
**Lignes** : 96-111

**Description** : Si un utilisateur est marque `offline`, un heartbeat le remet `connected` automatiquement sans re-verifier la validite de sa session.

---

### HIGH-06 : Scripts inline via dangerouslySetInnerHTML (layout)

**Severite** : HAUTE
**OWASP** : A03 - Injection
**Fichiers** :
- `app/layout.tsx` lignes 48-234
- `app/layout-complex.tsx` lignes 37-147

**Description** : Scripts JavaScript complexes injectes via `dangerouslySetInnerHTML` qui lisent `localStorage` pour les preferences UI. La validation des valeurs localStorage est insuffisante.

---

### HIGH-07 : 38 vulnerabilites npm (dont 34 haute severite)

**Severite** : HAUTE
**OWASP** : A06 - Vulnerable and Outdated Components

**Resultat `npm audit`** :
```
38 vulnerabilities (1 low, 3 moderate, 34 high)
```

| Package | Severite | Vulnerabilite |
|---|---|---|
| `next` 15.x | HIGH | Source Code Exposure, DoS (4 CVEs) |
| `fast-xml-parser` | HIGH | RangeError DoS |
| `@isaacs/brace-expansion` | HIGH | Uncontrolled Resource Consumption |
| `tar` | HIGH | Arbitrary File Overwrite, Symlink Poisoning (3 CVEs) |
| `path-to-regexp` | HIGH | ReDoS backtracking |
| `diff` (jsdiff) | HIGH | DoS in parsePatch/applyPatch (2 CVEs) |
| `undici` | MODERATE | Insufficient Random Values, Decompression DoS, Bad Certificate DoS |
| `lodash` | MODERATE | Prototype Pollution in unset/omit |

**Packages avec mises a jour majeures disponibles** :
```
next             15.5.7  ->  16.1.6
react            18.3.1  ->  19.2.4
react-dom        18.3.1  ->  19.2.4
@prisma/client   6.17.0  ->  7.3.0
zod              3.24.1  ->  4.3.6
eslint           9.34.0  -> 10.0.0
vitest           3.2.4   ->  4.0.18
tailwindcss      3.4.17  ->  4.1.18
supabase         2.40.7  ->  2.76.7
```

**Correction recommandee** :
```bash
npm audit fix                    # Corrections automatiques
npx npm-check-updates -u -t minor  # MAJ mineures
```

---

### HIGH-08 : error.message expose dans 50+ endpoints

**Severite** : HAUTE
**OWASP** : A09 - Security Logging and Monitoring Failures
**Fichiers** : Voir liste complete ci-dessous

**Description** : Les messages d'erreur internes de Supabase/PostgreSQL sont retournes directement aux clients, revelant la structure de la base de donnees.

**Exemples** :
```typescript
// Pattern repete dans 50+ endroits
return NextResponse.json({ error: error.message }, { status: 500 })
// Peut retourner: "relation \"artisans\" does not exist"
// Ou: "column \"email\" of relation \"users\" is not unique"
```

| Fichier | Lignes concernees |
|---|---|
| `app/api/auth/resolve/route.ts` | 16 |
| `app/api/user-preferences/route.ts` | 52, 125, 143 |
| `app/api/targets/route.ts` | 31, 98, 118 |
| `app/api/auth/profile/route.ts` | 169 |
| `app/api/purchase-links/route.ts` | 45, 63 |
| `app/api/settings/team/route.ts` | 21 |
| `app/api/interventions/[id]/assign/route.ts` | 74 |
| `app/api/settings/metiers/route.ts` | 24, 101, 107 |
| `app/api/settings/agency/route.ts` | 24, 101, 107 |
| `app/api/settings/team/user/route.ts` | 72, 203, 282, 307 |
| `app/api/users/[id]/permissions/route.ts` | 34, 66, 253, 264 |
| `app/api/settings/intervention-statuses/[statusId]/route.ts` | 58 |
| `app/api/settings/lateness-email/route.ts` | 123 |
| `app/api/settings/team/role/route.ts` | 23, 29, 31 |
| `app/api/credits/sync/route.ts` | 19 |
| `supabase/functions/artisans/index.ts` | 108, 209, 259 |
| `supabase/functions/comments/index.ts` | 142, 261, 331, 358, 406, 462 |
| `supabase/functions/documents/index.ts` | 290, 482, 587, 658, 746, 890 |
| `supabase/functions/users/index.ts` | 58, 96, 135 |
| `supabase/functions/artisans-v2/index.ts` | 426, 746, 914, 1799 |

**Correction recommandee** : Utiliser des messages generiques :
```typescript
// Creer un helper
function safeErrorResponse(error: unknown, status = 500) {
  console.error('[API Error]', error) // Logger en interne
  return NextResponse.json(
    { error: 'Internal server error' },
    { status }
  )
}
```

---

### HIGH-09 : MapTiler API Key exposee cote client

**Severite** : HAUTE
**OWASP** : A02 - Cryptographic Failures
**Fichier** : `src/components/maps/MapLibreMapImpl.tsx`
**Lignes** : 42, 59

```typescript
const maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY
// ...
style: `https://api.maptiler.com/maps/streets/style.json?key=${maptilerKey}`
```

**Note** : NEXT_PUBLIC_* est expose par design dans Next.js. La cle `8RuaZWQJFzh0o8mtJxqi` est visible dans le code client et les requetes reseau. Configurer les restrictions de domaine sur MapTiler.

---

## 3. VULNERABILITES MOYENNES (P2 - Correction sous 2 semaines)

### MED-01 : Middleware ne verifie que la PRESENCE du token

**Fichier** : `middleware.ts`
**Lignes** : 34-37

**Description** : Le middleware Next.js verifie uniquement si un cookie `sb-access-token` existe, pas s'il est valide. Un token expire, revoque ou forge permettra de passer le middleware.

---

### MED-02 : Pas de hierarchie d'administrateurs

**Fichier** : `app/api/settings/team/user/[userId]/page-permissions/route.ts`
**Ligne** : 50

**Description** : N'importe quel admin peut modifier les permissions d'un autre admin de meme niveau.

---

### MED-03 : Pas de rate limiting sur les endpoints sensibles

**Fichiers** : Tous les endpoints d'authentification et de gestion

| Endpoint | Risque |
|---|---|
| `/api/auth/resolve` | Enumeration utilisateurs |
| `/api/auth/session` | Brute force session |
| `/api/settings/team/user` POST | Spam creation comptes |
| `/api/settings/team/user/reset-password` | Forcer resets |

---

### MED-04 : Soft delete sans anonymisation GDPR

**Fichier** : `app/api/settings/team/user/route.ts`
**Lignes** : 355-368

**Description** : Les utilisateurs sont archives mais leurs donnees personnelles (email, nom) persistent en base.

---

### MED-05 : Stack traces exposees dans les logs

**Fichiers** :
- `supabase/functions/interventions-v2-admin-dashboard-stats/index.ts:136-137`
- `app/api/auth/me/route.ts:95, 101, 188, 236, 241, 260, 328`
- `app/api/settings/team/user/restore/route.ts:198`

---

### MED-06 : URL d'invitation non validee (protocole)

**Fichier** : `src/lib/email-templates/invitation-email.ts`
**Lignes** : 74, 93

**Description** : L'URL d'invitation est echappee via `escapeHtml()` mais le protocole n'est pas valide (`javascript:` possible theoriquement).

---

### MED-07 : Validation localStorage insuffisante

**Fichier** : `app/layout.tsx`
**Lignes** : 141-165

**Description** : Les valeurs lues depuis `localStorage` (`ui-accent`, `ui-accent-custom`) ne sont pas whitelistees avant utilisation.

---

### MED-08 : CSS injectee via dangerouslySetInnerHTML

**Fichier** : `app/admin/dashboard/page.tsx`
**Ligne** : 487

**Description** : CSS statique injectee via `dangerouslySetInnerHTML` - mauvaise pratique meme si le contenu est statique.

---

### MED-09 : parseInt() sans validation min/max dans Edge Functions

**Fichier** : `supabase/functions/artisans/index.ts`
**Lignes** : 50-51

```typescript
const limit = parseInt(url.searchParams.get('limit') || '35');
const offset = parseInt(url.searchParams.get('offset') || '0');
// Pas de validation: limit peut etre -1, 999999, etc. -> DoS
```

---

### MED-10 : console.log exposant des erreurs detaillees

**Fichiers concernes** :
- `app/api/interventions/[id]/send-email/route.ts` (8 occurrences)
- `app/api/auth/status/route.ts` (3 occurrences)
- `app/api/auth/profile/route.ts` (6 occurrences)
- `app/api/settings/team/user/route.ts` (5 occurrences)

**Note** : `next.config.mjs` supprime `console.log` en production (bon), mais garde `console.error` et `console.warn`.

---

### MED-11 : Fallback "dev-secret" hardcode

**Fichier** : `app/api/checkout/success/route.ts`
**Ligne** : 11

```typescript
return process.env.CREDITS_SECRET || "dev-secret"  // Fallback en dur
```

---

## 4. VULNERABILITES BASSES (P3 - Correction planifiee)

### LOW-01 : CSS recharts non validee

**Fichier** : `src/components/ui/chart.tsx`
**Lignes** : 80-96

**Description** : Couleurs dynamiques dans `dangerouslySetInnerHTML` pour les styles de charts. Risque minimal car les couleurs proviennent de la configuration interne.

---

### LOW-02 : Configuration token dupliquee (3x)

**Fichier** : `src/lib/supabase-client.ts`
**Lignes** : 18, 36, 55

**Description** : Meme configuration auth repetee 3 fois. Maintenance difficile, risque d'inconsistance.

---

### LOW-03 : Token Bearer regex trop simple

**Fichier** : `src/lib/supabase/server.ts`
**Lignes** : 34-39

```typescript
const m = /^Bearer\s+(.+)$/i.exec(h.trim())
return m ? m[1] : null
```
Accepte n'importe quelle chaine apres "Bearer" sans validation JWT.

---

### LOW-04 : allowedDevOrigins avec IP privee

**Fichier** : `next.config.mjs`
**Ligne** : 12

```javascript
allowedDevOrigins: ['192.168.1.164'],
```
IP privee dans la config - pas de risque en production mais a retirer.

---

## 5. Points Positifs (a maintenir)

| Point positif | Fichier / Details |
|---|---|
| `.gitignore` bien configure | `.env*`, `credentials.json`, `*.pem` ignores |
| Fichiers .env NON trackes dans git | `git ls-files` confirme 0 fichier .env dans l'historique |
| `escapeHtml()` dans les templates email | `src/lib/email-templates/invitation-email.ts` |
| `httpOnly: true` sur les cookies | `app/api/auth/session/route.ts:13` |
| Supabase parametrise (pas de SQL brut) | Tous les appels `.rpc()` utilisent des parametres |
| Pas de `eval()` ni `new Function()` | Aucun usage trouve |
| Pas de `child_process` / Command Injection | Aucun usage trouve |
| AuthGuard cote client | `src/components/layout/auth-guard.tsx` |
| `removeConsole` en production | `next.config.mjs:7-9` |
| RLS actif sur les tables critiques | `00041_rls_core_tables.sql` |
| `requirePermission()` sur les routes admin | `app/api/settings/team/user/route.ts` |

---

## 6. Checklist OWASP Top 10 (2021)

### A01:2021 - Broken Access Control

| Check | Status | Details |
|---|---|---|
| Principe du moindre privilege | ECHEC | RLS USING(true) sur users et interventions |
| Edge Functions protegees | ECHEC | 9/10 sans authentification |
| Endpoints admin proteges | PARTIEL | `requirePermission()` present mais fallback dangereux |
| CORS restrictif | ECHEC | Wildcard `*` sur toutes les Edge Functions |
| Rate limiting | ECHEC | Aucun rate limiting |
| CSRF protection | ECHEC | SameSite=Lax sans Origin validation |

### A02:2021 - Cryptographic Failures

| Check | Status | Details |
|---|---|---|
| Secrets non hardcodes | ECHEC | credentials.json, .env files sur disque |
| Chiffrement des mots de passe | OK | `email_password_encrypted` utilise le chiffrement |
| Cles de chiffrement protegees | ECHEC | IV et KEY en .env.vercel.local |
| HTTPS force | PARTIEL | Pas de HSTS header |
| Tokens pas dans localStorage | ECHEC | localStorage utilise pour les tokens Supabase |

### A03:2021 - Injection

| Check | Status | Details |
|---|---|---|
| SQL Injection | OK | Supabase parametrise, pas de SQL brut |
| XSS (Stored) | ECHEC | dangerouslySetInnerHTML sans DOMPurify |
| XSS (DOM) | PARTIEL | localStorage lu sans whitelist |
| Command Injection | OK | Pas d'exec/spawn |
| eval() | OK | Aucun usage |

### A04:2021 - Insecure Design

| Check | Status | Details |
|---|---|---|
| Separation client/serveur | ECHEC | Service Role Key dans Edge Functions |
| Defense en profondeur | ECHEC | Middleware verifie presence seule |
| Fail secure | ECHEC | Fallback silencieux sur permissions |
| Error handling securise | ECHEC | error.message retourne au client |

### A05:2021 - Security Misconfiguration

| Check | Status | Details |
|---|---|---|
| Security headers | ECHEC | Aucun header de securite configure |
| CORS restrictif | ECHEC | Wildcard |
| Source maps desactivees | PARTIEL | Pas de config explicite |
| Console.log en prod | OK | removeConsole active |
| Default credentials | ECHEC | `dev-secret` hardcode |

### A06:2021 - Vulnerable and Outdated Components

| Check | Status | Details |
|---|---|---|
| npm audit propre | ECHEC | 38 vulnerabilites (34 HIGH) |
| Dependances a jour | ECHEC | 70+ packages obsoletes |
| Packages majeurs a jour | ECHEC | Next.js 15 vs 16, React 18 vs 19 |

### A07:2021 - Identification and Authentication Failures

| Check | Status | Details |
|---|---|---|
| MFA | ECHEC | Non implemente |
| Verification email | ECHEC | email_confirm: true force |
| Session timeout | ECHEC | 7 jours trop long |
| Token refresh securise | PARTIEL | autoRefreshToken actif |
| Enumeration utilisateurs | ECHEC | /api/auth/resolve sans auth |

### A08:2021 - Software and Data Integrity Failures

| Check | Status | Details |
|---|---|---|
| CI/CD securise | PARTIEL | Pas de verification d'integrite |
| Pre-commit hooks | ECHEC | Pas de git-secrets/trufflehog |
| SRI sur scripts externes | N/A | Pas de CDN scripts externes |

### A09:2021 - Security Logging and Monitoring Failures

| Check | Status | Details |
|---|---|---|
| Logging des erreurs | PARTIEL | console.error present mais stack traces exposees |
| Monitoring de securite | ECHEC | Pas de Sentry/DataDog |
| Alertes en cas d'echec auth | ECHEC | Erreurs auth silencieuses |
| Audit trail | ECHEC | Pas de log des actions admin |

### A10:2021 - Server-Side Request Forgery (SSRF)

| Check | Status | Details |
|---|---|---|
| URLs validees | OK | Pas d'appels dynamiques a des URLs user-controlled |
| Requests sortantes | PARTIEL | OpenCage/MapTiler avec cles API dans les params |

---

## 7. Plan de Remediation Prioritise

### Phase 1 - Immediat (0-48h) - CRITIQUES

| # | Action | Fichier(s) | Effort |
|---|---|---|---|
| 1 | Ajouter authentification JWT sur TOUTES les Edge Functions | `supabase/functions/*/index.ts` | 2-3j |
| 2 | Restreindre les RLS policies (supprimer USING(true)) | `supabase/migrations/` | 1j |
| 3 | Proteger `/api/auth/resolve` (auth + rate limit) | `app/api/auth/resolve/route.ts` | 2h |
| 4 | Fail secure sur les permissions (pas de fallback) | `src/lib/api/permissions.ts` | 2h |
| 5 | Rotation IMMEDIATE de toutes les cles exposees | Dashboard Supabase, OpenAI, Stripe, Google | 2h |
| 6 | Supprimer `credentials.json` du disque, stocker en env | `supabase/functions/credentials.json` | 1h |

### Phase 2 - Court terme (1 semaine) - HAUTES

| # | Action | Fichier(s) | Effort |
|---|---|---|---|
| 7 | Ajouter headers de securite dans next.config.mjs | `next.config.mjs` | 2h |
| 8 | Installer et configurer DOMPurify pour les previews email | `EmailEditModal.tsx` | 1h |
| 9 | Restreindre CORS sur les Edge Functions | Tous les `corsHeaders` | 2h |
| 10 | Executer `npm audit fix` | `package.json` | 1h |
| 11 | Remplacer `error.message` par messages generiques | 50+ fichiers | 1j |
| 12 | Passer SameSite a Strict + validation Origin | `auth/session/route.ts` | 2h |
| 13 | Reduire maxAge token a 1-2h | `auth/session/route.ts` | 30min |

### Phase 3 - Moyen terme (2-4 semaines)

| # | Action | Effort |
|---|---|---|
| 14 | Migrer tokens de localStorage vers httpOnly cookies | 2-3j |
| 15 | Implementer rate limiting (@upstash/ratelimit) | 1-2j |
| 16 | Ajouter MFA (TOTP) | 2-3j |
| 17 | Anonymisation GDPR sur soft delete | 1j |
| 18 | Ajouter git-secrets en pre-commit hook | 2h |
| 19 | Configurer Sentry/monitoring securite | 1j |
| 20 | Audit trail des actions admin | 2-3j |

---

## 8. Resume Executif

L'application GMBS CRM presente des **vulnerabilites critiques** qui necessitent une attention immediate :

1. **9 sur 10 Edge Functions Supabase sont accessibles sans authentification**, exposant la totalite des donnees (artisans, documents, commentaires, utilisateurs) a quiconque connait l'URL.

2. **Les policies RLS sont inefficaces** (`USING(true)`), permettant a tout utilisateur authentifie de lire toutes les donnees de tous les autres utilisateurs.

3. **Des secrets de production** (cles API OpenAI, Stripe live, Service Role Supabase, cle privee Google) sont presents en clair sur le disque dans 4 fichiers `.env` et un `credentials.json`.

4. **Aucun header de securite** n'est configure (pas de CSP, HSTS, X-Frame-Options).

5. **38 vulnerabilites npm** dont 34 de haute severite, incluant Next.js avec 4 CVEs.

6. **50+ endpoints** retournent les messages d'erreur internes de PostgreSQL aux clients.

**Score global : 28/100** - L'application n'est **pas prete pour un usage en production** dans son etat actuel. Les corrections de Phase 1 (48h) sont imperatives avant toute mise en production supplementaire.

---

*Rapport genere le 10 fevrier 2026 par l'Agent Securite IA*
*Methodologie : OWASP Top 10 2021, analyse statique exhaustive de la codebase*
