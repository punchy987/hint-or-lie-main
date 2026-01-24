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
      const resultOverlay = $('result-reveal-overlay');
      const resultText = $('reveal-result-text');
      const win = state.myIsImpostor ? !res.impostorCaught : res.impostorCaught;

      // Setup result cinematic
      resultText.textContent = win ? 'VICTOIRE !' : 'DÉFAITE...';
      resultText.className = win ? 'victory' : 'defeat';
      
      // Play cinematic
      resultOverlay.classList.add('playing');

      // After cinematic, show results screen
      setTimeout(() => {
        resultOverlay.classList.remove('playing');
        show('screen-result');

        // Reset "Next" button state
        $('btn-next').disabled = false;
        $('btn-next').textContent = 'Manche suivante';

        // ('res-domain').textContent = res.domain || '?';
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

        // Display votes detail
        const votesContainer = $('res-votes');
        votesContainer.innerHTML = ''; // Clear previous votes

        if (res.votesDetail && state.room && state.room.players) {
          // Suggestion: Add a sound effect for each vote reveal for more juice.
          
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

          // Staggered animation for revealing votes
          voteEntries.forEach(([voterId, votedId], index) => {
            setTimeout(() => {
              const voterName = playersById.get(voterId);
              const votedName = playersById.get(votedId);

              if (voterName && votedName) {
                const voteElement = document.createElement('div');
                voteElement.className = 'vote-reveal'; // Animation class
                voteElement.style.display = 'flex';
                voteElement.style.alignItems = 'center';
                voteElement.style.gap = '8px';
                voteElement.style.padding = '4px 8px';
                voteElement.style.background = 'rgba(255, 255, 255, 0.05)';
                voteElement.style.borderRadius = '6px';
                voteElement.style.width = 'fit-content';

                // Voter Avatar
                const voterImg = document.createElement('img');
                voterImg.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(voterName)}&backgroundColor=b6e3f4,c0aede,d1d4f9&scale=80`;
                voterImg.style.width = '32px';
                voterImg.style.height = '32px';
                voterImg.style.borderRadius = '50%';
                voterImg.style.border = '2px solid var(--ink)';

                const voterSpan = document.createElement('span');
                voterSpan.textContent = voterName;
                voterSpan.style.fontWeight = 'bold';
                
                const arrowSpan = document.createElement('span');
                arrowSpan.textContent = '→';

                // Voted Avatar
                const votedImg = document.createElement('img');
                votedImg.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(votedName)}&backgroundColor=b6e3f4,c0aede,d1d4f9&scale=80`;
                votedImg.style.width = '32px';
                votedImg.style.height = '32px';
                votedImg.style.borderRadius = '50%';

                const votedSpan = document.createElement('span');
                votedSpan.textContent = votedName;
                
                if (votedId === res.impostorId) {
                  // Highlight impostor vote
                  // Suggestion: Add a special sound effect here.
                  votedSpan.style.color = 'var(--danger)';
                  votedSpan.style.fontWeight = 'bold';
                  votedImg.style.border = '2px solid var(--danger)';
                  voteElement.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.3)';
                } else {
                  votedImg.style.border = '2px solid var(--ink)';
                }

                voteElement.appendChild(voterImg);
                voteElement.appendChild(voterSpan);
                voteElement.appendChild(arrowSpan);
                voteElement.appendChild(votedImg);
                voteElement.appendChild(votedSpan);
                
                votesList.appendChild(voteElement);
              }
            }, index * 400); // 400ms delay between each vote
          });
          votesContainer.appendChild(votesList);
        }
      }, 2500); // Show result screen after 2.5s
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