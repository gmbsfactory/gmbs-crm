// ===== PROMPTS IA =====
// Templates de prompts pour chaque action IA contextuelle.
// Les prompts sont construits avec les donnees anonymisees de l'entite.

import type { AIActionType, AIDataSummary, AIPageContext, AnonymizedIntervention, AnonymizedArtisan } from './types'
import type { InterventionHistoryContext } from './history-context-builder'

/**
 * System prompt de base commun a toutes les actions
 */
const BASE_SYSTEM_PROMPT = `Tu es un assistant IA integre dans un CRM de gestion d'interventions batiment (GMBS-CRM).
Tu aides les gestionnaires a prendre des decisions rapidement.
Reponds toujours en francais, de maniere concise et actionnable.
Utilise des puces pour structurer tes reponses.
Ne mentionne jamais de donnees personnelles (noms, emails, telephones).
Concentre-toi sur les faits metier : statut, metier, couts, delais, zone.`

/**
 * Construit le system prompt enrichi avec le contexte de vue active.
 * Si aucun contexte de vue n'est disponible, retourne le prompt de base.
 */
function buildSystemPrompt(context?: AIPageContext | null): string {
  if (!context?.activeViewTitle && !context?.filterSummary) {
    return BASE_SYSTEM_PROMPT
  }

  const viewLine = `Vue active : ${context.activeViewTitle ?? 'Non specifiee'}`
  const filterLine = `Filtres appliques : ${context.filterSummary ?? 'Aucun'}`
  const layoutLine = context.activeViewLayout
    ? `Disposition : ${context.activeViewLayout}`
    : null

  const contextLines = [viewLine, filterLine, layoutLine].filter(Boolean).join('\n')

  return `${BASE_SYSTEM_PROMPT}

Contexte de navigation de l'utilisateur :
${contextLines}`
}

/**
 * Construit le prompt pour un resume d'intervention
 */
function buildSummaryPrompt(intervention: AnonymizedIntervention): string {
  return `Resume cette intervention en 3 points cles, puis liste les prochaines etapes recommandees.

Donnees intervention :
- ID : ${intervention.id_inter ?? 'N/A'}
- Statut : ${intervention.statut_label ?? intervention.statut_code ?? 'Inconnu'}
- Metier : ${intervention.metier_label ?? 'Non defini'}
- Zone : ${intervention.code_postal ?? ''} ${intervention.ville ?? ''}
- Date : ${intervention.date ?? 'Non definie'}
- Date prevue : ${intervention.date_prevue ?? 'Non definie'}
- Contexte : ${intervention.contexte ?? 'Aucun contexte'}
- Consigne : ${intervention.consigne ?? 'Aucune consigne'}
- Commentaire agent : ${intervention.commentaire_agent ?? 'Aucun'}
- Cout intervention : ${intervention.cout_intervention != null ? `${intervention.cout_intervention} EUR` : 'Non defini'}
- Cout SST : ${intervention.cout_sst != null ? `${intervention.cout_sst} EUR` : 'Non defini'}
- Marge : ${intervention.marge != null ? `${intervention.marge} EUR` : 'Non calculee'}
- Artisan : ${intervention.artisan_pseudo ?? 'Non assigne'}
- Gestionnaire : ${intervention.gestionnaire_pseudo ?? 'Non assigne'}

Format de reponse attendu :
## Resume
- Point 1
- Point 2
- Point 3

## Prochaines etapes
1. Action 1
2. Action 2
3. Action 3`
}

/**
 * Construit le prompt pour les suggestions de prochaines etapes
 */
function buildNextStepsPrompt(intervention: AnonymizedIntervention): string {
  return `En fonction du statut actuel et du contexte de cette intervention, propose les 3-5 prochaines actions concretes a effectuer par le gestionnaire.

Donnees intervention :
- Statut actuel : ${intervention.statut_label ?? intervention.statut_code ?? 'Inconnu'}
- Metier : ${intervention.metier_label ?? 'Non defini'}
- Contexte : ${intervention.contexte ?? 'Aucun contexte'}
- Consigne : ${intervention.consigne ?? 'Aucune consigne'}
- Date prevue : ${intervention.date_prevue ?? 'Non definie'}
- Artisan assigne : ${intervention.artisan_pseudo ?? 'Non assigne'}
- Cout : ${intervention.cout_intervention != null ? `${intervention.cout_intervention} EUR` : 'Non defini'}

Reponds sous forme de liste numerotee avec pour chaque etape :
- L'action a faire
- La raison (pourquoi maintenant)
- Le delai recommande`
}

