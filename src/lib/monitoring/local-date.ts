/**
 * Sérialisation de date pour les RPC de monitoring.
 *
 * Les utilisateurs sont en Europe/Paris ; les RPC bucketent désormais en
 * Europe/Paris (`SET timezone` sur les fonctions, migration 99038). Côté JS, il
 * faut donc envoyer les bornes `date` exprimées en **jour Paris**, pas en UTC.
 *
 * `Date.toISOString().split('T')[0]` renvoie la date **UTC** : pour un minuit
 * Paris (UTC+1/+2), elle tombe sur le jour précédent → chevauchement de jours.
 * On épingle explicitement `timeZone: 'Europe/Paris'` pour être robuste aussi
 * bien côté client que côté serveur (Vercel = UTC).
 */
export function toParisDateStr(d: Date): string {
  // 'sv-SE' produit le format ISO 'YYYY-MM-DD'.
  return d.toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" })
}
