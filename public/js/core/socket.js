// public/js/core/socket.js
(function () {
  window.HOL = window.HOL || {};
  
  // On ajoute des options pour Render (transports prioritaires)
  const socket = io({
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    timeout: 10000
  });

  socket.on('connect', () => {
    console.log('[Socket] Connecté avec ID:', socket.id);
  });

  socket.on('connect_error', (err) => {
    console.error('[Socket] Erreur de connexion:', err.message);
  });

  window.HOL.socket = socket;
})();