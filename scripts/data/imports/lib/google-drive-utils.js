/**
 * Utilitaires pour Google Drive
 * Fonctions communes pour télécharger et manipuler des fichiers depuis Google Drive
 */

/**
 * Télécharge un fichier depuis Google Drive et le convertit en base64
 * 
 * @param {Object} drive - Instance Google Drive API (google.drive)
 * @param {string} fileId - ID du fichier Google Drive à télécharger
 * @returns {Promise<string>} Contenu du fichier encodé en base64
 * @throws {Error} Si le téléchargement échoue
 */
async function downloadFileFromDrive(drive, fileId) {
  try {
    // Télécharger le fichier depuis Google Drive
    const response = await drive.files.get(
      { fileId: fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );
    
    // Convertir le buffer en base64
    const buffer = Buffer.from(response.data);
    const base64Content = buffer.toString('base64');
    
    return base64Content;
  } catch (error) {
    throw new Error(`Erreur lors du téléchargement depuis Google Drive: ${error.message}`);
  }
}

module.exports = {
  downloadFileFromDrive
};

