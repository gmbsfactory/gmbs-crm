/**
 * Utilitaires pour détecter les capacités de l'appareil
 * et adapter le comportement de l'application en conséquence
 */

export interface DeviceCapabilities {
  isLowEnd: boolean
  cores: number | null
  memory: number | null
  supportsIdleCallback: boolean
}

/**
 * Détecte si l'appareil est peu puissant (peu de RAM ou peu de cores)
 */
export function detectDeviceCapabilities(): DeviceCapabilities {
  if (typeof window === 'undefined') {
    return {
      isLowEnd: false,
      cores: null,
      memory: null,
      supportsIdleCallback: false,
    }
  }

  const memory = (navigator as any).deviceMemory as number | undefined // GB de RAM
  const cores = navigator.hardwareConcurrency // Nombre de cores CPU

  // Considérer comme "low-end" si :
  // - Moins de 4GB de RAM
  // - Moins de 4 cores CPU
  // - Ou si l'utilisateur a activé le mode économie d'énergie
  const isLowEnd = 
    (memory !== undefined && memory < 4) || 
    (cores !== undefined && cores < 4) ||
    localStorage.getItem('lowPowerMode') === 'true'

  return {
    isLowEnd,
    cores: cores ?? null,
    memory: memory ?? null,
    supportsIdleCallback: 'requestIdleCallback' in window,
  }
}

/**
 * Configuration de préchargement adaptée aux capacités de l'appareil
 */
export interface PreloadConfig {
  batchSize: number      // Nombre de vues à précharger en parallèle
  batchDelay: number     // Délai entre les batches (ms)
  maxViews: number       // Nombre maximum de vues à précharger
  useIdleCallback: boolean // Utiliser requestIdleCallback
  staleTime: number      // Durée de validité du cache (ms)
  gcTime: number         // Durée de conservation en mémoire (ms)
  isLowEnd: boolean      // Flag explicite pour appareil peu puissant
}

/**
 * Retourne la configuration de préchargement adaptée à l'appareil
 */
export function getPreloadConfig(): PreloadConfig {
  const { isLowEnd, supportsIdleCallback } = detectDeviceCapabilities()

  if (isLowEnd) {
    // Configuration pour PC peu puissants : préchargement minimal et en idle
    return {
      batchSize: 1,
      batchDelay: 2000,
      maxViews: 2,
      useIdleCallback: supportsIdleCallback,
      staleTime: 10 * 60 * 1000,  // 10 minutes - cache plus long pour éviter les refetch
      gcTime: 30 * 60 * 1000,     // 30 minutes
      isLowEnd: true,
    }
  }

  // Configuration pour PC normaux/puissants
  return {
    batchSize: 2,
    batchDelay: 800,
    maxViews: 6,
    useIdleCallback: supportsIdleCallback,
    staleTime: 5 * 60 * 1000,   // 5 minutes
    gcTime: 15 * 60 * 1000,     // 15 minutes
    isLowEnd: false,
  }
}

/**
 * Exécute une fonction en idle (quand le navigateur est inactif)
 * Fallback sur setTimeout si requestIdleCallback n'est pas supporté
 */
export function runInIdle(
  callback: () => void, 
  options: { timeout?: number; fallbackDelay?: number } = {}
): () => void {
  const { timeout = 5000, fallbackDelay = 1000 } = options

  if (typeof window === 'undefined') {
    return () => {}
  }

  if ('requestIdleCallback' in window) {
    const id = (window as any).requestIdleCallback(callback, { timeout })
    return () => (window as any).cancelIdleCallback(id)
  }

  // Fallback pour navigateurs qui ne supportent pas requestIdleCallback
  const id = setTimeout(callback, fallbackDelay)
  return () => clearTimeout(id)
}

/**
 * Exécute plusieurs fonctions en idle de manière séquentielle
 * avec un délai entre chaque exécution
 */
export function runBatchInIdle<T>(
  items: T[],
  callback: (item: T, index: number) => void,
  options: { 
    batchSize?: number
    delayBetweenBatches?: number
    timeout?: number 
  } = {}
): () => void {
  const { batchSize = 1, delayBetweenBatches = 500, timeout = 5000 } = options
  
  let cancelled = false
  const cleanups: (() => void)[] = []

  const processBatch = (startIndex: number) => {
    if (cancelled || startIndex >= items.length) return

    const cleanup = runInIdle(() => {
      if (cancelled) return

      const endIndex = Math.min(startIndex + batchSize, items.length)
      for (let i = startIndex; i < endIndex; i++) {
        if (!cancelled) {
          callback(items[i], i)
        }
      }

      // Planifier le prochain batch
      if (endIndex < items.length && !cancelled) {
        setTimeout(() => processBatch(endIndex), delayBetweenBatches)
      }
    }, { timeout })

    cleanups.push(cleanup)
  }

  processBatch(0)

  return () => {
    cancelled = true
    cleanups.forEach(cleanup => cleanup())
  }
}

