import InterventionCard from "@/features/interventions/components/InterventionCard"

type PreviewIntervention = Record<string, unknown>

const base: PreviewIntervention = {
  id: "preview-base",
  date: new Date().toISOString(),
  agence: "Paris",
  agence_id: "agency-paris",
  agenceLabel: "Paris",
  contexteIntervention: "Réparation volet roulant",
  contexte_intervention: "Réparation volet roulant",
  adresse: "12 Rue Exemple",
  codePostal: "75000",
  code_postal: "75000",
  ville: "Paris",
  type: "Dépannage",
  prenomClient: "Jean",
  nomClient: "Dupont",
  marge: 320,
  attribueA: "alice",
  assigned_user_id: "user-alice",
  assignedUserName: "Alice Martin",
  assignedUserCode: "A1",
  statut: "DEMANDE",
  statusValue: "DEMANDE",
  coutIntervention: 420,
  coutSST: 120,
  coutMateriel: 80,
}

function make(id: string, overrides: PreviewIntervention) {
  return {
    ...base,
    id,
    ...overrides,
  }
}

const now = new Date()
const past = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
const soon = new Date(now.getTime() + 24 * 60 * 60 * 1000)

const cards: { label: string; data: PreviewIntervention; props?: { keyboardHovered?: boolean; selectedActionIndex?: number } }[] = [
  { label: "default", data: make("1", { statut: "DEMANDE", statusValue: "DEMANDE", dateIntervention: now.toISOString() }) },
  { label: "hover", data: make("2", { statut: "ACCEPTE", statusValue: "ACCEPTE", dateIntervention: now.toISOString() }), props: {} },
  { label: "focus", data: make("3", { statut: "INTER_EN_COURS", statusValue: "INTER_EN_COURS", dateIntervention: now.toISOString() }), props: { keyboardHovered: true } },
  { label: "due-soon", data: make("4", { statut: "INTER_EN_COURS", statusValue: "INTER_EN_COURS", dateIntervention: soon.toISOString() }) },
  { label: "overdue", data: make("5", { statut: "INTER_EN_COURS", statusValue: "INTER_EN_COURS", dateIntervention: past.toISOString() }) },
  { label: "blocked", data: make("6", { statut: "ANNULE", statusValue: "ANNULE", dateIntervention: now.toISOString() }) },
]

export default function Page() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">InterventionCard states</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(({ label, data, props }) => (
          <div key={label} className="space-y-2">
            <div className="text-xs text-muted-foreground">{label}</div>
            <InterventionCard
              intervention={data as any}
              keyboardHovered={props?.keyboardHovered}
              selectedActionIndex={props?.selectedActionIndex ?? -1}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
