/**
 * EXEMPLE DE MIGRATION - Gestion d'Erreurs
 *
 * Ce fichier montre comment migrer du pattern problématique
 * vers le nouveau système de gestion d'erreurs
 */

// @ts-nocheck - Fichier d'exemple pour documentation

// ===== AVANT (Pattern Problématique) =====

async function getInterventionOld(id: string) {
  try {
    const { data, error } = await supabase
      .from('interventions')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error(error); // ❌ Log uniquement
    return null; // ❌ Pas de propagation, pas de contexte
  }
}

// ===== APRÈS (Nouveau Système) =====

import { ErrorHandler, Errors } from '@/lib/errors/error-handler';

async function getInterventionNew(id: string) {
  try {
    const { data, error } = await supabase
      .from('interventions')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    if (!data) throw Errors.notFound('Intervention', id);
    
    return data;
  } catch (error) {
    return ErrorHandler.handle(error, {
      context: 'interventionsApi',
      operation: 'getIntervention',
      fallback: null,
      propagate: false,
      metadata: { interventionId: id },
      severity: 'medium'
    });
  }
}

// ===== EXEMPLE AVEC PROPAGATION (API Route) =====

import { NextResponse } from 'next/server';
import { ErrorHandler } from '@/lib/errors/error-handler';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    
    if (!id) {
      throw Errors.badRequest('ID manquant');
    }
    
    const intervention = await getInterventionNew(id);
    return NextResponse.json({ intervention });
  } catch (error) {
    return ErrorHandler.handle(error, {
      context: 'api/interventions',
      operation: 'GET',
      propagate: true, // ✅ Re-lance pour que Next.js gère la réponse
      severity: 'high'
    });
  }
}

// ===== EXEMPLE AVEC WRAPPER =====

import { ErrorHandler } from '@/lib/errors/error-handler';

// Fonction originale
async function fetchInterventions() {
  const { data, error } = await supabase
    .from('interventions')
    .select('*');
  
  if (error) throw error;
  return data || [];
}

// Wrapper automatique
const safeFetchInterventions = ErrorHandler.wrap(
  fetchInterventions,
  {
    context: 'interventionsApi',
    operation: 'fetchInterventions',
    fallback: []
  }
);

// Utilisation
const interventions = await safeFetchInterventions(); // Gère automatiquement les erreurs

// ===== EXEMPLE AVEC SÉVÉRITÉ =====

// Erreur critique (ex: paiement)
async function processPayment(amount: number) {
  try {
    // Logique de paiement
    return await paymentService.process(amount);
  } catch (error) {
    return ErrorHandler.handle(error, {
      context: 'paymentService',
      operation: 'processPayment',
      severity: 'critical', // ✅ Log + monitoring
      propagate: true,
      metadata: { amount }
    });
  }
}

// Erreur mineure (ex: cache)
async function getCache(key: string) {
  try {
    return await cache.get(key);
  } catch (error) {
    return ErrorHandler.handle(error, {
      context: 'cache',
      operation: 'getCache',
      severity: 'low', // ✅ Log info uniquement
      fallback: null,
      metadata: { key }
    });
  }
}

