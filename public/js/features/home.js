(function () {
    const { $, el, onEnter, show, toast, getDeviceId, state, updateScoreboard, socket } = window.HOL;

    function updateAvatarPreview(name) {
        const seed = (name || '').trim() || 'Joueur';
        const url = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
        const imgs = document.querySelectorAll('[id^="avatar-preview-img"], #hero-avatar-img');
        imgs.forEach(img => {
            img.src = url;
        });
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
        const btnJoin = $('btn-join');
        if (btnJoin) {
            btnJoin.onclick = () => {
                const name = $('name-join')?.value.trim() || 'Joueur';
                const code = ($('join-code')?.value.trim() || '').replace(/\D/g, '').slice(0, 4);
                if (code.length !== 4) { toast('Code à 4 chiffres requis.'); return; }
                socket.emit('hello', { deviceId: getDeviceId(), pseudo: name, name });
                socket.emit('joinRoom', { code, pseudo: name, name, deviceId: getDeviceId() });
            };
        }

        const btnCreate = $('btn-create');
        if (btnCreate) {
            btnCreate.onclick = () => {
                const name = $('name-create')?.value.trim() || 'Joueur';
                socket.emit('hello', { deviceId: getDeviceId(), pseudo: name });
                socket.emit('createRoom', { name: name, deviceId: getDeviceId() });
            };
        }

        $('btn-how')?.addEventListener('click', () => {
            const panel = $('how');
            const btn = $('btn-how');
            const visible = panel.style.display !== 'none';

            if (visible) {
                panel.style.display = 'none';
                btn.textContent = 'Règles rapides';
            } else {
                panel.style.display = 'block';
                btn.textContent = 'Masquer les règles';
                panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });

        $('btn-refresh-leaderboard')?.addEventListener('click', () => {
            socket.emit('getLeaderboard');
            toast('Classement actualisé 📊');
        });

        $('btn-ready')?.addEventListener('click', () => {
            // Retour haptique double tap
            if (navigator.vibrate) {
                navigator.vibrate([30, 50, 30]);
            }
            
            const roomState = window.HOL?.state?.room?.state;
            const br = $('btn-ready');

            if (roomState === 'reveal') {
                socket.emit('playerReadyNext');
                if (br) {
                    br.textContent = 'Prêt ✓';
                    br.disabled = true;
                }
                return;
            }

            if (roomState === 'lobby') {
                state.myLobbyReady = !state.myLobbyReady;
                
                // Instant local feedback
                const myId = window.HOL.state.me.id;
                const myCard = document.querySelector(`.player-card[data-player-id="${myId}"]`);
                if (myCard) {
                    myCard.classList.toggle('is-ready', state.myLobbyReady);
                }

                if (br) {
                    br.textContent = state.myLobbyReady ? 'Annuler prêt' : 'Je suis prêt';
                    br.classList.toggle('ready', state.myLobbyReady);
                }
                
                socket.emit('playerReadyLobby', { ready: state.myLobbyReady });
                return;
            }

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
            const lobbyCode = $('lobby-code');
            if (lobbyCode) lobbyCode.textContent = code;
            show('screen-lobby');
            state.myLobbyReady = false;
            if ($('btn-ready')) $('btn-ready').textContent = 'Je suis prêt';
        };

        socket.on('roomCreated', onRoomEntry);
        socket.on('roomJoined', onRoomEntry);
        socket.on('errorMsg', (message) => toast(message || 'Erreur de salle.'));




        socket.on('lobbyReadyProgress', ({ ready, total }) => {
            const pill = $('lobby-ready-pill');
            if (pill) {
                pill.textContent = `${ready}/${total} prêts`;
                const allReady = ready === total && total > 0;
                pill.classList.toggle('pulse-slow', !allReady);
                pill.classList.toggle('pulse-fast', allReady);
            }
        });

        socket.on('lobbyCountdownStarted', ({ seconds }) => {
            const el = $('timer-lobby');
            if (el) { el.style.display = 'inline-block'; el.textContent = `00:${String(seconds).padStart(2, '0')}`; }
        });

        socket.on('spectatorMode', ({ message }) => {
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
        });

        socket.on('leftRoom', () => {
            state.myLobbyReady = false;
            const btnReady = $('btn-ready');
            if (btnReady) {
                btnReady.textContent = 'Je suis prêt';
                btnReady.disabled = false;
            }
            window.HOL.show('screen-home');
        });
    }

    function init() {
        initTabs();
        initHomeActions();
        initSocketRoom();
        initRulesModal();
    }

    function initRulesModal() {
        const btnShowRules = $('btn-show-rules-lobby');
        const btnCloseRules = $('btn-close-rules-lobby');
        const modalRules = $('modal-rules-lobby');

        if (btnShowRules && modalRules) {
            btnShowRules.onclick = () => {
                modalRules.classList.add('active');
                modalRules.style.display = 'flex';
            };
        }

        if (btnCloseRules && modalRules) {
            btnCloseRules.onclick = () => {
                modalRules.classList.remove('active');
                modalRules.style.display = 'none';
            };
        }

        // Fermer en cliquant à côté du panneau
        if (modalRules) {
            modalRules.onclick = (e) => {
                if (e.target === modalRules) {
                    modalRules.classList.remove('active');
                    modalRules.style.display = 'none';
                }
            };
        }
    }

    window.HOL.features = window.HOL.features || {};
    window.HOL.features.home = { init };
})();