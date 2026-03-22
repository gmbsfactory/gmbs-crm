'use strict';

const { cleanPhone, capitalizeFirstLetter } = require('./string-cleaner');

function extractNomPrenomStrict(nomPrenom) {
  const plain_nom = nomPrenom ? nomPrenom.trim() : '';
  if (!plain_nom) return { prenom: undefined, nom: undefined };

  let parts = plain_nom.split(/\s+/).filter(p => p.trim() !== '');
  const spaceCount = parts.length - 1;

  const particles = ['monsieur', 'mr', 'm', 'madame', 'mme', 'mlle'];
  const firstPartLower = parts[0] ? parts[0].toLowerCase() : '';

  if (spaceCount >= 2 && particles.includes(firstPartLower)) {
    parts = parts.slice(1);
    const newSpaceCount = parts.length - 1;
    if (newSpaceCount === 0) return { prenom: undefined, nom: plain_nom };
    else if (newSpaceCount === 1) return { prenom: parts[0], nom: plain_nom };
    else if (newSpaceCount === 2) return { prenom: parts[1], nom: parts[0] };
    else return { prenom: undefined, nom: plain_nom };
  }

  if (spaceCount === 0) return { prenom: undefined, nom: plain_nom };
  else if (spaceCount === 1) return { prenom: parts[0], nom: plain_nom };
  else if (spaceCount === 2) return { prenom: parts[1], nom: parts[0] };
  else return { prenom: undefined, nom: plain_nom };
}

/** @deprecated Utiliser extractNomPrenomStrict */
function extractPrenom(nomPrenom) {
  const { prenom } = extractNomPrenomStrict(nomPrenom);
  return prenom || null;
}

/** @deprecated Utiliser extractNomPrenomStrict */
function extractNom(nomPrenom) {
  const { nom } = extractNomPrenomStrict(nomPrenom);
  return nom || null;
}

function shouldInvertNames(prenom, nom) {
  const commonPrenoms = [
    'jean', 'pierre', 'marie', 'paul', 'jacques', 'michel', 'alain', 'philippe',
    'bernard', 'andr', 'alexandre', 'nicolas', 'christophe', 'francois', 'laurent',
    'thomas', 'david', 'olivier', 'vincent', 'sebastien', 'antoine', 'guillaume',
    'benjamin', 'julien', 'maxime', 'kevin', 'romain', 'alexis', 'cedric', 'fabien',
    'jeremy', 'mathieu', 'damien', 'florian', 'gregory', 'hugo', 'jordan', 'mickael',
    'nathan', 'quentin', 'simon', 'yann', 'adrien', 'arthur', 'axel', 'baptiste',
    'corentin', 'daniel', 'etienne', 'florent', 'gaetan', 'ivan', 'joffrey', 'kamel',
    'leo', 'lucas', 'marc', 'noel', 'pascal', 'raphael', 'sylvain', 'tristan',
    'valentin', 'william', 'yves', 'zacharie',
  ];

  const commonNoms = [
    'martin', 'bernard', 'dubois', 'thomas', 'robert', 'petit', 'durand', 'leroy',
    'moreau', 'simon', 'laurent', 'lefebvre', 'michel', 'garcia', 'david', 'bertrand',
    'roux', 'vincent', 'fournier', 'morel', 'girard', 'andre', 'lefevre', 'mercier',
    'dupont', 'lambert', 'bonnet', 'francois', 'martinez', 'legrand', 'garnier',
    'faure', 'roussel', 'blanc', 'guerin', 'muller', 'henry', 'rouger', 'nicolas',
    'perrin', 'morin', 'mathieu', 'clement', 'gauthier', 'dumont', 'lopez', 'fontaine',
    'chevalier', 'robin', 'masson', 'sanchez', 'gerard', 'nguyen', 'boyer', 'denis',
    'lucas', 'philippe', 'brun', 'rey', 'noel', 'giraud', 'blanchard', 'barre',
    'guillaume', 'lemaire',
  ];

  const prenomLower = prenom.toLowerCase();
  const nomLower = nom.toLowerCase();

  if (commonNoms.includes(prenomLower) && commonPrenoms.includes(nomLower)) return true;
  if (prenom.length > nom.length + 2) return true;
  if (prenomLower.includes('le ') || prenomLower.includes('de ') || prenomLower.includes('du ')) return true;

  const particles = ['le', 'de', 'du', 'la', 'les', 'des'];
  if (particles.includes(prenomLower)) return true;

  return false;
}

