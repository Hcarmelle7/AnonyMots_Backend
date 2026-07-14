const db = require('../config/db');

/**
 * Modèle de données pour la gestion des quiz bien-être (Couche Modèle)
 */
const QuizModel = {
  /**
   * Récupère un résultat de quiz aléatoire correspondant à l'humeur spécifiée.
   * @param {string} moodType - Le type d'humeur
   * @param {function} callback - Callback (err, row)
   */
  getRandomResultByMood: (moodType, callback) => {
    db.get(
      `SELECT * FROM quiz_results WHERE mood_type = ? ORDER BY RANDOM() LIMIT 1`, 
      [moodType], 
      (err, row) => {
        callback(err, row);
      }
    );
  }
};

module.exports = QuizModel;
