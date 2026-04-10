// ===== API ARTISAN STATUSES V2 =====
// Gestion des statuts d'artisan

import { supabase } from "./common/client";

// Types
export interface ArtisanStatus {
    id: string;
    code: string;
    label: string;
    color: string | null;
    abbreviation: string | null;
    sort_order: number;
    is_active: boolean;
}

export interface ArtisanStatusData {
    label: string;
    code?: string;
    color?: string | null;
    abbreviation?: string | null;
    sort_order?: number;
    is_active?: boolean;
}

export const artisanStatusesApi = {
    /**
     * Récupérer tous les statuts d'artisan
     */
    async getAll(): Promise<ArtisanStatus[]> {
        const { data, error } = await supabase
            .from("artisan_statuses")
            .select("*")
            .order("sort_order", { ascending: true });

        if (error) throw new Error(`Erreur lors de la récupération des statuts: ${error.message}`);

        return data || [];
    },

    /**
     * Créer un nouveau statut d'artisan
     */
    async create(statusData: ArtisanStatusData): Promise<ArtisanStatus> {
        const code = statusData.code || statusData.label.substring(0, 10).toUpperCase().replace(/[^A-Z0-9]/g, '');

        const { data, error } = await supabase
            .from("artisan_statuses")
            .insert({
                ...statusData,
                code
            })
            .select()
            .single();

        if (error) throw new Error(`Erreur lors de la création du statut: ${error.message}`);

        return data;
    },

    /**
     * Mettre à jour un statut d'artisan
     */
    async update(id: string, statusData: Partial<ArtisanStatusData>): Promise<ArtisanStatus> {
        const { data, error } = await supabase
            .from("artisan_statuses")
            .update(statusData)
            .eq("id", id)
            .select()
            .single();

        if (error) throw new Error(`Erreur lors de la mise à jour du statut: ${error.message}`);

        return data;
    },

    /**
     * Supprimer un statut d'artisan
     */
    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from("artisan_statuses")
            .delete()
            .eq("id", id);

        if (error) throw new Error(`Erreur lors de la suppression du statut: ${error.message}`);
    }
};
