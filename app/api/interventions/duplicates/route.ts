import { NextResponse } from "next/server"
import { findDuplicates } from "@/lib/api/interventions/server"

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const duplicates = await findDuplicates(payload)
    return NextResponse.json({ duplicates })
  } catch (error) {
    console.error("[api/interventions/duplicates] POST failed", error)
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
