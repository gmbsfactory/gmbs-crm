// ===== INTERVENTIONS CRUD - AUTH HELPERS =====
// Résolution d'identité pour rendre les opérations CRUD agnostiques de
// l'environnement (browser session vs SSR explicite).

import { supabase, getSupabaseClientForNode } from "@/lib/api/common/client";

export const supabaseClient = typeof window !== "undefined" ? supabase : getSupabaseClientForNode();

const isBrowser = (): boolean => typeof window !== "undefined";

/**
 * Auth context that callers may pass through to make CRUD operations
 * environment-agnostic. When omitted, browser callers fall back to the session
 * stored in the Supabase JS client; SSR/server callers must provide it
 * explicitly because there is no ambient session to read from.
 */
export interface InterventionAuthContext {
  userId?: string;
  isAdmin?: boolean;
}

/**
 * Resolve the current user id. If provided by the caller, use it. Otherwise
 * attempt a browser-side session lookup. In SSR contexts without a provided
 * id, returns undefined.
 */
export async function resolveUserId(provided?: string): Promise<string | undefined> {
  if (provided) return provided;
  if (!isBrowser()) return undefined;
  try {
    const { data: { user } } = await supabaseClient.auth.getUser();
    return user?.id ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolve whether the current caller is admin. If provided, use it. Otherwise
 * attempt a browser-side lookup via /api/auth/me. In SSR without a provided
 * value, returns false defensively (admin-only fields will be dropped rather
 * than leaked).
 */
export async function resolveIsAdmin(provided?: boolean): Promise<boolean> {
  if (typeof provided === "boolean") return provided;
  if (!isBrowser()) return false;
  try {
    const { data: session } = await supabaseClient.auth.getSession();
    const token = session?.session?.access_token;
    const response = await fetch("/api/auth/me", {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) return false;
    const current = await response.json();
    const roles: string[] = Array.isArray(current?.user?.roles) ? current.user.roles : [];
    return roles.some(
      (role) => typeof role === "string" && role.toLowerCase().includes("admin"),
    );
  } catch (error) {
    console.warn("[interventionsApi] Unable to verify admin role", error);
    return false;
  }
}
