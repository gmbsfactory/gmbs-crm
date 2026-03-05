"use client"

import { useQuery } from "@tanstack/react-query"

export interface Gestionnaire {
  id: string
  firstname: string | null
  lastname: string | null
  prenom?: string | null
  name?: string | null
  code_gestionnaire: string | null
  color: string | null
  email: string | null
  username: string | null
  avatar_url?: string | null
  role?: string | null
  roles?: string[]
}

export function useGestionnaires() {
  return useQuery({
    queryKey: ["gestionnaires"],
    queryFn: async (): Promise<Gestionnaire[]> => {
      const res = await fetch("/api/settings/team", { cache: "no-store" })
      if (!res.ok) {
        throw new Error(`Failed to fetch gestionnaires: ${res.statusText}`)
      }
      const data = await res.json()
      // Transformer les données de l'API pour correspondre à l'interface Gestionnaire
      const users = (data?.users || []).map((u: any) => ({
        id: u.id,
        firstname: u.firstname,
        lastname: u.lastname,
        prenom: u.prenom || u.firstname,
        name: u.name || u.lastname,
        code_gestionnaire: u.code_gestionnaire,
        color: u.color,
        email: u.email,
        username: u.username,
        avatar_url: u.avatar_url || null,
        role: u.role || null,
        roles: u.roles || [],
      }))
      return users
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

