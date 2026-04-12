import { notFound } from "next/navigation"
import { getIntervention } from "@/lib/api/v2/interventions/server"

type Params = {
  params: Promise<{
    id: string
  }>
}

export default async function InterventionDetailPage({ params }: Params) {
  const { id } = await params
  const intervention = await getIntervention({ id })

  if (!intervention) {
    notFound()
  }

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">
        Intervention {intervention.name ?? intervention.id}
      </h1>
      <p className="text-sm text-muted-foreground">
        La vue détaillée des interventions est en cours de refonte.
      </p>
    </div>
  )
}
