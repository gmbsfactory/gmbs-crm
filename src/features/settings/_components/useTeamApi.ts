"use client"

import { useState, useEffect, useCallback } from "react"
import { useToast } from "@/hooks/use-toast"
import type { TeamUser, CreatedUserData, ArchivedUserData } from "./team-types"

export function useTeamApi() {
  const { toast } = useToast()

  const [team, setTeam] = useState<TeamUser[]>([])
  const [teamLoading, setTeamLoading] = useState(true)
  const [lastSync, setLastSync] = useState<Date | null>(null)

  const [creating, setCreating] = useState(false)
  const [createdUser, setCreatedUser] = useState<CreatedUserData | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [sendingInvite, setSendingInvite] = useState(false)

  const [deleting, setDeleting] = useState(false)

  const [archivedUserToRestore, setArchivedUserToRestore] = useState<ArchivedUserData | null>(null)
  const [restoring, setRestoring] = useState(false)

  const loadTeam = useCallback(async () => {
    setTeamLoading(true)
    try {
      const res = await fetch('/api/settings/team', { cache: 'no-store' })
      const data = await res.json()
      setTeam(data?.users || [])
      setLastSync(new Date())
    } catch {
      setTeam([])
    } finally {
      setTeamLoading(false)
    }
  }, [])

  useEffect(() => { loadTeam() }, [loadTeam])

  async function handleCreateUser(payload: {
    firstname: string; lastname: string; email: string; surnom: string;
    role: 'admin' | 'manager' | 'gestionnaire';
  }): Promise<boolean> {
    if (!payload.firstname || !payload.lastname || !payload.email) {
      toast({ title: 'Erreur', description: 'Veuillez remplir tous les champs obligatoires', variant: 'destructive' as const })
      return false
    }
    setCreating(true)
    try {
      const resp = await fetch('/api/settings/team/user', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const j = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        if (j?.error === 'user_archived' && j?.archivedUser) {
          setArchivedUserToRestore(j.archivedUser)
          return false
        }
        if (j?.error === 'email_taken') {
          toast({ title: 'Utilisateur existant', description: 'Cette adresse email est deja utilisee.', variant: 'destructive' as const })
        } else if (j?.error === 'duplicate_field') {
          toast({ title: 'Doublon detecte', description: j?.message || 'Un utilisateur avec ces informations existe deja.', variant: 'destructive' as const })
        } else {
          toast({ title: 'Erreur', description: j?.message || j?.error || "Impossible de creer l'utilisateur", variant: 'destructive' as const })
        }
        return false
      }
      await loadTeam()
      if (j.inviteLink) {
        setCreatedUser({ id: j.id, inviteLink: j.inviteLink, email: j.email, firstname: j.firstname, lastname: j.lastname })
      } else {
        toast({ title: 'Utilisateur cree', description: `${j.firstname} ${j.lastname} a ete ajoute.` })
      }
      return true
    } finally { setCreating(false) }
  }

  async function handleCopyLink() {
    if (!createdUser?.inviteLink) return
    try {
      await navigator.clipboard.writeText(createdUser.inviteLink)
      setLinkCopied(true)
      toast({ title: 'Lien copie', description: "Le lien d'invitation a ete copie dans le presse-papiers." })
      setTimeout(() => setLinkCopied(false), 2000)
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de copier le lien', variant: 'destructive' as const })
    }
  }

  async function handleSendInviteEmail() {
    if (!createdUser) return
    setSendingInvite(true)
    try {
      const resp = await fetch('/api/settings/team/user/send-invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: createdUser.email, recipientFirstname: createdUser.firstname,
          recipientLastname: createdUser.lastname, inviteLink: createdUser.inviteLink,
        }),
      })
      const j = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        toast({ title: "Erreur d'envoi", description: j?.error || "Impossible d'envoyer l'email", variant: 'destructive' as const })
        return
      }
      toast({ title: 'Email envoye', description: `L'invitation a ete envoyee a ${createdUser.email}` })
    } finally { setSendingInvite(false) }
  }

  function handleCloseSuccessModal() {
    setCreatedUser(null)
    setLinkCopied(false)
  }

  async function handleRestoreUser(): Promise<boolean> {
    if (!archivedUserToRestore) return false
    setRestoring(true)
    try {
      const resp = await fetch('/api/settings/team/user/restore', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: archivedUserToRestore.id }),
      })
      const j = await resp.json().catch(() => ({}))
      if (!resp.ok) {
        toast({ title: 'Erreur de restauration', description: j?.error || "Impossible de restaurer l'utilisateur", variant: 'destructive' as const })
        return false
      }
      await loadTeam()
      setArchivedUserToRestore(null)
      if (j.inviteLink) {
        setCreatedUser({ id: j.id, inviteLink: j.inviteLink, email: j.email, firstname: j.firstname, lastname: j.lastname })
        toast({ title: 'Compte restaure', description: `Le compte de ${j.firstname} ${j.lastname} a ete restaure.` })
      } else {
        toast({ title: 'Compte restaure', description: "Le compte a ete restaure." })
      }
      return true
    } finally { setRestoring(false) }
  }

  async function handleDeleteUser(userId: string, emailConfirm: string) {
    setDeleting(true)
    try {
      await fetch('/api/settings/team/user', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, emailConfirm })
      })
      await loadTeam()
      toast({ title: 'Utilisateur supprime' })
    } finally { setDeleting(false) }
  }

  async function handleSaveUserPermissions(data: {
    userId: string; role: string; surnom: string; color: string;
    firstname?: string; lastname?: string; email?: string; avatar_url?: string | null;
  }) {
    await fetch('/api/settings/team/user', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: data.userId, surnom: data.surnom, color: data.color,
        firstname: data.firstname, lastname: data.lastname, email: data.email, avatar_url: data.avatar_url,
      })
    })
    if (data.role) {
      await fetch('/api/settings/team/role', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: data.userId, role: data.role })
      })
    }
    await loadTeam()
    toast({ title: "Permissions mises a jour", description: "Les permissions de l'utilisateur ont ete enregistrees." })
  }

  return {
    team, teamLoading, lastSync,
    creating, createdUser, linkCopied, sendingInvite,
    deleting,
    archivedUserToRestore, restoring,
    setArchivedUserToRestore,
    handleCreateUser, handleCopyLink, handleSendInviteEmail,
    handleCloseSuccessModal, handleRestoreUser, handleDeleteUser,
    handleSaveUserPermissions,
  }
}
