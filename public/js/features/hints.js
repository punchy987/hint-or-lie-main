(function () {
  const { $, $$, toast, show, state, socket, resetPhaseProgress, onEnter } = window.HOL;

  let sending = false;
  let locked  = false;
  let liveBox = null;
  let liveList = null;

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

    overlay.style.display = ''; // Force le nettoyage du style inline pour laisser le CSS agir
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
    const val = (ui.input()?.value || '').trim();
    if (!val) { toast("Écris un indice 😉"); return; }
    sending = true;
    ui.send().disabled = true;
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

        if (ui.theme()) ui.theme().textContent = domain || '—';
        if (ui.role()) {
          ui.role().textContent = isImpostor ? 'IMPOSTEUR' : 'ÉQUIPIER';
          ui.role().style.color = isImpostor ? 'var(--danger)' : 'var(--crew)';
        }

        const tipEl = ui.tip();
        if (isImpostor) {
          tipEl.style.display = 'block';
          tipEl.innerHTML = "🤫 <strong>CHUT !</strong> Tu n’as pas de mot.<br>Observe les indices et invente un mensonge !";
          ui.wordChip().style.display = 'none';
          ensureLiveUI();
          if (liveList) liveList.innerHTML = ''; // Nettoie les anciens indices
          ui.input()?.insertAdjacentElement('beforebegin', liveBox);
          liveBox.style.display = 'block';
        } else {
          tipEl.style.display = 'none';
          ui.wordChip().style.display = 'block';
          ui.wordChipText().textContent = wordDisplay || word || '—';
          if (liveBox) liveBox.style.display = 'none';
        }

        ui.input().value = '';
        ui.input().disabled = false;
        ui.send().disabled = false;
        setRound(round);
      });
    });

    socket.on('hintAck', () => {
      locked = true; sending = false;
      const status = ui.status();
      if (status) {
        status.textContent = 'Indice envoyé ✅';
        status.classList.remove('error');
      }
    });

    socket.on('hintRejected', ({ reason }) => {
      sending = false;
      const btn = ui.send();
      if (btn) btn.disabled = false;
      const status = ui.status();
      if (status) {
        status.textContent = reason || 'Indice rejeté.';
        status.classList.add('error');
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