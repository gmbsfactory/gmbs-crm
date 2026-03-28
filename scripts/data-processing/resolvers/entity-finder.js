'use strict';

const { artisansApi } = require('../../../src/lib/api/v2');
const { createClient } = require('@supabase/supabase-js');

class EntityFinder {
  constructor({ sstSearchDelay = 50, sstSearchTimeout = 5000, sstMaxVariants = 5, logParsingErrorFn = null } = {}) {
    this.lastSSTSearchTime = 0;
    this.sstSearchDelay = sstSearchDelay;
    this.sstSearchTimeout = sstSearchTimeout;
    this.sstMaxVariants = sstMaxVariants;
    this.logParsingError = logParsingErrorFn || (() => {});
  }

  async findOrCreateTenant(tenantInfo) {
    const { tenantsApi } = require('../../../src/lib/api/v2');

    if (!tenantInfo.email && !tenantInfo.telephone) {
      console.log('⚠️ Tenant sans email ni téléphone, impossible de créer');
      return null;
    }

    try {
      if (tenantInfo.email) {
        const existingByEmail = await tenantsApi.searchByEmail(tenantInfo.email);
        if (existingByEmail && existingByEmail.length > 0) {
          // console.log(`✅ Tenant trouvé par email: ${tenantInfo.email} (ID: ${existingByEmail[0].id})`);
          return existingByEmail[0].id;
        }
      }

      if (tenantInfo.telephone) {
        const existingByPhone = await tenantsApi.searchByPhone(tenantInfo.telephone);
        if (existingByPhone && existingByPhone.length > 0) {
          // console.log(`✅ Tenant trouvé par téléphone: ${tenantInfo.telephone} (ID: ${existingByPhone[0].id})`);
          return existingByPhone[0].id;
        }
      }

      const tenantData = {
        plain_nom_client: tenantInfo.plain_nom_client,
        firstname: tenantInfo.firstname,
        lastname: tenantInfo.lastname,
        email: tenantInfo.email,
        telephone: tenantInfo.telephone,
        telephone2: tenantInfo.telephone2,
      };

      const created = await tenantsApi.create(tenantData);
      const name = [tenantInfo.firstname, tenantInfo.lastname].filter(Boolean).join(' ') || 'Sans nom';
      // console.log(`🆕 Tenant créé: ${name} (ID: ${created.id})`);
      return created.id;
    } catch (error) {
      console.error('Erreur lors de la recherche/création du tenant:', error);
      return null;
    }
  }

  async findOrCreateOwner(ownerInfo) {
    const { ownersApi } = require('../../../src/lib/api/v2');

    if (!ownerInfo.telephone) {
      console.log('⚠️ Owner sans téléphone, impossible de créer');
      return null;
    }

    try {
      const existingByPhone = await ownersApi.searchByPhone(ownerInfo.telephone);
      if (existingByPhone && existingByPhone.length > 0) {
        // console.log(`✅ Owner trouvé par téléphone: ${ownerInfo.telephone} (ID: ${existingByPhone[0].id})`);
        return existingByPhone[0].id;
      }

      const ownerData = {
        plain_nom_facturation: ownerInfo.plain_nom_facturation,
        owner_firstname: ownerInfo.firstname,
        owner_lastname: ownerInfo.lastname,
        telephone: ownerInfo.telephone,
      };

      const created = await ownersApi.create(ownerData);
      const name = [ownerInfo.firstname, ownerInfo.lastname].filter(Boolean).join(' ') || 'Sans nom';
      // console.log(`🆕 Owner créé: ${name} (ID: ${created.id})`);
      return created.id;
    } catch (error) {
      console.error('Erreur lors de la recherche/création du owner:', error);
      return null;
    }
  }


  async findArtisanSST(sstName, idInter = null, csvRow = null, lineNumber = null, warningsAccumulator = null) {
    if (!sstName || !sstName.trim()) return null;

    sstName = sstName.trim();

    const now = Date.now();
    const timeSinceLastSearch = now - this.lastSSTSearchTime;
    if (timeSinceLastSearch < this.sstSearchDelay) {
      await new Promise(resolve => setTimeout(resolve, this.sstSearchDelay - timeSinceLastSearch));
    }
    this.lastSSTSearchTime = Date.now();

    let cleanSstName = sstName.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    cleanSstName = cleanSstName
      .replace(/\s*\(?\s*archiv[eé]\s*\)?/gi, '')
      .replace(/\s+IDF\s*$/i, '')
      .replace(/\s*\/\s*$/, '')
      .replace(/\s+\d{2,3}\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    let supabaseClient = null;

    if (supabaseUrl && supabaseServiceKey) {
      supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
      });
    }

