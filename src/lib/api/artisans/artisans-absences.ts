import { supabaseClient } from "./_helpers";

export const artisansAbsences = {
  /**
   * Récupère les absences d'un artisan
   */
  async getAbsences(artisanId: string): Promise<Array<{
    id: string;
    start_date: string;
    end_date: string;
    reason: string | null;
    is_confirmed: boolean;
  }>> {
    if (!artisanId) {
      throw new Error("artisanId is required");
    }

    const { data, error } = await supabaseClient
      .from("artisan_absences")
      .select("id, start_date, end_date, reason, is_confirmed")
      .eq("artisan_id", artisanId)
      .order("start_date", { ascending: false });

    if (error) {
      throw new Error(`Erreur lors de la récupération des absences: ${error.message}`);
    }

    return (data || []).map((absence: any) => ({
      id: absence.id,
      start_date: absence.start_date,
      end_date: absence.end_date,
      reason: absence.reason,
      is_confirmed: absence.is_confirmed ?? false,
    }));
  },

  /**
   * Crée une nouvelle absence pour un artisan
   */
  async createAbsence(artisanId: string, absence: {
    start_date: string;
    end_date: string;
    reason?: string;
    is_confirmed?: boolean;
  }): Promise<{
    id: string;
    start_date: string;
    end_date: string;
    reason: string | null;
    is_confirmed: boolean;
  }> {
    if (!artisanId) {
      throw new Error("artisanId is required");
    }
    if (!absence.start_date || !absence.end_date) {
      throw new Error("start_date and end_date are required");
    }

    const { data, error } = await supabaseClient
      .from("artisan_absences")
      .insert({
        artisan_id: artisanId,
        start_date: absence.start_date,
        end_date: absence.end_date,
        reason: absence.reason || null,
        is_confirmed: absence.is_confirmed ?? false,
      })
      .select("id, start_date, end_date, reason, is_confirmed")
      .single();

    if (error) {
      throw new Error(`Erreur lors de la création de l'absence: ${error.message}`);
    }

    return {
      id: data.id,
      start_date: data.start_date,
      end_date: data.end_date,
      reason: data.reason,
      is_confirmed: data.is_confirmed ?? false,
    };
  },

  /**
   * Supprime une absence
   */
  async deleteAbsence(absenceId: string): Promise<void> {
    if (!absenceId) {
      throw new Error("absenceId is required");
    }

    const { error } = await supabaseClient
      .from("artisan_absences")
      .delete()
      .eq("id", absenceId);

    if (error) {
      throw new Error(`Erreur lors de la suppression de l'absence: ${error.message}`);
    }
  },

  /**
   * Met à jour une absence
   */
  async updateAbsence(absenceId: string, updates: {
    start_date?: string;
    end_date?: string;
    reason?: string;
    is_confirmed?: boolean;
  }): Promise<{
    id: string;
    start_date: string;
    end_date: string;
    reason: string | null;
    is_confirmed: boolean;
  }> {
    if (!absenceId) {
      throw new Error("absenceId is required");
    }

    const { data, error } = await supabaseClient
      .from("artisan_absences")
      .update(updates)
      .eq("id", absenceId)
      .select("id, start_date, end_date, reason, is_confirmed")
      .single();

    if (error) {
      throw new Error(`Erreur lors de la mise à jour de l'absence: ${error.message}`);
    }

    return {
      id: data.id,
      start_date: data.start_date,
      end_date: data.end_date,
      reason: data.reason,
      is_confirmed: data.is_confirmed ?? false,
    };
  },
};
