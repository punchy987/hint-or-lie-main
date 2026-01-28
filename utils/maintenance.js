// utils/maintenance.js
/**
 * Système de notification de maintenance
 * Permet d'avertir les joueurs avant un redéploiement
 * 
 * Usage : node utils/maintenance.js announce "Mise à jour dans 5 minutes"
 */

const io = require('socket.io-client');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5500';
const MESSAGE = process.argv[2] || 'Maintenance programmée';
const COUNTDOWN = parseInt(process.argv[3]) || 300; // 5 minutes par défaut

console.log('📢 Envoi de notification de maintenance...');
console.log(`   Serveur : ${SERVER_URL}`);
console.log(`   Message : ${MESSAGE}`);
console.log(`   Délai   : ${COUNTDOWN}s`);

// Se connecter au serveur comme admin
const socket = io(SERVER_URL);

socket.on('connect', () => {
  console.log('✅ Connecté au serveur');
  
  // Émettre le message de maintenance
  socket.emit('broadcastMaintenance', {
    message: MESSAGE,
    countdown: COUNTDOWN,
    timestamp: Date.now()
  });
  
  console.log('📤 Notification envoyée à tous les joueurs');
  
  setTimeout(() => {
    socket.disconnect();
    console.log('✅ Terminé');
    process.exit(0);
  }, 1000);
});

socket.on('connect_error', (error) => {
  console.error('❌ Impossible de se connecter au serveur');
  console.error('   Vérifiez que le serveur est démarré');
  console.error('   URL :', SERVER_URL);
  process.exit(1);
});
