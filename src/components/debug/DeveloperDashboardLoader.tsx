"use client"

import dynamic from 'next/dynamic'

const DeveloperDashboard = dynamic(
  () => import('./DeveloperDashboard'),
  { ssr: false }
)

/**
 * Lazy-loaded developer dashboard. Only renders in development mode.
 * Code-split from the main bundle — zero production impact.
 * Mount this in app/layout.tsx.
 */
export function DeveloperDashboardLoader() {
  if (process.env.NODE_ENV !== 'development') return null
  return <DeveloperDashboard />
}
