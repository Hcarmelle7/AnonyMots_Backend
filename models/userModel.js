const db = require('../config/db');

/**
 * Modèle de données pour la gestion des utilisateurs (Couche Modèle)
 */
const UserModel = {
  /**
   * Crée un nouvel utilisateur.
   * @param {string} username - Le pseudonyme de l'utilisateur
   * @param {function} callback - Callback (err, lastID)
   */
  create: (username, callback) => {
    db.run(`INSERT INTO users (username) VALUES (?)`, [username], function(err) {
      // "this" contient lastID si l'opération a réussi
      callback(err, this ? this.lastID : null);
    });
  },

  /**
   * Récupère un utilisateur par son pseudonyme.
   * @param {string} username - Le pseudonyme recherché
   * @param {function} callback - Callback (err, row)
   */
  getByUsername: (username, callback) => {
    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, row) => {
      callback(err, row);
    });
  }
};

module.exports = UserModel;
