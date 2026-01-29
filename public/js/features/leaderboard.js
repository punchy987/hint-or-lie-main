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
      // LED statut
      const led = document.createElement('div');
      led.className = 'status-led';
      if (p.disconnected) {
        led.classList.add('status-offline');
      } else if (p.phase === 'lobby') {
        if (p.isReady || p.ready) {
          led.classList.add('status-lobby-ready');
        } else {
          led.classList.add('status-lobby-notready');
        }
      } else {
        led.classList.add('status-online');
      }
      li.appendChild(led);
      // Avatar
      const img = document.createElement('img');
      const seed = (p.name || '').trim() || 'default';
      img.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
      img.className = 'player-avatar-small';
      img.alt = p.name || 'Joueur';
      li.appendChild(img);
      // Nom
      const nameSpan = document.createElement('span');
      nameSpan.className = 'player-name';
      nameSpan.textContent = p.name || 'Joueur';
      li.appendChild(nameSpan);
      // Score
      const scoreSpan = document.createElement('span');
      scoreSpan.className = 'player-score';
      scoreSpan.textContent = `${p.score || 0} pts`;
      li.appendChild(scoreSpan);
      // Emoji de statut
      const emojiSpan = document.createElement('span');
      emojiSpan.className = 'status-icon';
      const currentPhase = window.HOL?.state?.currentPhase || 'lobby';
      let emoji = '';
      let isWaiting = false;
      if (p.disconnected) {
        emoji = '❌';
      } else if (currentPhase === 'lobby') {
        if (p.isReady || p.ready) {
          emoji = '✅';
        } else {
          emoji = '⏳';
          isWaiting = true;
        }
      } else if (currentPhase === 'hint') {
        if (p.hasSentHint || p.hintSent) {
          emoji = '📤';
        } else {
          emoji = '✍️';
          isWaiting = true;
        }
      } else if (currentPhase === 'vote') {
        if (p.hasVoted || p.voted) {
          emoji = '🗳️';
        } else {
          emoji = '🤔';
          isWaiting = true;
        }
      }
      emojiSpan.textContent = emoji;
      if (isWaiting) {
        emojiSpan.classList.add('status-icon-waiting');
      }
      li.appendChild(emojiSpan);
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
