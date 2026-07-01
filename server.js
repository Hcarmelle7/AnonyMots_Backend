const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const path = require('path');

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
  // Table des utilisateurs
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Table des messages
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient_username TEXT NOT NULL,
    content TEXT NOT NULL,
    has_clue BOOLEAN DEFAULT FALSE,
    clue TEXT,
    is_guessed BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (recipient_username) REFERENCES users (username)
  )`);

  // Table des messages bienveillants
  db.run(`CREATE TABLE IF NOT EXISTS wellness_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    category TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Table des résultats de quiz
  db.run(`CREATE TABLE IF NOT EXISTS quiz_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mood_type TEXT NOT NULL,
    personalized_message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Insertion des données de base
  insertInitialData();
}

// Insertion des données initiales
function insertInitialData() {
  // Attendre que les tables soient créées avant d'insérer les données
  setTimeout(() => {
    // Messages bienveillants
    const wellnessMessages = [
      { content: "Vous êtes plus fort que vous ne le pensez. Chaque défi que vous surmontez vous rend plus résilient.", category: "motivation" },
      { content: "Prenez le temps de respirer profondément. Vous méritez la paix et la sérénité.", category: "relaxation" },
      { content: "Votre présence dans ce monde fait une différence. Vous comptez plus que vous ne l'imaginez.", category: "encouragement" },
      { content: "Il est normal de ne pas aller bien parfois. Soyez doux avec vous-même.", category: "compassion" },
      { content: "Chaque petit pas compte. Vous progressez, même si cela ne se voit pas toujours.", category: "motivation" },
      { content: "Vous avez survécu à 100% de vos mauvais jours jusqu'à présent. C'est un excellent score.", category: "encouragement" },
      { content: "Votre valeur ne dépend pas de votre productivité. Vous êtes précieux tel que vous êtes.", category: "compassion" },
      { content: "Les tempêtes passent toujours. Le soleil brillera à nouveau dans votre vie.", category: "espoir" }
    ];

    wellnessMessages.forEach(msg => {
      db.run(`INSERT OR IGNORE INTO wellness_messages (content, category) VALUES (?, ?)`, 
             [msg.content, msg.category], (err) => {
        if (err) console.log('Erreur insertion wellness:', err.message);
      });
    });

    // Messages personnalisés pour le quiz
    const quizResults = [
      { mood_type: "triste", personalized_message: "Je comprends que vous traversez une période difficile. Rappelez-vous que la tristesse est temporaire et que vous avez la force de surmonter cela. Vous n'êtes pas seul(e)." },
      { mood_type: "stresse", personalized_message: "Le stress peut être accablant, mais vous avez déjà surmonté des défis par le passé. Prenez une pause, respirez profondément, et rappelez-vous que vous êtes capable." },
      { mood_type: "anxieux", personalized_message: "L'anxiété peut sembler insurmontable, mais elle ne définit pas qui vous êtes. Concentrez-vous sur le moment présent et rappelez-vous que vous êtes en sécurité." },
      { mood_type: "fatigue", personalized_message: "Il est important d'écouter votre corps et votre esprit. Accordez-vous le repos que vous méritez. Vous n'avez pas besoin d'être productif en permanence." },
      { mood_type: "heureux", personalized_message: "Votre joie est contagieuse ! Profitez de ce moment de bonheur et n'hésitez pas à le partager avec les autres. Vous illuminez le monde autour de vous." },
      { mood_type: "confiant", personalized_message: "Votre confiance en vous est inspirante ! Continuez à croire en vos capacités et n'hésitez pas à poursuivre vos rêves. Vous avez tout ce qu'il faut pour réussir." }
    ];

    quizResults.forEach(result => {
      db.run(`INSERT OR IGNORE INTO quiz_results (mood_type, personalized_message) VALUES (?, ?)`, 
             [result.mood_type, result.personalized_message], (err) => {
        if (err) console.log('Erreur insertion quiz:', err.message);
      });
    });
    
    console.log('Données initiales insérées avec succès.');
  }, 1000);
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
  const { recipient, content, hasClue, clue } = req.body;
  
  if (!recipient || !content) {
    return res.status(400).json({ error: 'Le destinataire et le contenu sont requis' });
  }

  if (content.length > 500) {
    return res.status(400).json({ error: 'Le message ne peut pas dépasser 500 caractères' });
  }

  // Vérifier que l'utilisateur destinataire existe
  db.get(`SELECT username FROM users WHERE username = ?`, [recipient.toLowerCase()], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur lors de la vérification de l\'utilisateur' });
    }
    
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur destinataire non trouvé' });
    }

    // Insérer le message
    db.run(`INSERT INTO messages (recipient_username, content, has_clue, clue) VALUES (?, ?, ?, ?)`, 
           [recipient.toLowerCase(), content, hasClue || false, clue || null], function(err) {
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
app.get('/api/messages/:username', (req, res) => {
  const { username } = req.params;
  
  db.all(`SELECT * FROM messages WHERE recipient_username = ? ORDER BY created_at DESC`, 
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

// Marquer un message comme deviné (pour le gaming)
app.put('/api/messages/:id/guess', (req, res) => {
  const { id } = req.params;
  
  db.run(`UPDATE messages SET is_guessed = TRUE WHERE id = ? AND has_clue = TRUE`, [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Erreur lors de la mise à jour du message' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Message non trouvé ou sans indice' });
    }
    
    res.json({ message: 'Message marqué comme deviné', points: 10 });
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

