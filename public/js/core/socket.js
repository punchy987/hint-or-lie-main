(function () {
  window.HOL = window.HOL || {};
  
  // RÈGLE D'OR : Configuration de l'URL du serveur (support mobile)
  let serverUrl = '';
  if (typeof getServerUrl === 'function') {
    serverUrl = getServerUrl();
  } else {
    console.error('[Socket] ⚠️ ERREUR: getServerUrl() non disponible !');
    console.error('[Socket] Vérifiez que server-config.js est bien chargé avant socket.js');
  }
  
  console.log('[GUARD] Socket logging active');
  console.log('[Socket] Connexion au serveur:', serverUrl || 'URL relative');
  
  // RÈGLE D'OR : Vérifier que l'URL n'est pas l'URL de placeholder
  if (serverUrl && serverUrl.includes('ton-nom-de-projet.onrender.com')) {
    console.error('[Socket] ⚠️ ERREUR: URL de production non configurée !');
    console.error('[Socket] Le serveur utilise toujours l\'URL placeholder.');
    console.error('[Socket] Videz le cache du navigateur (Ctrl+F5) ou vérifiez server-config.js');
  }
  
  const socket = io(serverUrl, {
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    timeout: 10000
  });

  // RÈGLE D'OR : Gestion des événements de connexion pour informer l'utilisateur
  socket.on('connect', () => {
    console.log('[Socket] ✅ Connecté au serveur');
    if (window.HOL.toast) {
      window.HOL.toast('Connecté au serveur ✅', 1500);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] ❌ Déconnecté:', reason);
    if (window.HOL.toast) {
      window.HOL.toast('Déconnexion du serveur ⚠️', 2500, true);
    }
  });

  socket.on('connect_error', (error) => {
    console.error('[Socket] ❌ Erreur de connexion:', error.message);
    if (window.HOL.toast) {
      window.HOL.toast('Impossible de se connecter au serveur ⚠️', 3000, true);
    }
  });

  socket.on('error', (error) => {
    console.error('[Socket] ❌ Erreur:', error);
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
      localStorage.removeItem('hol_room_code'); // Nettoyer le code de salle
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