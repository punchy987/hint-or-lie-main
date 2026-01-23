// routes/index.js
const express = require('express');
const router = express.Router();
const path = require('path');

// 1. Importation de la configuration
// On remonte d'un cran vers la racine pour trouver /config
const config = require('../config/index.js');

// 2. Importation du setup des Sockets
// On pointe vers le fichier que tu m'as envoyé tout à l'heure
const setupSockets = require('./sockets/index.js');

// 3. Importation de l'état des salles (Room State)
// CORRECTIF : Le fichier room.js est dans ./sockets/state/room.js
// C'est cette ligne (ligne 25 dans tes logs) qui faisait crash le serveur
const { rooms } = require('./sockets/state/room.js');

// --- ROUTES HTTP ---

// Route de base pour vérifier que le serveur répond
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    rooms: rooms.size,
    version: '1.0.3'
  });
});

// On peut ajouter ici d'autres routes API si nécessaire (leaderboard, etc.)

// On exporte le routeur et la fonction de setup pour server.js
module.exports = {
  router,
  setupSockets
};