// ===== API REFERENTIALS =====
// Chargement consolidé des tables de référence pour les opérations
// d'import en masse (un seul aller-retour réseau au lieu de 5).
//
// Utilise un client Supabase explicite (généralement le client SSR avec
// les RLS de l'utilisateur) plutôt que le singleton browser, car les
// imports s'exécutent côté serveur dans le contexte d'un utilisateur.

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ReferentialAgency {
  id: string;
  label: string;
}

export interface ReferentialMetier {
  id: string;
  label: string;
}

export interface ReferentialStatus {
  id: string;
  label: string;
  /**
   * Code technique stable (`INTER_TERMINEE`, `INTER_EN_COURS`, …). Sert à matcher
   * les CSV exportés avec la valeur "code" plutôt que le libellé français.
   */
  code: string | null;
}

export interface ReferentialUser {
  id: string;
  username: string | null;
  /** Lettre/code court utilisé en colonne "Gest." des CSV d'import. */
  code_gestionnaire: string | null;
}

export interface ReferentialArtisan {
  id: string;
  plain_nom: string | null;
  telephone: string | null;
  email: string | null;
}

export interface ImportReferentials {
  agencies: ReferentialAgency[];
  metiers: ReferentialMetier[];
  statuses: ReferentialStatus[];
  users: ReferentialUser[];
  artisans: ReferentialArtisan[];
}

export const referentialsApi = {
  /**
   * Charge en parallèle toutes les tables de référence nécessaires à un
   * import d'interventions. Filtre sur `is_active = true` côté serveur.
   *
   * Le client est passé explicitement pour préserver le contexte RLS de
   * l'utilisateur appelant (route SSR).
   */
  async loadForImport(supabase: SupabaseClient): Promise<ImportReferentials> {
    const [agenciesRes, metiersRes, statusesRes, usersRes, artisansRes] =
      await Promise.all([
        supabase.from('agencies').select('id, label').eq('is_active', true),
        supabase.from('metiers').select('id, label').eq('is_active', true),
        supabase
          .from('intervention_statuses')
          .select('id, label, code')
          .eq('is_active', true),
        // `users` n'a pas de colonne `is_active` — on exclut les utilisateurs
        // archivés via `archived_at IS NULL`.
        supabase
          .from('users')
          .select('id, username, code_gestionnaire')
          .is('archived_at', null),
        supabase
          .from('artisans')
          .select('id, plain_nom, telephone, email')
          .eq('is_active', true),
      ]);

    return {
      agencies: agenciesRes.data ?? [],
      metiers: metiersRes.data ?? [],
      statuses: statusesRes.data ?? [],
      users: usersRes.data ?? [],
      artisans: artisansRes.data ?? [],
    };
  },
};
