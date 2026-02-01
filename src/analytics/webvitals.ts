import { onINP, onLCP, onCLS } from "web-vitals"

const send = (name: string, value: number) => {
  // Envoi vers console pour le développement
  console.info(`[Vitals] ${name}: ${Math.round(value)}`)
  
  // gtag('event', name, { value: Math.round(value) })
}

export function initWebVitals() {
  onINP(m => send("INP", m.value))
  onLCP(m => send("LCP", m.value))
  onCLS(m => send("CLS", m.value))
}

// Perf marks pour le filtrage
export const markFilterStart = () => performance.mark("filter:start")
export const markFilterEnd = () => {
  performance.mark("filter:end")
  performance.measure("filter", "filter:start", "filter:end")
  
  // Log si le filtrage prend trop de temps
  const measure = performance.getEntriesByName("filter")[0]
  if (measure && measure.duration > 16) {
    console.warn(`[Perf] Filtrage lent: ${Math.round(measure.duration)}ms`)
  }
}
