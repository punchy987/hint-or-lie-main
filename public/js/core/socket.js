(function () {
  window.HOL = window.HOL || {};
  
  const socket = io({
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    timeout: 10000
  });

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
      
      const screenIds = ['screen-home', 'screen-lobby', 'screen-hint', 'screen-vote', 'screen-result'];
      screenIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
    }
  });

  socket.on('roomJoined', () => {
    const modal = document.getElementById('spectator-waiting');
    if (modal) modal.style.display = 'none';
  });

  const btnLeaveSpectator = document.getElementById('btn-leave-spectator');
  if (btnLeaveSpectator) {
    btnLeaveSpectator.addEventListener('click', () => {
      socket.emit('leaveRoom');
      const modal = document.getElementById('spectator-waiting');
      if (modal) modal.style.display = 'none';
    });
  }

  socket.on('gameStateSync', (gameData) => {
    if (window.HOL.state) {
      window.HOL.state.currentPhase = gameData.phase;
    }
    if (window.HOL.updateUIFromState) {
        window.HOL.updateUIFromState({
            state: gameData.state,
            round: gameData.round,
            players: gameData.players,
        });
    }
  });

  // Écoute des notifications toast d'erreur critique (déconnexion imposteur, manque de joueurs)
  socket.on('toast', ({ message, isError }) => {
    if (window.HOL.toast) {
      window.HOL.toast(message, isError);
    }
    
    // Si c'est une erreur et qu'on est dans une phase de jeu, retour au lobby
    if (isError && window.HOL.transitionTo) {
      setTimeout(() => {
        window.HOL.transitionTo('screen-lobby');
      }, 2500); // Délai pour laisser le temps de lire le message
    }
  });

  // Listener pour la migration de host
  socket.on('newHost', ({ newHostId }) => {
    // Mettre à jour l'état local
    if (window.HOL.state && window.HOL.state.room) {
      window.HOL.state.room.hostId = newHostId;
    }
    
    // Rafraîchir les contrôles de host si la fonction existe
    if (window.HOL.refreshHostControls) {
      window.HOL.refreshHostControls();
    }
  });

  window.HOL.socket = socket;
})();