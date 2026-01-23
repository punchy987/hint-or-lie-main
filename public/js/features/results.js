(function () {
  const { $, show, socket, state } = window.HOL;

  function initUI() {
    $('btn-next').onclick = () => {
      $('btn-next').disabled = true;
      $('btn-next').textContent = 'Prêt ✓';
      socket.emit('playerReadyNext');
    };
    $('btn-modal-lobby').onclick = () => { 
      show('screen-lobby'); 
      $('modal').style.display = 'none'; 
    };
  }

  function initSocket() {
    socket.on('roundResult', (res) => {
      show('screen-result');
      $('res-domain').textContent = res.domain || '?';
      $('res-common').textContent = res.common || '';

      const impName = res.impostorName || '(?)';
      const impContainer = $('res-imp-name');
      
      impContainer.innerHTML = '';
      impContainer.style.display = 'flex';
      impContainer.style.flexDirection = 'column';
      impContainer.style.alignItems = 'center';
      impContainer.style.gap = '10px';

      const img = document.createElement('img');
      img.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(impName)}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
      img.style.width = '120px'; // Taille équilibrée
      img.style.height = '120px';
      img.style.borderRadius = '50%';
      img.style.border = '4px solid var(--danger)';
      img.style.boxShadow = '0 0 20px rgba(239, 68, 68, 0.4)';

      const nameSpan = document.createElement('span');
      nameSpan.textContent = impName;
      nameSpan.style.fontSize = '1.8rem';
      nameSpan.style.fontWeight = '900';
      nameSpan.style.color = 'var(--danger)';

      impContainer.appendChild(img);
      impContainer.appendChild(nameSpan);

      // Gestion de la bannière
      let win = state.myIsImpostor ? !res.impostorCaught : res.impostorCaught;
      const banner = $('personal-banner');
      if (banner) {
        banner.textContent = win ? 'VICTOIRE !' : 'DÉFAITE...';
        banner.style.color = win ? 'var(--crew)' : 'var(--danger)';
      }
    });

    socket.on('gameOver', ({ winners }) => {
      $('modal').style.display = 'flex';
      $('winners-text').textContent = winners.map(w => w.name).join(', ') + " gagne !";
    });
  }

  function init() { initUI(); initSocket(); }
  window.HOL.features = window.HOL.features || {};
  window.HOL.features.results = { init };
})();