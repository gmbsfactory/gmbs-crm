"use client"

import * as React from "react"
import { DesignDebugBar } from "@/components/debug/DesignDebugBar"

// Toggle pour activer/désactiver le debug bar (mettre false pour désactiver)
const ENABLE_DESIGN_DEBUG = true

export default function ThemeWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative min-h-screen font-sans antialiased liquid-glass-app-bg"
    >
      {children}
      {ENABLE_DESIGN_DEBUG && <DesignDebugBar />}
    </div>
  )
}
