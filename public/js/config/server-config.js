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
  
  // RÈGLE D'OR : Vérifier si l'URL de production est définie et valide
  const isProductionConfigured = SERVER_CONFIG.production && 
                                 SERVER_CONFIG.production.startsWith('http');
  
  // Détection localhost : inclut localhost, 127.0.0.1 et adresses IPv4 locales
  const isLocalhost = hostname === 'localhost' || 
                      hostname === '127.0.0.1' ||
                      hostname.startsWith('192.168.') ||
                      hostname.startsWith('10.') ||
                      hostname.startsWith('172.');
  
  // RÈGLE D'OR : Force l'URL de production si on est sur un domaine de prod
  const isRenderDomain = hostname.includes('.onrender.com') || 
                         hostname.includes('.herokuapp.com') ||
                         hostname.includes('.vercel.app');
  
  // Priorité : domaine de production > localhost
  const serverUrl = isRenderDomain ? SERVER_CONFIG.production :
                    (isLocalhost || !isProductionConfigured) ? SERVER_CONFIG.development : 
                    SERVER_CONFIG.production;
  
  // Debug : afficher l'URL utilisée
  console.log('[ServerConfig] Hostname:', hostname);
  console.log('[ServerConfig] Is Localhost:', isLocalhost);
  console.log('[ServerConfig] Is Production Domain:', isRenderDomain);
  console.log('[ServerConfig] Production configured:', isProductionConfigured);
  console.log('[ServerConfig] Using URL:', serverUrl);
  console.log('[ServerConfig] Cache Buster: v3');
  
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
