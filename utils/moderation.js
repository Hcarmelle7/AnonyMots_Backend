const path = require('path');
const fs = require('fs');

// Chargement de la liste de mots malveillants pour la modération
const blockedWordsPath = path.join(__dirname, '..', 'data', 'blocked_words.json');
let BLOCKED_WORDS = [];

try {
  BLOCKED_WORDS = JSON.parse(fs.readFileSync(blockedWordsPath, 'utf8'));
} catch (err) {
  console.error('Erreur chargement blocked_words.json:', err.message);
}

/**
 * Vérifie si un texte contient des mots/expressions malveillants.
 * @param {string} text - Le contenu du message à vérifier
 * @returns {boolean} true si le message est malveillant
 */
function isMalicious(text) {
  if (!text) return false;
  
  const normalized = text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // supprimer les accents
    .replace(/[^a-z0-9\s]/g, ' ');                   // garder uniquement lettres, chiffres, espaces
  
  return BLOCKED_WORDS.some(word => {
    const normalizedWord = word.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ');
    return normalized.includes(normalizedWord);
  });
}

module.exports = {
  isMalicious
};