/**
 * Construit le prompt pour generer un brouillon d'email artisan
 */
function buildEmailArtisanPrompt(intervention: AnonymizedIntervention): string {
  return `Genere un brouillon d'email professionnel a envoyer a l'artisan pour cette intervention.

Donnees intervention :
- ID : ${intervention.id_inter ?? 'N/A'}
- Statut : ${intervention.statut_label ?? intervention.statut_code ?? 'Inconnu'}
- Metier : ${intervention.metier_label ?? 'Non defini'}
- Zone : ${intervention.code_postal ?? ''} ${intervention.ville ?? ''}
- Contexte : ${intervention.contexte ?? 'Aucun contexte'}
- Consigne artisan : ${intervention.consigne ?? 'Aucune consigne'}
- Date prevue : ${intervention.date_prevue ?? 'Non definie'}

L'email doit :
- Etre professionnel mais cordial
- Rappeler le contexte de l'intervention
- Inclure les consignes
- Demander confirmation de disponibilite si pas encore confirmee
- Utiliser [NOM_ARTISAN] comme placeholder pour le nom

Format :
Objet : ...
Corps : ...`
}

/**
 * Construit le prompt pour generer un brouillon d'email client
 */
function buildEmailClientPrompt(intervention: AnonymizedIntervention): string {
  return `Genere un brouillon d'email professionnel a envoyer au client/locataire pour cette intervention.

Donnees intervention :
- ID : ${intervention.id_inter ?? 'N/A'}
- Statut : ${intervention.statut_label ?? intervention.statut_code ?? 'Inconnu'}
- Metier : ${intervention.metier_label ?? 'Non defini'}
- Contexte : ${intervention.contexte ?? 'Aucun contexte'}
- Date prevue : ${intervention.date_prevue ?? 'Non definie'}

L'email doit :
- Etre professionnel et rassurant
- Informer du statut de l'intervention
- Mentionner la date prevue si connue
- Utiliser [NOM_CLIENT] comme placeholder pour le nom

Format :
Objet : ...
Corps : ...`
}

/**
 * Construit le prompt pour trouver un artisan adapte
 */
function buildFindArtisanPrompt(intervention: AnonymizedIntervention): string {
  return `En fonction du contexte de cette intervention, decris le profil d'artisan ideal a rechercher et les criteres de selection.

Donnees intervention :
- Metier requis : ${intervention.metier_label ?? 'Non defini'}
- Zone : ${intervention.code_postal ?? ''} ${intervention.ville ?? ''}
- Contexte : ${intervention.contexte ?? 'Aucun contexte'}
- Consigne : ${intervention.consigne ?? 'Aucune consigne'}
- Date prevue : ${intervention.date_prevue ?? 'Non definie'}
- Cout estime : ${intervention.cout_intervention != null ? `${intervention.cout_intervention} EUR` : 'Non defini'}

Reponds avec :
## Profil artisan recherche
- Metier(s) requis
- Competences specifiques
- Zone geographique ideale

## Criteres de selection
1. Critere 1 (priorite haute)
2. Critere 2
3. Critere 3`
}

/**
 * Construit le prompt pour un resume d'artisan
 */
function buildArtisanSummaryPrompt(artisan: AnonymizedArtisan): string {
  return `Resume le profil de cet artisan en quelques points cles.

Donnees artisan :
- Pseudo : ${artisan.pseudo}
- Metiers : ${artisan.metiers.length > 0 ? artisan.metiers.join(', ') : 'Non definis'}
- Zone : ${artisan.zone_code_postal ?? ''} ${artisan.zone_ville ?? ''}
- Statut : ${artisan.statut ?? 'Inconnu'}
- Interventions actives : ${artisan.nombre_interventions_actives ?? 'Inconnu'}
- SIRET : ${artisan.siret ?? 'Non renseigne'}

Resume en 3 points :
1. Specialite et zone
2. Charge actuelle
3. Points d'attention`
}

