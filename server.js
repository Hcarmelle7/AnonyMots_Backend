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

// 3. Parsing des requêtes (Sécurité : Limite de taille de charge utile à 10 Ko pour éviter les attaques DoS)
app.use(bodyParser.json({ limit: '10kb' }));
app.use(bodyParser.urlencoded({ limit: '10kb', extended: true }));

// 4. Utilisation des routes centralisées
app.use('/api', apiRoutes);

// 5. Gestionnaire global d'erreurs (mis à jour pour conserver les codes de statut HTTP des erreurs lancées par Express/middlewares)
app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Quelque chose s\'est mal passé!' });
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

// Fonction de fermeture propre de la base de données et du processus
const handleGracefulShutdown = () => {
  console.log('Arrêt du serveur en cours...');
  // On ferme la connexion SQLite pour s'assurer que toutes les écritures en attente sont terminées
  db.close((err) => {
    if (err) {
      console.error('Erreur lors de la fermeture de la base de données:', err.message);
    }
    console.log('Connexion à la base de données SQLite fermée de manière sécurisée.');
    process.exit(0);
  });
};

// SIGINT est déclenché par Ctrl+C en local dans la console.
process.on('SIGINT', handleGracefulShutdown);

// SIGTERM est déclenché par les gestionnaires de processus (PM2, Docker, Heroku, etc.) lors de l'extinction.
process.on('SIGTERM', handleGracefulShutdown);

module.exports = app;
