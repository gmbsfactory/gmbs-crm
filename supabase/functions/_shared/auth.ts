import { type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Gets the authenticated user ID from the request via JWT verification.
 * Returns null if no valid Authorization header is present.
 */
export async function getAuthUserId(req: Request, supabase: SupabaseClient): Promise<string | null> {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return null;

    const token = authHeader.replace('Bearer ', '');
    if (!token) return null;

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (!error && user?.id) return user.id;
    } catch (err) {
        console.warn(`[auth] JWT verification failed: ${err}`);
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
