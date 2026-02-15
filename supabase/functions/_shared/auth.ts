import { type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Gets the authenticated user ID from the request.
 * Prioritizes standard Authorization JWT (Best Practice).
 * Falls back to x-user-id header with a warning.
 */
export async function getAuthUserId(req: Request, supabase: SupabaseClient): Promise<string | null> {
    // 1. Prioritize standard Authorization JWT
    const authHeader = req.headers.get('authorization');
    if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        if (token) {
            try {
                // Verify the JWT with Supabase Auth
                const { data: { user }, error } = await supabase.auth.getUser(token);
                if (!error && user?.id) {
                    return user.id;
                }
            } catch (err) {
                console.warn(`[auth] JWT verification failed: ${err}`);
            }
        }
    }

    // 2. Fallback: x-user-id header (Legacy/Workaround mode)
    const userIdHeader = req.headers.get('x-user-id');
    if (userIdHeader) {
        console.warn('[auth] Using x-user-id header fallback. Identity is NOT verified via JWT.');
        return userIdHeader;
    }

    return null;
}

/**
 * Ensures the request is authenticated.
 * Throws an error or returns a Response if not.
 */
export async function requireAuth(req: Request, supabase: SupabaseClient): Promise<string> {
    const userId = await getAuthUserId(req, supabase);
    if (!userId) {
        throw new Error('Unauthorized: Authentication required');
    }
    return userId;
}
