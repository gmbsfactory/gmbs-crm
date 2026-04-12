import { NextResponse } from "next/server"
import { transitionStatus } from "@/lib/api/interventions"
import type { InterventionStatusValue } from "@/types/interventions"
import { requirePermission, isPermissionError } from "@/lib/auth/permissions"

type Params = {
  params: Promise<{
    id: string
  }>
}

export async function POST(request: Request, { params }: Params) {
  try {
    const permCheck = await requirePermission(request, "write_interventions")
    if (isPermissionError(permCheck)) return permCheck.error

    const { id } = await params
    const body = await request.json()
    const status = body.status as InterventionStatusValue | undefined
    if (!status) {
      return NextResponse.json({ message: "Statut requis" }, { status: 400 })
    }

    const intervention = await transitionStatus(id, {
      status,
      dueAt: body.dueAt,
      artisanId: body.artisanId,
    })
    return NextResponse.json(intervention)
  } catch (error) {
    console.error("[api/interventions/:id/status] POST failed", error)
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
