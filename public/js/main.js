﻿(function () {
  const { $, fmt, state, socket, startPhaseAnim } = window.HOL;

  function updateUIFromState(snap) {
      state.room = snap;

      if ($('round-num')) $('round-num').textContent = snap.round;
      
      if (window.HOL.updateScoreboard) window.HOL.updateScoreboard(snap.players);

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
          if (document.body.getAttribute('data-screen') !== 'screen-result') {
            window.HOL.show('screen-result');
          }
          break;
      }
      
      const list = $('players');
      if (list) {
          list.innerHTML = '';
          snap.players.forEach(p => {
              const card = document.createElement('div');
              card.className = 'player-card';
              
              // Determine status
              let statusText = '';
              if (p.disconnected) statusText = 'Déconnecté';
              else if (p.ready) statusText = 'Prêt ✓';

              const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(p.name || 'default')}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
              card.innerHTML = `
                  <img src="${avatarUrl}" alt="Avatar de ${p.name}">
                  <div class="player-name">${p.name}</div>
                  ${statusText ? `<div class="player-status">${statusText}</div>` : ''}
              `;
              list.appendChild(card);
          });
      }

      const meNow = snap.players?.find(p => p.id === state.me.id);
      const meBefore = state.room?.players?.find(p => p.id === state.me.id);
      if (meBefore?.spectator && meNow && !meNow.spectator && snap.state === 'lobby') {
        window.HOL.toast('Vous rejoignez la partie !', 1500);
      }
      
      if (snap.state === 'lobby') {
        const modal = $('modal');
        if (modal && modal.style.display === 'flex') {
          const box = modal.querySelector('.box');
          if (box && box.innerHTML.includes('PARTIE TERMINEE')) {
            modal.style.display = 'none';
          }
          if (box && box.textContent.includes('Partie en cours')) {
            modal.style.display = 'none';
          }
        }
        const btnReady = $('btn-ready');
        if (btnReady) {
          btnReady.textContent = 'Je suis prêt';
          btnReady.disabled = false;
        }
      }
    }
  window.HOL.updateUIFromState = updateUIFromState;
  function initTimersFromServer() {
    let lastDeadline = null;
    let localTimerRAF = null;

    socket.on('timer', ({ phase, leftMs, totalMs }) => {
      if (phase !== state.currentPhase) state.currentPhase = phase;

      lastDeadline = Date.now() + leftMs;

      startPhaseAnim(phase, totalMs || state.DUR[phase] || 0, leftMs);

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

    socket.on('roomState', (snap) => {
      window.HOL.updateUIFromState(snap);
    });

    socket.on('scoresReset', () => {
      window.HOL.show('screen-lobby');
      const btnReady = $('btn-ready');
      if (btnReady) {
        btnReady.textContent = 'Je suis prêt';
        btnReady.disabled = false;
      }
      state.myLobbyReady = false;
      window.HOL.toast('Partie réinitialisée !', 1500);
    });
  }

  function init() {
    window.HOL.features.home.init();
    window.HOL.features.hints.init();
    window.HOL.features.vote.init();
    window.HOL.features.results.init();
    window.HOL.features.leaderboard.init();
    initTimersFromServer();
    document.body.setAttribute('data-screen', 'screen-home');
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
