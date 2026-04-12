import { NextResponse } from "next/server"
import { deleteIntervention, getIntervention, updateIntervention } from "@/lib/api/v2/interventions/server"
import { mapStatusFromDb } from "@/lib/interventions/mappers"
import { isTerminalStatus } from "@/config/interventions"
import { requirePermission, isPermissionError } from "@/lib/auth/permissions"
import { supabaseAdmin } from "@/lib/supabase-admin"

type Params = {
  params: Promise<{
    id: string
  }>
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const intervention = await getIntervention({ id })
  if (!intervention) {
    return NextResponse.json({ message: "Intervention introuvable" }, { status: 404 })
  }
  return NextResponse.json(intervention)
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const permCheck = await requirePermission(request, "write_interventions")
    if (isPermissionError(permCheck)) return permCheck.error
    const { user } = permCheck

    const { id } = await params
    if (!supabaseAdmin) {
      return NextResponse.json({ message: "No DB" }, { status: 500 })
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("interventions")
      .select("statut")
      .eq("id", id)
      .maybeSingle()

    if (existingError) {
      return NextResponse.json({ message: existingError.message }, { status: 500 })
    }

    if (existing?.statut) {
      const statusValue = mapStatusFromDb(existing.statut)
      const isClosed = statusValue === "INTER_TERMINEE" || isTerminalStatus(statusValue)
      if (isClosed) {
        const closedCheck = await requirePermission(request, "edit_closed_interventions")
        if (isPermissionError(closedCheck)) return closedCheck.error
      }
    }

    const isAdmin = user.roles.some((role) => role.toLowerCase().includes("admin"))

    const payload = await request.json()
    const wantsContextUpdate =
      Object.prototype.hasOwnProperty.call(payload, "context") ||
      Object.prototype.hasOwnProperty.call(payload, "contexte_intervention")

    if (wantsContextUpdate && !isAdmin) {
      return NextResponse.json(
        { message: "Seuls les administrateurs peuvent modifier le contexte après création" },
        { status: 403 },
      )
    }

    const intervention = await updateIntervention(id, payload)
    return NextResponse.json(intervention)
  } catch (error) {
    console.error("[api/interventions/:id] PATCH failed", error)
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const permCheck = await requirePermission(_request, "delete_interventions")
  if (isPermissionError(permCheck)) return permCheck.error

  const { id } = await params
  await deleteIntervention(id)
  return NextResponse.json({ ok: true })
}
