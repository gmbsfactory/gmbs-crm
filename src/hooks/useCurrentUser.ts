"use client"

import { useQuery } from "@tanstack/react-query"

interface CurrentUser {
  id: string
  code_gestionnaire?: string | null
  username?: string | null
  email?: string | null
  firstname?: string | null
  lastname?: string | null
  prenom?: string | null
  nom?: string | null
  surnom?: string | null
  color?: string | null
  status?: string | null
  roles?: string[]
}

export function useCurrentUser(options?: { enabled?: boolean }) {
  // Le listener onAuthStateChange est maintenant géré par AuthStateListenerProvider
  // pour éviter les listeners multiples quand plusieurs composants utilisent ce hook
  // IMPORTANT: On n'utilise plus supabase.auth.getSession() qui lit depuis localStorage
  // car localStorage est partagé entre les fenêtres du même navigateur, ce qui cause
  // des problèmes de sécurité. On utilise directement /api/auth/me qui lit depuis
  // les cookies HTTP-only, qui sont isolés par navigateur/fenêtre.
  return useQuery({
    queryKey: ["currentUser"],
    queryFn: async (): Promise<CurrentUser | null> => {
      // Appel direct à /api/auth/me sans header Authorization
      // L'API route lira automatiquement depuis les cookies HTTP-only
      // Cela garantit que chaque navigateur/fenêtre a sa propre session isolée
      const response = await fetch("/api/auth/me", {
        cache: "no-store", // Ne pas mettre en cache HTTP
        credentials: "include", // Inclure les cookies dans la requête
      })

      if (!response.ok) {
        if (response.status === 401) {
          // Pas authentifié, retourner null
          return null
        }
        throw new Error("Impossible de récupérer l'utilisateur")
      }

      const payload = await response.json()
      return payload?.user ?? null
    },
    staleTime: 5 * 60 * 1000, // Cache 5 minutes
    gcTime: 10 * 60 * 1000, // Garde en cache 10 minutes
    retry: 1,
    // Refetch automatique quand la fenêtre reprend le focus (sécurité)
    refetchOnWindowFocus: true,
    // Refetch automatique quand la connexion réseau revient
    refetchOnReconnect: true,
    // Permettre de désactiver la query sur les pages publiques
    enabled: options?.enabled !== false,
  })
}


