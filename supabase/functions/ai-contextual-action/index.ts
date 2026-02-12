// ===== AI CONTEXTUAL ACTION - EDGE FUNCTION =====
// Point d'entree unique pour toutes les actions IA contextuelles.
// Recoit une action + contexte + donnees anonymisees, appelle Claude, retourne le resultat.
//
// POST /ai-contextual-action
// Body: { action, context, entity_data, extra_params }
// Response: { success, action, result, cached, computed_at, confidence }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

// Types (mirrored from src/lib/ai/types.ts for Deno)
type AIActionType = 'summary' | 'next_steps' | 'email_artisan' | 'email_client' | 'find_artisan' | 'suggestions' | 'stats_insights';

interface AIContextualActionRequest {
  action: AIActionType;
  context: {
    page: string;
    entityId: string | null;
    entityType: 'intervention' | 'artisan' | null;
    pathname: string;
  };
  entity_data?: Record<string, unknown> | null;
  extra_params?: Record<string, unknown>;
}

// System prompt
const SYSTEM_PROMPT = `Tu es un assistant IA integre dans un CRM de gestion d'interventions batiment (GMBS-CRM).
Tu aides les gestionnaires a prendre des decisions rapidement.
Reponds toujours en francais, de maniere concise et actionnable.
Utilise des puces pour structurer tes reponses.
Ne mentionne jamais de donnees personnelles (noms, emails, telephones).
Concentre-toi sur les faits metier : statut, metier, couts, delais, zone.`;

// Validated action types
const VALID_ACTIONS: AIActionType[] = [
  'summary', 'next_steps', 'email_artisan', 'email_client',
  'find_artisan', 'suggestions', 'stats_insights'
];

/**
 * Build a user prompt based on action type and entity data
 */
