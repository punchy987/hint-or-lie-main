(function () {
  const { $, show, socket, state } = window.HOL;

  function playResultCinematic({ win, text, isGameOver = false }) {
    const resultOverlay = $('result-reveal-overlay');
    const victoryBanner = $('victory-banner');
    const defeatBanner = $('defeat-banner');
    
    // Masquer les bannières au départ
    if (victoryBanner) victoryBanner.classList.add('hidden');
    if (defeatBanner) defeatBanner.classList.add('hidden');
    if (resultOverlay) {
      resultOverlay.style.display = '';
      resultOverlay.classList.add('playing');
    }

    // Afficher la bannière appropriée avec un délai
    setTimeout(() => {
      if (win && victoryBanner) {
        victoryBanner.classList.remove('hidden');
      } else if (!win && defeatBanner) {
        defeatBanner.classList.remove('hidden');
      }
    }, 800);

    return new Promise(resolve => setTimeout(() => {
      if (resultOverlay) resultOverlay.classList.remove('playing');
      // Masquer les bannières à la fin
      if (victoryBanner) victoryBanner.classList.add('hidden');
      if (defeatBanner) defeatBanner.classList.add('hidden');
      resolve();
    }, isGameOver ? 3500 : 3000));
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

      // Suspense de 3 secondes avant d'afficher les détails
      await new Promise(resolve => setTimeout(resolve, 3000));

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
        title.textContent = 'DÉTAIL DES VOTES';
        title.style.fontFamily = "'Lexend', sans-serif";
        title.style.fontWeight = '800';
        title.style.textTransform = 'uppercase';
        title.style.letterSpacing = '1px';
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
              voteElement.className = 'arcade-bar';
              voteElement.style.width = 'fit-content';
              voteElement.style.animationDelay = `${index * 0.1}s`;

              const voterSpan = document.createElement('span');
              voterSpan.textContent = voterName;
              voterSpan.style.fontFamily = "'Lexend', sans-serif";
              voterSpan.style.fontWeight = '800';
              voterSpan.style.opacity = '1';

              const arrow = document.createElement('span');
              arrow.textContent = '→';
              arrow.style.color = 'var(--muted)';
              arrow.style.fontWeight = '600';

              const votedSpan = document.createElement('span');
              votedSpan.textContent = votedName;
              votedSpan.style.fontFamily = "'Lexend', sans-serif";
              votedSpan.style.fontWeight = '800';
              votedSpan.style.opacity = '1';
              votedSpan.style.color = votedId === res.impostorId ? 'var(--danger)' : 'var(--crew)';

              voteElement.appendChild(voterSpan);
              voteElement.appendChild(arrow);
              voteElement.appendChild(votedSpan);
              votesList.appendChild(voteElement);
            }
          }, index * 100);
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
      font-family: 'Lexend', sans-serif;
      font-size: 2.2rem;
      font-weight: 800;
      text-align: center;
      color: var(--color-primary);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 30px;
      margin-top: 0;
    `;
    title.textContent = '🏆 PARTIE TERMINÉE !';

    const winnersSection = document.createElement('div');
    winnersSection.style.cssText = `
      background: rgba(232, 197, 71, 0.15);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
      text-align: center;
      box-shadow: inset 0 2px 3px rgba(255,255,255,0.15), inset 0 -3px 4px rgba(0,0,0,0.3);
    `;

    const winnersTitle = document.createElement('h3');
    winnersTitle.textContent = winners.length > 1 ? 'GAGNANTS 🎉' : 'GAGNANT 🎉';
    winnersTitle.style.cssText = `
      font-family: 'Lexend', sans-serif;
      font-size: 1.4rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 0;
      margin-bottom: 16px;
      color: var(--color-primary);
    `;
    winnersSection.appendChild(winnersTitle);

    winners.forEach((w, i) => {
      const winnerDiv = document.createElement('div');
      winnerDiv.className = 'arcade-bar';
      winnerDiv.style.cssText = `
        padding: 14px 20px;
        margin: 12px 0;
        background: rgba(232, 197, 71, 0.15);
        border-radius: 12px;
        font-family: 'Lexend', sans-serif;
        font-weight: 800;
        font-size: 1.2rem;
        box-shadow: inset 0 2px 3px rgba(255,255,255,0.15), inset 0 -3px 4px rgba(0,0,0,0.3), 0 4px 6px rgba(0,0,0,0.2);
        animation: slideInRight ${0.5 + i * 0.2}s ease-out;
      `;
      winnerDiv.innerHTML = `
        <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(w.name)}" 
             style="width: 48px; height: 48px; border-radius: 50%; margin-right: 12px; vertical-align: middle;">
        <span style="font-family: 'Lexend', sans-serif; font-weight: 800;">${w.name}</span>
        <span style="font-family: 'Lexend', sans-serif; color: var(--color-primary); margin-left: 12px; font-weight: 800;">+${w.score}pts</span>
      `;
      winnersSection.appendChild(winnerDiv);
    });

    const scoreboardSection = document.createElement('div');
    scoreboardSection.style.cssText = `
      background: var(--relief-bg);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
      box-shadow: inset 0 2px 3px rgba(255,255,255,0.15), inset 0 -3px 4px rgba(0,0,0,0.3);
    `;

    const scoreboardTitle = document.createElement('h4');
    scoreboardTitle.textContent = 'CLASSEMENT FINAL';
    scoreboardTitle.style.cssText = `
      font-family: 'Lexend', sans-serif;
      font-size: 1.2rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      text-align: center;
      margin-top: 0;
      margin-bottom: 16px;
      color: var(--text-main);
    `;
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
          padding: 10px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          font-family: 'Lexend', sans-serif;
          font-size: 1.1rem;
          animation: fadeIn ${0.3 + i * 0.1}s ease-out;
        `;
        scoreDiv.innerHTML = `
          <span style="font-family: 'Lexend', sans-serif; font-weight: 600;">${medal} ${p.name}</span>
          <span style="font-family: 'Lexend', sans-serif; font-weight: 800; color: var(--color-primary);">${finalScores[p.id] || 0}pts</span>
        `;
        scoreboardSection.appendChild(scoreDiv);
      });
    }

    const actionsDiv = document.createElement('div');
    actionsDiv.style.cssText = `
      display: flex;
      gap: 16px;
      margin-top: 24px;
    `;

    const btnHome = document.createElement('button');
    btnHome.textContent = '🏠 ACCUEIL';
    btnHome.type = 'button';
    btnHome.className = 'btn';
    btnHome.style.cssText = `
      flex: 1;
      padding: 16px;
      background: var(--relief-bg);
      color: var(--text-main);
      border: none;
      border-radius: 16px;
      font-family: 'Lexend', sans-serif;
      font-size: 1.2rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      cursor: pointer;
      transition: transform 0.2s ease-out;
      box-shadow: inset 0 2px 3px rgba(255,255,255,0.15), inset 0 -3px 4px rgba(0,0,0,0.3), 0 4px 6px rgba(0,0,0,0.2);
    `;
    btnHome.onclick = () => {
      modal.style.display = 'none';
      socket.emit('leaveRoom');
    };
    btnHome.onmouseover = () => btnHome.style.transform = 'translateY(-2px)';
    btnHome.onmouseout = () => btnHome.style.transform = 'translateY(0)';

    const btnRestart = document.createElement('button');
    btnRestart.textContent = '🔄 RECOMMENCER';
    btnRestart.type = 'button';
    btnRestart.className = 'btn';

    const isHost = window.HOL?.state?.room?.hostId === window.HOL?.state?.me?.id;

    if (isHost) {
      btnRestart.style.cssText = `
        flex: 1;
        padding: 16px;
        background: var(--color-primary);
        color: var(--bg-main);
        border: none;
        border-radius: 16px;
        font-family: 'Lexend', sans-serif;
        font-size: 1.2rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 1px;
        cursor: pointer;
        transition: transform 0.2s ease-out;
        box-shadow: inset 0 2px 3px rgba(255,255,255,0.15), inset 0 -3px 4px rgba(0,0,0,0.3), 0 4px 6px rgba(0,0,0,0.2);
      `;
      btnRestart.onclick = () => {
        modal.style.display = 'none';
        socket.emit('resetScores');
      };
      btnRestart.onmouseover = () => btnRestart.style.transform = 'translateY(-2px)';
      btnRestart.onmouseout = () => btnRestart.style.transform = 'translateY(0)';
    } else {
      btnRestart.textContent = '🔄 SEUL L\'HÔTE PEUT RECOMMENCER';
      btnRestart.disabled = true;
      btnRestart.style.cssText = `
        flex: 1;
        padding: 16px;
        background: rgba(255, 255, 255, 0.05);
        color: rgba(241, 242, 246, 0.4);
        border: none;
        border-radius: 16px;
        font-family: 'Lexend', sans-serif;
        font-size: 1rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        cursor: not-allowed;
        box-shadow: inset 0 2px 3px rgba(0,0,0,0.3);
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