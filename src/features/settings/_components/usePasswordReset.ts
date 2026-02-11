"use client"

import * as React from "react"
import { toast } from "sonner"

export function usePasswordReset(userId: string | undefined, userEmail: string | null | undefined) {
  const [resetPasswordLoading, setResetPasswordLoading] = React.useState(false)
  const [resetPasswordLink, setResetPasswordLink] = React.useState<string | null>(null)
  const [resetLinkCopied, setResetLinkCopied] = React.useState(false)
  const [sendingResetEmail, setSendingResetEmail] = React.useState(false)

  function resetPasswordState() {
    setResetPasswordLink(null)
    setResetLinkCopied(false)
    setResetPasswordLoading(false)
    setSendingResetEmail(false)
  }

  const handleGenerateResetLink = async () => {
    if (!userId) return
    setResetPasswordLoading(true)
    setResetPasswordLink(null)
    try {
      const resp = await fetch('/api/settings/team/user/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, sendEmail: false }),
      })
      const data = await resp.json()
      if (!resp.ok) { toast.error(data?.error || 'Erreur generation du lien'); return }
      setResetPasswordLink(data.resetLink)
      toast.success('Lien de reinitialisation genere')
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erreur inattendue'
      toast.error(msg)
    } finally { setResetPasswordLoading(false) }
  }

  const handleCopyResetLink = async () => {
    if (!resetPasswordLink) return
    try {
      await navigator.clipboard.writeText(resetPasswordLink)
      setResetLinkCopied(true)
      toast.success('Lien copie dans le presse-papiers')
      setTimeout(() => setResetLinkCopied(false), 2000)
    } catch { toast.error('Impossible de copier le lien') }
  }

  const handleSendResetEmail = async () => {
    if (!userId) return
    setSendingResetEmail(true)
    try {
      const resp = await fetch('/api/settings/team/user/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, sendEmail: true }),
      })
      const data = await resp.json()
      if (!resp.ok) { toast.error(data?.error || "Erreur lors de l'envoi"); return }
      if (data.emailSent) {
        toast.success(`Email envoye a ${userEmail}`)
        setResetPasswordLink(data.resetLink)
      } else {
        setResetPasswordLink(data.resetLink)
        toast.info(data.message || 'Lien genere, mais email non envoye')
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erreur inattendue'
      toast.error(msg)
    } finally { setSendingResetEmail(false) }
  }

  return {
    resetPasswordLoading,
    resetPasswordLink,
    resetLinkCopied,
    sendingResetEmail,
    resetPasswordState,
    handleGenerateResetLink,
    handleCopyResetLink,
    handleSendResetEmail,
  }
}
