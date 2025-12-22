import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { requirePermission, isPermissionError } from "@/lib/api/permissions"

const execAsync = promisify(exec);

type Params = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * API Route pour recalculer le statut d'un seul artisan
 * 
 * POST /api/artisans/[id]/recalculate-status
 * 
 * Appelle le script recalculate-single-artisan-status.js en arrière-plan
 */
export async function POST(
  request: NextRequest,
  { params }: Params
) {
  const permCheck = await requirePermission(request, "manage_settings")
  if (isPermissionError(permCheck)) return permCheck.error

  const { id: artisanId } = await params;

  if (!artisanId) {
    return NextResponse.json(
      { error: 'Artisan ID is required' },
      { status: 400 }
    );
  }

  try {
    // Exécuter le script en arrière-plan
    const scriptPath = path.join(process.cwd(), 'scripts', 'recalculate-single-artisan-status.js');
    
    // Exécuter le script de manière asynchrone (ne pas attendre la fin)
    execAsync(`node ${scriptPath} ${artisanId}`)
      .then(() => {
        console.log(`✅ Statut recalculé pour artisan ${artisanId}`);
      })
      .catch((error) => {
        console.error(`❌ Erreur lors du recalcul pour artisan ${artisanId}:`, error);
      });

    // Retourner immédiatement (traitement en arrière-plan)
    return NextResponse.json({
      success: true,
      message: `Recalcul du statut de l'artisan ${artisanId} lancé en arrière-plan`
    });
  } catch (error) {
    console.error('Erreur lors du lancement du script:', error);
    return NextResponse.json(
      { error: 'Failed to start recalculation script' },
      { status: 500 }
    );
  }
}
