const QuizModel = require('../models/quizModel');

/**
 * Contrôleur pour la gestion des quiz bien-être (Couche Contrôleur)
 */
const QuizController = {
  /**
   * Soumet un quiz et récupère un message personnalisé en fonction du mood.
   * Route : POST /api/quiz
   */
  submitQuiz: (req, res) => {
    const { mood, needs } = req.body;
    
    if (!mood) {
      return res.status(400).json({ error: 'L\'humeur est requise' });
    }

    const moodType = mood.toLowerCase();
    
    QuizModel.getRandomResultByMood(moodType, (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Erreur lors de la récupération du message personnalisé' });
      }
      
      if (!row) {
        // Message par défaut si aucun message spécifique n'est trouvé
        row = {
          mood_type: moodType,
          personalized_message: "Merci d'avoir pris le temps de réfléchir à votre bien-être. Rappelez-vous que chaque jour est une nouvelle opportunité de prendre soin de vous."
        };
      }
      
      res.json(row);
    });
  }
};

module.exports = QuizController;
