import { notFound } from "next/navigation"
import { getIntervention } from "@/lib/api/interventions/server"

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

  if (!intervention.isActive) {
    return (
      <div className="flex min-h-[360px] items-center justify-center p-6">
        <div className="max-w-md rounded-lg border border-amber-200 bg-amber-50 p-5 text-center text-sm text-amber-950 shadow-sm">
          <h1 className="font-semibold">Intervention supprimée</h1>
          <p className="mt-2 text-amber-900">
            Cette intervention a été supprimée du CRM. Veuillez contacter le développeur.
          </p>
        </div>
      </div>
    )
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
