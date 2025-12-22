import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase-client'

interface PodiumPeriod {
  period_start: string
  period_end: string
  is_active: boolean
}

interface UsePodiumPeriodResult {
  periodStart: string | null
  periodEnd: string | null
  isLoading: boolean
  error: string | null
}

/**
 * Hook pour récupérer et surveiller la période actuelle du podium
 *
 * FONCTIONNEMENT:
 * 1. Au premier chargement, récupère la période actuelle depuis la base de données
 * 2. Vérifie toutes les heures si la période a changé
 *
 * POURQUOI VÉRIFIER TOUTES LES HEURES ?
 * - Le job cron rafraîchit la période chaque vendredi à 16h
 * - Sans cette vérification, les utilisateurs devraient recharger la page manuellement
 * - Avec cette vérification, tous les clients connectés détectent automatiquement
 *   le changement de période dans l'heure suivant le rafraîchissement
 * - 1 heure est suffisant car les utilisateurs rechargent généralement leur page
 *
 * ALTERNATIVE: Utiliser Supabase Realtime pour être notifié instantanément,
 * mais cela nécessiterait plus de configuration et de ressources
 */
export function usePodiumPeriod(): UsePodiumPeriodResult {
  const [periodStart, setPeriodStart] = useState<string | null>(null)
  const [periodEnd, setPeriodEnd] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadPodiumPeriod = async () => {
      try {
        // Ne pas afficher le loading lors des vérifications périodiques
        // (seulement au premier chargement)
        if (!periodStart) {
          setIsLoading(true)
        }
        setError(null)

        // Appeler la fonction Supabase pour obtenir la période actuelle
        const { data, error: rpcError } = await supabase.rpc('get_current_podium_period')

        if (rpcError) {
          throw new Error(rpcError.message)
        }

        if (!cancelled && data) {
          const period = data as PodiumPeriod
          const newStart = period.period_start
          const newEnd = period.period_end

          // Détecter si la période a changé
          if (periodStart && (newStart !== periodStart || newEnd !== periodEnd)) {
            console.log('🔄 Podium: Nouvelle période détectée', {
              ancienne: { start: periodStart, end: periodEnd },
              nouvelle: { start: newStart, end: newEnd }
            })
          }

          setPeriodStart(newStart)
          setPeriodEnd(newEnd)
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('Erreur lors du chargement de la période du podium:', err)
          setError(err.message || 'Erreur inconnue')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    // Chargement initial
    loadPodiumPeriod()

    // Vérifier périodiquement si la période a changé
    // Cela permet de détecter automatiquement quand le job cron a rafraîchi la période
    // 1 heure est suffisant car les utilisateurs rechargent généralement leur page
    const CHECK_INTERVAL = 60 * 60 * 1000 // 1 heure en millisecondes

    const intervalId = setInterval(() => {
      console.log('🔍 Podium: Vérification de la période...')
      loadPodiumPeriod()
    }, CHECK_INTERVAL)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [periodStart, periodEnd])

  return {
    periodStart,
    periodEnd,
    isLoading,
    error,
  }
}
