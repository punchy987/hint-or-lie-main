(function () {
  const { $, $$, toast, show, state, socket, resetPhaseProgress, onEnter } = window.HOL;

  let sending = false;
  let locked  = false;
  let liveBox = null;
  let liveList = null;
  let hintStatusTimer = null;

  const ui = {
    role:   () => $('my-role'),
    theme:  () => $('theme-hint-name'),
    tip:    () => $('impostor-tip'),
    input:  () => $('hint-input'),
    send:   () => $('btn-send-hint'),
    status: () => $('hint-status'),
    wordChip:     () => $('crew-word-chip'),
    wordChipText: () => $('crew-word'),
  };

  function applyRoleTheme(isImpostor) {
    const body = document.body;
    body.classList.remove('theme-impostor', 'theme-crew');
    if (isImpostor) {
      body.classList.add('theme-impostor');
      body.style.animation = 'flash-red 0.5s ease-out';
      setTimeout(() => body.style.animation = '', 500);
    } else {
      body.classList.add('theme-crew');
    }
  }

  function resetTheme() {
    document.body.classList.remove('theme-impostor', 'theme-crew');
  }

  function playRoleCinematic(isImpostor, callback) {
    const overlay = $('role-reveal-overlay');
    const roleText = $('reveal-role-text');
    if (!overlay || !roleText) { callback(); return; } 

    // Retour haptique pour la révélation de rôle
    if (navigator.vibrate) {
      navigator.vibrate(200);
    }

    overlay.style.display = '';
    roleText.textContent = isImpostor ? 'IMPOSTEUR' : 'ÉQUIPIER';
    roleText.className = isImpostor ? 'impostor' : 'crew';
    overlay.classList.add('playing');

    setTimeout(() => {
      overlay.classList.remove('playing');
      callback(); 
    }, 3000); 
  }

  function setRound(num) { $$('.round-live').forEach(el => el.textContent = String(num || 0)); }
  
  function ensureLiveUI() {
    if (liveBox && liveList) return;
    liveBox = document.createElement('div');
    liveBox.id = 'crew-live-box';
    liveBox.className = 'tip';
    liveBox.innerHTML = `<strong>📡 Indices interceptés (live)</strong><ul id="crew-live-list" style="margin-top:8px;"></ul>`;
    liveList = liveBox.querySelector('#crew-live-list');
  }

  function sendHint() {
    if (locked || sending) return;
    const inputEl = ui.input();
    const val = (inputEl?.value || '').trim();
    if (!val) {
      const status = ui.status();
      if (status) {
        status.textContent = 'Écris un indice 😉';
        status.classList.add('error');
        setTimeout(() => {
          if (status && status.textContent === 'Écris un indice 😉') {
            status.textContent = '';
            status.classList.remove('error');
          }
        }, 2200);
      }
      return;
    }
    sending = true;
    const sendBtn = ui.send();
    if (sendBtn) { sendBtn.disabled = true; }
    
    // Retour haptique double tap
    if (navigator.vibrate) {
      navigator.vibrate([30, 50, 30]);
    }
    
    // Stocker l'indice pour le retrouver pendant le vote
    if (window.HOL && window.HOL.state) {
      window.HOL.state.myOwnHintText = val;
    }
    
    socket.emit('submitHint', { hint: val });
  }

  function initSocket() {
    socket.on('roundInfo', ({ word, wordDisplay, isImpostor, domain, round }) => {
      playRoleCinematic(isImpostor, () => {
        state.myIsImpostor = !!isImpostor;
        sending = false; locked = false;
        const status = ui.status();
        if (status) {
          status.textContent = '';
          status.classList.remove('error');
        }
        show('screen-hint');
        resetPhaseProgress();
        applyRoleTheme(isImpostor);

        const themeEl = ui.theme(); if (themeEl) themeEl.textContent = domain || '—';
        const roleEl = ui.role();
        if (roleEl) {
          roleEl.textContent = isImpostor ? 'IMPOSTEUR' : 'ÉQUIPIER';
          roleEl.style.color = isImpostor ? 'var(--danger)' : 'var(--crew)';
        }

        // Remplacer le texte du bouton par un emoji ➔
        const sendBtn = ui.send();
        if (sendBtn) sendBtn.textContent = '➔';

        const tipEl = ui.tip();
        if (tipEl && isImpostor) {
          tipEl.style.display = 'block';
          tipEl.innerHTML = "🤫 <strong>CHUT !</strong> Tu n’as pas de mot.<br>Observe les indices et invente un mensonge !";
          const wordChip = ui.wordChip(); if (wordChip) wordChip.style.display = 'none';
          ensureLiveUI();
          if (liveList) liveList.innerHTML = '';
          const inputEl = ui.input(); if (inputEl) inputEl.insertAdjacentElement('beforebegin', liveBox);
          liveBox.style.display = 'block';
        } else if (tipEl) {
          tipEl.style.display = 'none';
          const wordChip = ui.wordChip(); if (wordChip) wordChip.style.display = 'block';
          const wordChipText = ui.wordChipText(); if (wordChipText) wordChipText.textContent = wordDisplay || word || '—';
          if (liveBox) liveBox.style.display = 'none';
        }

        const inputEl = ui.input(); if (inputEl) { inputEl.value = ''; inputEl.disabled = false; }
        if (sendBtn) sendBtn.disabled = false;
        setRound(round);
      });
    });

    socket.on('hintAck', () => {
      locked = true; sending = false;
      const status = ui.status();
      if (status) {
        clearTimeout(hintStatusTimer);
        status.textContent = 'Indice envoyé ✅';
        status.classList.remove('error');
        
        // Effacer le message après 2.5 secondes
        hintStatusTimer = setTimeout(() => {
          if (status) {
            status.textContent = '';
          }
        }, 2500);
      }
    });

    socket.on('hintRejected', ({ reason }) => {
      sending = false;
      const btn = ui.send();
      if (btn) btn.disabled = false;
      const status = ui.status();
      if (status) {
        clearTimeout(hintStatusTimer);
        status.textContent = reason || 'Indice rejeté.';
        status.classList.add('error');
        
        // Effacer le message après 3.5 secondes (erreur = plus de temps de lecture)
        hintStatusTimer = setTimeout(() => {
          if (status) {
            status.textContent = '';
            status.classList.remove('error');
          }
        }, 3500);
      }
      toast(reason || 'Indice rejeté.', 'danger');
    });

    socket.on('crewHintsLive', ({ hints }) => {
      if (!state.myIsImpostor) return;
      ensureLiveUI();
      liveList.innerHTML = '';
      hints.forEach(h => {
        const li = document.createElement('li');
        li.className = 'live-hint-item';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'live-hint-name';
        nameSpan.textContent = h.name;

        const hintSpan = document.createElement('span');
        hintSpan.className = 'live-hint-text';
        hintSpan.textContent = `"${h.hint}"`;

        li.appendChild(nameSpan);
        li.appendChild(hintSpan);

        liveList.appendChild(li);
      });
    });

    socket.on('crewHintAdded', (h) => {
      if (!state.myIsImpostor) return;
      
      // Micro-retour haptique pour l'interception
      if (navigator.vibrate) {
        navigator.vibrate(10);
      }
      
      ensureLiveUI();
      const li = document.createElement('li');
      li.className = 'live-hint-item';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'live-hint-name';
      nameSpan.textContent = h.name;

      const hintSpan = document.createElement('span');
      hintSpan.className = 'live-hint-text';
      hintSpan.textContent = `"${h.hint}"`;

      li.appendChild(nameSpan);
      li.appendChild(hintSpan);
      
      const delay = liveList.children.length * 100;
      li.style.animationDelay = `${delay}ms`;

      liveList.appendChild(li);
    });

    socket.on('timer', ({ phase, leftMs }) => {
      if (phase !== 'hints' && phase !== 'prestart') resetTheme();
    });
  }

  function init() { 
    ui.send()?.addEventListener('click', sendHint);
    onEnter('hint-input', sendHint);
    initSocket(); 
  }

  window.HOL.features = window.HOL.features || {};
  window.HOL.features.hints = { init };
})();