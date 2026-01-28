/**
 * Configuration du serveur pour l'application mobile
 * 
 * Ce fichier permet d'externaliser l'URL du serveur pour que l'application
 * mobile sache où se connecter au démarrage.
 * 
 * En développement, utilisez l'URL locale.
 * En production, remplacez par l'URL de votre serveur déployé.
 */

const SERVER_CONFIG = {
  production: 'https://ton-nom-de-projet.onrender.com', // Remplace par ton URL Render
  development: 'http://localhost:3000'
};

/**
 * Récupère l'URL du serveur en fonction de l'environnement actuel
 * Détecte automatiquement si on est en production (domaine != localhost)
 * @returns {string} L'URL du serveur
 */
function getServerUrl() {
  const isLocalhost = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1';
  return isLocalhost ? SERVER_CONFIG.development : SERVER_CONFIG.production;
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
