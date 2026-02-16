Migration Auth: Custom cookies → @supabase/ssr
Contexte
Le token JWT expire et n'est jamais rafraîchi côté serveur → erreur 401 "token is expired".
@supabase/ssr résout ce problème en rafraîchissant automatiquement le token dans le middleware Next.js.

Phase 1 — Installation et nouveaux utilitaires (sans casser l'existant)
1.1 Installer @supabase/ssr

npm install @supabase/ssr
1.2 Créer src/lib/supabase/client.ts (NOUVEAU)
Client navigateur via createBrowserClient — remplace le singleton Proxy de supabase-client.ts.

1.3 Créer src/lib/supabase/server-ssr.ts (NOUVEAU)
Client serveur via createServerClient avec lecture/écriture des cookies Next.js.

1.4 Créer src/lib/supabase/middleware.ts (NOUVEAU)
Helper middleware qui appelle supabase.auth.getUser() pour rafraîchir le token à chaque requête.

createServerSupabaseAdmin() dans src/lib/supabase/server.ts reste inchangé.

Phase 2 — Middleware (fix principal du 401)
2.1 Réécrire middleware.ts
Appeler updateSession() du nouveau helper
getUser() rafraîchit automatiquement le token expiré et écrit les nouveaux cookies dans la réponse
Garder la même logique de routing (public paths, redirect login, x-pathname header)
Phase 3 — Routes API serveur
3.1 Migrer src/lib/api/permissions.ts
Remplacer l'extraction manuelle du token :


// Avant
let token = bearerFrom(req)
if (!token) { token = cookies().get('sb-access-token')?.value }
const supabase = createServerSupabase(token)

// Après
const supabase = await createSSRServerClient()
3.2 Migrer les routes API auth (même pattern)
Fichier	Notes
app/api/auth/me/route.ts	Route la plus critique
app/api/auth/status/route.ts	Garder supabaseAdmin pour les writes
app/api/auth/heartbeat/route.ts	Idem
app/api/auth/first-activity/route.ts	Garder createServerSupabaseAdmin()
app/api/auth/profile/route.ts	Passer de Bearer-only à cookies SSR
3.3 Migrer les autres routes API
app/api/artisans/[id]/archive/route.ts
app/api/interventions/[id]/duplicate/route.ts
app/api/interventions/[id]/send-email/route.ts
app/api/user-preferences/route.ts
app/api/lateness/check/route.ts
app/api/settings/lateness-email/route.ts
app/api/settings/team/user/send-invite/route.ts
app/api/settings/team/user/reset-password/route.ts
3.4 Migrer app/auth/callback/route.ts
Utiliser createSSRServerClient() pour que exchangeCodeForSession() persiste la session dans les cookies.

3.5 Mettre à jour app/layout.tsx
Remplacer cookieStore.get('sb-access-token') par supabase.auth.getUser() pour isAuthed.

Phase 4 — Client navigateur
4.1 Remplacer src/lib/supabase-client.ts
Réduire à un re-export du nouveau client :


import { createClient } from '@/lib/supabase/client'
export const supabase = createClient()
→ Les 38+ fichiers qui importent { supabase } continuent de fonctionner sans modification.

4.2 Simplifier AuthStateListenerProvider.tsx
Supprimer :

Le onAuthStateChange qui POST vers /api/auth/session (lignes 22-93)
Conserver :

queryClient.invalidateQueries / queryClient.clear sur SIGNED_IN / SIGNED_OUT
preloadCriticalDataAsync() sur SIGNED_IN / INITIAL_SESSION
Le PATCH /api/auth/status pour mettre le statut à "connected"
Le heartbeat (useEffect lignes 208-241)
Le first-activity check (useEffect lignes 152-203)
Le multi-tab tracking + offline detection (useEffect lignes 245-549)
4.3 Simplifier la page login app/(auth)/login/page.tsx
Supprimer :

supabase.auth.getSession() après signIn (lignes 43-46)
Le POST vers /api/auth/session (lignes 47-58)
Le Authorization: Bearer dans le PATCH status (ligne 59)
Garder :

supabase.auth.signInWithPassword() (fonctionne avec createBrowserClient)
Le PATCH status avec credentials: 'include' (cookies envoyés automatiquement)
Le window.location.href redirect (safe, garantit que les cookies sont disponibles)
4.4 Simplifier src/lib/auth/logout-manager.ts
Supprimer :

STEP 7 : DELETE vers /api/auth/session (lignes 153-166)
supabase.auth.signOut() (STEP 6) nettoie déjà les cookies via @supabase/ssr.

Phase 5 — Nettoyage
5.1 Supprimer app/api/auth/session/route.ts
Plus nécessaire — @supabase/ssr gère les cookies automatiquement.

5.2 Nettoyer src/lib/supabase/server.ts
Supprimer createServerSupabase(token?) et bearerFrom()
Garder uniquement createServerSupabaseAdmin()
5.3 Nettoyage localStorage
Ajouter un one-time cleanup dans AuthStateListenerProvider pour supprimer l'ancien supabase.auth.token du localStorage.

Phase 6 — Tests et vérification
6.1 Tests unitaires
tests/unit/lib/supabase/server-ssr.test.ts
tests/unit/lib/supabase/middleware.test.ts
tests/unit/lib/supabase/client.test.ts
6.2 Vérification manuelle
 Login → cookie SSR créé (vérifier dans DevTools > Application > Cookies)
 Navigation pages protégées → pas de 401
 Token expiré → middleware le rafraîchit automatiquement
 Logout → cookies nettoyés, redirect login
 Multi-tab logout → broadcast fonctionne
 Heartbeat → PATCH /api/auth/heartbeat retourne 200
 OAuth callback (set-password) → session persistée via cookies
 npm run build passe sans erreur
 npm run test passe sans régression
Fichiers modifiés (résumé)
Action	Fichier
NOUVEAU	src/lib/supabase/client.ts
NOUVEAU	src/lib/supabase/server-ssr.ts
NOUVEAU	src/lib/supabase/middleware.ts
RÉÉCRIRE	middleware.ts
SIMPLIFIER	src/lib/supabase-client.ts
SIMPLIFIER	src/providers/AuthStateListenerProvider.tsx
SIMPLIFIER	app/(auth)/login/page.tsx
SIMPLIFIER	src/lib/auth/logout-manager.ts
MODIFIER	src/lib/api/permissions.ts
MODIFIER	app/api/auth/me/route.ts
MODIFIER	app/api/auth/status/route.ts
MODIFIER	app/api/auth/heartbeat/route.ts
MODIFIER	app/api/auth/first-activity/route.ts
MODIFIER	app/api/auth/profile/route.ts
MODIFIER	app/auth/callback/route.ts
MODIFIER	app/layout.tsx
MODIFIER	app/api/artisans/[id]/archive/route.ts
MODIFIER	app/api/interventions/[id]/duplicate/route.ts
MODIFIER	app/api/interventions/[id]/send-email/route.ts
MODIFIER	app/api/user-preferences/route.ts
MODIFIER	app/api/lateness/check/route.ts
MODIFIER	app/api/settings/lateness-email/route.ts
MODIFIER	app/api/settings/team/user/send-invite/route.ts
MODIFIER	app/api/settings/team/user/reset-password/route.ts
NETTOYER	src/lib/supabase/server.ts (garder admin)
SUPPRIMER	app/api/auth/session/route.ts
Risques et mitigations
Utilisateurs actifs : Après déploiement, les sessions existantes (ancien cookie sb-access-token) seront invalides → les utilisateurs devront se reconnecter une fois
Taille cookies : @supabase/ssr chunke automatiquement les gros tokens
Edge Functions : getHeaders() dans utils.ts utilise getSession() qui fonctionne toujours avec createBrowserClient → pas de changement nécessaire