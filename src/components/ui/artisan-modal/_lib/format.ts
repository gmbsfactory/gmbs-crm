export const formatDate = (value: string | null | undefined, withTime = false) => {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  try {
    return new Intl.DateTimeFormat(
      "fr-FR",
      withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" },
    ).format(date)
  } catch {
    return value
  }
}
