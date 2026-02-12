// ===== AI CONTEXTUAL ACTION - EDGE FUNCTION =====
// Point d'entree unique pour toutes les actions IA contextuelles.
// Optimise pour la vitesse : Haiku pour les actions rapides, Sonnet pour l'analytique.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

// Types
type AIActionType = 'summary' | 'next_steps' | 'email_artisan' | 'email_client' | 'find_artisan' | 'suggestions' | 'stats_insights' | 'data_summary';

interface AIContextualActionRequest {
  action: AIActionType;
  context: {
    page: string;
    entityId: string | null;
    entityType: 'intervention' | 'artisan' | null;
    pathname: string;
    activeViewId?: string;
    activeViewTitle?: string;
    activeViewLayout?: string;
    appliedFilters?: Array<{ property: string; operator: string; value: unknown }>;
    filterSummary?: string;
  };
  entity_data?: Record<string, unknown> | null;
  history_context?: HistoryContext | null;
  summary_data?: AIDataSummaryPayload | null;
  user_instruction?: string | null;
  extra_params?: Record<string, unknown>;
}

interface AIDataSummaryPayload {
  period: { label: string; startDate: string; endDate: string };
  interventions: { total: number; byStatus: Record<string, number>; created: number; completed: number };
  financial: { totalRevenue: number; totalCosts: number; totalMargin: number; averageMarginPercent: number };
  alerts: string[];
}

interface HistoryContext {
  totalActions: number;
  statusChanges: Array<{ from: string; to: string; actor: string; date: string }>;
  artisanChanges: Array<{ type: string; actor: string; date: string }>;
  costChanges: Array<{ type: string; oldAmount?: number; newAmount?: number; date: string }>;
  recentComments: Array<{ content: string; actor: string; date: string }>;
  metrics: {
    daysInCurrentStatus: number;
    daysSinceCreation: number;
    daysSinceLastAction: number;
    totalStatusChanges: number;
    totalCostChanges: number;
  };
  alerts: string[];
}

// ===== SPEED OPTIMIZATION: Model + token limits per action =====
// Haiku 4.5 is 3-5x faster than Sonnet for structured tasks
const FAST_MODEL = 'claude-haiku-4-5-20251001';
const ANALYSIS_MODEL = 'claude-sonnet-4-5-20250929';

function getModelConfig(action: AIActionType): { model: string; maxTokens: number } {
  switch (action) {
    case 'summary':       return { model: FAST_MODEL, maxTokens: 350 };
    case 'next_steps':    return { model: FAST_MODEL, maxTokens: 300 };
    case 'email_artisan': return { model: FAST_MODEL, maxTokens: 450 };
    case 'email_client':  return { model: FAST_MODEL, maxTokens: 450 };
    case 'find_artisan':  return { model: FAST_MODEL, maxTokens: 300 };
    case 'suggestions':   return { model: ANALYSIS_MODEL, maxTokens: 600 };
    case 'stats_insights':return { model: ANALYSIS_MODEL, maxTokens: 600 };
    case 'data_summary':  return { model: ANALYSIS_MODEL, maxTokens: 800 };
  }
}

// ===== COMPACT SYSTEM PROMPTS =====
const FAST_SYSTEM = `Assistant CRM interventions batiment. Francais, concis, puces. Pas de donnees personnelles. Focus: statut, metier, couts, delais, zone.`;

const ANALYSIS_SYSTEM = `Tu es un assistant IA integre dans un CRM de gestion d'interventions batiment (GMBS-CRM).
Tu aides les gestionnaires a prendre des decisions rapidement.
Reponds toujours en francais, de maniere concise et actionnable.
Utilise des puces pour structurer tes reponses.
Ne mentionne jamais de donnees personnelles (noms, emails, telephones).
Concentre-toi sur les faits metier : statut, metier, couts, delais, zone.`;

function getSystemPrompt(action: AIActionType, ctx: AIContextualActionRequest['context']): string {
  const isFast = ['summary', 'next_steps', 'email_artisan', 'email_client', 'find_artisan'].includes(action);
  const base = isFast ? FAST_SYSTEM : ANALYSIS_SYSTEM;

  // Only add view context for analysis actions (fast actions don't need it)
  if (isFast) return base;

  const lines: string[] = [];
  if (ctx.activeViewTitle) lines.push(`Vue active : ${ctx.activeViewTitle}`);
  if (ctx.filterSummary && ctx.filterSummary !== 'Aucun filtre') lines.push(`Filtres : ${ctx.filterSummary}`);
  if (lines.length === 0) return base;
  return `${base}\n\nContexte navigation :\n${lines.join('\n')}`;
}

