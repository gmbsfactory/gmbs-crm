/**
 * Utilitaires pour la navigation avec support du Ctrl/Cmd + Clic
 */

import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime"

interface NavigationOptions {
  router: AppRouterInstance
  path: string
  event?: React.MouseEvent | MouseEvent
  sessionStorageKey?: string
  sessionStorageValue?: any
}

/**
 * Navigate to a path with support for opening in new tab via Ctrl/Cmd+Click or middle-click
 * @param options Navigation options
 */
export function navigateWithModifier({
  router,
  path,
  event,
  sessionStorageKey,
  sessionStorageValue,
}: NavigationOptions): void {
  // Détecter si l'utilisateur veut ouvrir dans un nouvel onglet
  const shouldOpenInNewTab = event
    ? event.ctrlKey || event.metaKey || (event as any).button === 1
    : false

  // Stocker les données dans sessionStorage si nécessaire
  if (sessionStorageKey && sessionStorageValue) {
    sessionStorage.setItem(sessionStorageKey, JSON.stringify(sessionStorageValue))
  }

  if (shouldOpenInNewTab) {
    // Ouvrir dans un nouvel onglet
    window.open(path, '_blank')
  } else {
    // Navigation normale
    router.push(path)
  }
}
