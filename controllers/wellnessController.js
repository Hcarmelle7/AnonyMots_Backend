const WellnessModel = require('../models/wellnessModel');

/**
 * Contrôleur pour la gestion des citations bienveillantes (Couche Contrôleur)
 */
const WellnessController = {
  /**
   * Récupère des messages bienveillants aléatoires.
   * Route : GET /api/wellness-messages
   */
  getRandom: (req, res) => {
    const { category } = req.query;
    
    WellnessModel.getRandom(category, (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Erreur lors de la récupération des messages bienveillants' });
      }
      
      res.json(rows);
    });
  }
};

module.exports = WellnessController;