/**
 * Prompt pour suggestions contextuelles enrichi avec vue active et filtres
 */
function buildSuggestionsPrompt(pageType: string, context?: AIPageContext | null, entityData?: AnonymizedIntervention | AnonymizedArtisan | null): string {
  const parts: string[] = []

  parts.push(`En tant qu'assistant CRM expert en gestion d'interventions batiment, analyse le contexte actuel et propose 3 a 5 actions concretes et specifiques.`)

  // Contexte de page et vue
  parts.push(`\nPage actuelle : ${pageType}`)
  if (context?.activeViewTitle) {
    parts.push(`Vue/pastille active : ${context.activeViewTitle}`)
  }
  if (context?.filterSummary && context.filterSummary !== 'Aucun filtre') {
    parts.push(`Filtres appliques : ${context.filterSummary}`)
  }

  // Si on a des donnees d'entite (modal ouvert)
  if (entityData && 'id_inter' in entityData) {
    const inter = entityData as AnonymizedIntervention
    parts.push(`\nIntervention ouverte :`)
    parts.push(`- ID : ${inter.id_inter ?? 'N/A'}`)
    parts.push(`- Statut : ${inter.statut_label ?? inter.statut_code ?? 'Inconnu'}`)
    parts.push(`- Metier : ${inter.metier_label ?? 'Non defini'}`)
    parts.push(`- Artisan : ${inter.artisan_pseudo ?? 'Non assigne'}`)
    parts.push(`- Cout : ${inter.cout_intervention != null ? `${inter.cout_intervention} EUR` : 'Non defini'}`)
    parts.push(`- Marge : ${inter.marge != null ? `${inter.marge} EUR` : 'Non calculee'}`)
    parts.push(`- Date prevue : ${inter.date_prevue ?? 'Non definie'}`)
    parts.push(`- Contexte : ${inter.contexte ?? 'Aucun'}`)
  } else if (entityData && 'pseudo' in entityData) {
    const art = entityData as AnonymizedArtisan
    parts.push(`\nArtisan ouvert :`)
    parts.push(`- Pseudo : ${art.pseudo}`)
    parts.push(`- Metiers : ${art.metiers.join(', ') || 'Non definis'}`)
    parts.push(`- Zone : ${art.zone_code_postal ?? ''} ${art.zone_ville ?? ''}`)
    parts.push(`- Statut : ${art.statut ?? 'Inconnu'}`)
    parts.push(`- Interventions actives : ${art.nombre_interventions_actives ?? 'Inconnu'}`)
  }

  parts.push(`\nPour chaque suggestion :
1. Action precise a effectuer maintenant
2. Pourquoi c'est important (base sur les donnees ci-dessus)
3. Benefice attendu

Sois SPECIFIQUE : ne dis pas "verifier les interventions" mais "relancer l'artisan X car aucune activite depuis Y jours" si c'est pertinent.`)

  return parts.join('\n')
}

/**
 * Prompt pour insights stats enrichi avec contexte de vue et filtres
 */
function buildStatsInsightsPrompt(context?: AIPageContext | null): string {
  const parts: string[] = []

  parts.push(`En tant qu'analyste CRM expert, analyse le contexte de navigation actuel et propose 3 a 5 insights actionables.`)

  if (context?.activeViewTitle) {
    parts.push(`\nVue active : ${context.activeViewTitle}`)
  }
  if (context?.filterSummary && context.filterSummary !== 'Aucun filtre') {
    parts.push(`Filtres appliques : ${context.filterSummary}`)
  }
  parts.push(`Page : ${context?.page ?? 'inconnue'}`)

  parts.push(`\nConcentre-toi sur :
- Les tendances detectables depuis le contexte (vue filtree = focus utilisateur)
- Les anomalies potentielles (retards, marges faibles, interventions bloquees)
- Les actions proactives a prendre en priorite
- Les KPIs a surveiller dans cette vue specifique

Sois SPECIFIQUE au contexte de la vue active. Si l'utilisateur est sur "Ma liste en cours", parle des interventions en cours. Si sur "Mes demandes", parle des nouvelles demandes.

Format : liste a puces, concis et actionnable.`)

  return parts.join('\n')
}

