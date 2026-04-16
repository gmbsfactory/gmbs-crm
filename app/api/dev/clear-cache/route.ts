import { invalidateReferenceCache } from '@/lib/api';
import { NextResponse } from 'next/server';

/**
 * Route API pour invalider le cache des données de référence
 * Usage: GET /api/dev/clear-cache
 */
export async function GET() {
  try {
    invalidateReferenceCache();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Cache invalidé avec succès' 
    });
  } catch (error) {
    console.error('Erreur lors de l\'invalidation du cache:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de l\'invalidation du cache' },
      { status: 500 }
    );
  }
}

