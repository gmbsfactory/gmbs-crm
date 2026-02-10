// ===== PROCESS AVATAR - Traitement d'images pour photos de profil =====
// Edge Function pour normaliser et générer des dérivés d'images
// 
// FEATURES:
// - Normalisation (rotation EXIF, sRGB, strip metadata)
// - Génération dérivés : 40px, 80px, 160px (carrés)
// - Formats : WebP (priorité) + JPEG fallback
// - Calcul hash contenu (SHA-256)
// - Upload vers avatars/{artisan_id}/avatar_{hash}_{size}.webp

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import sharp from 'https://esm.sh/sharp-wasm@0.31.0';
import { getCorsHeaders } from '../_shared/cors.ts';

interface ProcessAvatarRequest {
  artisan_id: string;
  attachment_id: string;
  image_url: string;
  mime_type: string;
}

// Tailles de dérivés à générer (carrés)
const AVATAR_SIZES = [40, 80, 160] as const;
type AvatarSize = typeof AVATAR_SIZES[number];

// Fonction pour calculer le hash SHA-256 d'un buffer
async function calculateHash(buffer: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Fonction pour télécharger une image depuis une URL
async function downloadImage(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

// Fonction pour traiter une image : normalisation, redimensionnement, conversion de format
// Utilise Sharp WASM pour le traitement d'images dans Deno Edge Functions
// Variable globale pour initialiser Sharp WASM une seule fois
let sharpInitialized = false;

async function processImage(
  imageBuffer: Uint8Array,
  size: AvatarSize,
  format: 'webp' | 'jpeg' = 'webp'
): Promise<Uint8Array> {
  try {
    // Initialiser Sharp WASM une seule fois (idempotent)
    if (!sharpInitialized) {
      await sharp();
      sharpInitialized = true;
      console.log('[process-avatar] Sharp WASM initialized');
    }
    
    // Traiter l'image avec Sharp WASM
    const processedBuffer = await sharp(imageBuffer)
      // Rotation automatique basée sur les données EXIF
      .rotate()
      // Redimensionner en carré avec crop center
      .resize(size, size, {
        fit: 'cover', // Crop pour remplir le carré
        position: 'center' // Centrer le crop
      })
      // Convertir en sRGB et supprimer les métadonnées EXIF/IPTC
      .toColorspace('srgb')
      .removeAlpha() // Supprimer le canal alpha si présent
      // Convertir au format demandé avec qualité optimisée
      .toFormat(format === 'webp' ? 'webp' : 'jpeg', {
        quality: format === 'webp' ? 85 : 90,
        mozjpeg: format === 'jpeg', // Optimisation JPEG avec mozjpeg
        effort: format === 'webp' ? 4 : undefined // Effort WebP (0-6, 4 = bon compromis)
      })
      // Supprimer toutes les métadonnées restantes
      .withMetadata({}) // Objet vide = supprime toutes les métadonnées
      .toBuffer();
    
    console.log(`[process-avatar] Image processed successfully: ${size}px ${format} (${processedBuffer.length} bytes)`);
    return new Uint8Array(processedBuffer);
    
  } catch (error) {
    console.error(`[process-avatar] Error processing image (size: ${size}px, format: ${format}):`, error);
    // En cas d'erreur, retourner l'original plutôt que de faire échouer tout le pipeline
    // Cela permet au moins d'avoir une URL de base fonctionnelle
    console.warn(`[process-avatar] Falling back to original image due to processing error`);
    return imageBuffer;
  }
}

// Fonction pour obtenir le format MIME préféré selon le support navigateur
function getPreferredMimeType(originalMime: string): 'image/webp' | 'image/jpeg' {
  // WebP est préféré pour la compression, JPEG comme fallback
  if (originalMime === 'image/webp' || originalMime === 'image/png' || originalMime === 'image/jpeg') {
    return 'image/webp';
  }
  return 'image/jpeg';
}

serve(async (req: Request) => {
  const corsHeaders = {
    ...getCorsHeaders(req),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle CORS preflight requests FIRST, before any other code
  // This MUST be the very first statement to ensure OPTIONS always returns 200
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: corsHeaders
    });
  }

  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  console.log(JSON.stringify({
    level: 'info',
    requestId,
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString(),
    message: 'Process Avatar request started'
  }));

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body: ProcessAvatarRequest = await req.json();

    // Validation
    if (!body.artisan_id || !body.attachment_id || !body.image_url) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: artisan_id, attachment_id, image_url' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(JSON.stringify({
      level: 'info',
      requestId,
      artisan_id: body.artisan_id,
      attachment_id: body.attachment_id,
      message: 'Processing avatar'
    }));

    // Télécharger l'image originale
    const originalImageBuffer = await downloadImage(body.image_url);
    
    // Calculer le hash du contenu original
    const contentHash = await calculateHash(originalImageBuffer);
    
    // Déterminer le format préféré
    const mimePreferred = getPreferredMimeType(body.mime_type);
    const format = mimePreferred === 'image/webp' ? 'webp' : 'jpeg';

    // Générer les dérivés pour chaque taille
    const derivedSizes: Record<string, string> = {};
    const uploadPromises: Promise<void>[] = [];

    for (const size of AVATAR_SIZES) {
      // Traiter l'image pour cette taille
      const processedBuffer = await processImage(originalImageBuffer, size, format);
      
      // Générer le nom de fichier avec hash
      const filename = `avatar_${contentHash}_${size}.${format}`;
      const storagePath = `avatars/${body.artisan_id}/${filename}`;
      
      // Upload vers Supabase Storage
      const uploadPromise = supabase.storage
        .from('documents')
        .upload(storagePath, processedBuffer, {
          contentType: mimePreferred,
          cacheControl: 'public, max-age=31536000, immutable',
          upsert: true // Permettre le remplacement si le hash existe déjà
        })
        .then(({ data, error }) => {
          if (error) {
            console.error(`Error uploading ${size}px:`, error);
            throw error;
          }
          
          // Obtenir l'URL publique
          const { data: { publicUrl } } = supabase.storage
            .from('documents')
            .getPublicUrl(storagePath);
          
          // Remplacer l'URL interne Docker
          const publicUrlFixed = publicUrl.replace(
            'http://kong:8000',
            Deno.env.get('SUPABASE_PUBLIC_URL') || 'http://127.0.0.1:54321'
          );
          
          derivedSizes[size.toString()] = publicUrlFixed;
          
          console.log(JSON.stringify({
            level: 'info',
            requestId,
            size,
            url: publicUrlFixed,
            message: `Uploaded ${size}px avatar`
          }));
        });
      
      uploadPromises.push(uploadPromise);
    }

    // Attendre que tous les uploads soient terminés
    await Promise.all(uploadPromises);

    // Mettre à jour l'enregistrement dans artisan_attachments avec les métadonnées
    const { error: updateError } = await supabase
      .from('artisan_attachments')
      .update({
        content_hash: contentHash,
        derived_sizes: derivedSizes,
        mime_preferred: mimePreferred
      })
      .eq('id', body.attachment_id)
      .eq('artisan_id', body.artisan_id);

    if (updateError) {
      console.error('Error updating attachment metadata:', updateError);
      return new Response(
        JSON.stringify({ error: `Failed to update metadata: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const duration = Date.now() - startTime;
    console.log(JSON.stringify({
      level: 'info',
      requestId,
      duration,
      message: 'Avatar processing completed'
    }));

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          attachment_id: body.attachment_id,
          content_hash: contentHash,
          derived_sizes: derivedSizes,
          mime_preferred: mimePreferred
        }
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Process Avatar error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

