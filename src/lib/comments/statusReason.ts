export type StatusReasonType = "archive" | "done"

const normalizeCode = (code?: string | null) => (code ?? "").trim().toUpperCase()

export const ARCHIVE_REASON_CODES = new Set(["ARCHIVE"])
export const DONE_REASON_CODES = new Set(["INTER_TERMINEE"])

export const getReasonTypeForCode = (code?: string | null): StatusReasonType | null => {
  const normalized = normalizeCode(code)
  if (!normalized) {
    return null
  }
  if (ARCHIVE_REASON_CODES.has(normalized)) {
    return "archive"
  }
  if (DONE_REASON_CODES.has(normalized)) {
    return "done"
  }
  return null
}

export const getReasonTypeForTransition = (
  previousCode?: string | null,
  nextCode?: string | null,
): StatusReasonType | null => {
  const prev = normalizeCode(previousCode)
  const next = normalizeCode(nextCode)
  if (!next || prev === next) {
    return null
  }
  return getReasonTypeForCode(next)
}
