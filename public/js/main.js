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
          const el = $('timer-hints'); if (el) el.textContent = fmt(remaining);
          if (remaining <= 0) { $('btn-send-hint')?.setAttribute('disabled', 'true'); $('hint-input')?.setAttribute('disabled', 'true'); }
        } else if (phase === 'voting') {
          const el = $('timer-vote'); if (el) el.textContent = fmt(remaining);
          if (remaining <= 0) { document.querySelectorAll('#hints .vote-card').forEach(b => b.disabled = true); }
        } else if (phase === 'prestart') {
          const el = $('timer-lobby'); if (el) el.textContent = fmt(remaining);
        } else if (phase === 'reveal') {
          const el = $('timer-reveal'); if (el) el.textContent = fmt(remaining);
        } else if (phase === 'lobby') {
          const el = $('timer-lobby'); if (el) { el.textContent = fmt(remaining); if (remaining <= 0) el.style.display = 'none'; }
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
        const el = $('progress-hints');
        if (el) el.textContent = `${submitted}/${total}`;
      } else if (phase === 'voting') {
        const el = $('progress-vote');
        if (el) el.textContent = `${submitted}/${total}`;
      }
    });

    // NOUVEAU : Spectateur devient actif
    socket.on('roomUpdate', (snap) => {
      state.room = snap;

      // Met à jour le numéro du round
      if ($('round-num')) $('round-num').textContent = snap.round;
      
      // Met à jour le tableau des scores
      if (window.HOL.updateScoreboard) window.HOL.updateScoreboard(snap.players);

      // Gère l'affichage des écrans en fonction de la phase de jeu
      switch (snap.state) {
        case 'lobby':
          window.HOL.show('screen-lobby');
          break;
        case 'hints':
          window.HOL.show('screen-hint');
          break;
        case 'voting':
          window.HOL.show('screen-vote');
          break;
        case 'reveal':
          // L'événement `roundResult` dans `results.js` gère l'affichage 
          // avec une animation, mais on assure ici la transition au cas où.
          if (document.body.getAttribute('data-screen') !== 'screen-result') {
            window.HOL.show('screen-result');
          }
          break;
      }
      
      // Met à jour la liste des joueurs dans le lobby
      const list = $('players');
      if (list) {
          list.innerHTML = '';
          list.style.display = 'grid';
          list.style.gridTemplateColumns = 'repeat(auto-fill, minmax(100px, 1fr))';
          list.style.gap = '10px';
          snap.players.forEach(p => {
              const card = document.createElement('div');
              card.className = 'player-card'; 
              card.style.cssText = 'background:rgba(255,255,255,0.05);border-radius:10px;padding:10px;text-align:center;display:flex;flex-direction:column;align-items:center;border:1px solid rgba(255,255,0.1);';
              const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(p.name || 'default')}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
              card.innerHTML = `
                  <img src="${avatarUrl}" style="width:50px;height:50px;border-radius:50%;margin-bottom:6px;" />
                  <div style="font-weight:bold;font-size:0.9rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;">${p.name}</div>
              `;
              list.appendChild(card);
          });
      }

      // Transition spectateur -> actif
      const meNow = snap.players?.find(p => p.id === state.me.id);
      const meBefore = state.room?.players?.find(p => p.id === state.me.id);
      if (meBefore?.spectator && meNow && !meNow.spectator && snap.state === 'lobby') {
        window.HOL.toast('Vous rejoignez la partie !', 1500);
      }
      
      // Ferme les modales si on retourne au lobby
      if (snap.state === 'lobby') {
        const modal = $('modal');
        if (modal && modal.style.display === 'flex') {
          const box = modal.querySelector('.box');
          // Ferme la modale de fin de partie
          if (box && box.innerHTML.includes('PARTIE TERMINEE')) {
            modal.style.display = 'none';
          }
          // Ferme la modale "Partie en cours" pour les spectateurs
          if (box && box.textContent.includes('Partie en cours')) {
            modal.style.display = 'none';
          }
        }
        // Réactive le bouton "Prêt"
        const btnReady = $('btn-ready');
        if (btnReady) {
          btnReady.textContent = 'Je suis pret';
          btnReady.disabled = false;
        }
      }
    });

    // NOUVEAU : Scores reinitialises (apres resetScores)
    socket.on('scoresReset', () => {
      window.HOL.show('screen-lobby');
      const btnReady = $('btn-ready');
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
