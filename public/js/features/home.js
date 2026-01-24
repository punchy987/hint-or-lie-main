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

        // GESTION DES REGLES AVEC GAME JUICE
        $('btn-how')?.addEventListener('click', () => {
            const panel = $('how');
            const btn = $('btn-how');
            const visible = panel.style.display !== 'none';

            // Effet de jus : rebond au clic
            btn.style.transform = "scale(0.92)";
            setTimeout(() => btn.style.transform = "scale(1)", 100);

            if (visible) {
                panel.style.display = 'none';
                btn.textContent = 'Règles rapides';
            } else {
                panel.style.display = 'block';
                btn.textContent = 'Masquer les règles';
                // Scroll fluide pour mobile
                panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });

        $('btn-ready')?.addEventListener('click', () => {
            const roomState = window.HOL?.state?.room?.state;
            const br = $('btn-ready');

            // Cas 1 : Phase reveal (après une manche)
            if (roomState === 'reveal') {
                socket.emit('playerReadyNext');
                if (br) {
                    br.textContent = 'Prêt ✓';
                    br.disabled = true;
                }
                return;
            }

            // Cas 2 : Phase lobby (avant manche ou après gameOver)
            if (roomState === 'lobby') {
                state.myLobbyReady = !state.myLobbyReady;
                
                if (br) {
                    br.textContent = state.myLobbyReady ? 'Annuler prêt' : 'Je suis prêt';
                    br.style.opacity = state.myLobbyReady ? '1' : '0.8';
                }
                
                socket.emit('playerReadyLobby', { ready: state.myLobbyReady });
                return;
            }

            // Cas 3 : En manche (hints/voting) → désactivé
            if (br) {
                br.disabled = true;
                br.title = 'Manche en cours...';
            }
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
            
            // Si on était en attente de spectateur et qu'on revient au lobby → rejoindre la partie
            if (snap.state === 'lobby') {
                const modal = $('#modal');
                if (modal && modal.style.display === 'flex') {
                    const box = modal.querySelector('.box');
                    if (box && box.textContent.includes('Partie en cours')) {
                        modal.style.display = 'none';
                        show('screen-lobby');
                    }
                }
            }
            
            if ($('round-num')) $('round-num').textContent = snap.round;
            const list = $('players');
            if (list) {
                list.innerHTML = '';
                list.style.display = 'grid';
                list.style.gridTemplateColumns = 'repeat(auto-fill, minmax(100px, 1fr))';
                list.style.gap = '10px';

                snap.players.forEach(p => {
                    const card = document.createElement('div');
                    card.className = 'player-card'; 
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

        socket.on('spectatorMode', ({ message }) => {
            // ✅ Ne montrer la modal que si on n'est pas au lobby
            if (state.room?.state === 'lobby') return;
            
            const modal = document.getElementById('modal');
            if (!modal) return;
            
            const box = modal.querySelector('.box');
            if(box) {
                box.innerHTML = `
                    <h2>⏳ Partie en cours</h2>
                    <p>${message || 'Veuillez patienter, vous rejoindrez la prochaine manche.'}</p>
                    <p style="margin-top:15px; font-size:0.8rem; opacity:0.7;">Vous pouvez suivre le déroulement en attendant.</p>
                `;
            }
            
            modal.style.display = 'flex';
            // ✅ Message persiste jusqu'à la fin de la manche (pas de fermeture automatique)
        });

        // ✅ NOUVEAU : Réinitialiser les boutons à la sortie
        socket.on('leftRoom', () => {
            state.myLobbyReady = false;
            const btnReady = $('btn-ready');
            if (btnReady) {
                btnReady.textContent = 'Je suis prêt';
                btnReady.disabled = false;
                btnReady.style.opacity = '0.8';
                btnReady.title = '';
            }
            window.HOL.show('screen-home');
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