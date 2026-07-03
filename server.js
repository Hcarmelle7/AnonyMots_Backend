const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

// Chargement de la liste de mots malveillants pour la modération
const blockedWordsPath = path.join(__dirname, 'data', 'blocked_words.json');
const BLOCKED_WORDS = JSON.parse(fs.readFileSync(blockedWordsPath, 'utf8'));

/**
 * Vérifie si un texte contient des mots/expressions malveillants.
 * @param {string} text - Le contenu du message à vérifier
 * @returns {boolean} true si le message est malveillant
 */
function isMalicious(text) {
  const normalized = text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // supprimer les accents
    .replace(/[^a-z0-9\s]/g, ' ');                   // garder uniquement lettres, chiffres, espaces
  
  return BLOCKED_WORDS.some(word => {
    const normalizedWord = word.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ');
    return normalized.includes(normalizedWord);
  });
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware de sécurité
app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limite chaque IP à 100 requêtes par windowMs
  message: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.'
});
app.use('/api/', limiter);

// Body parser
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialisation de la base de données SQLite
const db = new sqlite3.Database('./anonymots.db', (err) => {
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
    const wellnessMessagesPath = path.join(__dirname, 'data', 'wellness_messages.json');
    const wellnessMessages = JSON.parse(fs.readFileSync(wellnessMessagesPath, 'utf8'));

    wellnessMessages.forEach(msg => {
      db.run(`INSERT INTO wellness_messages (content, category) VALUES (?, ?)`, 
             [msg.content, msg.category], (err) => {
        if (err) console.log('Erreur insertion wellness:', err.message);
      });
    });

    // 2. Chargement et insertion des résultats de quiz
    const quizResultsPath = path.join(__dirname, 'data', 'quiz_results.json');
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

// Routes API

// Créer un utilisateur
app.post('/api/users', (req, res) => {
  const { username } = req.body;
  
  if (!username || username.trim().length === 0) {
    return res.status(400).json({ error: 'Le nom d\'utilisateur est requis' });
  }

  const cleanUsername = username.trim().toLowerCase();
  
  db.run(`INSERT INTO users (username) VALUES (?)`, [cleanUsername], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({ error: 'Ce nom d\'utilisateur existe déjà' });
      }
      return res.status(500).json({ error: 'Erreur lors de la création de l\'utilisateur' });
    }
    
    res.status(201).json({ 
      id: this.lastID, 
      username: cleanUsername,
      link: `${req.protocol}://${req.get('host')}/send/${cleanUsername}`
    });
  });
});

// Récupérer un utilisateur
app.get('/api/users/:username', (req, res) => {
  const { username } = req.params;
  
  db.get(`SELECT * FROM users WHERE username = ?`, [username.toLowerCase()], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur lors de la récupération de l\'utilisateur' });
    }
    
    if (!row) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    res.json(row);
  });
});

// Envoyer un message
app.post('/api/messages', (req, res) => {
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

  // Modération silencieuse : vérifier si le message est malveillant
  const blocked = isMalicious(content) || (clue && isMalicious(clue));
  if (blocked) {
    // On log en interne mais on répond comme si l'envoi était réussi (silencieux)
    console.warn(`[MODERATION] Message bloqué pour ${recipient} : "${content.substring(0, 60)}..."`);
  }

  // Vérifier que l'utilisateur destinataire existe
  db.get(`SELECT username FROM users WHERE username = ?`, [recipient.toLowerCase()], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur lors de la vérification de l\'utilisateur' });
    }
    
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur destinataire non trouvé' });
    }

    // Insérer le message — is_blocked marque les messages malveillants (invisibles pour le destinataire)
    db.run(`INSERT INTO messages (recipient_username, content, has_clue, clue, sender_name, is_blocked) VALUES (?, ?, ?, ?, ?, ?)`, 
           [recipient.toLowerCase(), content, hasClue || false, clue || null, hasClue ? senderName.trim().toLowerCase() : null, blocked ? 1 : 0], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Erreur lors de l\'envoi du message' });
      }
      
      res.status(201).json({ 
        id: this.lastID,
        message: 'Message envoyé avec succès'
      });
    });
  });
});

// Récupérer les messages d'un utilisateur
// Le prénom secret (sender_name) n'est renvoyé que s'il a déjà été deviné, pour éviter toute triche
app.get('/api/messages/:username', (req, res) => {
  const { username } = req.params;
  
  // Les messages bloqués (malveillants) sont filtrés silencieusement
  db.all(`SELECT id, recipient_username, content, has_clue, clue, is_guessed, created_at, CASE WHEN is_guessed = 1 THEN sender_name ELSE NULL END as sender_name FROM messages WHERE recipient_username = ? AND (is_blocked = FALSE OR is_blocked IS NULL) ORDER BY created_at DESC`, 
         [username.toLowerCase()], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur lors de la récupération des messages' });
    }
    
    res.json(rows);
  });
});

// Récupérer des messages bienveillants aléatoires
app.get('/api/wellness-messages', (req, res) => {
  const { category } = req.query;
  
  let query = `SELECT * FROM wellness_messages`;
  let params = [];
  
  if (category) {
    query += ` WHERE category = ?`;
    params.push(category);
  }
  
  query += ` ORDER BY RANDOM() LIMIT 5`;
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur lors de la récupération des messages bienveillants' });
    }
    
    res.json(rows);
  });
});

// Soumettre un quiz et récupérer un message personnalisé
app.post('/api/quiz', (req, res) => {
  const { mood, needs } = req.body;
  
  if (!mood) {
    return res.status(400).json({ error: 'L\'humeur est requise' });
  }

  // Déterminer le type de mood basé sur les réponses
  let moodType = mood.toLowerCase();
  
  db.get(`SELECT * FROM quiz_results WHERE mood_type = ? ORDER BY RANDOM() LIMIT 1`, 
         [moodType], (err, row) => {
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
});

// Tenter de deviner l'expéditeur en mode gaming
// Le corps de la requête doit contenir { guess: "prenom" }
app.put('/api/messages/:id/guess', (req, res) => {
  const { id } = req.params;
  const { guess } = req.body;

  if (!guess || guess.trim().length === 0) {
    return res.status(400).json({ error: 'Il faut saisir un prénom pour deviner.' });
  }

  // Récupérer le message avec le sender_name secret
  db.get(`SELECT id, sender_name, is_guessed, has_clue FROM messages WHERE id = ? AND has_clue = TRUE`, [id], (err, msg) => {
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
    db.run(`UPDATE messages SET is_guessed = TRUE WHERE id = ?`, [id], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Erreur lors de la mise à jour du message' });
      }
      
      res.json({ success: true, message: 'Bravo ! Tu as trouvé !', points: 10 });
    });
  });
});

// Route de santé
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'AnonyMots API is running' });
});

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Quelque chose s\'est mal passé!' });
});

// Route 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// Démarrage du serveur
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur AnonyMots démarré sur le port ${PORT}`);
  console.log(`API disponible sur http://0.0.0.0:${PORT}/api`);
});

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
  console.log('Arrêt du serveur...');
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Connexion à la base de données fermée.');
    process.exit(0);
  });
});

