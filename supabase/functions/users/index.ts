import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight requests FIRST, before any other code
  // This MUST be the very first statement to ensure OPTIONS always returns 200
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: corsHeaders
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    // GET /users - Liste tous les utilisateurs actifs
    if (req.method === 'GET' && path === 'users') {
      const role = url.searchParams.get('role');

      let query = supabase
        .from('users')
        .select(`
          id,
          name,
          prenom,
          username,
          email,
          token_version,
          color,
          delete_date,
          code_gestionnaire
        `);

      // Filtrer les utilisateurs actifs
      query = query.is('delete_date', null);

      // Appliquer le filtre par rôle si spécifié
      if (role) {
        // TODO: Implémenter le filtrage par rôle via user_roles
        // Pour l'instant, on retourne tous les utilisateurs
      }

      const { data, error } = await query;

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Transformer les données pour correspondre à l'interface MockAPI
      const transformedData = data.map(user => ({
        id: user.id,
        name: user.name,
        prenom: user.prenom,
        username: user.username,
        email: user.email,
        roles: [], // TODO: Récupérer depuis user_roles
        tokenVersion: user.token_version,
        color: user.color,
        deleteDate: user.delete_date
      }));

      // Simuler le délai du MockAPI
      await new Promise(resolve => setTimeout(resolve, 100));

      return new Response(
        JSON.stringify(transformedData),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /users/{id} - Utilisateur par ID
    if (req.method === 'GET' && path && path !== 'users') {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          name,
          prenom,
          username,
          email,
          token_version,
          color,
          delete_date,
          code_gestionnaire
        `)
        .eq('id', path)
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Transformer les données
      const transformedData = {
        id: data.id,
        name: data.name,
        prenom: data.prenom,
        username: data.username,
        email: data.email,
        roles: [], // TODO: Récupérer depuis user_roles
        tokenVersion: data.token_version,
        color: data.color,
        deleteDate: data.delete_date
      };

      // Simuler le délai du MockAPI
      await new Promise(resolve => setTimeout(resolve, 50));

      return new Response(
        JSON.stringify(transformedData),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /users/username/{username} - Utilisateur par nom d'utilisateur
    if (req.method === 'GET' && path === 'username') {
      const username = url.searchParams.get('username');
      
      if (!username) {
        return new Response(
          JSON.stringify({ error: 'Username parameter required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          name,
          prenom,
          username,
          email,
          token_version,
          color,
          delete_date,
          code_gestionnaire
        `)
        .eq('username', username)
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Transformer les données
      const transformedData = {
        id: data.id,
        name: data.name,
        prenom: data.prenom,
        username: data.username,
        email: data.email,
        roles: [], // TODO: Récupérer depuis user_roles
        tokenVersion: data.token_version,
        color: data.color,
        deleteDate: data.delete_date
      };

      // Simuler le délai du MockAPI
      await new Promise(resolve => setTimeout(resolve, 50));

      return new Response(
        JSON.stringify(transformedData),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
