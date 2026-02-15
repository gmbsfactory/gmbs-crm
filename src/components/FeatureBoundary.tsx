"use client"
import { ErrorBoundary } from "react-error-boundary"

export function FeatureBoundary({
  boundaryKey,
  children,
}: { boundaryKey: string; children: React.ReactNode }) {
  return (
    <ErrorBoundary
      key={boundaryKey}
      fallbackRender={({ error, resetErrorBoundary }) => {
        const message = error instanceof Error ? error.message : String(error)
        return (
        <div className="p-4 border rounded-md bg-red-50 text-sm">
          <div className="font-medium text-red-700 mb-2">Oups…</div>
          <pre className="text-red-800 overflow-auto max-h-40">{message}</pre>
          <button className="mt-3 px-3 py-1 border rounded" onClick={resetErrorBoundary}>
            Réessayer
          </button>
        </div>
        )
      }}
    >
      {children}
    </ErrorBoundary>
  )
}
