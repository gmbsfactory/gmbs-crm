// ===== API ENUMS V2 =====
// Gestion des énumérations (agences, métiers, zones, statuts)
// avec création automatique si nécessaire

import { supabase } from "@/lib/supabase-client";

/**
 * Crée un client Supabase admin pour Node.js avec les bonnes credentials
 * Utilise la service role key pour contourner les RLS lors des imports
 */
function getSupabaseClientForNode() {
  // Si on est dans le navigateur, utiliser le client standard
  if (typeof window !== 'undefined') {
    return supabase;
  }
  
  // Dans Node.js, créer un nouveau client avec les credentials du service role
  const { createClient } = require('@supabase/supabase-js');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('[enumsApi] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquants, utilisation du client standard');
    return supabase;
  }
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    }
  });
}

// Utiliser le client admin dans Node.js, le client standard dans le navigateur
const supabaseClient = typeof window !== 'undefined' ? supabase : getSupabaseClientForNode();

// Type de retour pour indiquer si l'élément a été créé ou trouvé
export interface FindOrCreateResult {
  id: string;
  created: boolean;
}

// ===== AGENCES =====

/**
 * Trouve ou crée une agence par son nom
 */
export const findOrCreateAgency = async (name: string): Promise<FindOrCreateResult> => {
  if (!name || name.trim() === '') {
    throw new Error('Le nom de l\'agence ne peut pas être vide');
  }

  const normalizedName = name.trim();
  const code = normalizedName.substring(0, 10).toUpperCase().replace(/[^A-Z0-9]/g, '');

  // Chercher d'abord par label
  const { data: existingByLabel } = await supabaseClient
    .from('agencies')
    .select('id')
    .ilike('label', normalizedName)
    .single();

  if (existingByLabel) {
    return { id: existingByLabel.id, created: false };
  }

  // Chercher ensuite par code (pour gérer les variations d'accents)
  const { data: existingByCode } = await supabaseClient
    .from('agencies')
    .select('id')
    .eq('code', code)
    .single();

  if (existingByCode) {
    return { id: existingByCode.id, created: false };
  }

  // Si elle n'existe pas, la créer
  const { data: created, error: createError } = await supabaseClient
    .from('agencies')
    .insert({ code, label: normalizedName })
    .select('id')
    .single();

  if (createError) {
    // Si erreur de duplicate key, refaire une recherche par code
    if (createError.message.includes('duplicate key')) {
      const { data: retry } = await supabaseClient
        .from('agencies')
        .select('id')
        .eq('code', code)
        .single();
      
      if (retry) {
        return { id: retry.id, created: false };
      }
    }
    throw new Error(`Erreur lors de la création de l'agence: ${createError.message}`);
  }

  return { id: created.id, created: true };
};

// ===== UTILISATEURS =====

/**
 * Trouve ou crée un utilisateur par son code gestionnaire ou nom
 */
export const findOrCreateUser = async (name: string): Promise<FindOrCreateResult> => {
  if (!name || name.trim() === '') {
    throw new Error('Le nom de l\'utilisateur ne peut pas être vide');
  }

  const normalizedName = name.trim();

  // Chercher d'abord par username ou firstname/lastname
  const { data: existingByName } = await supabaseClient
    .from('users')
    .select('id')
    .or(`username.ilike.${normalizedName},firstname.ilike.${normalizedName},lastname.ilike.${normalizedName}`)
    .single();

  if (existingByName) {
    return { id: existingByName.id, created: false };
  }

  // Si il n'existe pas, le créer
  const username = normalizedName.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Générer un code gestionnaire unique
  // Utiliser la première lettre du nom, puis chercher un code disponible
  let code = normalizedName.substring(0, 1).toUpperCase();
  let codeCounter = 1;
  
  // Vérifier si le code existe déjà
  const { data: existingCode } = await supabaseClient
    .from('users')
    .select('id')
    .eq('code_gestionnaire', code)
    .single();
  
  // Si le code existe, essayer avec un numéro
  if (existingCode) {
    while (true) {
      const testCode = `${code}${codeCounter}`;
      const { data: testExisting } = await supabaseClient
        .from('users')
        .select('id')
        .eq('code_gestionnaire', testCode)
        .single();
      
      if (!testExisting) {
        code = testCode;
        break;
      }
      codeCounter++;
    }
  }
  
  const { data: created, error: createError } = await supabaseClient
    .from('users')
    .insert({ 
      username, 
      firstname: normalizedName,
      code_gestionnaire: code,
      status: 'offline'
    })
    .select('id')
    .single();

  if (createError) {
    // Si erreur de duplicate key, refaire une recherche par code_gestionnaire
    if (createError.message.includes('duplicate key')) {
      const { data: retry } = await supabaseClient
        .from('users')
        .select('id')
        .eq('code_gestionnaire', code)
        .single();
      
      if (retry) {
        return { id: retry.id, created: false };
      }
      
      // Si toujours pas trouvé, essayer de chercher par username
      const { data: retryByUsername } = await supabaseClient
        .from('users')
        .select('id')
        .eq('username', username)
        .single();
      
      if (retryByUsername) {
        return { id: retryByUsername.id, created: false };
      }
    }
    throw new Error(`Erreur lors de la création de l'utilisateur: ${createError.message}`);
  }

  return { id: created.id, created: true };
};

