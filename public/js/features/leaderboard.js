// public/js/features/leaderboard.js
// ✅ Scoreboard unifié avec structure grid : LED | AVATAR | NOM | PTS

(function () {
  const { $ } = window.HOL;

  function updateScoreboard(players) {
    const list = $('score-list');
    if (!list) return;

    list.innerHTML = '';
    const sorted = [...(players || [])].sort((a, b) => (b.score || 0) - (a.score || 0));

    sorted.forEach(p => {
      const li = document.createElement('li');
      li.className = 'player-row';
      
      // ✅ 1. LED avec logique de statut
      const led = document.createElement('div');
      led.className = 'status-led';
      
      // Logique de couleur LED
      if (p.disconnected) {
        led.classList.add('status-offline');
      } else if (p.spectator || p.phase === 'lobby' || !p.active) {
        led.classList.add('status-lobby');
      } else {
        led.classList.add('status-online');
      }
      
      li.appendChild(led);

      // ✅ 2. Avatar
      const img = document.createElement('img');
      const seed = (p.name || '').trim() || 'default';
      img.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
      img.className = 'player-avatar-small';
      img.alt = p.name || 'Joueur';
      li.appendChild(img);

      // ✅ 3. Nom
      const nameSpan = document.createElement('span');
      nameSpan.className = 'player-name';
      nameSpan.textContent = p.name || 'Joueur';
      li.appendChild(nameSpan);

      // ✅ 4. Score
      const scoreSpan = document.createElement('span');
      scoreSpan.className = 'player-score';
      scoreSpan.textContent = `${p.score || 0} pts`;
      li.appendChild(scoreSpan);

      // ✅ 5. Emoji de statut selon la phase
      const emojiSpan = document.createElement('span');
      emojiSpan.className = 'status-icon';
      
      const currentPhase = window.HOL?.state?.currentPhase || 'lobby';
      let emoji = '';
      let isWaiting = false;
      
      if (p.disconnected) {
        emoji = '❌'; // Croix rouge pour déconnecté
      } else if (currentPhase === 'lobby') {
        if (p.isReady || p.ready) {
          emoji = '✅'; // Check vert si prêt
        } else {
          emoji = '⏳'; // Sablier si en attente
          isWaiting = true;
        }
      } else if (currentPhase === 'hint') {
        if (p.hasSentHint || p.hintSent) {
          emoji = '📤'; // Enveloppe envoyée
        } else {
          emoji = '✍️'; // Main qui écrit
          isWaiting = true;
        }
      } else if (currentPhase === 'vote') {
        if (p.hasVoted || p.voted) {
          emoji = '🗳️'; // Urne de vote
        } else {
          emoji = '🤔'; // Visage pensif
          isWaiting = true;
        }
      }
      
      emojiSpan.textContent = emoji;
      if (isWaiting) {
        emojiSpan.classList.add('status-icon-waiting');
      }
      li.appendChild(emojiSpan);

      // Highlight du joueur local
      if (p.id === window.HOL?.state?.me?.id) {
        li.classList.add('me');
      }

      list.appendChild(li);
    });
  }

  function init() {}

  window.HOL = window.HOL || {};
  window.HOL.updateScoreboard = updateScoreboard;
  window.HOL.features = window.HOL.features || {};
  window.HOL.features.leaderboard = { init };
})();
