// routes/sockets/version.js
/**
 * Gestion des versions côté serveur
 * RÈGLE D'OR : Vérifie la compatibilité et informe les clients
 */

const packageJson = require('../../package.json');

const VERSION_CONFIG = {
  current: packageJson.version,      // Version actuelle du serveur
  minimum: '1.0.0',                   // Version minimum requise pour se connecter
  latest: packageJson.version         // Dernière version disponible
};

/**
 * Configure les événements de vérification de version
 */
function setupVersionCheck(socket) {
  socket.on('clientVersion', ({ version }) => {
    console.log(`[Version] Client ${socket.id} : v${version}`);
    
    // Envoyer les infos de version au client
    socket.emit('versionCheck', {
      serverVersion: VERSION_CONFIG.current,
      minVersion: VERSION_CONFIG.minimum,
      latestVersion: VERSION_CONFIG.latest
    });
    
    // Vérifier la compatibilité
    const clientMajor = version.split('.')[0];
    const minMajor = VERSION_CONFIG.minimum.split('.')[0];
    
    if (parseInt(clientMajor) < parseInt(minMajor)) {
      console.warn(`[Version] ⚠️ Client ${socket.id} incompatible (v${version} < v${VERSION_CONFIG.minimum})`);
      
      socket.emit('toast', {
        message: `Version ${version} incompatible. Mise à jour requise.`,
        isError: true
      });
    }
  });
}

/**
 * Broadcast une notification de nouvelle version à tous les clients connectés
 */
function notifyNewVersion(io, newVersion) {
  console.log(`[Version] 📢 Notification nouvelle version : v${newVersion}`);
  
  io.emit('newVersionAvailable', {
    version: newVersion,
    message: `Une nouvelle version (v${newVersion}) est disponible !`,
    downloadUrl: 'https://github.com/[votre-username]/hint-or-lie'
  });
}

/**
 * Met à jour la configuration de version
 */
function updateVersionConfig(newVersion, minVersion) {
  VERSION_CONFIG.latest = newVersion || VERSION_CONFIG.latest;
  VERSION_CONFIG.minimum = minVersion || VERSION_CONFIG.minimum;
  
  console.log('[Version] Configuration mise à jour:', VERSION_CONFIG);
}

module.exports = {
  setupVersionCheck,
  notifyNewVersion,
  updateVersionConfig,
  VERSION_CONFIG
};
