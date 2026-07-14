const UserModel = require('../models/userModel');

/**
 * Contrôleur pour la gestion des utilisateurs (Couche Contrôleur)
 */
const UserController = {
  /**
   * Crée un nouvel utilisateur.
   * Route : POST /api/users
   */
  create: (req, res) => {
    const { username } = req.body;
    
    if (!username || username.trim().length === 0) {
      return res.status(400).json({ error: 'Le nom d\'utilisateur est requis' });
    }

    const cleanUsername = username.trim().toLowerCase();
    
    // Étape 1 : Validation de sécurité (Regex)
    // - On exige entre 3 et 20 caractères.
    // - On autorise uniquement lettres minuscules, chiffres, tirets (-) et tirets bas (_).
    // Cela protège contre le XSS, évite d'avoir des caractères d'URL réservés qui planteraient
    // le routage du frontend, et garde les URL propres.
    const usernameRegex = /^[a-z0-9_-]{3,20}$/;
    if (!usernameRegex.test(cleanUsername)) {
      return res.status(400).json({ 
        error: 'Le pseudonyme doit faire entre 3 et 20 caractères et ne contenir que des lettres, chiffres, tirets (-) ou tirets bas (_).' 
      });
    }

    // Étape 2 : Création récursive avec gestion de l'unicité
    // Si le pseudo est pris, on lui ajoute un suffixe aléatoire de 4 chiffres.
    // Pour ne pas dépasser la limite de 20 caractères, on tronque le pseudo d'origine à 15 caractères.
    const tryCreateUser = (baseUsername, attempt = 0) => {
      const targetUsername = attempt === 0 
        ? baseUsername 
        : `${baseUsername.slice(0, 15)}_${Math.floor(1000 + Math.random() * 9000)}`;

      UserModel.create(targetUsername, (err, lastID) => {
        if (err) {
          // Si le pseudo généré existe déjà, on retente récursivement avec un nouveau nombre
          if (err.message.includes('UNIQUE constraint failed') && attempt < 5) {
            return tryCreateUser(baseUsername, attempt + 1);
          }
          console.error(`[DB ERROR] Erreur lors de la création de l'utilisateur ${targetUsername}:`, err.message);
          return res.status(500).json({ error: 'Erreur lors de la création de l\'utilisateur' });
        }
        
        // Utilisateur créé avec succès
        res.status(201).json({ 
          id: lastID, 
          username: targetUsername,
          link: `${req.protocol}://${req.get('host')}/send/${targetUsername}`
        });
      });
    };

    tryCreateUser(cleanUsername);
  },

  /**
   * Récupère un utilisateur par son nom d'utilisateur.
   * Route : GET /api/users/:username
   */
  getByUsername: (req, res) => {
    const { username } = req.params;
    
    UserModel.getByUsername(username.toLowerCase(), (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Erreur lors de la récupération de l\'utilisateur' });
      }
      
      if (!row) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }
      
      res.json(row);
    });
  }
};

module.exports = UserController;
