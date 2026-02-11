"use client"
import { Component, type ReactNode, type ErrorInfo } from "react"

interface ErrorBoundaryProps {
  children: ReactNode
  section?: string
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

/**
 * ErrorBoundary — Composant class pour capturer les erreurs React
 * Isole les crashs d'un sous-arbre sans faire planter toute la page.
 *
 * Usage :
 *   <ErrorBoundary section="page-content">
 *     {children}
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(
      `[ErrorBoundary${this.props.section ? `:${this.props.section}` : ""}]`,
      error,
      errorInfo.componentStack,
    )
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-8 text-center">
          <div className="text-lg font-semibold text-red-700 mb-2">
            Une erreur est survenue
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            {this.props.section
              ? `Section « ${this.props.section} » — `
              : ""}
            Veuillez réessayer ou recharger la page.
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="px-4 py-2 text-sm font-medium border rounded-md hover:bg-accent transition-colors"
          >
            Réessayer
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
