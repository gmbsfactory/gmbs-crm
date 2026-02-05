import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Nexflow CRM - La plateforme qui transforme votre gestion client',
  description: 'Nexflow CRM centralise vos clients, interventions et ventes. Solution intuitive pour le BTP, commerce, services et plus encore.',
  keywords: 'CRM, gestion client, BTP, commerce, services, interventions, devis, facturation',
  authors: [{ name: 'Nexflow' }],
  openGraph: {
    title: 'Nexflow CRM - Propulsez votre croissance',
    description: 'Le CRM qui centralise vos clients, ventes et interventions. Essai gratuit 14 jours.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  )
}
