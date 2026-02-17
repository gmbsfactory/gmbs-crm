export interface HistoryItem {
  id: string
  action_type: string
  action_label: string | null
  actor_display: string | null
  actor_code: string | null
  actor_color: string | null
  occurred_at: string
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  changed_fields: string[] | null
  related_entity_type: string | null
  related_entity_id: string | null
  source: string | null
  metadata: Record<string, unknown> | null
}

export type HistoryValueResolver = (
  field: string,
  value: unknown
) => { label: string; color?: string | null } | null
