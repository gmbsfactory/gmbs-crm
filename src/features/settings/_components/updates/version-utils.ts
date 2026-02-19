export interface ParsedVersion {
  major: number
  minor: number
}

/**
 * Parse a version string like "1.03" into { major: 1, minor: 3 }
 */
export function parseVersion(str: string): ParsedVersion {
  const parts = str.split('.')
  const major = parseInt(parts[0], 10) || 0
  const minor = parseInt(parts[1], 10) || 0
  return { major, minor }
}

/**
 * Format a version as "X.YY" (major.minor with zero-padded minor)
 */
export function formatVersion(major: number, minor: number): string {
  return `${major}.${String(minor).padStart(2, '0')}`
}

/**
 * Increment the minor version. If minor reaches 100, bump major.
 */
export function incrementMinor(version: string): string {
  const { major, minor } = parseVersion(version)
  if (minor >= 99) {
    return formatVersion(major + 1, 0)
  }
  return formatVersion(major, minor + 1)
}

/**
 * Suggest the next version based on the latest version string.
 * If no version is given, returns "1.00".
 */
export function suggestNextVersion(latestVersion?: string | null): string {
  if (!latestVersion) return '1.00'
  return incrementMinor(latestVersion)
}
