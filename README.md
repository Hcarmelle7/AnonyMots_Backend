# AnonyMots 🛠️ — Le Backend (API Express & SQLite)

Salut ! Bienvenue dans les coulisses d'AnonyMots. C'est ici que toute la magie invisible opère ! C'est l'API qui stocke nos utilisateurs, gère l'envoi des messages, valide les indices du jeu et protège nos utilisateurs de la malveillance.

J'ai construit cette partie avec Node.js, Express et une base SQLite. Mon but était de faire quelque chose de simple, léger, robuste et surtout bien sécurisé.

---

## 🎯 Ce que fait cette API

* **Gestion des profils** : Enregistrement des pseudos et vérification de leur existence.
* **Boîte aux lettres anonyme** : Réception des messages et stockage en base. Pour que le jeu fonctionne, l'API masque l'identité de l'expéditeur lors des requêtes de lecture classiques.
* **Le Mode Gaming** : Un endpoint dédié reçoit les propositions de prénoms envoyées par les utilisateurs. Si la réponse correspond à ce qui est stocké, le serveur valide la devinette, attribue les points et révèle enfin le prénom.
* **Modération automatique** : Pour éviter le harcèlement ou les insultes, le backend passe chaque message reçu au crible d'un filtre basé sur une liste de mots bloqués (située dans `data/blocked_words.json`). Si un mot interdit est détecté, le message est silencieusement marqué comme bloqué.
* **Bien-être & Quiz** : Distribution de citations positives de façon aléatoire et traitement du questionnaire d'humeur.

---

## 🛠️ Ma boîte à outils technique

Côté backend, j'ai voulu rester sur du solide et éprouvé :
* **Node.js** & **Express** pour monter notre serveur d'API REST.
* **SQLite** (via le package `sqlite3`) : Une base de données SQL super légère, stockée directement dans un fichier local (`anonymots.db`), ce qui évite d'avoir à configurer un gros serveur de base de données.
* **Helmet** & **CORS** pour sécuriser les en-têtes HTTP et autoriser notre frontend à communiquer proprement avec le serveur.
* **Express Rate Limit** pour limiter le nombre de requêtes par adresse IP (100 requêtes max par tranche de 15 minutes) et éviter les spams de messages.

---

## 🚀 Comment lancer le serveur en local ?

### 1. Installation
Assure-toi d'être dans le dossier `anonymots-backend` puis installe les dépendances :
```bash
npm install
```

### 2. Démarrage
Lance le serveur :
```bash
npm run dev
# ou npm start
```
Le serveur démarrera sur `http://localhost:3001/` et tu devrais voir apparaître le message de succès de connexion à SQLite dans ta console. Au premier démarrage, les données de base pour le quiz et les citations bienveillantes s'injectent toutes seules !

---

## 📌 Les principaux points d'entrée (API Endpoints)

* `POST /api/users` : Crée un nouvel utilisateur.
* `GET /api/users/:username` : Récupère les infos publiques d'un profil.
* `POST /api/messages` : Envoie un message anonyme (avec modération auto et mode gaming optionnel).
* `GET /api/messages/:username` : Récupère les messages d'un utilisateur (en masquant les expéditeurs non découverts).
* `PUT /api/messages/:id/guess` : Soumet une tentative pour deviner le prénom de l'expéditeur.
* `GET /api/wellness-messages` : Donne une liste de citations réconfortantes.

---

Si tu veux fouiller la base de données de test, j'ai aussi écrit un petit script rapide : tu peux lancer `node check_db.js` pour afficher instantanément les derniers utilisateurs et messages enregistrés directement dans ton terminal. 

Bonne lecture du code et n'hésite pas si tu as des retours ! 🙂

*Rose Carmelle*