/**
 * Construit le prompt pour un resume data-driven avec les vraies donnees de la periode
 */
export function buildDataSummaryPrompt(summaryData: AIDataSummary): string {
  const statusEntries = Object.entries(summaryData.interventions.byStatus)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ')

  const alertsSection = summaryData.alerts.length > 0
    ? `\n## Alertes detectees\n${summaryData.alerts.map((a) => `- ${a}`).join('\n')}`
    : ''

  return `Tu es un analyste de donnees pour un CRM de gestion d'interventions.
Voici les donnees REELLES de la periode ${summaryData.period.label} :

## Interventions
- Total : ${summaryData.interventions.total}
- Creees sur la periode : ${summaryData.interventions.created}
- Cloturees : ${summaryData.interventions.completed}
- Par statut : ${statusEntries || 'Aucune donnee'}

## Financier
- Chiffre d'affaires : ${summaryData.financial.totalRevenue} EUR
- Couts : ${summaryData.financial.totalCosts} EUR
- Marge : ${summaryData.financial.totalMargin} EUR (${summaryData.financial.averageMarginPercent}%)
${alertsSection}

Genere un resume analytique concis et actionnable. Identifie les points forts, les points faibles, et les actions recommandees.

Format de reponse attendu :
## Resume de la periode
- Point 1
- Point 2
- Point 3

## Points forts
- ...

## Points d'attention
- ...

## Actions recommandees
1. Action 1
2. Action 2
3. Action 3`
}

// ===== SECTION HISTORIQUE POUR PROMPTS =====

/**
 * Formate le contexte d'historique en section textuelle pour l'injecter dans le prompt utilisateur.
 * Retourne une chaine vide si aucun historique n'est disponible.
 */
function formatHistorySection(historyContext: InterventionHistoryContext | null | undefined): string {
  if (!historyContext) return ''

  const lines: string[] = []

  lines.push(`\n## Historique recent de l'intervention`)
  lines.push(`- ${historyContext.totalActions} actions au total`)
  lines.push(`- ${historyContext.metrics.daysInCurrentStatus} jours dans le statut actuel`)
  lines.push(`- ${historyContext.metrics.daysSinceLastAction} jours depuis la derniere action`)
  lines.push(`- ${historyContext.metrics.daysSinceCreation} jours depuis la creation`)

  if (historyContext.statusChanges.length > 0) {
    lines.push(`\n### Changements de statut :`)
    for (const s of historyContext.statusChanges.slice(0, 10)) {
      lines.push(`- ${s.date}: ${s.from} -> ${s.to} (par ${s.actor})`)
    }
  }

  if (historyContext.costChanges.length > 0) {
    lines.push(`\n### Modifications de couts :`)
    for (const c of historyContext.costChanges.slice(0, 5)) {
      const amounts = [
        c.oldAmount != null ? `ancien: ${c.oldAmount} EUR` : null,
        c.newAmount != null ? `nouveau: ${c.newAmount} EUR` : null,
      ].filter(Boolean).join(', ')
      lines.push(`- ${c.date}: ${c.type} ${amounts ? `(${amounts})` : ''}`)
    }
  }

  if (historyContext.artisanChanges.length > 0) {
    lines.push(`\n### Changements artisan :`)
    for (const a of historyContext.artisanChanges.slice(0, 5)) {
      lines.push(`- ${a.date}: ${a.type} (par ${a.actor})`)
    }
  }

  if (historyContext.recentComments.length > 0) {
    lines.push(`\n### Commentaires recents :`)
    for (const c of historyContext.recentComments.slice(0, 5)) {
      lines.push(`- ${c.date} (${c.actor}): "${c.content}"`)
    }
  }

  if (historyContext.alerts.length > 0) {
    lines.push(`\n### Alertes :`)
    for (const a of historyContext.alerts) {
      lines.push(`- ${a}`)
    }
  }

  return lines.join('\n')
}

