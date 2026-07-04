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
    
    UserModel.create(cleanUsername, (err, lastID) => {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({ error: 'Ce nom d\'utilisateur existe déjà' });
        }
        return res.status(500).json({ error: 'Erreur lors de la création de l\'utilisateur' });
      }
      
      res.status(201).json({ 
        id: lastID, 
        username: cleanUsername,
        link: `${req.protocol}://${req.get('host')}/send/${cleanUsername}`
      });
    });
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
