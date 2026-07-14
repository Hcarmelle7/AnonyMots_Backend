const db = require('../config/db');

/**
 * Modèle de données pour la gestion des messages anonymes (Couche Modèle)
 */
const MessageModel = {
  /**
   * Enregistre un nouveau message.
   * @param {object} params - Paramètres du message (recipient, content, hasClue, clue, senderName, isBlocked)
   * @param {function} callback - Callback (err, lastID)
   */
  create: ({ recipient, content, hasClue, clue, senderName, isBlocked }, callback) => {
    db.run(
      `INSERT INTO messages (recipient_username, content, has_clue, clue, sender_name, is_blocked) VALUES (?, ?, ?, ?, ?, ?)`, 
      [recipient, content, hasClue, clue, senderName, isBlocked],
      function(err) {
        callback(err, this ? this.lastID : null);
      }
    );
  },

  /**
   * Récupère la liste des messages reçus par un utilisateur (en excluant les messages bloqués par la modération).
   * Renvoie sender_name uniquement si l'expéditeur a été correctement deviné.
   * @param {string} recipient - Pseudonyme du destinataire
   * @param {function} callback - Callback (err, rows)
   */
  getByRecipient: (recipient, callback) => {
    db.all(
      `SELECT id, recipient_username, content, has_clue, clue, is_guessed, created_at, 
              CASE WHEN is_guessed = 1 THEN sender_name ELSE NULL END as sender_name 
       FROM messages 
       WHERE recipient_username = ? AND (is_blocked = FALSE OR is_blocked IS NULL) 
       ORDER BY created_at DESC`, 
      [recipient],
      (err, rows) => {
        callback(err, rows);
      }
    );
  },

  getByIdAndGaming: (id, callback) => {
    db.get(
      `SELECT id, sender_name, is_guessed, has_clue, guess_attempts FROM messages WHERE id = ? AND has_clue = TRUE`, 
      [id], 
      (err, row) => {
        callback(err, row);
      }
    );
  },

  /**
   * Incrémente le nombre de tentatives de devinette d'un message.
   * @param {number|string} id - Identifiant du message
   * @param {function} callback - Callback (err)
   */
  incrementGuessAttempts: (id, callback) => {
    db.run(
      `UPDATE messages SET guess_attempts = guess_attempts + 1 WHERE id = ?`,
      [id],
      function(err) {
        callback(err);
      }
    );
  },

  /**
   * Marque le message comme deviné.
   * @param {number|string} id - Identifiant du message
   * @param {function} callback - Callback (err)
   */
  markAsGuessed: (id, callback) => {
    db.run(`UPDATE messages SET is_guessed = TRUE WHERE id = ?`, [id], function(err) {
      callback(err);
    });
  }
};

module.exports = MessageModel;
