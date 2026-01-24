// public/js/features/leaderboard.js

(function () {
  const { $ } = window.HOL;

  function updateScoreboard(players) {
    const list = $('score-list');
    if (!list) return;

    list.innerHTML = '';
    const sorted = [...(players || [])].sort((a, b) => (b.score || 0) - (a.score || 0));
    const currentState = window.HOL.state?.state || 'lobby';

    sorted.forEach(p => {
      const li = document.createElement('li');
      if (p.id === window.HOL.state.me?.id) li.className = 'me';

      // Conteneur Avatar
      const avatarBox = document.createElement('div');
      avatarBox.className = 'avatar-box';

      const img = document.createElement('img');
      const seed = (p.name || '').trim() || 'default';
      img.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
      img.className = 'score-avatar';
      
      // LED de statut
      const led = document.createElement('div');
      let ledClass = 'status-led'; // Classe de base (éteinte/défaut)

      // Logique de priorité des couleurs
      if (p.disconnected) {
        ledClass += ' is-disconnected'; // Priorité absolue : déconnecté
      } else if (p.active) {
        ledClass += ' is-active';       // En jeu (Vert)
      } else if (currentState === 'lobby' && p.ready) {
        ledClass += ' is-ready';        // En attente et Prêt (Orange)
      }
      // Sinon : reste "status-led" (éteinte/gris, ex: spectateur ou pas encore prêt)

      led.className = ledClass;
      
      avatarBox.appendChild(img);
      avatarBox.appendChild(led);

      const nameSpan = document.createElement('span');
      nameSpan.className = 'name';
      nameSpan.textContent = p.name;

      const scoreSpan = document.createElement('span');
      scoreSpan.className = 'pts';
      scoreSpan.textContent = p.score || 0;

      li.appendChild(avatarBox);
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
