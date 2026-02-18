"use client"

import dynamic from 'next/dynamic'

const DeveloperDashboard = dynamic(
  () => import('./DeveloperDashboard'),
  { ssr: false }
)

/**
 * Lazy-loaded developer dashboard. Renders in development mode or when
 * NEXT_PUBLIC_ENABLE_DEV_DASHBOARD=true is set in environment.
 * Code-split from the main bundle — zero production impact when disabled.
 * Mount this in app/layout.tsx.
 */
export function DeveloperDashboardLoader() {
  const isDashboardEnabled =
    process.env.NODE_ENV === 'development' ||
    process.env.NEXT_PUBLIC_ENABLE_DEV_DASHBOARD === 'true'

  if (!isDashboardEnabled) return null
  return <DeveloperDashboard />
}
