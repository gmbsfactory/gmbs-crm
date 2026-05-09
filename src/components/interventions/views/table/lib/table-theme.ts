export type ThemeMode = "light" | "dark"

export const resolveThemeMode = (): ThemeMode => {
  if (typeof document === "undefined") return "light"
  return document.documentElement.classList.contains("dark") ? "dark" : "light"
}
