/**
 * Sérialisation TSV du « Copier » de la comptabilité, robuste au collage tableur.
 *
 * Le presse-papier reçoit du texte séparé par des tabulations (colonnes) et des
 * retours ligne (lignes). Excel / Google Sheets appliquent au collage les règles
 * RFC 4180 : un guillemet `"` ouvre un « champ entre guillemets » qui absorbe les
 * tabulations et retours ligne suivants jusqu'au guillemet fermant. Un guillemet
 * non échappé dans un champ (ex. un contexte d'intervention qui commence par `"`,
 * cf. inter 21343) fait donc « avaler » les colonnes suivantes (matériel / CA / SST)
 * et parfois les lignes d'après, le tout aspiré dans une seule cellule.
 *
 * On échappe donc tout champ contenant `"` (ou une tabulation / un retour ligne, par
 * sécurité) : on l'entoure de guillemets et on double les guillemets internes.
 */
export const escapeTsvCell = (value: string): string =>
  /["\t\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value

/** Sérialise des lignes (cellules déjà en `string`) en TSV échappé, prêt pour le presse-papier. */
export const rowsToTsv = (rows: string[][]): string =>
  rows.map((row) => row.map(escapeTsvCell).join("\t")).join("\n")