// Validated action types
const VALID_ACTIONS: AIActionType[] = [
  'summary', 'next_steps', 'email_artisan', 'email_client',
  'find_artisan', 'suggestions', 'stats_insights', 'data_summary'
];

// ===== COMPACT INTERVENTION CONTEXT (for fast prompts) =====
function compactIntervention(d: Record<string, unknown>): string {
  const lines: string[] = [];
  if (d.id_inter) lines.push(`${d.id_inter}`);

  const meta = [
    d.statut_label ?? d.statut_code,
    d.metier_label,
    (d.code_postal || d.ville) ? `${d.code_postal ?? ''} ${d.ville ?? ''}`.trim() : null,
  ].filter(Boolean);
  if (meta.length) lines.push(meta.join(' | '));

  const dates = [
    d.date ? `cree ${d.date}` : null,
    d.date_prevue ? `prevu ${d.date_prevue}` : null,
    d.artisan_pseudo ? `artisan: ${d.artisan_pseudo}` : 'PAS D\'ARTISAN',
  ].filter(Boolean);
  if (dates.length) lines.push(dates.join(' | '));

  const costs = [
    d.cout_intervention != null ? `cout: ${d.cout_intervention}€` : null,
    d.marge != null ? `marge: ${d.marge}€` : null,
  ].filter(Boolean);
  if (costs.length) lines.push(costs.join(' | '));

  if (d.contexte) lines.push(`${d.contexte}`);
  if (d.consigne) lines.push(`Consigne: ${d.consigne}`);
  if (d.commentaire_agent) lines.push(`Note: ${d.commentaire_agent}`);

  return lines.join('\n');
}

// ===== COMPACT HISTORY (max 5 lines for fast prompts) =====
function compactHistory(hc: HistoryContext | null | undefined): string {
  if (!hc) return '';
  const lines: string[] = [`\nHistorique: ${hc.metrics.daysInCurrentStatus}j dans statut actuel, ${hc.metrics.daysSinceLastAction}j depuis derniere action`];
  if (hc.alerts.length > 0) lines.push(`Alertes: ${hc.alerts.join(', ')}`);
  if (hc.statusChanges.length > 0) {
    lines.push(`Statuts: ${hc.statusChanges.slice(0, 3).map(s => `${s.from}->${s.to}`).join(', ')}`);
  }
  return lines.join('\n');
}

// ===== FULL HISTORY (for analysis prompts) =====
function formatHistorySection(hc: HistoryContext | null | undefined): string {
  if (!hc) return '';
  const lines: string[] = [];
  lines.push(`\n## Historique`);
  lines.push(`- ${hc.totalActions} actions | ${hc.metrics.daysInCurrentStatus}j statut actuel | ${hc.metrics.daysSinceLastAction}j inactif | ${hc.metrics.daysSinceCreation}j depuis creation`);
  if (hc.statusChanges.length > 0) {
    lines.push(`Statuts: ${hc.statusChanges.slice(0, 5).map(s => `${s.date}: ${s.from}->${s.to}`).join(' | ')}`);
  }
  if (hc.costChanges.length > 0) {
    lines.push(`Couts: ${hc.costChanges.slice(0, 3).map(c => `${c.type}${c.newAmount != null ? ` ${c.newAmount}€` : ''}`).join(' | ')}`);
  }
  if (hc.recentComments.length > 0) {
    lines.push(`Commentaires: ${hc.recentComments.slice(0, 2).map(c => `"${c.content}"`).join(' | ')}`);
  }
  if (hc.alerts.length > 0) {
    lines.push(`**Alertes: ${hc.alerts.join(' | ')}**`);
  }
  return lines.join('\n');
}

