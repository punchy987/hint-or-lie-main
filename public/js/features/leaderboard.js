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
      
      // ✅ 1. LED (positionné en absolute, parent en relative)
      const ledContainer = document.createElement('div');
      ledContainer.style.cssText = 'position: relative; width: 10px; height: 32px;';
      
      const led = document.createElement('div');
      led.className = 'status-led';
      
      // Logique de couleur
      if (p.disconnected) {
        led.classList.add('is-disconnected');
      } else if (p.spectator) {
        led.classList.add('is-ready');  // Orange pour spectateur
      } else if (p.active) {
        led.classList.add('is-active');  // Vert pour actif
      }
      
      ledContainer.appendChild(led);
      li.appendChild(ledContainer);

      // ✅ 2. Avatar (taille forcée)
      const img = document.createElement('img');
      const seed = (p.name || '').trim() || 'default';
      img.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
      img.className = 'score-avatar';
      img.style.cssText = 'width: 32px; height: 32px; border-radius: 50%; object-fit: cover; background: rgba(255, 255, 255, 0.05);';
      li.appendChild(img);

      // ✅ 3. Nom (avec mention si spectateur)
      let nameText = p.name || 'Joueur';
      if (p.spectator) nameText += ' (en attente)';
      if (p.disconnected) nameText += ' (déconnecté)';
      
      const nameSpan = document.createElement('span');
      nameSpan.className = 'name';
      nameSpan.textContent = nameText;
      li.appendChild(nameSpan);

      // ✅ 4. Score
      const scoreSpan = document.createElement('span');
      scoreSpan.className = 'pts';
      scoreSpan.textContent = String(p.score || 0);
      li.appendChild(scoreSpan);

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
