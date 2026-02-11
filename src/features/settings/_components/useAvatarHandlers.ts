"use client"

import * as React from "react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase-client"

interface UseAvatarHandlersParams {
  userId: string | undefined
  avatarUrl: string | null
  setAvatarUrl: (url: string | null) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
}

export function useAvatarHandlers({ userId, avatarUrl, setAvatarUrl, fileInputRef }: UseAvatarHandlersParams) {
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false)

  async function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !userId) return
    if (!file.type.startsWith('image/')) { toast.error('Le fichier doit etre une image'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error("L'image ne doit pas depasser 5MB"); return }

    setUploadingAvatar(true)
    try {
      const timestamp = Date.now()
      const extension = file.name.split('.').pop() || 'jpg'
      const filename = `user_${userId}_avatar_${timestamp}.${extension}`
      const storagePath = `users/${userId}/${filename}`

      if (avatarUrl) {
        try {
          const urlParts = avatarUrl.split('/')
          const oldPath = urlParts.slice(urlParts.indexOf('users')).join('/')
          await supabase.storage.from('documents').remove([oldPath])
        } catch (err) { console.warn('Erreur suppression ancienne photo:', err) }
      }

      const { error: uploadError } = await supabase.storage.from('documents').upload(storagePath, file, {
        contentType: file.type, cacheControl: '3600', upsert: true
      })
      if (uploadError) throw new Error(`Erreur upload: ${uploadError.message}`)

      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(storagePath)
      setAvatarUrl(publicUrl)
      toast.success('Photo de profil mise a jour')
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Impossible d'uploader la photo"
      console.error('Erreur upload photo:', e)
      toast.error(msg)
    } finally { setUploadingAvatar(false) }
  }

  async function handleRemoveAvatar() {
    if (!avatarUrl || !userId) return
    try {
      const urlParts = avatarUrl.split('/')
      const filename = urlParts[urlParts.length - 1]
      const storagePath = `users/${userId}/${filename}`
      await supabase.storage.from('documents').remove([storagePath])
      setAvatarUrl(null)
      toast.success('Photo de profil supprimee')
    } catch (e: unknown) {
      console.error('Erreur suppression photo:', e)
      toast.error('Impossible de supprimer la photo')
    }
  }

  return { uploadingAvatar, handleAvatarUpload, handleRemoveAvatar }
}
