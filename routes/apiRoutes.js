const express = require('express');
const router = express.Router();

const UserController = require('../controllers/userController');
const MessageController = require('../controllers/messageController');
const WellnessController = require('../controllers/wellnessController');
const QuizController = require('../controllers/quizController');

/**
 * Définition de la route de santé globale (Health Check)
 */
router.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'AnonyMots API is running' });
});

/**
 * Routes Utilisateurs
 */
router.post('/users', UserController.create);
router.get('/users/:username', UserController.getByUsername);

/**
 * Routes Messages Anonymes
 */
router.post('/messages', MessageController.create);
router.get('/messages/:username', MessageController.getByRecipient);
router.put('/messages/:id/guess', MessageController.guessSender);

/**
 * Routes Messages de Bien-être & Quiz
 */
router.get('/wellness-messages', WellnessController.getRandom);
router.post('/quiz', QuizController.submitQuiz);

module.exports = router;
