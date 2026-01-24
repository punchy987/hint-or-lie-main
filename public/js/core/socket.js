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

  // ✅ NOUVELLE: Gestion de la modal spectateur
  socket.on('spectatorMode', ({ phase, message }) => {
    const modal = document.getElementById('spectator-waiting');
    const phaseDisplay = document.getElementById('spectator-phase');
    if (modal) {
      const phaseLabel = {
        'hints': '📝 Phase Indices',
        'voting': '🗳️ Phase Vote',
        'reveal': '🎭 Révélation',
      }[phase] || '⏳ ' + phase;
      
      if (phaseDisplay) phaseDisplay.textContent = phaseLabel;
      modal.style.display = 'block';
      
      // Masquer tous les écrans
      const screenIds = ['screen-home', 'screen-lobby', 'screen-hint', 'screen-vote', 'screen-result'];
      screenIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
    }
  });

  // ✅ NOUVELLE: Fermer la modal spectateur quand on rejoint le lobby pour la prochaine manche
  socket.on('roomJoined', () => {
    const modal = document.getElementById('spectator-waiting');
    if (modal) modal.style.display = 'none';
  });

  // ✅ NOUVELLE: Quitter la salle depuis la modal spectateur
  const btnLeaveSpectator = document.getElementById('btn-leave-spectator');
  if (btnLeaveSpectator) {
    btnLeaveSpectator.addEventListener('click', () => {
      socket.emit('leaveRoom');
      const modal = document.getElementById('spectator-waiting');
      if (modal) modal.style.display = 'none';
    });
  }

  // ✅ NOUVELLE: ReconnectHandler - envoi de l'état du jeu à la reconnexion
  socket.on('gameStateSync', ({ state, phase, round, players, scores }) => {
    console.log('[Reconnect] État du jeu reçu:', { state, phase, round });
    
    // Mettre à jour state.js
    if (window.HOL.state) {
      window.HOL.state.currentPhase = phase;
      window.HOL.state.room.state = state;
      window.HOL.state.room.round = round;
      if (players) window.HOL.state.room.players = players;
      if (scores) {
        for (const [id, score] of Object.entries(scores)) {
          const p = window.HOL.state.room.players.find(pl => pl.id === id);
          if (p) p.score = score;
        }
      }
    }
  });

  window.HOL.socket = socket;
})();