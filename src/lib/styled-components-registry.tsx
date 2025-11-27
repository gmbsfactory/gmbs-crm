'use client'

import React from 'react'

/**
 * Registry simplifié pour styled-components avec Next.js App Router
 * 
 * Note: La configuration `compiler: { styledComponents: true }` dans next.config.mjs
 * gère déjà le SSR des styles. Ce composant est conservé pour la compatibilité
 * mais ne fait plus de manipulation DOM qui pourrait interférer avec React.
 * 
 * L'ancienne implémentation avec ServerStyleSheet et clearTag() causait des erreurs
 * "Failed to execute 'removeChild' on 'Node'" lors de la fermeture des modals
 * car clearTag() supprimait des nœuds DOM que React essayait ensuite de supprimer.
 */
export default function StyledComponentsRegistry({
  children,
}: {
  children: React.ReactNode
}) {
  // Simplement rendre les children - Next.js gère le SSR via le compiler
  return <>{children}</>
}

