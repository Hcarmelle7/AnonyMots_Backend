const db = require('../config/db');

/**
 * Modèle de données pour la gestion des citations bienveillantes (Couche Modèle)
 */
const WellnessModel = {
  /**
   * Récupère jusqu'à 5 messages bienveillants aléatoires (éventuellement filtrés par catégorie).
   * @param {string} category - Catégorie de filtrage (optionnel)
   * @param {function} callback - Callback (err, rows)
   */
  getRandom: (category, callback) => {
    let query = `SELECT * FROM wellness_messages`;
    let params = [];
    
    if (category) {
      query += ` WHERE category = ?`;
      params.push(category);
    }
    
    query += ` ORDER BY RANDOM() LIMIT 5`;
    
    db.all(query, params, (err, rows) => {
      callback(err, rows);
    });
  }
};

module.exports = WellnessModel;