// ===== MÉTIERS =====

/**
 * Trouve ou crée un métier par son nom
 */
export const findOrCreateMetier = async (name: string): Promise<FindOrCreateResult> => {
  if (!name || name.trim() === '') {
    throw new Error('Le nom du métier ne peut pas être vide');
  }

  const normalizedName = name.trim();
  const code = normalizedName.substring(0, 10).toUpperCase().replace(/[^A-Z0-9]/g, '');

  // Chercher d'abord par label
  const { data: existingByLabel } = await supabaseClient
    .from('metiers')
    .select('id')
    .ilike('label', normalizedName)
    .single();

  if (existingByLabel) {
    return { id: existingByLabel.id, created: false };
  }

  // Chercher ensuite par code (pour gérer les variations d'accents)
  const { data: existingByCode } = await supabaseClient
    .from('metiers')
    .select('id')
    .eq('code', code)
    .single();

  if (existingByCode) {
    return { id: existingByCode.id, created: false };
  }

  // Si il n'existe pas, le créer
  const { data: created, error: createError } = await supabaseClient
    .from('metiers')
    .insert({ code, label: normalizedName })
    .select('id')
    .single();

  if (createError) {
    // Si erreur de duplicate key, refaire une recherche par code
    if (createError.message.includes('duplicate key')) {
      const { data: retry } = await supabaseClient
        .from('metiers')
        .select('id')
        .eq('code', code)
        .single();
      
      if (retry) {
        return { id: retry.id, created: false };
      }
    }
    throw new Error(`Erreur lors de la création du métier: ${createError.message}`);
  }

  return { id: created.id, created: true };
};

// ===== ZONES =====

/**
 * Trouve ou crée une zone par son nom
 */
export const findOrCreateZone = async (name: string): Promise<FindOrCreateResult> => {
  if (!name || name.trim() === '') {
    throw new Error('Le nom de la zone ne peut pas être vide');
  }

  const normalizedName = name.trim();
  const code = normalizedName.substring(0, 10).toUpperCase().replace(/[^A-Z0-9]/g, '');

  // Chercher d'abord par label
  const { data: existingByLabel } = await supabaseClient
    .from('zones')
    .select('id')
    .ilike('label', normalizedName)
    .single();

  if (existingByLabel) {
    return { id: existingByLabel.id, created: false };
  }

  // Chercher ensuite par code (pour gérer les variations d'accents)
  const { data: existingByCode } = await supabaseClient
    .from('zones')
    .select('id')
    .eq('code', code)
    .single();

  if (existingByCode) {
    return { id: existingByCode.id, created: false };
  }

  // Si elle n'existe pas, la créer
  
  const { data: created, error: createError } = await supabaseClient
    .from('zones')
    .insert({ code, label: normalizedName })
    .select('id')
    .single();

  if (createError) {
    // Si erreur de duplicate key, refaire une recherche par code
    if (createError.message.includes('duplicate key')) {
      const { data: retry } = await supabaseClient
        .from('zones')
        .select('id')
        .eq('code', code)
        .single();
      
      if (retry) {
        return { id: retry.id, created: false };
      }
    }
    throw new Error(`Erreur lors de la création de la zone: ${createError.message}`);
  }

  return { id: created.id, created: true };
};

// ===== STATUTS ARTISAN =====

/**
 * Trouve ou crée un statut artisan par son nom
 */
