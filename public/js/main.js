// public/js/main.js
// Boot : initialise toutes les features + timers pilotes par le serveur
(function () {
  const { $, fmt, state, socket, startPhaseAnim } = window.HOL;

  function initTimersFromServer() {
    let lastDeadline = null;
    let localTimerRAF = null;

    socket.on('timer', ({ phase, leftMs, totalMs }) => {
      if (phase !== state.currentPhase) state.currentPhase = phase;

      // Recalibrer le deadline du serveur
      lastDeadline = Date.now() + leftMs;

      startPhaseAnim(phase, totalMs || state.DUR[phase] || 0, leftMs);

      // Filet de securite d'ecran : si le serveur dit "voting" et qu'on est encore sur l'ecran "hint", basculer
      if (phase === 'voting' && document.body.getAttribute('data-screen') === 'screen-hint') {
        window.HOL.show('screen-vote');
      }

      // Arreter l'ancienne animation et en demarrer une nouvelle
      if (localTimerRAF) cancelAnimationFrame(localTimerRAF);

      function updateLocalTimer() {
        const now = Date.now();
        const remaining = Math.max(0, lastDeadline - now);

        if (phase === 'hints') {
          const el = timer-hints; if (el) el.textContent = fmt(remaining);
          if (remaining <= 0) { btn-send-hint?.setAttribute('disabled', 'true'); hint-input?.setAttribute('disabled', 'true'); }
        } else if (phase === 'voting') {
          const el = timer-vote; if (el) el.textContent = fmt(remaining);
          if (remaining <= 0) { document.querySelectorAll('#vote-buttons button').forEach(b => b.disabled = true); }
        } else if (phase === 'prestart') {
          const el = timer-lobby; if (el) el.textContent = fmt(remaining);
        } else if (phase === 'reveal') {
          const el = timer-reveal; if (el) el.textContent = fmt(remaining);
        } else if (phase === 'lobby') {
          const el = timer-lobby; if (el) { el.textContent = fmt(remaining); if (remaining <= 0) el.style.display = 'none'; }
        }

        if (remaining > 0) {
          localTimerRAF = requestAnimationFrame(updateLocalTimer);
        } else {
          localTimerRAF = null;
        }
      }

      // Demarrer l'animation fluide
      updateLocalTimer();
    });

    socket.on('phaseProgress', ({ phase, submitted, total }) => {
      if (phase === 'hints') {
        const el = progress-hints;
        if (el) el.textContent = ${ submitted }/;
      } else if (phase === 'voting') {
        const el = progress-vote;
        if (el) el.textContent = ${ submitted }/;
      }
    });

    // NOUVEAU : Spectateur devient actif
    socket.on('roomUpdate', (snap) => {
      state.room = snap;
      
      const meNow = snap.players?.find(p => p.id === state.me.id);
      const meBefore = state.room?.players?.find(p => p.id === state.me.id);
      
      // Transition spectateur -> actif
      if (meBefore?.spectator && meNow && !meNow.spectator && snap.state === 'lobby') {
        window.HOL.toast('Vous rejoignez la partie !', 1500);
      }
      
      // Transition gameOver -> lobby : fermer la modale
      if (snap.state === 'lobby') {
        const modal = modal;
        if (modal && modal.style.display === 'flex') {
          const box = modal.querySelector('.box');
          if (box && box.innerHTML.includes('PARTIE TERMINEE')) {
            modal.style.display = 'none';
            window.HOL.show('screen-lobby');
            const btnReady = btn-ready;
            if (btnReady) {
              btnReady.textContent = 'Je suis pret';
              btnReady.disabled = false;
            }
          }
        }
      }
    });

    // NOUVEAU : Scores reinitialises (apres resetScores)
    socket.on('scoresReset', () => {
      window.HOL.show('screen-lobby');
      const btnReady = btn-ready;
      if (btnReady) {
        btnReady.textContent = 'Je suis pret';
        btnReady.disabled = false;
      }
      state.myLobbyReady = false;
      window.HOL.toast('Partie reinitalisee !', 1500);
    });
  }

  function init() {
    window.HOL.features.home.init();
    window.HOL.features.hints.init();
    window.HOL.features.vote.init();
    window.HOL.features.results.init();
    window.HOL.features.leaderboard.init();
    initTimersFromServer();
    // Ecran initial
    document.body.setAttribute('data-screen', 'screen-home');
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
