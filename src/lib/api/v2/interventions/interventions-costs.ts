// ===== INTERVENTIONS COSTS =====
// Gestion des coûts, paiements et calcul de marge

import { supabase } from "@/lib/api/v2/common/client";
import type {
  InterventionCost,
  InterventionPayment,
  BulkOperationResult,
  MarginCalculation,
} from "@/lib/api/v2/common/types";
import { safeErrorMessage } from "@/lib/api/v2/common/error-handler";

export const interventionsCosts = {
  /**
   * Créer ou mettre à jour un coût d'intervention
   */
  async upsertCost(interventionId: string, cost: {
    cost_type: 'sst' | 'materiel' | 'intervention' | 'marge';
    amount: number;
    artisan_order?: 1 | 2 | null;
    label?: string | null;
  }): Promise<void> {
    if (!interventionId) {
      throw new Error("interventionId is required");
    }

    const artisanOrder = cost.artisan_order ?? (cost.cost_type === 'intervention' || cost.cost_type === 'marge' ? null : 1);

    let query = supabase
      .from('intervention_costs')
      .select('id')
      .eq('intervention_id', interventionId)
      .eq('cost_type', cost.cost_type);

    if (artisanOrder === null) {
      query = query.is('artisan_order', null);
    } else {
      query = query.eq('artisan_order', artisanOrder);
    }

    const { data: existing, error: selectError } = await query.maybeSingle();

    if (selectError) {
      throw new Error(`Erreur lors de la recherche du coût: ${selectError.message}`);
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from('intervention_costs')
        .update({
          amount: cost.amount,
          label: cost.label ?? null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      if (updateError) {
        throw new Error(`Erreur lors de la mise à jour du coût: ${updateError.message}`);
      }
    } else {
      const { error: insertError } = await supabase
        .from('intervention_costs')
        .insert({
          intervention_id: interventionId,
          cost_type: cost.cost_type,
          amount: cost.amount,
          artisan_order: artisanOrder,
          label: cost.label ?? null,
        });

      if (insertError) {
        throw new Error(`Erreur lors de la création du coût: ${insertError.message}`);
      }
    }
  },

  /**
   * Créer ou mettre à jour plusieurs coûts d'intervention en batch (optimisé)
   */
  async upsertCostsBatch(interventionId: string, costs: Array<{
    cost_type: 'sst' | 'materiel' | 'intervention' | 'marge';
    amount: number;
    artisan_order?: 1 | 2 | null;
    label?: string | null;
  }>): Promise<void> {
    if (!interventionId || costs.length === 0) {
      return;
    }

    const normalizedCosts = costs.map(c => ({
      ...c,
      artisan_order: c.artisan_order ?? (c.cost_type === 'intervention' || c.cost_type === 'marge' ? null : 1)
    }));

    const { data: existingCosts, error: selectError } = await supabase
      .from('intervention_costs')
      .select('id, cost_type, artisan_order')
      .eq('intervention_id', interventionId);

    if (selectError) {
      throw new Error(`Erreur lors de la recherche des coûts existants: ${selectError.message}`);
    }

    const existingMap = new Map<string, string>();
    for (const e of existingCosts || []) {
      const key = `${e.cost_type}|${e.artisan_order ?? 'null'}`;
      existingMap.set(key, e.id);
    }

    const toUpdate: Array<{ id: string; amount: number; label: string | null }> = [];
    const toInsert: Array<{
      intervention_id: string;
      cost_type: string;
      amount: number;
      artisan_order: number | null;
      label: string | null
    }> = [];

    for (const cost of normalizedCosts) {
      const key = `${cost.cost_type}|${cost.artisan_order ?? 'null'}`;
      const existingId = existingMap.get(key);

      if (existingId) {
        toUpdate.push({ id: existingId, amount: cost.amount, label: cost.label ?? null });
      } else {
        toInsert.push({
          intervention_id: interventionId,
          cost_type: cost.cost_type,
          amount: cost.amount,
          artisan_order: cost.artisan_order ?? null,
          label: cost.label ?? null
        });
      }
    }

    const operations: Promise<void>[] = [];

    if (toUpdate.length > 0) {
      operations.push(
        Promise.all(toUpdate.map(async ({ id, amount, label }) => {
          const { error } = await supabase
            .from('intervention_costs')
            .update({ amount, label, updated_at: new Date().toISOString() })
            .eq('id', id);
          if (error) {
            throw new Error(`Erreur lors de la mise à jour du coût: ${error.message}`);
          }
        })).then(() => {})
      );
    }

    if (toInsert.length > 0) {
      operations.push(
        (async () => {
          const { error } = await supabase
            .from('intervention_costs')
            .insert(toInsert);
          if (error) {
            throw new Error(`Erreur lors de l'insertion des coûts: ${error.message}`);
          }
        })()
      );
    }

    await Promise.all(operations);
  },

  /**
   * Récupérer les coûts d'une intervention
   */
  async getCosts(interventionId: string, artisanOrder?: 1 | 2 | null): Promise<InterventionCost[]> {
    if (!interventionId) {
      throw new Error("interventionId is required");
    }

    let query = supabase
      .from('intervention_costs')
      .select('*')
      .eq('intervention_id', interventionId);

    if (artisanOrder !== undefined) {
      if (artisanOrder === null) {
        query = query.is('artisan_order', null);
      } else {
        query = query.eq('artisan_order', artisanOrder);
      }
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erreur lors de la récupération des coûts: ${error.message}`);
    }

    return data || [];
  },

  /**
   * Supprimer un coût d'intervention
   */
  async deleteCost(interventionId: string, costType: string, artisanOrder?: 1 | 2 | null): Promise<void> {
    if (!interventionId) {
      throw new Error("interventionId is required");
    }

    let query = supabase
      .from('intervention_costs')
      .delete()
      .eq('intervention_id', interventionId)
      .eq('cost_type', costType);

    if (artisanOrder === null || artisanOrder === undefined) {
      query = query.is('artisan_order', null);
    } else {
      query = query.eq('artisan_order', artisanOrder);
    }

    const { error } = await query;

    if (error) {
      throw new Error(`Erreur lors de la suppression du coût: ${error.message}`);
    }
  },

  // Ajouter un coût à une intervention
  async addCost(
    interventionId: string,
    data: {
      cost_type: "sst" | "materiel" | "intervention" | "marge";
      label?: string;
      amount: number;
      currency?: string;
      metadata?: Record<string, unknown> | null;
      artisan_order?: 1 | 2 | null;
    }
  ): Promise<InterventionCost> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!interventionId || !uuidRegex.test(interventionId)) {
      throw new Error(`ID d'intervention invalide: ${interventionId}`);
    }

    if (typeof data.amount !== 'number' || isNaN(data.amount)) {
      throw new Error(`Montant invalide: ${data.amount}`);
    }

    const artisanOrder = data.artisan_order !== undefined
      ? data.artisan_order
      : 1;

    const insertData = {
      intervention_id: interventionId,
      cost_type: data.cost_type,
      label: data.label || null,
      amount: data.amount,
      currency: data.currency || 'EUR',
      metadata: data.metadata || null,
      artisan_order: artisanOrder
    };

    try {
      const { data: result, error } = await supabase
        .from('intervention_costs')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('[addCost] Erreur Supabase:', { code: error.code, message: error.message, details: error.details, hint: error.hint });
        throw new Error(`Erreur lors de l'ajout du coût: ${error.message || error.code || 'Erreur inconnue'}`);
      }

      return result;
    } catch (err: unknown) {
      console.error('[addCost] Erreur inattendue:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('invalid response') || errMsg.includes('upstream server')) {
        throw new Error(`Erreur de connexion Supabase - veuillez réessayer: ${errMsg}`);
      }
      throw err;
    }
  },

  // Ajouter un paiement à une intervention
  async addPayment(
    interventionId: string,
    data: {
      payment_type: string;
      amount: number;
      currency?: string;
      is_received?: boolean;
      payment_date?: string;
      reference?: string;
    }
  ): Promise<InterventionPayment> {
    const { data: result, error } = await supabase
      .from('intervention_payments')
      .insert({
        intervention_id: interventionId,
        payment_type: data.payment_type,
        amount: data.amount,
        currency: data.currency || 'EUR',
        is_received: data.is_received || false,
        payment_date: data.payment_date || null,
        reference: data.reference || null
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erreur lors de l'ajout du paiement: ${error.message}`);
    }

    return result;
  },

  // Mettre à jour ou créer un paiement pour une intervention (upsert)
  async upsertPayment(
    interventionId: string,
    data: {
      payment_type: string;
      amount?: number;
      currency?: string;
      is_received?: boolean;
      payment_date?: string | null;
      reference?: string | null;
    }
  ): Promise<InterventionPayment> {
    const { data: existingPayment, error: findError } = await supabase
      .from('intervention_payments')
      .select('id')
      .eq('intervention_id', interventionId)
      .eq('payment_type', data.payment_type)
      .maybeSingle();

    if (findError && findError.code !== 'PGRST116') {
      throw new Error(`Erreur lors de la recherche du paiement: ${findError.message}`);
    }

    if (existingPayment) {
      const { data: result, error: updateError } = await supabase
        .from('intervention_payments')
        .update({
          ...data,
        })
        .eq('id', existingPayment.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Erreur lors de la mise à jour du paiement: ${updateError.message}`);
      }

      return result;
    } else {
      return this.addPayment(interventionId, {
        payment_type: data.payment_type,
        amount: data.amount ?? 0,
        currency: data.currency,
        is_received: data.is_received,
        payment_date: data.payment_date || undefined,
        reference: data.reference || undefined
      });
    }
  },

  // Insérer plusieurs coûts pour des interventions
  async insertInterventionCosts(
    costs: Array<{
      intervention_id: string;
      cost_type: "sst" | "materiel" | "intervention" | "marge";
      label?: string;
      amount: number;
      currency?: string;
      metadata?: Record<string, unknown> | null;
      artisan_order?: 1 | 2 | null;
    }>
  ): Promise<BulkOperationResult> {
    const results: BulkOperationResult = { success: 0, errors: 0, details: [] };

    for (const cost of costs) {
      try {
        await this.upsertCost(cost.intervention_id, {
          cost_type: cost.cost_type,
          amount: cost.amount,
          label: cost.label || null,
          artisan_order: cost.artisan_order ?? (cost.cost_type === 'intervention' || cost.cost_type === 'marge' ? null : 1)
        });
        results.success++;
        results.details.push({ item: cost as unknown as Record<string, unknown>, success: true });
      } catch (error: unknown) {
        results.errors++;
        results.details.push({ item: cost as unknown as Record<string, unknown>, success: false, error: safeErrorMessage(error, "l'insertion du coût") });
      }
    }

    return results;
  },

  /**
   * Calcule la marge pour une intervention à partir de ses coûts
   */
  calculateMarginForIntervention(
    costs: InterventionCost[],
    interventionId?: string | number
  ): MarginCalculation | null {
    if (!costs || costs.length === 0) {
      return null;
    }

    let coutIntervention = 0;
    let coutSST = 0;
    let coutMateriel = 0;

    costs.forEach((cost) => {
      switch (cost.cost_type) {
        case "intervention":
          coutIntervention = cost.amount || 0;
          break;
        case "sst":
          coutSST = cost.amount || 0;
          break;
        case "materiel":
          coutMateriel = cost.amount || 0;
          break;
      }
    });

    if (coutIntervention <= 0) {
      return null;
    }

    const totalCostForIntervention = coutSST + coutMateriel;
    const marge = coutIntervention - totalCostForIntervention;
    const marginPercentage = (marge / coutIntervention) * 100;

    if (marge < 0) {
      const idStr = interventionId ? ` (ID: ${interventionId})` : '';
    }

    return {
      revenue: coutIntervention,
      costs: totalCostForIntervention,
      margin: marge,
      marginPercentage: marginPercentage,
    };
  },
};
