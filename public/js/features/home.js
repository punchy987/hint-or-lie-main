// public/js/features/home.js
(function () {
    const { $, el, onEnter, show, toast, getDeviceId, state, updateScoreboard, socket } = window.HOL;

    function updateAvatarPreview(name) {
        const seed = (name || '').trim() || 'default';
        const url = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
        const img = $('avatar-preview-img');
        if (img) img.src = url;
    }

    function initTabs() {
        const tabs = { join: $('tab-join'), create: $('tab-create') };
        const panes = { join: $('pane-join'), create: $('pane-create') };

        function activateTab(which) {
            const isJoin = which === 'join';
            tabs.join?.setAttribute('aria-selected', isJoin ? 'true' : 'false');
            tabs.create?.setAttribute('aria-selected', isJoin ? 'false' : 'true');
            panes.join?.classList.toggle('active', isJoin);
            panes.create?.classList.toggle('active', !isJoin);
            
            const input = isJoin ? $('name-join') : $('name-create');
            input?.focus();
            updateAvatarPreview(input?.value);
        }

        tabs.join?.addEventListener('click', () => activateTab('join'));
        tabs.create?.addEventListener('click', () => activateTab('create'));
        $('join-code')?.addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); });

        ['name-join', 'name-create'].forEach(id => {
            const input = $(id);
            if (input) {
                input.addEventListener('input', (e) => updateAvatarPreview(e.target.value));
            }
        });
    }

    function initHomeActions() {
        if (!$('avatar-preview-box')) {
            const hero = document.querySelector('.hero');
            if (hero) {
                const box = document.createElement('div');
                box.id = 'avatar-preview-box';
                box.style.cssText = 'display:flex;justify-content:center;margin-bottom:15px;';
                box.innerHTML = `<img id="avatar-preview-img" src="https://api.dicebear.com/7.x/bottts/svg?seed=Joueur" style="width:80px;height:80px;border-radius:50%;background:#2a2535;border:3px solid #8b5cf6;padding:5px;transition:transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);" />`;
                hero.parentNode.insertBefore(box, hero.nextSibling);
            }
        }

        $('btn-join').onclick = () => {
            const name = $('name-join')?.value.trim() || 'Joueur';
            const code = ($('join-code')?.value.trim() || '').replace(/\D/g, '').slice(0, 4);
            if (code.length !== 4) { toast('Code à 4 chiffres requis.'); return; }
            socket.emit('hello', { deviceId: getDeviceId(), pseudo: name, name });
            socket.emit('joinRoom', { code, pseudo: name, name, deviceId: getDeviceId() });
        };

        $('btn-create').onclick = () => {
            const name = $('name-create')?.value.trim() || 'Joueur';
            socket.emit('hello', { deviceId: getDeviceId(), pseudo: name, name });
            socket.emit('createRoom', { pseudo: name, name, deviceId: getDeviceId() });
        };

        $('btn-how')?.addEventListener('click', () => {
            const panel = $('how');
            const visible = panel.style.display !== 'none';
            panel.style.display = visible ? 'none' : 'block';
            $('btn-how').textContent = visible ? 'Règles rapides' : 'Masquer les règles';
        });

        $('btn-ready')?.addEventListener('click', () => {
            const roomState = window.HOL?.state?.room?.state;
            if (roomState === 'reveal') {
                socket.emit('playerReadyNext');
                const br = $('btn-ready');
                if (br) { br.textContent = 'Prêt ✓'; br.disabled = true; }
                return;
            }
            state.myLobbyReady = !state.myLobbyReady;
            $('btn-ready').textContent = state.myLobbyReady ? 'Annuler prêt' : 'Je suis prêt';
            socket.emit('playerReadyLobby', { ready: state.myLobbyReady });
        });

        $('btn-back-home')?.addEventListener('click', () => {
            socket.emit('leaveRoom');
            state.myLobbyReady = false;
            if ($('btn-ready')) $('btn-ready').textContent = 'Je suis prêt';
            show('screen-home');
        });

        onEnter('name-join', () => $('btn-join')?.click());
        onEnter('join-code', () => $('btn-join')?.click());
        onEnter('name-create', () => $('btn-create')?.click());
    }

    function initSocketRoom() {
        socket.on('system', ({ text }) => toast(text));
        socket.on('host-changed', ({ hostId }) => {
            const hb = $('host-badge');
            if (hb) hb.style.display = (window.HOL.state.me.id === hostId) ? 'inline-block' : 'none';
        });
        
        socket.on('connect', () => {
            socket.emit('getLeaderboard');
            state.me.id = socket.id;
        });

        const codeSpan = $('lobby-code');
        if (codeSpan && !codeSpan._wired) {
            codeSpan._wired = true;
            const pill = codeSpan.parentElement;
            if (pill) {
                pill.style.cursor = 'pointer';
                pill.addEventListener('click', async () => {
                    try { await navigator.clipboard.writeText(codeSpan.textContent.trim()); toast('Code copié 📋'); }
                    catch { toast('Copie impossible'); }
                });
            }
        }

        const onRoomEntry = ({ code }) => {
            state.me.code = code;
            $('lobby-code').textContent = code;
            show('screen-lobby');
            state.myLobbyReady = false;
            if ($('btn-ready')) $('btn-ready').textContent = 'Je suis prêt';
        };

        socket.on('roomCreated', onRoomEntry);
        socket.on('roomJoined', onRoomEntry);
        socket.on('roomError', ({ message }) => toast(message || 'Erreur de salle.'));

        socket.on('roomUpdate', (snap) => {
            state.room = snap;
            if ($('round-num')) $('round-num').textContent = snap.round;
            const list = $('players');
            if (list) {
                list.innerHTML = '';
                list.style.display = 'grid';
                list.style.gridTemplateColumns = 'repeat(auto-fill, minmax(100px, 1fr))';
                list.style.gap = '10px';

                snap.players.forEach(p => {
                    const card = document.createElement('div');
                    card.className = 'player-card'; // Tu pourras styliser ça en CSS
                    card.style.cssText = 'background:rgba(255,255,255,0.05);border-radius:10px;padding:10px;text-align:center;display:flex;flex-direction:column;align-items:center;border:1px solid rgba(255,255,255,0.1);';
                    
                    const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(p.name || 'default')}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
                    card.innerHTML = `
                        <img src="${avatarUrl}" style="width:50px;height:50px;border-radius:50%;margin-bottom:6px;" />
                        <div style="font-weight:bold;font-size:0.9rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;">${p.name}</div>
                    `;
                    list.appendChild(card);
                });
            }
            if (window.HOL.updateScoreboard) window.HOL.updateScoreboard(snap.players);
        });

        socket.on('lobbyReadyProgress', ({ ready, total }) => {
            if ($('lobby-ready-pill')) $('lobby-ready-pill').textContent = `${ready}/${total} prêts`;
        });

        socket.on('lobbyCountdownStarted', ({ seconds }) => {
            const el = $('timer-lobby');
            if (el) { el.style.display = 'inline-block'; el.textContent = `00:${String(seconds).padStart(2, '0')}`; }
        });
    }

    function init() {
        initTabs();
        initHomeActions();
        initSocketRoom();
    }

    window.HOL.features = window.HOL.features || {};
    window.HOL.features.home = { init };
})();