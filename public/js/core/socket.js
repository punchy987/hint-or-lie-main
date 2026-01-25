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

  window.HOL.socket = socket;
})();