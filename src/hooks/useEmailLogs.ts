import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase-client'
import { emailLogKeys } from '@/lib/react-query/queryKeys'

export interface EmailLog {
  id: string
  intervention_id: string
  artisan_id: string | null
  sent_by: string | null
  recipient_email: string
  subject: string
  email_type: 'devis' | 'intervention'
  status: 'sent' | 'failed'
  error_message: string | null
  smtp_message_id: string | null
  attachments_count: number
  sent_at: string
  sender_firstname: string | null
  sender_lastname: string | null
}

interface RawEmailLog {
  id: string
  intervention_id: string
  artisan_id: string | null
  sent_by: string | null
  recipient_email: string
  subject: string
  email_type: 'devis' | 'intervention'
  status: 'sent' | 'failed'
  error_message: string | null
  smtp_message_id: string | null
  attachments_count: number
  sent_at: string
  sender: { firstname: string | null; lastname: string | null } | null
}

function mapRawToEmailLog(row: RawEmailLog): EmailLog {
  return {
    id: row.id,
    intervention_id: row.intervention_id,
    artisan_id: row.artisan_id,
    sent_by: row.sent_by,
    recipient_email: row.recipient_email,
    subject: row.subject,
    email_type: row.email_type,
    status: row.status,
    error_message: row.error_message,
    smtp_message_id: row.smtp_message_id,
    attachments_count: row.attachments_count,
    sent_at: row.sent_at,
    sender_firstname: row.sender?.firstname ?? null,
    sender_lastname: row.sender?.lastname ?? null,
  }
}

const EMAIL_LOG_SELECT = `
  id,
  intervention_id,
  artisan_id,
  sent_by,
  recipient_email,
  subject,
  email_type,
  status,
  error_message,
  smtp_message_id,
  attachments_count,
  sent_at,
  sender:users!email_logs_sent_by_fkey (firstname, lastname)
`

async function fetchEmailLogs(interventionId: string): Promise<EmailLog[]> {
  const { data, error } = await supabase
    .from('email_logs')
    .select(EMAIL_LOG_SELECT)
    .eq('intervention_id', interventionId)
    .order('sent_at', { ascending: false })

  if (error) throw error

  return ((data ?? []) as unknown as RawEmailLog[]).map(mapRawToEmailLog)
}

export function useEmailLogs(interventionId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: emailLogKeys.byIntervention(interventionId),
    queryFn: () => fetchEmailLogs(interventionId),
    enabled: Boolean(interventionId) && (options?.enabled ?? true),
  })
}

async function fetchEmailLogsByType(
  interventionId: string,
  emailType: 'devis' | 'intervention'
): Promise<EmailLog[]> {
  const { data, error } = await supabase
    .from('email_logs')
    .select(EMAIL_LOG_SELECT)
    .eq('intervention_id', interventionId)
    .eq('email_type', emailType)
    .order('sent_at', { ascending: false })

  if (error) throw error

  return ((data ?? []) as unknown as RawEmailLog[]).map(mapRawToEmailLog)
}

export function useEmailLogsByType(
  interventionId: string,
  emailType: 'devis' | 'intervention',
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: emailLogKeys.byInterventionAndType(interventionId, emailType),
    queryFn: () => fetchEmailLogsByType(interventionId, emailType),
    enabled: Boolean(interventionId) && (options?.enabled ?? true),
  })
}