function extractSecondPhone(phoneValue) {
  if (!phoneValue || phoneValue.trim() === '') return null;
  const separators = ['/', '\\', '|', ' ou ', ' et ', ' - ', ' -'];
  for (const sep of separators) {
    if (phoneValue.includes(sep)) {
      const parts = phoneValue.split(sep);
      if (parts.length >= 2) return cleanPhone(parts[1].trim());
    }
  }
  return null;
}

function extractPrenomProprietaire(proprioValue) {
  if (!proprioValue || proprioValue.trim() === '') return null;
  const match = proprioValue.match(/M\.?\s+([A-Za-z]+)/);
  return match ? match[1] : null;
}

function extractNomProprietaire(proprioValue) {
  if (!proprioValue || proprioValue.trim() === '') return null;
  const parts = proprioValue.split(/\s+/);
  if (parts.length >= 3) return parts.slice(2).join(' ');
  return null;
}

function extractNomClient(locataireValue) {
  if (!locataireValue || locataireValue.trim() === '') return null;
  const parts = locataireValue.split(/\s+/);
  if (parts.length >= 3) return parts.slice(2).join(' ');
  return locataireValue;
}

function extractPrenomClient(locataireValue) {
  if (!locataireValue || locataireValue.trim() === '') return null;
  const parts = locataireValue.split(/\s+/);
  if (parts.length >= 2) return parts[1];
  return null;
}

function parsePersonName(fullName) {
  if (!fullName || typeof fullName !== 'string') return { firstname: null, lastname: null };

  let cleaned = fullName.trim();
  cleaned = cleaned.replace(/0[1-9](?:[\s.-]?\d{2}){4}/g, '');
  cleaned = cleaned.replace(/\+33[\s.-]?[1-9](?:[\s.-]?\d{2}){4}/g, '');
  cleaned = cleaned.replace(/\b(conjointe?|conjoint|tél\.?|téléphone|email|mail)\b/gi, '');
  cleaned = cleaned.replace(/\b(M\.|Mme|Mlle|Mr|Monsieur|Madame|Mademoiselle)\b/gi, '');
  cleaned = cleaned.replace(/[,:;\/]/g, ' ').replace(/\s+/g, ' ').trim();

  if (!cleaned) return { firstname: null, lastname: null };

  let words = cleaned.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return { firstname: null, lastname: null };

  const civilites = ['m', 'mme', 'mlle', 'mr', 'ms', 'dr'];
  if (words.length > 1 && civilites.includes(words[0].toLowerCase())) {
    words = words.slice(1);
  }

  if (words.length === 0) return { firstname: null, lastname: null };

  if (words.length === 1) {
    return { firstname: null, lastname: capitalizeFirstLetter(words[0]) };
  }

  const uppercaseWords = [];
  const lowercaseWords = [];
  words.forEach((w) => {
    if (w === w.toUpperCase() && w.length > 1) uppercaseWords.push(w);
    else lowercaseWords.push(w);
  });

  if (uppercaseWords.length > 0 && lowercaseWords.length > 0) {
    return {
      firstname: capitalizeFirstLetter(lowercaseWords.join(' ')),
      lastname: capitalizeFirstLetter(uppercaseWords.join(' ')),
    };
  }

  if (uppercaseWords.length === words.length && words.length >= 2) {
    return {
      firstname: capitalizeFirstLetter(words[0]),
      lastname: capitalizeFirstLetter(words.slice(1).join(' ')),
    };
  }

  return {
    firstname: capitalizeFirstLetter(words[0]),
    lastname: capitalizeFirstLetter(words.slice(1).join(' ')),
  };
}

module.exports = {
  extractNomPrenomStrict,
  shouldInvertNames,
  extractPrenom,
  extractNom,
  extractSecondPhone,
  extractPrenomProprietaire,
  extractNomProprietaire,
  extractNomClient,
  extractPrenomClient,
  parsePersonName,
};
