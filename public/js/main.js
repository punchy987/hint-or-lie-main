// public/js/main.js
// Boot : initialise toutes les features + timers pilotés par le serveur
(function () {
  const { $, fmt, state, socket, startPhaseAnim } = window.HOL;

  function initTimersFromServer() {
    socket.on('timer', ({ phase, leftMs, totalMs }) => {
      if (phase !== state.currentPhase) state.currentPhase = phase;

      startPhaseAnim(phase, totalMs || state.DUR[phase] || 0, leftMs);

      const left = Math.floor((leftMs + 20) / 1000);
      if (phase === 'hints') {
        const el = $('timer-hints'); if (el) el.textContent = fmt(leftMs);
        if (left <= 0) { $('btn-send-hint')?.setAttribute('disabled', 'true'); $('hint-input')?.setAttribute('disabled', 'true'); }
      } else if (phase === 'voting') {
        const el = $('timer-vote'); if (el) el.textContent = fmt(leftMs);
        if (left <= 0) { document.querySelectorAll('#vote-buttons button').forEach(b => b.disabled = true); }
      } else if (phase === 'prestart') {
        // ✅ NOUVEAU : afficher le countdown du prestart sur le timer du lobby
        const el = $('timer-lobby'); if (el) el.textContent = fmt(leftMs);
      } else if (phase === 'reveal') {
        const el = $('timer-reveal'); if (el) el.textContent = fmt(leftMs);
      } else if (phase === 'lobby') {
        const el = $('timer-lobby'); if (el) { el.textContent = fmt(leftMs); if (left <= 0) el.style.display = 'none'; }
      }
        // 🔒 Filet de sécurité d’écran :
  // si le serveur dit "voting" et qu'on est encore sur l'écran "hint",
  // on bascule de force sur l'écran Vote.
  if (phase === 'voting' && document.body.getAttribute('data-screen') === 'screen-hint') {
    // show() est ton utilitaire qui change d'écran
    window.HOL.show('screen-vote');
  }
    });

    socket.on('phaseProgress', ({ phase, submitted, total }) => {
      if (phase === 'hints') {
        const el = $('progress-hints');
        if (el) el.textContent = `${submitted}/${total}`;
      } else if (phase === 'voting') {
        const el = $('progress-vote');
        if (el) el.textContent = `${submitted}/${total}`;
      }
    });

    // ✅ NOUVEAU : Spectateur devient actif
    socket.on('roomUpdate', (snap) => {
      state.room = snap;
      
      const meNow = snap.players?.find(p => p.id === state.me.id);
      const meBefore = state.room?.players?.find(p => p.id === state.me.id);
      
      // Transition spectateur → actif
      if (meBefore?.spectator && meNow && !meNow.spectator && snap.state === 'lobby') {
        window.HOL.toast('✅ Vous rejoignez la partie !', 1500);
      }
      
      // Transition gameOver → lobby : fermer la modale
      if (snap.state === 'lobby') {
        const modal = $('modal');
        if (modal && modal.style.display === 'flex') {
          const box = modal.querySelector('.box');
          if (box && box.innerHTML.includes('PARTIE TERMINÉE')) {
            modal.style.display = 'none';
            window.HOL.show('screen-lobby');
            const btnReady = $('btn-ready');
            if (btnReady) {
              btnReady.textContent = 'Je suis prêt';
              btnReady.disabled = false;
            }
          }
        }
      }
    });

    // ✅ NOUVEAU : Scores réinitialisés (après resetScores)
    socket.on('scoresReset', () => {
      window.HOL.show('screen-lobby');
      const btnReady = $('btn-ready');
      if (btnReady) {
        btnReady.textContent = 'Je suis prêt';
        btnReady.disabled = false;
      }
      state.myLobbyReady = false;
      window.HOL.toast('Partie réinitialisée ! 🎮', 1500);
    });
  }

  function init() {
    window.HOL.features.home.init();
    window.HOL.features.hints.init();
    window.HOL.features.vote.init();
    window.HOL.features.results.init();
    window.HOL.features.leaderboard.init();
    initTimersFromServer();
    // Écran initial
    document.body.setAttribute('data-screen', 'screen-home');
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