function buildUserPrompt(action: AIActionType, entityData?: Record<string, unknown> | null, pageType?: string): string {
  const data = entityData ?? {};

  switch (action) {
    case 'summary': {
      if (data.id_inter !== undefined) {
        return `Resume cette intervention en 3 points cles, puis liste les prochaines etapes recommandees.

Donnees intervention :
- ID : ${data.id_inter ?? 'N/A'}
- Statut : ${data.statut_label ?? data.statut_code ?? 'Inconnu'}
- Metier : ${data.metier_label ?? 'Non defini'}
- Zone : ${data.code_postal ?? ''} ${data.ville ?? ''}
- Date : ${data.date ?? 'Non definie'}
- Date prevue : ${data.date_prevue ?? 'Non definie'}
- Contexte : ${data.contexte ?? 'Aucun contexte'}
- Consigne : ${data.consigne ?? 'Aucune consigne'}
- Commentaire agent : ${data.commentaire_agent ?? 'Aucun'}
- Cout : ${data.cout_intervention != null ? `${data.cout_intervention} EUR` : 'Non defini'}
- Marge : ${data.marge != null ? `${data.marge} EUR` : 'Non calculee'}
- Artisan : ${data.artisan_pseudo ?? 'Non assigne'}

Format :
## Resume
- Point 1
- Point 2
- Point 3

## Prochaines etapes
1. Action 1
2. Action 2
3. Action 3`;
      }
      // Artisan summary
      return `Resume le profil de cet artisan en 3 points.

Donnees :
- Metiers : ${data.metiers ?? 'Non definis'}
- Zone : ${data.zone_code_postal ?? ''} ${data.zone_ville ?? ''}
- Statut : ${data.statut ?? 'Inconnu'}
- Interventions actives : ${data.nombre_interventions_actives ?? 'Inconnu'}

Points : specialite, charge actuelle, points d'attention.`;
    }

    case 'next_steps':
      return `Propose 3-5 prochaines actions concretes pour cette intervention.

- Statut : ${data.statut_label ?? data.statut_code ?? 'Inconnu'}
- Metier : ${data.metier_label ?? 'Non defini'}
- Contexte : ${data.contexte ?? 'Aucun'}
- Date prevue : ${data.date_prevue ?? 'Non definie'}
- Artisan : ${data.artisan_pseudo ?? 'Non assigne'}

Pour chaque etape : action, raison, delai recommande.`;

    case 'email_artisan':
      return `Genere un email professionnel pour l'artisan.

- ID intervention : ${data.id_inter ?? 'N/A'}
- Metier : ${data.metier_label ?? 'Non defini'}
- Zone : ${data.code_postal ?? ''} ${data.ville ?? ''}
- Contexte : ${data.contexte ?? 'Aucun'}
- Consigne : ${data.consigne ?? 'Aucune'}
- Date prevue : ${data.date_prevue ?? 'Non definie'}

Utilise [NOM_ARTISAN] comme placeholder. Format : Objet + Corps.`;

    case 'email_client':
      return `Genere un email professionnel pour le client.

- ID intervention : ${data.id_inter ?? 'N/A'}
- Statut : ${data.statut_label ?? data.statut_code ?? 'Inconnu'}
- Contexte : ${data.contexte ?? 'Aucun'}
- Date prevue : ${data.date_prevue ?? 'Non definie'}

Utilise [NOM_CLIENT] comme placeholder. Format : Objet + Corps.`;

    case 'find_artisan':
      return `Decris le profil artisan ideal pour cette intervention.

- Metier : ${data.metier_label ?? 'Non defini'}
- Zone : ${data.code_postal ?? ''} ${data.ville ?? ''}
- Contexte : ${data.contexte ?? 'Aucun'}
- Consigne : ${data.consigne ?? 'Aucune'}

Reponds : profil recherche + criteres de selection.`;

    case 'suggestions':
      return `Propose 3 actions utiles pour la page "${pageType ?? 'inconnue'}".
Contexte : CRM gestion interventions batiment.`;

    case 'stats_insights':
      return `Propose 3 insights ou alertes pour un dashboard de gestion d'interventions batiment.
Tendances, anomalies, actions proactives.`;

    default:
      return 'Aide-moi avec le contexte actuel.';
  }
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  console.log(JSON.stringify({
    level: 'info',
    requestId,
    method: req.method,
    timestamp: new Date().toISOString(),
    message: 'AI contextual action request started'
  }));

  try {
    // Only POST allowed
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json() as AIContextualActionRequest;
    const { action, context, entity_data, extra_params } = body;

    // Validate action
    if (!action || !VALID_ACTIONS.includes(action)) {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid action: ${action}. Valid: ${VALID_ACTIONS.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get API key
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      console.error('ANTHROPIC_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check cache (for summary and next_steps only)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const cacheable = ['summary', 'next_steps'].includes(action);
    if (cacheable && context.entityId && context.entityType === 'intervention') {
      const { data: cached } = await supabase
        .from('intervention_ai_cache')
        .select('cached_value, computed_at, confidence')
        .eq('intervention_id', context.entityId)
        .eq('cache_type', action)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (cached) {
        console.log(JSON.stringify({
          level: 'info',
          requestId,
          action,
          entityId: context.entityId,
          message: 'Cache hit',
          duration: Date.now() - startTime
        }));

        return new Response(
          JSON.stringify({
            success: true,
            action,
            result: cached.cached_value,
            cached: true,
            computed_at: cached.computed_at,
            confidence: cached.confidence,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Build prompt
    const userPrompt = buildUserPrompt(action, entity_data, context.page);

    // Call Claude API
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error(JSON.stringify({
        level: 'error',
        requestId,
        action,
        status: claudeResponse.status,
        error: errorText,
        message: 'Claude API error'
      }));

      return new Response(
        JSON.stringify({ success: false, error: 'AI service error' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const claudeData = await claudeResponse.json();
    const content = claudeData.content?.[0]?.text ?? '';

    // Build result
    const result = {
      content,
      sections: parseResultSections(content),
      suggested_actions: [],
    };

    const computed_at = new Date().toISOString();

    // Cache result if applicable
    if (cacheable && context.entityId && context.entityType === 'intervention') {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min TTL
      await supabase
        .from('intervention_ai_cache')
        .upsert({
          intervention_id: context.entityId,
          cache_type: action,
          cached_value: result,
          confidence: 0.85,
          computed_at,
          expires_at: expiresAt,
        }, { onConflict: 'intervention_id,cache_type' })
        .then(({ error }) => {
          if (error) {
            console.warn(JSON.stringify({
              level: 'warn',
              requestId,
              message: 'Cache write failed',
              error: error.message
            }));
          }
        });
    }

    // Log usage
    const inputTokens = claudeData.usage?.input_tokens ?? 0;
    const outputTokens = claudeData.usage?.output_tokens ?? 0;
    console.log(JSON.stringify({
      level: 'info',
      requestId,
      action,
      entityId: context.entityId,
      inputTokens,
      outputTokens,
      duration: Date.now() - startTime,
      message: 'AI action completed'
    }));

    return new Response(
      JSON.stringify({
        success: true,
        action,
        result,
        cached: false,
        computed_at,
        confidence: 0.85,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      requestId,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
      message: 'AI contextual action failed'
    }));

    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Parse markdown content into structured sections
 */
function parseResultSections(content: string): Array<{ title: string; content: string; type: string }> {
  const sections: Array<{ title: string; content: string; type: string }> = [];
  const lines = content.split('\n');
  let currentTitle = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    const headerMatch = line.match(/^##\s+(.+)/);
    if (headerMatch) {
      // Save previous section
      if (currentTitle || currentContent.length > 0) {
        sections.push({
          title: currentTitle || 'Resultat',
          content: currentContent.join('\n').trim(),
          type: currentTitle.toLowerCase().includes('attention') || currentTitle.toLowerCase().includes('alerte')
            ? 'warning'
            : 'text',
        });
      }
      currentTitle = headerMatch[1];
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  // Save last section
  if (currentTitle || currentContent.length > 0) {
    sections.push({
      title: currentTitle || 'Resultat',
      content: currentContent.join('\n').trim(),
      type: 'text',
    });
  }

  return sections;
}
