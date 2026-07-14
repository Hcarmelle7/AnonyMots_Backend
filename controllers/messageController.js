const MessageModel = require('../models/messageModel');
const UserModel = require('../models/userModel');
const { isMalicious } = require('../utils/moderation');

/**
 * Contrôleur pour la gestion des messages anonymes (Couche Contrôleur)
 */
const MessageController = {
  /**
   * Envoie un message anonyme (avec modération et mode gaming facultatif).
   * Route : POST /api/messages
   */
  create: (req, res) => {
    const { recipient, content, hasClue, clue, senderName } = req.body;
    
    if (!recipient || !content) {
      return res.status(400).json({ error: 'Le destinataire et le contenu sont requis' });
    }

    if (content.length > 500) {
      return res.status(400).json({ error: 'Le message ne peut pas dépasser 500 caractères' });
    }

    // En mode gaming, le prénom secret est obligatoire
    if (hasClue && (!senderName || senderName.trim().length === 0)) {
      return res.status(400).json({ error: 'Le prénom secret est obligatoire en mode gaming.' });
    }

    // Étape 2 : Limitation de taille sur les champs Gaming (sécurité stockage)
    if (hasClue) {
      if (clue && clue.length > 100) {
        return res.status(400).json({ error: "L'indice ne peut pas dépasser 100 caractères." });
      }
      if (senderName && senderName.trim().length > 30) {
        return res.status(400).json({ error: "Le prénom secret ne peut pas dépasser 30 caractères." });
      }
    }

    // Modération silencieuse : vérifier si le message est malveillant
    const blocked = isMalicious(content) || (clue && isMalicious(clue));
    if (blocked) {
      // On log en interne mais on répond comme si l'envoi était réussi (silencieux)
      console.warn(`[MODERATION] Message bloqué pour ${recipient} : "${content.substring(0, 60)}..."`);
    }

    // Vérifier que l'utilisateur destinataire existe
    UserModel.getByUsername(recipient.toLowerCase(), (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Erreur lors de la vérification de l\'utilisateur' });
      }
      
      if (!user) {
        return res.status(404).json({ error: 'Utilisateur destinataire non trouvé' });
      }

      // Insérer le message
      MessageModel.create({
        recipient: recipient.toLowerCase(),
        content,
        hasClue: hasClue || false,
        clue: clue || null,
        senderName: hasClue ? senderName.trim().toLowerCase() : null,
        isBlocked: blocked ? 1 : 0
      }, (err, lastID) => {
        if (err) {
          return res.status(500).json({ error: 'Erreur lors de l\'envoi du message' });
        }
        
        res.status(201).json({ 
          id: lastID,
          message: 'Message envoyé avec succès'
        });
      });
    });
  },

  /**
   * Récupère les messages reçus par un utilisateur.
   * Route : GET /api/messages/:username
   */
  getByRecipient: (req, res) => {
    const { username } = req.params;
    
    MessageModel.getByRecipient(username.toLowerCase(), (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Erreur lors de la récupération des messages' });
      }
      
      res.json(rows);
    });
  },

  /**
   * Tente de deviner l'expéditeur d'un message en mode gaming.
   * Route : PUT /api/messages/:id/guess
   */
  guessSender: (req, res) => {
    const { id } = req.params;
    const { guess } = req.body;

    if (!guess || guess.trim().length === 0) {
      return res.status(400).json({ error: 'Il faut saisir un prénom pour deviner.' });
    }

    // Récupérer le message avec le sender_name secret
    MessageModel.getByIdAndGaming(id, (err, msg) => {
      if (err) {
        return res.status(500).json({ error: 'Erreur lors de la récupération du message' });
      }
      
      if (!msg) {
        return res.status(404).json({ error: 'Message non trouvé ou sans mode gaming actif.' });
      }

      if (msg.is_guessed) {
        return res.status(409).json({ error: 'Ce message a déjà été deviné !' });
      }

      const normalizedGuess = guess.trim().toLowerCase();
      const normalizedSenderName = (msg.sender_name || '').trim().toLowerCase();

      if (normalizedGuess !== normalizedSenderName) {
        // Mauvaise réponse — on ne révèle pas le nom
        return res.status(200).json({ success: false, message: 'Ce n\'est pas le bon prénom. Réessaie !' });
      }

      // Bonne réponse → marquer comme deviné
      MessageModel.markAsGuessed(id, (err) => {
        if (err) {
          return res.status(500).json({ error: 'Erreur lors de la mise à jour du message' });
        }
        
        res.json({ 
          success: true, 
          message: 'Bravo ! Tu as trouvé !', 
          points: 10, 
          senderName: msg.sender_name 
        });
      });
    });
  }
};

module.exports = MessageController;
