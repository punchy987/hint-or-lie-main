(function () {
  const { $, show, socket, state } = window.HOL;

  function playResultCinematic({ win, text, isGameOver = false }) {
    const resultOverlay = $('result-reveal-overlay');
    const resultText = $('reveal-result-text');
    
    if (resultText) resultText.textContent = text;
    if (isGameOver) {
      if (resultText) resultText.style.fontSize = 'clamp(2rem, 10vw, 5rem)';
    }
    if (resultText) resultText.className = win ? 'victory' : 'defeat';
    if (resultOverlay) resultOverlay.classList.add('playing');

    if (win && window.confetti) {
      const config = isGameOver
        ? { particleCount: 200, spread: 90, origin: { y: 0.6 }, gravity: 0.8 }
        : { particleCount: 100, spread: 70, origin: { y: 0.6 } };
      confetti(config);
      if (isGameOver) {
        setTimeout(() => confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } }), 500);
      }
    }

    return new Promise(resolve => setTimeout(() => {
      if (resultOverlay) resultOverlay.classList.remove('playing');
      resolve();
    }, isGameOver ? 3500 : 2500));
  }

  function initUI() {
    const btnNext = $('btn-next');
    if (btnNext) btnNext.onclick = () => {
      btnNext.disabled = true;
      btnNext.textContent = 'Prêt ✓';
      socket.emit('playerReadyNext');
    };
    const btnModalLobby = $('btn-modal-lobby');
    if (btnModalLobby) btnModalLobby.onclick = () => { 
      show('screen-lobby'); 
      const modal = $('modal');
      if (modal) modal.style.display = 'none'; 
    };
  }

  function initSocket() {
    socket.on('roundResult', async (res) => {
      if (res.isGameOver) return;

      const win = state.myIsImpostor ? !res.impostorCaught : res.impostorCaught;
      await playResultCinematic({ win, text: win ? 'VICTOIRE !' : 'DÉFAITE...' });
      
      show('screen-result');

      const btnNext = $('btn-next');
      if (btnNext) { btnNext.disabled = false; btnNext.textContent = 'Manche suivante'; }
      const resCommon = $('res-common');
      if (resCommon) resCommon.textContent = res.common || '';

      const impName = res.impostorName || '(?)';
      const impContainer = $('res-imp-name');
      if (impContainer) {
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
      }

      const votesContainer = $('res-votes');
      if (votesContainer) votesContainer.innerHTML = '';

      if (votesContainer && res.votesDetail && state.room?.players) {
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
    });

    socket.on('gameOver', async ({ winners, finalScores, winnersCount }) => {
      const playerWon = winners.some(w => w.id === state.me.id);
      const text = winnersCount > 1 ? '🏆 ÉGALITÉ !' : '🏆 PARTIE TERMINÉE !';
      
      await playResultCinematic({ win: playerWon, text, isGameOver: true });
      showGameOverModal(winners, finalScores);
    });
  }

  function showGameOverModal(winners, finalScores) {
    const modal = $('modal');
    if (!modal) return;

    modal.style.display = 'flex';
    const box = modal.querySelector('.box');
    if (!box) return;

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
    };
    btnHome.onmouseover = () => btnHome.style.opacity = '0.9';
    btnHome.onmouseout = () => btnHome.style.opacity = '1';

    const btnRestart = document.createElement('button');
    btnRestart.textContent = '🔄 Recommencer';
    btnRestart.type = 'button';

    const isHost = window.HOL?.state?.room?.hostId === window.HOL?.state?.me?.id;

    if (isHost) {
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
      };
      btnRestart.onmouseover = () => btnRestart.style.opacity = '0.9';
      btnRestart.onmouseout = () => btnRestart.style.opacity = '1';
    } else {
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