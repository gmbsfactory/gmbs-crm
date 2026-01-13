// Types
export * from "./types";

// Hook partagé
export { useDocumentManager, type UseDocumentManagerReturn } from "./useDocumentManager";

// Registry (composant principal)
export { DocumentManagerRegistry, DocumentManager } from "./DocumentManagerRegistry";

// Variantes individuelles (pour usage direct si nécessaire)
export { DocumentManagerLegacy } from "./variants/legacy";
export { DocumentManagerGmbs } from "./variants/docs_gmbs";

// Preview (composant partagé)
export { DocumentPreview } from "./DocumentPreview";