// ===== CONSTRUCTEUR DE PROMPTS =====

/**
 * Construit le prompt complet (system + user) pour une action IA donnee.
 *
 * @param action - L'action IA a executer
 * @param entityData - Les donnees anonymisees de l'entite (intervention ou artisan)
 * @param pageType - Le type de page (pour les actions contextuelles)
 * @param context - Le contexte IA de la page courante (optionnel, enrichi avec vue active)
 * @param historyContext - Contexte d'historique condense de l'intervention (optionnel)
 * @returns { system, user } - Les prompts system et user
 */
export function buildPrompt(
  action: AIActionType,
  entityData?: AnonymizedIntervention | AnonymizedArtisan | null,
  pageType?: string,
  context?: AIPageContext | null,
  historyContext?: InterventionHistoryContext | null,
): { system: string; user: string } {
  let userPrompt: string
  const historySection = formatHistorySection(historyContext)

  switch (action) {
    case 'summary':
      if (entityData && 'id_inter' in entityData) {
        userPrompt = buildSummaryPrompt(entityData as AnonymizedIntervention) + historySection
      } else if (entityData && 'pseudo' in entityData) {
        userPrompt = buildArtisanSummaryPrompt(entityData as AnonymizedArtisan)
      } else {
        userPrompt = 'Resume le contexte actuel.'
      }
      break

    case 'next_steps':
      userPrompt = entityData && 'id_inter' in entityData
        ? buildNextStepsPrompt(entityData as AnonymizedIntervention) + historySection
        : 'Propose les prochaines etapes recommandees.'
      break

    case 'email_artisan':
      userPrompt = entityData && 'id_inter' in entityData
        ? buildEmailArtisanPrompt(entityData as AnonymizedIntervention) + historySection
        : 'Genere un brouillon d\'email pour l\'artisan.'
      break

    case 'email_client':
      userPrompt = entityData && 'id_inter' in entityData
        ? buildEmailClientPrompt(entityData as AnonymizedIntervention) + historySection
        : 'Genere un brouillon d\'email pour le client.'
      break

    case 'find_artisan':
      userPrompt = entityData && 'id_inter' in entityData
        ? buildFindArtisanPrompt(entityData as AnonymizedIntervention) + historySection
        : 'Decris le profil d\'artisan ideal.'
      break

    case 'suggestions':
      userPrompt = buildSuggestionsPrompt(pageType ?? 'inconnue', context, entityData)
      break

    case 'stats_insights':
      userPrompt = buildStatsInsightsPrompt(context)
      break

    case 'data_summary':
      // Le prompt data_summary est construit cote client avec les vraies donnees
      // et envoye directement dans extra_params.summary_data
      // Ce fallback est utilise si aucune donnee n'est fournie
      userPrompt = 'Genere un resume des donnees du tableau de bord.'
      break

    default:
      userPrompt = 'Aide-moi avec le contexte actuel.'
  }

  return {
    system: buildSystemPrompt(context),
    user: userPrompt,
  }
}

/**
 * Labels lisibles pour chaque action
 */
export const ACTION_LABELS: Record<AIActionType, string> = {
  summary: 'Resume',
  next_steps: 'Prochaines etapes',
  email_artisan: 'Email artisan',
  email_client: 'Email client',
  find_artisan: 'Trouver artisan',
  suggestions: 'Suggestions',
  stats_insights: 'Insights stats',
  data_summary: 'Resume donnees',
}

/**
 * Descriptions pour chaque action (affichees dans le menu)
 */
export const ACTION_DESCRIPTIONS: Record<AIActionType, string> = {
  summary: 'Resume en 3 points + prochaines etapes',
  next_steps: 'Actions recommandees pour cette intervention',
  email_artisan: 'Generer un brouillon d\'email pour l\'artisan',
  email_client: 'Generer un brouillon d\'email pour le client',
  find_artisan: 'Profil artisan ideal pour cette intervention',
  suggestions: 'Actions utiles dans le contexte actuel',
  stats_insights: 'Analyses et tendances du tableau de bord',
  data_summary: 'Analyse les donnees reelles de la periode selectionnee',
}
