// ===== PROMPTS IA =====
// Templates de prompts pour chaque action IA contextuelle.
// Les prompts sont construits avec les donnees anonymisees de l'entite.

import type { AIActionType, AnonymizedIntervention, AnonymizedArtisan } from './types'

/**
 * System prompt commun a toutes les actions
 */
const SYSTEM_PROMPT = `Tu es un assistant IA integre dans un CRM de gestion d'interventions batiment (GMBS-CRM).
Tu aides les gestionnaires a prendre des decisions rapidement.
Reponds toujours en francais, de maniere concise et actionnable.
Utilise des puces pour structurer tes reponses.
Ne mentionne jamais de donnees personnelles (noms, emails, telephones).
Concentre-toi sur les faits metier : statut, metier, couts, delais, zone.`

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
 * Prompt generique pour suggestions contextuelles
 */
function buildSuggestionsPrompt(pageType: string): string {
  return `En tant qu'assistant CRM, propose 3 actions utiles que le gestionnaire pourrait faire maintenant sur la page "${pageType}".
Prends en compte les bonnes pratiques de gestion d'interventions batiment.
Format : liste numerotee avec action + benefice attendu.`
}

/**
 * Prompt pour insights sur les stats du dashboard
 */
function buildStatsInsightsPrompt(): string {
  return `En tant qu'assistant CRM, propose 3 insights ou alertes basees sur les donnees du tableau de bord.
Concentre-toi sur :
- Les tendances (hausse/baisse du volume)
- Les anomalies potentielles (retards, marges faibles)
- Les actions proactives recommandees
Format : liste a puces, concis et actionnable.`
}

// ===== CONSTRUCTEUR DE PROMPTS =====

/**
 * Construit le prompt complet (system + user) pour une action IA donnee.
 *
 * @param action - L'action IA a executer
 * @param entityData - Les donnees anonymisees de l'entite (intervention ou artisan)
 * @param pageType - Le type de page (pour les actions contextuelles)
 * @returns { system, user } - Les prompts system et user
 */
export function buildPrompt(
  action: AIActionType,
  entityData?: AnonymizedIntervention | AnonymizedArtisan | null,
  pageType?: string
): { system: string; user: string } {
  let userPrompt: string

  switch (action) {
    case 'summary':
      if (entityData && 'id_inter' in entityData) {
        userPrompt = buildSummaryPrompt(entityData as AnonymizedIntervention)
      } else if (entityData && 'pseudo' in entityData) {
        userPrompt = buildArtisanSummaryPrompt(entityData as AnonymizedArtisan)
      } else {
        userPrompt = 'Resume le contexte actuel.'
      }
      break

    case 'next_steps':
      userPrompt = entityData && 'id_inter' in entityData
        ? buildNextStepsPrompt(entityData as AnonymizedIntervention)
        : 'Propose les prochaines etapes recommandees.'
      break

    case 'email_artisan':
      userPrompt = entityData && 'id_inter' in entityData
        ? buildEmailArtisanPrompt(entityData as AnonymizedIntervention)
        : 'Genere un brouillon d\'email pour l\'artisan.'
      break

    case 'email_client':
      userPrompt = entityData && 'id_inter' in entityData
        ? buildEmailClientPrompt(entityData as AnonymizedIntervention)
        : 'Genere un brouillon d\'email pour le client.'
      break

    case 'find_artisan':
      userPrompt = entityData && 'id_inter' in entityData
        ? buildFindArtisanPrompt(entityData as AnonymizedIntervention)
        : 'Decris le profil d\'artisan ideal.'
      break

    case 'suggestions':
      userPrompt = buildSuggestionsPrompt(pageType ?? 'inconnue')
      break

    case 'stats_insights':
      userPrompt = buildStatsInsightsPrompt()
      break

    default:
      userPrompt = 'Aide-moi avec le contexte actuel.'
  }

  return {
    system: SYSTEM_PROMPT,
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
}