export const findOrCreateArtisanStatus = async (name: string): Promise<FindOrCreateResult> => {
  if (!name || name.trim() === '') {
    throw new Error('Le nom du statut artisan ne peut pas être vide');
  }

  const normalizedName = name.trim();
  const code = normalizedName.substring(0, 10).toUpperCase().replace(/[^A-Z0-9]/g, '');

  // Chercher d'abord par label
  const { data: existingByLabel } = await supabaseClient
    .from('artisan_statuses')
    .select('id')
    .ilike('label', normalizedName)
    .single();

  if (existingByLabel) {
    return { id: existingByLabel.id, created: false };
  }

  // Chercher ensuite par code (pour gérer les variations d'accents)
  const { data: existingByCode } = await supabaseClient
    .from('artisan_statuses')
    .select('id')
    .eq('code', code)
    .single();

  if (existingByCode) {
    return { id: existingByCode.id, created: false };
  }

  // Si il n'existe pas, le créer
  
  const { data: created, error: createError } = await supabaseClient
    .from('artisan_statuses')
    .insert({ 
      code, 
      label: normalizedName,
      color: '#808080',
      sort_order: 999
    })
    .select('id')
    .single();

  if (createError) {
    // Si erreur de duplicate key, refaire une recherche par code
    if (createError.message.includes('duplicate key')) {
      const { data: retry } = await supabaseClient
        .from('artisan_statuses')
        .select('id')
        .eq('code', code)
        .single();
      
      if (retry) {
        return { id: retry.id, created: false };
      }
    }
    throw new Error(`Erreur lors de la création du statut artisan: ${createError.message}`);
  }

  return { id: created.id, created: true };
};

// ===== STATUTS INTERVENTION =====

/**
 * Trouve ou crée un statut intervention par son nom
 */
export const findOrCreateInterventionStatus = async (name: string): Promise<FindOrCreateResult> => {
  if (!name || name.trim() === '') {
    throw new Error('Le nom du statut intervention ne peut pas être vide');
  }

  const normalizedName = name.trim();
  const code = normalizedName.substring(0, 10).toUpperCase().replace(/[^A-Z0-9]/g, '');

  // Chercher d'abord par label
  const { data: existingByLabel } = await supabaseClient
    .from('intervention_statuses')
    .select('id')
    .ilike('label', normalizedName)
    .single();

  if (existingByLabel) {
    return { id: existingByLabel.id, created: false };
  }

  // Chercher ensuite par code (pour gérer les variations d'accents)
  const { data: existingByCode } = await supabaseClient
    .from('intervention_statuses')
    .select('id')
    .eq('code', code)
    .single();

  if (existingByCode) {
    return { id: existingByCode.id, created: false };
  }

  // Si il n'existe pas, le créer
  
  const { data: created, error: createError } = await supabaseClient
    .from('intervention_statuses')
    .insert({ 
      code, 
      label: normalizedName,
      color: '#808080',
      sort_order: 999
    })
    .select('id')
    .single();

  if (createError) {
    // Si erreur de duplicate key, refaire une recherche par code
    if (createError.message.includes('duplicate key')) {
      const { data: retry } = await supabaseClient
        .from('intervention_statuses')
        .select('id')
        .eq('code', code)
        .single();
      
      if (retry) {
        return { id: retry.id, created: false };
      }
    }
    throw new Error(`Erreur lors de la création du statut intervention: ${createError.message}`);
  }

  return { id: created.id, created: true };
};

/**
 * Récupère un statut d'intervention via son code canonique.
 */
export const getInterventionStatusByCode = async (code: string) => {
  const normalizedCode = code?.trim();
  if (!normalizedCode) {
    return { data: null, error: new Error('Le code du statut ne peut pas être vide') };
  }

  const { data, error } = await supabaseClient
    .from('intervention_statuses')
    .select('id, code, label, color, sort_order')
    .eq('code', normalizedCode)
    .single();

  return { data, error };
};

/**
 * Récupère un utilisateur via son username canonique.
 */
export const getUserByUsername = async (username: string) => {
  const normalizedUsername = username?.trim();
  if (!normalizedUsername) {
    return { data: null, error: new Error('Le username ne peut pas être vide') };
  }

  const { data, error } = await supabaseClient
    .from('users')
    .select('id, username, email, code_gestionnaire')
    .eq('username', normalizedUsername)
    .single();

  return { data, error };
};

// Export de l'API complète
export const enumsApi = {
  findOrCreateAgency,
  findOrCreateUser,
  findOrCreateMetier,
  findOrCreateZone,
  findOrCreateArtisanStatus,
  findOrCreateInterventionStatus,
  getInterventionStatusByCode,
  getUserByUsername,
};
