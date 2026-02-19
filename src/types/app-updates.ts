export type AppUpdateSeverity = 'info' | 'important' | 'breaking' | 'feature' | 'fix'
export type AppUpdateStatus = 'draft' | 'published'

export interface AppUpdate {
  id: string
  version: string
  title: string
  content: string
  audience: string[]
  target_user_ids: string[]
  severity: AppUpdateSeverity
  status: AppUpdateStatus
  published_at: string | null
  created_by: string | null
  created_at: string
}

export interface AppUpdateView {
  id: string
  update_id: string
  user_id: string
  viewed_at: string
  acknowledged_at: string | null
}

export interface AppUpdateWithViewStatus extends AppUpdate {
  is_acknowledged: boolean
  acknowledged_at: string | null
}

export interface AppUpdateWithAcknowledgments extends AppUpdate {
  views: AppUpdateView[]
  acknowledgment_count: number
}
