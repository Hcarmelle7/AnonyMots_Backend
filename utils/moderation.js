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
 * Cette fonction permet de détecter si un message contient des mots insultants ou inappropriés.
 * Pour éviter de bloquer des mots tout à fait normaux qui contiennent des morceaux de mots interdits
 * (par exemple : bloquer "annuler" à cause de "nul", ou "violette" à cause de "viol"),
 * nous utilisons des expressions régulières avec des bordures de mots (\b).
 * De cette façon, un mot interdit n'est bloqué que s'il apparaît de manière isolée dans la phrase.
 */
function isMalicious(text) {
  if (!text) return false;
  
  // Étape 1 : On nettoie le texte de l'utilisateur pour faciliter la comparaison.
  // On passe tout en minuscules, on retire les accents et on remplace la ponctuation par des espaces.
  const normalized = text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');
  
  // Étape 2 : On vérifie chaque mot interdit de notre liste noire.
  return BLOCKED_WORDS.some(word => {
    // On nettoie également le mot interdit de la même façon pour être sûr que la comparaison soit juste.
    const normalizedWord = word.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ').trim();
    
    // Si après nettoyage, le mot interdit est vide, on l'ignore pour ne pas tout bloquer.
    if (!normalizedWord) return false;
    
    // Étape 3 : On prépare le mot pour l'expression régulière en échappant les caractères spéciaux.
    // Cela évite que des caractères comme * ou ? ne perturbent la recherche.
    const escapedWord = normalizedWord.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    
    // Étape 4 : On utilise le symbole \b pour chercher uniquement des mots entiers.
    // \b garantit que le mot n'est pas "collé" à d'autres lettres.
    const regex = new RegExp(`\\b${escapedWord}\\b`);
    
    return regex.test(normalized);
  });
}

module.exports = {
  isMalicious
};