// ===== FAST PROMPTS (compact, directive) =====
function buildFastPrompt(action: AIActionType, data: Record<string, unknown>, hc: HistoryContext | null | undefined): string {
  const ctx = compactIntervention(data);
  const hist = compactHistory(hc);

  switch (action) {
    case 'summary': {
      if (data.id_inter !== undefined) {
        return `${ctx}${hist}\n\n→ Resume 3 puces + 3 prochaines etapes. Max 150 mots.`;
      }
      // Artisan
      return `Artisan ${data.pseudo ?? '?'} | Metiers: ${data.metiers ?? '?'} | Zone: ${data.zone_code_postal ?? ''} ${data.zone_ville ?? ''} | Statut: ${data.statut ?? '?'} | ${data.nombre_interventions_actives ?? '?'} interventions actives\n\n→ Resume 3 puces: specialite, charge, attention. Max 80 mots.`;
    }

    case 'next_steps':
      return `${ctx}${hist}\n\n→ 3-5 actions concretes. Pour chaque: action + delai. Max 100 mots.`;

    case 'email_artisan':
      return `${ctx}${hist}\n\n→ Email pro pour artisan. Placeholder [NOM_ARTISAN]. Format: Objet + Corps. Cordial, concis.`;

    case 'email_client':
      return `${ctx}${hist}\n\n→ Email pro pour client. Placeholder [NOM_CLIENT]. Format: Objet + Corps. Rassurant, concis.`;

    case 'find_artisan':
      return `${ctx}\n\n→ Profil artisan ideal: metier, competences, zone. + 3 criteres de selection.`;

    default:
      return `${ctx}${hist}\n\n→ Aide contextuelle.`;
  }
}

// ===== ANALYSIS PROMPTS =====
function buildSuggestionsWithDataPrompt(
  action: 'suggestions' | 'stats_insights',
  sd: AIDataSummaryPayload,
  ctx: AIContextualActionRequest['context'],
  entityData?: Record<string, unknown> | null,
  userInstruction?: string | null,
): string {
  const statusEntries = Object.entries(sd.interventions.byStatus).map(([k, v]) => `${k}: ${v}`).join(', ');
  const alerts = sd.alerts.length > 0 ? `\nAlertes: ${sd.alerts.join(' | ')}` : '';

  let prompt = `Donnees REELLES (dernier mois):
- Total: ${sd.interventions.total} interventions | Creees: ${sd.interventions.created} | Cloturees: ${sd.interventions.completed}
- Par statut: ${statusEntries || 'Aucune'}
- CA: ${sd.financial.totalRevenue}€ | Couts: ${sd.financial.totalCosts}€ | Marge: ${sd.financial.totalMargin}€ (${sd.financial.averageMarginPercent}%)${alerts}`;

  if (ctx.activeViewTitle) prompt += `\nVue: ${ctx.activeViewTitle}`;
  if (ctx.filterSummary && ctx.filterSummary !== 'Aucun filtre') prompt += `\nFiltres: ${ctx.filterSummary}`;

  if (entityData && entityData.id_inter !== undefined) {
    prompt += `\nIntervention ouverte: ${compactIntervention(entityData)}`;
  }

  if (action === 'suggestions') {
    prompt += `\n\n→ 3-5 actions METIER concretes basees sur ces chiffres. Cite les vrais nombres. JAMAIS de suggestions d'interface/UI.
Pour chaque: action precise (avec chiffres) + urgence + impact.`;
  } else {
    prompt += `\n\n→ 3-5 insights analytiques FACTUELS. Cite les chiffres exacts. Tendances, anomalies, risques.`;
  }

  if (userInstruction) {
    prompt += `\n\nFOCUS: "${userInstruction}"`;
  }
  return prompt;
}

function buildDataSummaryPrompt(sd: AIDataSummaryPayload): string {
  const statusEntries = Object.entries(sd.interventions.byStatus).map(([k, v]) => `${k}: ${v}`).join(', ');
  const alerts = sd.alerts.length > 0 ? `\nAlertes: ${sd.alerts.map((a: string) => `- ${a}`).join('\n')}` : '';

  return `Donnees REELLES periode ${sd.period.label}:
- ${sd.interventions.total} interventions | Creees: ${sd.interventions.created} | Cloturees: ${sd.interventions.completed}
- Par statut: ${statusEntries || 'Aucune'}
- CA: ${sd.financial.totalRevenue}€ | Couts: ${sd.financial.totalCosts}€ | Marge: ${sd.financial.totalMargin}€ (${sd.financial.averageMarginPercent}%)${alerts}

→ Resume analytique: points forts, points d'attention, 3 actions recommandees.`;
}

// ===== FALLBACK for analysis actions without data =====
function buildAnalysisFallbackPrompt(action: AIActionType, data: Record<string, unknown>, pageType: string, hc: HistoryContext | null | undefined): string {
  const historySection = formatHistorySection(hc);

  if (action === 'suggestions') {
    const parts: string[] = [`Page: ${pageType}`];
    if (data.id_inter !== undefined) {
      parts.push(`\n${compactIntervention(data)}`);
    } else if (data.pseudo !== undefined) {
      parts.push(`\nArtisan ${data.pseudo} | Metiers: ${data.metiers ?? '?'} | Statut: ${data.statut ?? '?'}`);
    }
    parts.push(`\n→ 3-5 actions concretes METIER. Sois specifique aux donnees.`);
    return parts.join('\n') + historySection;
  }

  if (action === 'stats_insights') {
    return `Page: ${pageType}\n→ 3-5 insights actionables pour cette vue.` + historySection;
  }

  return 'Aide contextuelle.' + historySection;
}

