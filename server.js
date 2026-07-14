const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');

// Importation de la base de données et des routes
const db = require('./config/db');
const apiRoutes = require('./routes/apiRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

// 1. Middleware de sécurité
app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 2. Limiteur de débit (Rate limiting)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limite chaque IP à 100 requêtes par windowMs
  message: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.'
});
app.use('/api/', limiter);

// 3. Parsing des requêtes
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 4. Utilisation des routes centralisées
app.use('/api', apiRoutes);

// 5. Gestionnaire global d'erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Quelque chose s\'est mal passé!' });
});

// 6. Gestion des routes non trouvées (404)
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// Démarrage du serveur web
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Serveur AnonyMots démarré sur le port ${PORT}`);
    console.log(`API disponible sur http://localhost:${PORT}/api`);
  });
}

// Gestion propre de l'arrêt du processus (Fermeture SQLite)
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

module.exports = app;
