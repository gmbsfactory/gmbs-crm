import { supabaseClient } from "./_helpers";
import type { ArtisanStatsByStatus } from "@/lib/api/common/types";

export const artisansStats = {
  /**
   * Récupère les statistiques d'artisans par statut pour un gestionnaire
   * @param gestionnaireId - ID du gestionnaire (utilisateur)
   * @param startDate - Date de début (optionnelle, format ISO string)
   * @param endDate - Date de fin (optionnelle, format ISO string)
   * @returns Statistiques avec le nombre d'artisans par statut et le nombre de dossiers à compléter
   */
  async getStatsByGestionnaire(
    gestionnaireId: string,
    startDate?: string,
    endDate?: string
  ): Promise<ArtisanStatsByStatus> {
    if (!gestionnaireId) {
      throw new Error("gestionnaireId is required");
    }

    // Construire la requête avec join sur artisan_statuses
    let query = supabaseClient
      .from("artisans")
      .select(
        `
        statut_id,
        date_ajout,
        statut_dossier,
        status:artisan_statuses!inner(id, code, label)
        `,
        { count: "exact" }
      )
      .eq("gestionnaire_id", gestionnaireId)
      .eq("is_active", true)
      .neq("status.code", "ARCHIVE");

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Erreur lors de la récupération des statistiques: ${error.message}`);
    }

    // Initialiser les compteurs
    const byStatus: Record<string, number> = {};
    const byStatusLabel: Record<string, number> = {};
    let dossiersACompleter = 0;

    // Compter les artisans par statut et les dossiers à compléter
    (data || []).forEach((item: any) => {
      const statusRaw = item.status;
      const status = Array.isArray(statusRaw) ? statusRaw[0] as { id?: string; code?: string; label?: string } | undefined : statusRaw as { id?: string; code?: string; label?: string } | null;
      if (status) {
        const code = status.code || "SANS_STATUT";
        const label = status.label || "Sans statut";

        byStatus[code] = (byStatus[code] || 0) + 1;
        byStatusLabel[label] = (byStatusLabel[label] || 0) + 1;
      } else {
        // Artisan sans statut
        byStatus["SANS_STATUT"] = (byStatus["SANS_STATUT"] || 0) + 1;
        byStatusLabel["Sans statut"] = (byStatusLabel["Sans statut"] || 0) + 1;
      }

      // Compter les dossiers à compléter
      if (item.statut_dossier === "À compléter" || item.statut_dossier === "incomplet" || item.statut_dossier === "INCOMPLET") {
        dossiersACompleter++;
      }
    });

    return {
      total: count || 0,
      by_status: byStatus,
      by_status_label: byStatusLabel,
      dossiers_a_completer: dossiersACompleter,
      period: {
        start_date: startDate || null,
        end_date: endDate || null,
      },
    };
  },

  /**
   * Récupère les 5 artisans les plus actifs pour un gestionnaire avec leur dernière intervention et statut de disponibilité
   * @param gestionnaireId - ID du gestionnaire
   * @returns Liste des artisans avec leur nombre d'interventions, dernière date d'intervention et statut de disponibilité
   */
  async getTopArtisansByGestionnaire(
    gestionnaireId: string
  ): Promise<Array<{
    artisan_id: string;
    artisan_nom: string;
    artisan_prenom: string;
    total_interventions: number;
    derniere_intervention_date: string | null;
    is_available: boolean;
    absence_reason: string | null;
    absence_end_date: string | null;
  }>> {
    if (!gestionnaireId) {
      throw new Error("gestionnaireId is required");
    }

    // Récupérer les artisans du gestionnaire avec leur nombre d'interventions
    const { data: artisansStats, error: statsError } = await supabaseClient
      .from("artisans")
      .select(
        `
        id,
        nom,
        prenom,
        intervention_artisans!inner(
          intervention_id,
          interventions!inner(
            date,
            is_active
          )
        )
        `
      )
      .eq("gestionnaire_id", gestionnaireId)
      .eq("is_active", true);

    if (statsError) {
      throw new Error(`Erreur lors de la récupération des artisans: ${statsError.message}`);
    }

    // Compter les interventions par artisan et trouver la dernière date
    const artisanMap = new Map<string, {
      artisan_id: string;
      artisan_nom: string;
      artisan_prenom: string;
      intervention_dates: string[];
    }>();

    (artisansStats || []).forEach((artisan: any) => {
      const interventionArtisansList = artisan.intervention_artisans || [];
      const interventionDates = interventionArtisansList
        .map((ia: any) => {
          const interv = Array.isArray(ia.interventions) ? ia.interventions[0] : ia.interventions;
          return interv?.is_active ? interv?.date : null;
        })
        .filter((date: unknown): date is string => typeof date === 'string');

      if (interventionDates.length > 0) {
        artisanMap.set(artisan.id, {
          artisan_id: artisan.id,
          artisan_nom: artisan.nom || "",
          artisan_prenom: artisan.prenom || "",
          intervention_dates: interventionDates,
        });
      }
    });

    // Trier par nombre d'interventions et prendre les 5 premiers
    const topArtisans = Array.from(artisanMap.values())
      .map(artisan => ({
        ...artisan,
        total_interventions: artisan.intervention_dates.length,
        derniere_intervention_date: artisan.intervention_dates
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null,
      }))
      .sort((a, b) => b.total_interventions - a.total_interventions)
      .slice(0, 5);

    // Récupérer les absences pour vérifier la disponibilité
    const artisanIds = topArtisans.map(a => a.artisan_id);
    const now = new Date().toISOString();

    const { data: absences, error: absencesError } = await supabaseClient
      .from("artisan_absences")
      .select("artisan_id, start_date, end_date, reason, is_confirmed")
      .in("artisan_id", artisanIds)
      .lte("start_date", now)
      .gte("end_date", now)
      .eq("is_confirmed", true);

    if (absencesError) {
      console.warn("Erreur lors de la récupération des absences:", absencesError);
    }

    // Créer un map des absences par artisan
    const absenceMap = new Map<string, { reason: string | null; end_date: string }>();
    (absences || []).forEach((absence: any) => {
      absenceMap.set(absence.artisan_id, {
        reason: absence.reason,
        end_date: absence.end_date,
      });
    });

    // Ajouter les informations de disponibilité
    return topArtisans.map(artisan => {
      const absence = absenceMap.get(artisan.artisan_id);
      return {
        artisan_id: artisan.artisan_id,
        artisan_nom: artisan.artisan_nom,
        artisan_prenom: artisan.artisan_prenom,
        total_interventions: artisan.total_interventions,
        derniere_intervention_date: artisan.derniere_intervention_date,
        is_available: !absence,
        absence_reason: absence?.reason || null,
        absence_end_date: absence?.end_date || null,
      };
    });
  },

  /**
   * Récupère les 5 dernières interventions d'un artisan avec leurs marges
   * @param artisanId - ID de l'artisan
   * @param limit - Nombre d'interventions à récupérer (défaut: 5)
   * @param startDate - Date de début (optionnelle) pour filtrer les interventions
   * @param endDate - Date de fin (optionnelle) pour filtrer les interventions
   * @returns Liste des interventions avec id_inter, date et marge
   */
  async getRecentInterventionsByArtisanWithMargins(
    artisanId: string,
    limit: number = 5,
    startDate?: string,
    endDate?: string
  ): Promise<Array<{
    id: string;
    id_inter: string | null;
    date: string;
    marge: number; // Somme des coûts de type 'marge'
    status_label: string | null;
    status_color: string | null;
    due_date: string | null;
    metier_label: string | null;
  }>> {
    if (!artisanId) {
      throw new Error("artisanId is required");
    }

    // Récupérer les interventions de l'artisan via intervention_artisans
    const { data: interventionArtisans, error: joinError } = await supabaseClient
      .from("intervention_artisans")
      .select(
        `
        intervention_id,
        interventions!inner (
          id,
          id_inter,
          date,
          due_date,
          is_active,
          statut_id,
          status:intervention_statuses(id, code, label, color),
          metier:metiers!metier_id(id, label, code),
          intervention_costs (
            cost_type,
            amount
          )
        )
        `
      )
      .eq("artisan_id", artisanId);

    if (joinError) {
      throw new Error(`Erreur lors de la récupération des interventions: ${joinError.message}`);
    }

    if (!interventionArtisans || interventionArtisans.length === 0) {
      return [];
    }

    // Traiter les interventions et calculer les marges
    let interventionsWithMargins = interventionArtisans
      .map((ia: any) => {
        const interventionRaw = ia.interventions;
        const intervention = Array.isArray(interventionRaw) ? interventionRaw[0] : interventionRaw;
        if (!intervention || !intervention.is_active) {
          return null;
        }

        // Filtrer par période si fournie (filtrage côté client car Supabase ne permet pas de filtrer sur les relations imbriquées)
        if (startDate && intervention.date < startDate) {
          return null;
        }
        if (endDate && intervention.date > endDate) {
          return null;
        }

        // Calculer la marge (somme des coûts de type 'marge')
        let marge = 0;
        const costsList = intervention.intervention_costs;
        if (costsList && Array.isArray(costsList)) {
          costsList.forEach((cost) => {
            if (cost.cost_type === "marge" && cost.amount !== null && cost.amount !== undefined) {
              marge += Number(cost.amount);
            }
          });
        }

        // Extraire le statut depuis la relation
        const statusRaw = intervention.status;
        const status = Array.isArray(statusRaw) ? statusRaw[0] : statusRaw;
        const status_label = status?.label || null;
        const status_color = status?.color || null;

        // Extraire le métier depuis la relation
        const metierRaw = intervention.metier;
        const metier = Array.isArray(metierRaw) ? metierRaw[0] : metierRaw;
        const metier_label = metier?.label || null;

        return {
          id: intervention.id,
          id_inter: intervention.id_inter,
          date: intervention.date,
          marge,
          status_label,
          status_color,
          due_date: intervention.due_date || null,
          metier_label,
        };
      })
      .filter((item: any): item is { id: string; id_inter: string | null; date: string; marge: number; status_label: string | null; status_color: string | null; due_date: string | null; metier_label: string | null; } => item !== null)
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);

    return interventionsWithMargins;
  },

  /**
   * Récupère les artisans d'un statut avec leurs 5 dernières interventions et marges
   * @param gestionnaireId - ID du gestionnaire
   * @param statusLabel - Label du statut (ex: "Expert", "Confirmé", etc.)
   * @param startDate - Date de début (optionnelle) pour filtrer les interventions
   * @param endDate - Date de fin (optionnelle) pour filtrer les interventions
   * @returns Liste des artisans avec leurs interventions récentes
   */
  async getArtisansByStatusWithRecentInterventions(
    gestionnaireId: string,
    statusLabel: string,
    startDate?: string,
    endDate?: string,
    maxArtisans: number = 3,
    maxInterventions: number = 3
  ): Promise<Array<{
    artisan_id: string;
    artisan_nom: string;
    artisan_prenom: string;
    recent_interventions: Array<{
      id: string;
      id_inter: string | null;
      date: string;
      marge: number;
      status_label: string | null;
      status_color: string | null;
      due_date: string | null;
      metier_label: string | null;
    }>;
  }>> {
    if (!gestionnaireId) {
      throw new Error("gestionnaireId is required");
    }
    if (!statusLabel) {
      throw new Error("statusLabel is required");
    }

    // Récupérer les artisans du gestionnaire avec le statut correspondant
    const { data: artisans, error: artisansError } = await supabaseClient
      .from("artisans")
      .select(
        `
        id,
        nom,
        prenom,
        created_at,
        status:artisan_statuses(id, code, label)
        `
      )
      .eq("gestionnaire_id", gestionnaireId)
      .eq("is_active", true)
      .order("created_at", { ascending: false }); // Trier par date d'insertion décroissante

    if (artisansError) {
      throw new Error(`Erreur lors de la récupération des artisans: ${artisansError.message}`);
    }

    if (!artisans || artisans.length === 0) {
      return [];
    }

    // Filtrer les artisans par statut label
    const artisansByStatus = artisans.filter((artisan: any) => {
      const statusRaw = artisan.status;
      const status = Array.isArray(statusRaw) ? statusRaw[0] : statusRaw;
      return status && status.label === statusLabel;
    });

    if (artisansByStatus.length === 0) {
      return [];
    }

    // Limiter aux maxArtisans derniers artisans insérés par statut
    const topArtisansByStatus = artisansByStatus.slice(0, maxArtisans);

    // Pour chaque artisan, récupérer ses maxInterventions dernières interventions avec marges (filtrées par période si fournie)
    const artisansWithInterventions = await Promise.all(
      topArtisansByStatus.map(async (artisan: any) => {
        const recentInterventions = await this.getRecentInterventionsByArtisanWithMargins(
          artisan.id,
          maxInterventions,
          startDate,
          endDate
        );

        return {
          artisan_id: artisan.id,
          artisan_nom: artisan.nom || "",
          artisan_prenom: artisan.prenom || "",
          recent_interventions: recentInterventions,
        };
      })
    );

    // Filtrer les artisans qui ont au moins une intervention
    return artisansWithInterventions.filter(
      (artisan) => artisan.recent_interventions.length > 0
    );
  },

  /**
   * Récupère les artisans avec dossiers à compléter pour un gestionnaire
   * @param gestionnaireId - ID du gestionnaire
   * @returns Liste des artisans avec leur nom et prénom
   */
  async getArtisansWithDossiersACompleter(
    gestionnaireId: string
  ): Promise<Array<{
    artisan_id: string;
    artisan_nom: string;
    artisan_prenom: string;
  }>> {
    if (!gestionnaireId) {
      throw new Error("gestionnaireId is required");
    }

    const { data, error } = await supabaseClient
      .from("artisans")
      .select("id, nom, prenom, statut_id, artisan_statuses!inner(code)")
      .eq("gestionnaire_id", gestionnaireId)
      .eq("is_active", true)
      .in("statut_dossier", ["À compléter", "incomplet", "INCOMPLET"])
      .neq("artisan_statuses.code", "ARCHIVE");

    if (error) {
      throw new Error(`Erreur lors de la récupération des artisans: ${error.message}`);
    }

    return (data || []).map((a: any) => ({
      artisan_id: a.id,
      artisan_nom: a.nom || "",
      artisan_prenom: a.prenom || "",
    }));
  },
};
