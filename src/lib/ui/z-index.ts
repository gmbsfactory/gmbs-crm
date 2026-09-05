/**
 * Échelle de superposition (z-index) de l'application.
 *
 * SOURCE DE VÉRITÉ UNIQUE. Aucun composant ne doit écrire un `z-[…]` en dur :
 * on importe une constante ou une classe d'ici. Ajouter un étage se fait ici,
 * et nulle part ailleurs.
 *
 * Règle de lecture : un étage passe DEVANT tous les étages inférieurs.
 * L'ordre suit le sens de lecture de l'utilisateur — ce qu'il vient d'ouvrir
 * doit toujours être devant ce depuis quoi il l'a ouvert.
 *
 * ┌───────────────────────────────────────────────────────────────────────────┐
 * │ 10001 flottantImbrique  menu ouvert depuis un menu (sous-menu, recherche) │
 * │ 10000 flottant          menus, listes déroulantes, sélecteurs, infobulles │
 * │  9999 pleinEcran        économiseur d'écran, tableau de bord développeur  │
 * │  1700 notification      messages éphémères (toasts)                       │
 * │  1600 visionneuse       visionneuse de photos plein écran                 │
 * │  1500 confirmation      boîte de confirmation (AlertDialog)               │
 * │  1400 confirmationVoile son voile                                         │
 * │  1350 dialogueImbrique  dialogue ouvert DEPUIS un dialogue (aperçu…)      │
 * │  1320 dialogueImbriqueVoile                                               │
 * │  1300 dialogue          boîte de dialogue (Dialog)                        │
 * │  1200 dialogueVoile     son voile                                         │
 * │  1000 flottantPage      infobulles de cellules, survols de cartes         │
 * │   120 panneau           panneau latéral (Sheet : historique, activité)    │
 * │   110 panneauVoile      son voile                                         │
 * │    80 surModal          modals secondaires historiques (journal, updates) │
 * │    70 modal             gros modals (GenericModal : artisan, intervention)│
 * │    60 modalVoile        son voile                                         │
 * │    50 barreSuperieure   barre du haut, en-têtes collants                  │
 * │  < 50 contenuPage       tout le reste                                     │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * Pourquoi chaque étage est au-dessus du précédent :
 *
 * - `modalVoile` / `modal` (60/70) : le gros modal recouvre la page et sa barre
 *   du haut (50). Ces deux valeurs sont volontairement CONSERVÉES à leur niveau
 *   historique : une dizaine de composants se positionnent déjà par rapport à
 *   elles (journal des mises à jour, en-têtes de tableau redimensionnables,
 *   aperçus de documents…). Les monter à 600/700 aurait obligé à toucher tous
 *   ces fichiers sans rien apporter : ce qui manquait, ce n'était pas de la
 *   place sous les modals mais un étage AU-DESSUS. On l'a créé à 1200+.
 *
 * - `panneauVoile` / `panneau` (110/120) : un panneau d'historique s'ouvre
 *   depuis un gros modal, il doit donc le recouvrir.
 *
 * - `flottantPage` (1000) : éléments flottants attachés au contenu de la page
 *   (infobulle d'une cellule tronquée, carte de survol d'une intervention).
 *   Au-dessus des panneaux, mais SOUS les dialogues : quand une boîte de
 *   dialogue est ouverte, plus rien de la page ne doit passer devant elle.
 *
 * - `dialogueVoile` / `dialogue` (1200/1300) : c'est LE correctif. Une boîte de
 *   dialogue (motif de refus d'une pièce, demande de correction d'un rapport,
 *   lien portail…) s'ouvre presque toujours DEPUIS un gros modal ou un panneau.
 *   Elle doit donc passer devant eux. Avant, elle sortait à 50, sous le modal
 *   à 70, et chaque appelant devait poser sa propre rustine `!z-[1300]`.
 *
 * - `dialogueImbriqueVoile` / `dialogueImbrique` (1320/1350) : un dialogue
 *   ouvert depuis un autre dialogue (ex. l'aperçu d'un document depuis la
 *   reclassification). Reste sous les confirmations.
 *
 * - `confirmationVoile` / `confirmation` (1400/1500) : une confirmation
 *   (« Voulez-vous vraiment ? », « Modifications non enregistrées ») s'ouvre
 *   très souvent DEPUIS un dialogue. Elle doit donc passer devant lui.
 *
 * - `visionneuse` (1600) : la visionneuse de photos est plein écran et
 *   s'ouvre depuis n'importe lequel des étages précédents.
 *
 * - `notification` (1700) : un message éphémère doit rester lisible même
 *   pendant qu'un dialogue ou une visionneuse est ouvert, sinon l'utilisateur
 *   ne voit jamais la confirmation de l'action qu'il vient de déclencher.
 *
 * - `pleinEcran` (9999) : économiseur d'écran et outils de développement,
 *   qui recouvrent tout le produit.
 *
 * - `flottant` / `flottantImbrique` (10000/10001) : INCHANGÉ. Un sélecteur, une
 *   liste déroulante ou une infobulle ouverts DANS un dialogue doivent rester
 *   devant lui. Cet étage est délibérément hors d'atteinte de tous les autres :
 *   il n'est jamais modal, il se referme au premier clic, il ne peut donc pas
 *   « piéger » l'utilisateur en masquant une surface.
 */
export const Z_INDEX = {
  contenuPage: 10,
  barreSuperieure: 50,
  modalVoile: 60,
  modal: 70,
  surModal: 80,
  panneauVoile: 110,
  panneau: 120,
  flottantPage: 1000,
  dialogueVoile: 1200,
  dialogue: 1300,
  dialogueImbriqueVoile: 1320,
  dialogueImbrique: 1350,
  confirmationVoile: 1400,
  confirmation: 1500,
  visionneuse: 1600,
  notification: 1700,
  pleinEcran: 9999,
  flottant: 10000,
  flottantImbrique: 10001,
} as const

export type EtageSuperposition = keyof typeof Z_INDEX

/**
 * Classes Tailwind correspondantes.
 *
 * Elles sont écrites en toutes lettres (et non générées) pour que le scanner
 * de Tailwind les voie : il lit le texte des fichiers, il n'exécute pas le code.
 * Ce fichier est bien couvert par `content: ["./src/**\/*.{ts,tsx}"]`.
 */
export const Z_CLASS = {
  contenuPage: "z-10",
  barreSuperieure: "z-50",
  modalVoile: "z-[60]",
  modal: "z-[70]",
  surModal: "z-[80]",
  panneauVoile: "z-[110]",
  panneau: "z-[120]",
  flottantPage: "z-[1000]",
  dialogueVoile: "z-[1200]",
  dialogue: "z-[1300]",
  dialogueImbriqueVoile: "z-[1320]",
  dialogueImbrique: "z-[1350]",
  confirmationVoile: "z-[1400]",
  confirmation: "z-[1500]",
  visionneuse: "z-[1600]",
  notification: "z-[1700]",
  pleinEcran: "z-[9999]",
  flottant: "z-[10000]",
  flottantImbrique: "z-[10001]",
} as const satisfies Record<EtageSuperposition, string>
