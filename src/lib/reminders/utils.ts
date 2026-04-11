/**
 * Utilitaires pour les reminders — fonctions pures sans dépendance React
 */

export const normalizeReminderIdentifier = (input: string): string => {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]/g, "")
}

export const extractReminderMentions = (note: string): string[] => {
  if (!note) return []
  const regex = /@([\p{L}\p{N}_.-]+)/gu
  const mentions = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = regex.exec(note)) !== null) {
    const normalized = normalizeReminderIdentifier(match[1] ?? "")
    if (normalized) {
      mentions.add(normalized)
    }
  }
  return Array.from(mentions)
}
