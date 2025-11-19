/**
 * Fonction debounce pour retarder l'exécution d'une fonction
 * 
 * @param fn - Fonction à débouncer
 * @param delay - Délai en millisecondes
 * @returns Fonction débouncée
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null

  return function debounced(...args: Parameters<T>) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      fn(...args)
    }, delay)
  }
}



