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
    // ========== MANCHE NORMALE ==========
    socket.on('roundResult', (res) => {
      if (res.isGameOver) return; // Déléguée à gameOver

      const resultOverlay = $('result-reveal-overlay');
      const resultText = $('reveal-result-text');
      const win = state.myIsImpostor ? !res.impostorCaught : res.impostorCaught;

      // Cinématique victoire/défaite
      resultText.textContent = win ? 'VICTOIRE !' : 'DÉFAITE...';
      resultText.className = win ? 'victory' : 'defeat';
      resultOverlay.classList.add('playing');

      // Confetti si victoire
      if (win && window.confetti) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }

      setTimeout(() => {
        resultOverlay.classList.remove('playing');
        show('screen-result');

        $('btn-next').disabled = false;
        $('btn-next').textContent = 'Manche suivante';
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
        img.style.width = '120px';
        img.style.height = '120px';
        img.style.borderRadius = '50%';
        img.style.border = `4px solid ${res.impostorCaught ? 'var(--crew)' : 'var(--danger)'}`;
        img.style.boxShadow = `0 0 20px rgba(${res.impostorCaught ? '59, 130, 246' : '239, 68, 68'}, 0.4)`;

        const nameSpan = document.createElement('span');
        nameSpan.textContent = impName;
        nameSpan.style.fontSize = '1.8rem';
        nameSpan.style.fontWeight = '900';
        nameSpan.style.color = res.impostorCaught ? 'var(--crew)' : 'var(--danger)';

        impContainer.appendChild(img);
        impContainer.appendChild(nameSpan);

        // Détail des votes (staggered)
        const votesContainer = $('res-votes');
        votesContainer.innerHTML = '';

        if (res.votesDetail && state.room?.players) {
          const title = document.createElement('h4');
          title.textContent = 'Détail des votes';
          title.style.textAlign = 'center';
          title.style.marginBottom = '10px';
          votesContainer.appendChild(title);

          const votesList = document.createElement('div');
          votesList.style.display = 'flex';
          votesList.style.flexDirection = 'column';
          votesList.style.gap = '8px';
          votesList.style.alignItems = 'center';

          const playersById = new Map(state.room.players.map(p => [p.id, p.name]));
          const voteEntries = Object.entries(res.votesDetail);

          voteEntries.forEach(([voterId, votedId], index) => {
            setTimeout(() => {
              const voterName = playersById.get(voterId);
              const votedName = playersById.get(votedId);

              if (voterName && votedName) {
                const voteElement = document.createElement('div');
                voteElement.style.display = 'flex';
                voteElement.style.alignItems = 'center';
                voteElement.style.gap = '8px';
                voteElement.style.padding = '4px 8px';
                voteElement.style.background = 'rgba(255, 255, 255, 0.05)';
                voteElement.style.borderRadius = '6px';
                voteElement.style.width = 'fit-content';

                const voterSpan = document.createElement('span');
                voterSpan.textContent = voterName;
                voterSpan.style.fontWeight = '700';

                const arrow = document.createElement('span');
                arrow.textContent = '→';
                arrow.style.color = 'var(--muted)';

                const votedSpan = document.createElement('span');
                votedSpan.textContent = votedName;
                votedSpan.style.fontWeight = '700';
                votedSpan.style.color = votedId === res.impostorId ? 'var(--danger)' : 'var(--crew)';

                voteElement.appendChild(voterSpan);
                voteElement.appendChild(arrow);
                voteElement.appendChild(votedSpan);
                votesList.appendChild(voteElement);
              }
            }, index * 400);
          });

          votesContainer.appendChild(votesList);
        }
      }, 2500);
    });

    // ========== FIN DE PARTIE (10 PTS) ==========
    socket.on('gameOver', ({ winners, finalScores, winnersCount }) => {
      // ✅ Cinématique finale spectaculaire
      const resultOverlay = $('result-reveal-overlay');
      const resultText = $('reveal-result-text');

      const playerWon = winners.some(w => w.id === state.me.id);

      resultText.textContent = winnersCount > 1 ? '🏆 ÉGALITÉ !' : '🏆 PARTIE TERMINÉE !';
      resultText.style.fontSize = 'clamp(2rem, 10vw, 5rem)';
      resultText.className = playerWon ? 'victory' : 'defeat';
      resultOverlay.classList.add('playing');

      // Confetti spectaculaire
      if (playerWon && window.confetti) {
        confetti({ particleCount: 200, spread: 90, origin: { y: 0.6 }, gravity: 0.8 });
        setTimeout(() => {
          confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        }, 500);
      }

      setTimeout(() => {
        resultOverlay.classList.remove('playing');
        showGameOverModal(winners, finalScores);
      }, 3500);
    });

    socket.on('roomUpdate', (snap) => {
      state.room = snap;
      if (snap.state === 'lobby') {
        const modal = $('modal');
        if (modal && modal.style.display === 'flex') {
          modal.style.display = 'none';
          show('screen-home');
        }
      }
    });
  }

  function showGameOverModal(winners, finalScores) {
    const modal = $('modal');
    if (!modal) return;

    modal.style.display = 'flex';
    const box = modal.querySelector('.box');
    if (!box) return;

    // Titre
    const title = document.createElement('h2');
    title.style.cssText = `
      font-size: 2.5rem;
      text-align: center;
      background: linear-gradient(45deg, var(--accent), #ff3b3b);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 20px;
      animation: pulse-glow 1.5s ease-in-out infinite;
    `;
    title.textContent = '🏆 PARTIE TERMINÉE !';

    // Gagnant(s)
    const winnersSection = document.createElement('div');
    winnersSection.style.cssText = `
      background: rgba(74, 222, 128, 0.1);
      border: 2px solid rgba(74, 222, 128, 0.3);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 20px;
      text-align: center;
    `;

    const winnersTitle = document.createElement('h3');
    winnersTitle.textContent = winners.length > 1 ? 'Gagnants 🎉' : 'Gagnant 🎉';
    winnersTitle.style.cssText = 'margin-top: 0; color: var(--accent-3);';
    winnersSection.appendChild(winnersTitle);

    winners.forEach((w, i) => {
      const winnerDiv = document.createElement('div');
      winnerDiv.style.cssText = `
        padding: 8px;
        margin: 8px 0;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        font-weight: 800;
        font-size: 1.3rem;
        animation: slideInRight ${0.5 + i * 0.2}s ease-out;
      `;
      winnerDiv.innerHTML = `
        <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(w.name)}" 
             style="width: 48px; height: 48px; border-radius: 50%; margin-right: 12px; vertical-align: middle;">
        <span>${w.name}</span>
        <span style="color: var(--accent-3); margin-left: 12px;">+${w.score}pts</span>
      `;
      winnersSection.appendChild(winnerDiv);
    });

    // Scoreboard final
    const scoreboardSection = document.createElement('div');
    scoreboardSection.style.cssText = `
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 20px;
    `;

    const scoreboardTitle = document.createElement('h4');
    scoreboardTitle.textContent = 'Classement Final';
    scoreboardTitle.style.cssText = 'text-align: center; margin-top: 0; color: var(--muted);';
    scoreboardSection.appendChild(scoreboardTitle);

    if (state.room?.players) {
      const sorted = [...state.room.players]
        .sort((a, b) => (finalScores[b.id] || 0) - (finalScores[a.id] || 0));

      sorted.forEach((p, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '·';
        const scoreDiv = document.createElement('div');
        scoreDiv.style.cssText = `
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          animation: fadeIn ${0.3 + i * 0.1}s ease-out;
        `;
        scoreDiv.innerHTML = `
          <span>${medal} ${p.name}</span>
          <span style="font-weight: 800; color: var(--accent);">${finalScores[p.id] || 0}pts</span>
        `;
        scoreboardSection.appendChild(scoreDiv);
      });
    }

    // Boutons action
    const actionsDiv = document.createElement('div');
    actionsDiv.style.cssText = `
      display: flex;
      gap: 10px;
      margin-top: 20px;
    `;

    const btnHome = document.createElement('button');
    btnHome.textContent = '🏠 Accueil';
    btnHome.type = 'button';
    btnHome.style.cssText = `
      flex: 1;
      padding: 12px;
      background: var(--primary);
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 800;
      cursor: pointer;
      transition: 0.2s;
    `;
    btnHome.onclick = () => {
      modal.style.display = 'none';
      socket.emit('leaveRoom');
      // ✅ Attendre le signal leftRoom pour changer d'écran
    };
    btnHome.onmouseover = () => btnHome.style.opacity = '0.9';
    btnHome.onmouseout = () => btnHome.style.opacity = '1';

    const btnRestart = document.createElement('button');
    btnRestart.textContent = '🔄 Recommencer';
    btnRestart.type = 'button';

    const isHost = window.HOL?.state?.room?.hostId === window.HOL?.state?.me?.id;

    if (isHost) {
      // ✅ Hôte peut recommencer
      btnRestart.style.cssText = `
        flex: 1;
        padding: 12px;
        background: var(--accent);
        color: #4d0d17;
        border: none;
        border-radius: 8px;
        font-weight: 800;
        cursor: pointer;
        transition: 0.2s;
      `;
      btnRestart.onclick = () => {
        modal.style.display = 'none';
        socket.emit('resetScores');
        // ✅ Attendre le signal scoresReset pour transition
      };
      btnRestart.onmouseover = () => btnRestart.style.opacity = '0.9';
      btnRestart.onmouseout = () => btnRestart.style.opacity = '1';
    } else {
      // ✅ Non-hôte : désactivé
      btnRestart.textContent = '🔄 Seul l\'hôte peut recommencer';
      btnRestart.disabled = true;
      btnRestart.style.cssText = `
        flex: 1;
        padding: 12px;
        background: rgba(255, 255, 255, 0.1);
        color: var(--muted);
        border: none;
        border-radius: 8px;
        font-weight: 800;
        cursor: not-allowed;
      `;
    }

    actionsDiv.appendChild(btnHome);
    actionsDiv.appendChild(btnRestart);

    // Assemble la modale
    box.innerHTML = '';
    box.appendChild(title);
    box.appendChild(winnersSection);
    box.appendChild(scoreboardSection);
    box.appendChild(actionsDiv);
  }

  function init() { initUI(); initSocket(); }
  window.HOL.features = window.HOL.features || {};
  window.HOL.features.results = { init };
})();