// ===== MAIN SERVER =====
serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json() as AIContextualActionRequest;
    const { action, context, entity_data, history_context, summary_data, user_instruction } = body;

    if (!action || !VALID_ACTIONS.includes(action)) {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid action: ${action}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI service not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check cache (summary + next_steps + email_artisan + email_client + find_artisan)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const cacheable = ['summary', 'next_steps', 'email_artisan', 'email_client', 'find_artisan'].includes(action);
    if (cacheable && context.entityId && context.entityType === 'intervention') {
      const { data: cached } = await supabase
        .from('intervention_ai_cache')
        .select('cached_value, computed_at, confidence')
        .eq('intervention_id', context.entityId)
        .eq('cache_type', action)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (cached) {
        console.log(JSON.stringify({ level: 'info', requestId, action, message: 'Cache hit', duration: Date.now() - startTime }));
        return new Response(
          JSON.stringify({ success: true, action, result: cached.cached_value, cached: true, computed_at: cached.computed_at, confidence: cached.confidence }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Build prompt based on action category
    const { model, maxTokens } = getModelConfig(action);
    const isFastAction = ['summary', 'next_steps', 'email_artisan', 'email_client', 'find_artisan'].includes(action);

    let userPrompt: string;
    if (action === 'data_summary' && summary_data) {
      userPrompt = buildDataSummaryPrompt(summary_data);
    } else if ((action === 'suggestions' || action === 'stats_insights') && summary_data) {
      userPrompt = buildSuggestionsWithDataPrompt(action, summary_data, context, entity_data, user_instruction);
    } else if (isFastAction) {
      userPrompt = buildFastPrompt(action, entity_data ?? {}, history_context);
    } else {
      userPrompt = buildAnalysisFallbackPrompt(action, entity_data ?? {}, context.page, history_context);
      if (user_instruction) {
        userPrompt += `\n\nFOCUS: "${user_instruction}"`;
      }
    }

    // Call Claude API with optimized params
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: 0,
        system: getSystemPrompt(action, context),
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error(JSON.stringify({ level: 'error', requestId, action, status: claudeResponse.status, error: errorText }));
      return new Response(
        JSON.stringify({ success: false, error: 'AI service error' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const claudeData = await claudeResponse.json();
    const content = claudeData.content?.[0]?.text ?? '';

    const result = {
      content,
      sections: parseResultSections(content),
      suggested_actions: [],
    };
    const computed_at = new Date().toISOString();

    // Cache write (fire-and-forget, don't block response)
    if (cacheable && context.entityId && context.entityType === 'intervention') {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      supabase
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
          if (error) console.warn(JSON.stringify({ level: 'warn', requestId, message: 'Cache write failed', error: error.message }));
        });
    }

    const inputTokens = claudeData.usage?.input_tokens ?? 0;
    const outputTokens = claudeData.usage?.output_tokens ?? 0;
    console.log(JSON.stringify({
      level: 'info', requestId, action, model,
      inputTokens, outputTokens,
      duration: Date.now() - startTime,
      message: 'AI action completed'
    }));

    return new Response(
      JSON.stringify({ success: true, action, result, cached: false, computed_at, confidence: 0.85 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(JSON.stringify({
      level: 'error', requestId,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
    }));
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function parseResultSections(content: string): Array<{ title: string; content: string; type: string }> {
  const sections: Array<{ title: string; content: string; type: string }> = [];
  const lines = content.split('\n');
  let currentTitle = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    const headerMatch = line.match(/^##\s+(.+)/);
    if (headerMatch) {
      if (currentTitle || currentContent.length > 0) {
        sections.push({
          title: currentTitle || 'Resultat',
          content: currentContent.join('\n').trim(),
          type: currentTitle.toLowerCase().includes('attention') || currentTitle.toLowerCase().includes('alerte') ? 'warning' : 'text',
        });
      }
      currentTitle = headerMatch[1];
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  if (currentTitle || currentContent.length > 0) {
    sections.push({
      title: currentTitle || 'Resultat',
      content: currentContent.join('\n').trim(),
      type: 'text',
    });
  }

  return sections;
}