    try {
      let results = await artisansApi.searchByPlainNom(cleanSstName, { limit: 1 }, supabaseClient);

      if (results.data && results.data.length > 0) {
        const searchNormalized = cleanSstName.toLowerCase().replace(/\s+/g, ' ').trim();
        let found = null;
        let bestScore = 0;

        for (const artisan of results.data) {
          const artisanPlainNom = (artisan.plain_nom || `${artisan.prenom || ''} ${artisan.nom || ''}`).toLowerCase().replace(/\s+/g, ' ').trim();
          const artisanFullName = `${(artisan.prenom || '').toLowerCase()} ${(artisan.nom || '').toLowerCase()}`.trim();

          let score = 0;
          if (artisanPlainNom === searchNormalized || artisanFullName === searchNormalized) {
            score = 100;
          } else if (artisanPlainNom.includes(searchNormalized) || searchNormalized.includes(artisanPlainNom)) {
            score = 80;
          } else {
            const searchWords = searchNormalized.split(' ').filter(w => w.length > 2);
            const artisanWords = artisanPlainNom.split(' ').filter(w => w.length > 2);
            const matchingWords = searchWords.filter(word => artisanWords.some(aw => aw.includes(word) || word.includes(aw)));
            if (matchingWords.length > 0) {
              score = (matchingWords.length / Math.max(searchWords.length, artisanWords.length)) * 60;
            }
          }

          if (score > bestScore) {
            bestScore = score;
            found = artisan;
          }
        }

        if (found && bestScore >= 60) {
          if (bestScore < 100) {
            // console.log(`✅ [ARTISAN-SST] Trouvé (score: ${bestScore.toFixed(0)}): ${found.prenom} ${found.nom} (ID: ${found.id})`);
          }
          return found.id;
        }
      }

      if (cleanSstName.includes('/') || cleanSstName.includes(' / ')) {
        const separator = cleanSstName.includes(' / ') ? ' / ' : '/';
        const parts = cleanSstName.split(separator);

        for (let partIndex = 0; partIndex < Math.min(parts.length, 2); partIndex++) {
          const part = parts[partIndex].trim();
          if (part && part.length > 2) {
            const cleanPart = part.replace(/\s+\d{2,3}(?:\s+\d{2,3})?$/, '').trim();
            if (cleanPart && cleanPart.length > 2) {
              await new Promise(resolve => setTimeout(resolve, this.sstSearchDelay));
              try {
                let results = await artisansApi.searchByName(cleanPart, { limit: 5 });
                if (results.data && results.data.length > 0) {
                  const searchNormalized = cleanPart.toLowerCase().replace(/\s+/g, ' ').trim();
                  let found = results.data[0];
                  for (const artisan of results.data) {
                    const artisanName = (artisan.plain_nom || `${artisan.prenom || ''} ${artisan.nom || ''}`).toLowerCase().replace(/\s+/g, ' ').trim();
                    if (artisanName === searchNormalized || artisanName.includes(searchNormalized) || searchNormalized.includes(artisanName)) {
                      found = artisan;
                      break;
                    }
                  }
                  // console.log(`✅ [ARTISAN-SST] Trouvé (composite "${cleanPart}"): ${found.prenom} ${found.nom} (ID: ${found.id})`);
                  return found.id;
                }
              } catch (searchError) {
                continue;
              }
            }
          }
        }
      }

      const logId = idInter || 'N/A';
      const reason = `Artisan SST non trouvé: "${sstName}"`;
      this.logParsingError(logId, reason, csvRow, lineNumber);
      console.log(`❌ [ARTISAN-SST] Aucun artisan trouvé pour "${sstName}" (id_inter: ${logId})`);
      if (warningsAccumulator) {
        warningsAccumulator.push({ type: 'artisan_sst', reason: `Artisan SST non trouvé: "${sstName}" (id_inter: ${logId})` });
      }
      return null;
    } catch (error) {
      if (error.message && (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('timeout'))) {
        console.warn(`⚠️ [ARTISAN-SST] Erreur réseau pour "${sstName}", retry dans 1s...`);
        try {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const retryResults = await artisansApi.searchByPlainNom(cleanSstName, { limit: 1 }, supabaseClient);
          if (retryResults.data && retryResults.data.length > 0) {
            const found = retryResults.data[0];
            console.log(`✅ [ARTISAN-SST] Trouvé après retry: ${found.prenom} ${found.nom} (ID: ${found.id})`);
            return found.id;
          }
        } catch (retryError) {
          console.error(`💥 [ARTISAN-SST] Erreur réseau persistante pour "${sstName}": ${retryError.message}`);
        }
      } else {
        console.error(`💥 [ARTISAN-SST] Erreur recherche "${sstName}": ${error.message}`);
      }

      const logId = idInter || 'N/A';
      const reason = `Artisan SST non trouvé (erreur): "${sstName}"`;
      this.logParsingError(logId, reason, csvRow, lineNumber);
      return null;
    }
  }
}

module.exports = { EntityFinder };
