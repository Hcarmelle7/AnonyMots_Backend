const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Chemin absolu de la base de données pour plus de sécurité
const dbPath = path.join(__dirname, '..', 'anonymots.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erreur lors de l\'ouverture de la base de données:', err.message);
  } else {
    console.log('Connecté à la base de données SQLite.');
    initializeDatabase();
  }
});

// Initialisation des tables
function initializeDatabase() {
  db.serialize(() => {
    // Table des utilisateurs
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) console.error('Erreur creation table users:', err.message);
    });

    // Table des messages
    db.run(`CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_username TEXT NOT NULL,
      content TEXT NOT NULL,
      has_clue BOOLEAN DEFAULT FALSE,
      clue TEXT,
      sender_name TEXT,
      is_guessed BOOLEAN DEFAULT FALSE,
      is_blocked BOOLEAN DEFAULT FALSE,
      guess_attempts INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (recipient_username) REFERENCES users (username)
    )`, (err) => {
      if (err) console.error('Erreur creation table messages:', err.message);
    });

    // Migrations : ajouter les nouvelles colonnes si la table existe déjà
    db.run(`ALTER TABLE messages ADD COLUMN sender_name TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Erreur migration sender_name:', err.message);
      }
    });
    db.run(`ALTER TABLE messages ADD COLUMN is_blocked BOOLEAN DEFAULT FALSE`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Erreur migration is_blocked:', err.message);
      }
    });
    db.run(`ALTER TABLE messages ADD COLUMN guess_attempts INTEGER DEFAULT 0`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Erreur migration guess_attempts:', err.message);
      }
    });

    // Suppression des tables statiques avant création pour éviter les doublons au redémarrage
    db.run("DROP TABLE IF EXISTS wellness_messages", (err) => {
      if (err) console.error('Erreur DROP wellness_messages:', err.message);
    });
    db.run("DROP TABLE IF EXISTS quiz_results", (err) => {
      if (err) console.error('Erreur DROP quiz_results:', err.message);
    });

    // Table des messages bienveillants
    db.run(`CREATE TABLE IF NOT EXISTS wellness_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      category TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) console.error('Erreur creation table wellness_messages:', err.message);
    });

    // Table des résultats de quiz
    db.run(`CREATE TABLE IF NOT EXISTS quiz_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mood_type TEXT NOT NULL,
      personalized_message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) console.error('Erreur creation table quiz_results:', err.message);
    });

    // Insertion des données de base
    insertInitialData();
  });
}

// Insertion des données initiales depuis les fichiers JSON
function insertInitialData() {
  try {
    // 1. Chargement et insertion des messages bienveillants
    const wellnessMessagesPath = path.join(__dirname, '..', 'data', 'wellness_messages.json');
    const wellnessMessages = JSON.parse(fs.readFileSync(wellnessMessagesPath, 'utf8'));

    wellnessMessages.forEach(msg => {
      db.run(`INSERT INTO wellness_messages (content, category) VALUES (?, ?)`, 
             [msg.content, msg.category], (err) => {
        if (err) console.log('Erreur insertion wellness:', err.message);
      });
    });

    // 2. Chargement et insertion des résultats de quiz
    const quizResultsPath = path.join(__dirname, '..', 'data', 'quiz_results.json');
    const quizResults = JSON.parse(fs.readFileSync(quizResultsPath, 'utf8'));

    quizResults.forEach(result => {
      db.run(`INSERT INTO quiz_results (mood_type, personalized_message) VALUES (?, ?)`, 
             [result.mood_type, result.personalized_message], (err) => {
        if (err) console.log('Erreur insertion quiz:', err.message);
      });
    });
    
    console.log(`Données initiales insérées avec succès (${wellnessMessages.length} citations, ${quizResults.length} humeurs).`);
  } catch (err) {
    console.error('Erreur lors du chargement des fichiers de données de base:', err.message);
  }
}

module.exports = db;
