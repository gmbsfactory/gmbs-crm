import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ totals: { tokens: 0, requests: 0, costUsd: '0.000000' } })
  }
  const { data, error } = await supabaseAdmin
    .from('conversation_usage')
    .select('total_prompt_tokens, total_completion_tokens, total_requests, total_cost_usd, mode')
    .eq('mode', 'test_beta')
  if (error) {
    return new NextResponse(error.message || 'Erreur DB', { status: 500 })
  }

  let tokens = 0
  let requests = 0
  let cost = 0
  for (const r of data || []) {
    tokens += (r.total_prompt_tokens || 0) + (r.total_completion_tokens || 0)
    requests += (r.total_requests || 0)
    cost += Number(r.total_cost_usd || 0)
  }
  const costUsd = cost.toFixed(6)
  const initialFree = Math.max(0, Math.min(10_000_00, parseInt(process.env.INITIAL_FREE_CENTS || '500', 10) || 500))
  const usedCents = Math.round(cost * 100)
  const balanceCentsOverride = Math.max(0, initialFree - usedCents)
  const result = { totals: { tokens, requests, costUsd }, usedCents, balanceCentsOverride }
  return NextResponse.json(result)
}

