"use client";

import React from "react";
import { DocumentManagerLegacy } from "./variants/legacy";
import { DocumentManagerGmbs } from "./variants/docs_gmbs";
import type { DocumentManagerProps } from "./types";

/**
 * DocumentManagerRegistry - Sélecteur de variante pour le gestionnaire de documents
 * 
 * Ce composant agit comme un registry/factory qui sélectionne la bonne implémentation
 * du gestionnaire de documents en fonction de la prop `variant`.
 * 
 * Variantes disponibles:
 * - "legacy": Design tableau classique avec boutons Importer/Annuler
 * - "docs_gmbs": Design avec lignes pré-créées par type et import direct (par défaut)
 * 
 * @example
 * // Utilisation avec la variante par défaut (docs_gmbs)
 * <DocumentManagerRegistry
 *   entityType="intervention"
 *   entityId={intervention.id}
 *   kinds={INTERVENTION_DOCUMENT_KINDS}
 * />
 * 
 * @example
 * // Utilisation avec la variante legacy
 * <DocumentManagerRegistry
 *   variant="legacy"
 *   entityType="artisan"
 *   entityId={artisan.id}
 *   kinds={ARTISAN_DOCUMENT_KINDS}
 * />
 */
export function DocumentManagerRegistry({
  variant = "docs_gmbs",
  entityType,
  entityId,
  kinds,
  accept,
  multiple = true,
  onChange,
  currentUser,
}: DocumentManagerProps) {
  // Props communes à passer à la variante sélectionnée
  const commonProps = {
    entityType,
    entityId,
    kinds,
    accept,
    multiple,
    onChange,
    currentUser,
  };

  // Sélection de la variante
  switch (variant) {
    case "legacy":
      return <DocumentManagerLegacy {...commonProps} />;
    
    case "docs_gmbs":
    default:
      return <DocumentManagerGmbs {...commonProps} />;
  }
}

// Alias pour rétrocompatibilité
export const DocumentManager = DocumentManagerRegistry;

export default DocumentManagerRegistry;
