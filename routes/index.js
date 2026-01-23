// routes/index.js
const express = require('express');
const router = express.Router();
const path = require('path');

// CORRECTIF DES CHEMINS POUR RENDER
const rootDir = path.join(__dirname, '..');

// 1. Import de la config
const config = require(path.join(rootDir, 'config', 'index.js'));

// 2. Import de l'état des salles (nécessaire pour certaines routes)
// On pointe bien vers sockets/state/room.js
const { rooms } = require('./sockets/state/room.js');

// 3. Import du setup des Sockets (pour l'exporter vers server.js)
const setupSockets = require('./sockets/index.js');

// --- TES ROUTES HTTP ---

// Route de test
router.get('/health', (req, res) => {
  res.json({ status: 'ok', rooms: rooms.size });
});

// --- EXPORT POUR SERVER.JS ---

// Cette fonction est celle que server.js appelle à la ligne 15
function setupRoutes(app) {
  app.use('/', router);
}

// On exporte la fonction directement ET en tant que propriété pour être sûr
module.exports = setupRoutes;
module.exports.setupRoutes = setupRoutes;
module.exports.setupSockets = setupSockets;