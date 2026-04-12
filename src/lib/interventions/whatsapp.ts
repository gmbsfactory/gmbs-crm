import { toast } from "sonner"
import { generateDevisWhatsAppText, generateInterventionWhatsAppText, encodeWhatsAppUrl } from "@/lib/email-templates/intervention-emails"

/**
 * Formate un numéro de téléphone pour WhatsApp (format international).
 * Convertit les numéros français (0x) en +33x.
 */
export function formatPhoneForWhatsApp(phone: string): string {
  if (!phone) return ''

  const cleanPhone = phone.replace(/[\s\-\.\(\)]/g, '')

  return cleanPhone.startsWith('0')
    ? `+33${cleanPhone.slice(1)}`
    : cleanPhone.startsWith('+')
      ? cleanPhone
      : `+33${cleanPhone}`
}

/**
 * Ouvre WhatsApp avec un message pré-rempli.
 * Sur mobile : utilise le protocole whatsapp://
 * Sur desktop : ouvre une fenêtre centrée.
 */
export function openWhatsApp(params: {
  emailType: 'devis' | 'intervention'
  artisanId: string
  artisanPhone: string
  generateEmailTemplateData: (artisanId: string) => any
}) {
  const { emailType, artisanId, artisanPhone, generateEmailTemplateData } = params

  if (!artisanId) {
    toast.error('Artisan non sélectionné')
    return
  }

  if (!artisanPhone || artisanPhone.trim() === '') {
    toast.error('Numéro de téléphone de l\'artisan manquant')
    return
  }

  const templateData = generateEmailTemplateData(artisanId)

  const whatsappMessage = emailType === 'devis'
    ? generateDevisWhatsAppText(templateData)
    : generateInterventionWhatsAppText(templateData)

  const formattedPhone = formatPhoneForWhatsApp(artisanPhone)

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

  if (isMobile) {
    const whatsappUrl = `whatsapp://send?phone=${formattedPhone}&text=${encodeURIComponent(whatsappMessage)}`
    window.location.href = whatsappUrl
  } else {
    const whatsappUrl = encodeWhatsAppUrl(formattedPhone, whatsappMessage)
    const popupWidth = 780
    const popupHeight = 910
    const left = Math.round((window.screen.width - popupWidth) / 2)
    const top = Math.round((window.screen.height - popupHeight) / 2)
    window.open(
      whatsappUrl,
      '_blank',
      `width=${popupWidth},height=${popupHeight},left=${left},top=${top},resizable=yes,scrollbars=yes`
    )
  }
}
