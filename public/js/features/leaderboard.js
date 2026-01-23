(function () {
  const { $ } = window.HOL;

  function updateScoreboard(players) {
    const list = $('score-list');
    if (!list) return;

    list.innerHTML = '';
    const sorted = [...(players || [])].sort((a, b) => (b.score || 0) - (a.score || 0));

    sorted.forEach(p => {
      const li = document.createElement('li');
      if (p.id === window.HOL.state.myId) li.className = 'me';

      // 1. Avatar
      const img = document.createElement('img');
      const seed = (p.name || '').trim() || 'default';
      img.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
      img.className = 'score-avatar';
      
      // 2. Nom (Utilise la classe .name du CSS)
      const nameSpan = document.createElement('span');
      nameSpan.className = 'name';
      nameSpan.textContent = p.name;

      // 3. Score (Utilise la classe .pts du CSS)
      const scoreSpan = document.createElement('span');
      scoreSpan.className = 'pts';
      scoreSpan.textContent = p.score || 0;

      li.appendChild(img);
      li.appendChild(nameSpan);
      li.appendChild(scoreSpan);
      list.appendChild(li);
    });
  }

  function init() {}

  window.HOL = window.HOL || {};
  window.HOL.updateScoreboard = updateScoreboard;
  window.HOL.features = window.HOL.features || {};
  window.HOL.features.leaderboard = { init };
})();