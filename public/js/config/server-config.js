/**
 * Configuration du serveur pour l'application mobile
 * 
 * Ce fichier permet d'externaliser l'URL du serveur pour que l'application
 * mobile sache où se connecter au démarrage.
 * 
 * En développement, utilisez l'URL locale.
 * En production, remplacez par l'URL de votre serveur déployé.
 * 
 * RÈGLE D'OR : Le port local doit correspondre au port du server.js (5500)
 */

const SERVER_CONFIG = {
  // RÈGLE D'OR : Si vous déployez sur Render/Heroku, remplacez l'URL ci-dessous
  // Sinon, le jeu fonctionnera automatiquement en local après 'npm install && npm start'
  production: 'https://hint-or-lie.onrender.com',
  development: 'http://localhost:5500'  // Port par défaut du server.js
};

/**
 * Récupère l'URL du serveur en fonction de l'environnement actuel
 * Détecte automatiquement si on est en production (domaine != localhost)
 * @returns {string} L'URL du serveur
 */
function getServerUrl() {
  const hostname = window.location.hostname;
  
  // RÈGLE D'OR : Forcer le mode développement si l'URL de production n'est pas configurée
  const isProductionConfigured = SERVER_CONFIG.production !== 'https://hint-or-lie.onrender.com';
  
  // Détection localhost : inclut localhost, 127.0.0.1 et adresses IPv4 locales
  const isLocalhost = hostname === 'localhost' || 
                      hostname === '127.0.0.1' ||
                      hostname.startsWith('192.168.') ||
                      hostname.startsWith('10.') ||
                      hostname.startsWith('172.');
  
  // Si production n'est pas configurée, toujours utiliser development
  const serverUrl = (isLocalhost || !isProductionConfigured) 
    ? SERVER_CONFIG.development 
    : SERVER_CONFIG.production;
  
  // Debug : afficher l'URL utilisée
  console.log('[ServerConfig] Hostname:', hostname);
  console.log('[ServerConfig] Is Localhost:', isLocalhost);
  console.log('[ServerConfig] Production configured:', isProductionConfigured);
  console.log('[ServerConfig] Using URL:', serverUrl);
  
  return serverUrl;
}

/**
 * Détecte automatiquement si l'app tourne sur mobile ou web
 * @returns {boolean} true si mobile, false sinon
 */
function isMobileApp() {
  return window.Capacitor !== undefined;
}

// Exporter pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SERVER_CONFIG, getServerUrl, isMobileApp };
}
