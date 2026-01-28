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
                const name = $('name-join')?.value.trim() || '';
                const code = ($('join-code')?.value.trim() || '').replace(/\D/g, '').slice(0, 4);
                if (code.length !== 4) { toast('Code à 4 chiffres requis.'); return; }
                const persistentId = window.HOL.getPersistentId();
                socket.emit('hello', { deviceId: getDeviceId(), pseudo: name, name, persistentId });
                socket.emit('joinRoom', { code, pseudo: name, name, deviceId: getDeviceId(), persistentId });
            };
        }

        const btnCreate = $('btn-create');
        if (btnCreate) {
            btnCreate.onclick = () => {
                const name = $('name-create')?.value.trim() || '';
                const persistentId = window.HOL.getPersistentId();
                socket.emit('hello', { deviceId: getDeviceId(), pseudo: name, persistentId });
                socket.emit('createRoom', { name: name, deviceId: getDeviceId(), persistentId });
            };
        }

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
                
                // Retirer l'animation pulse quand on devient prêt
                if (br) {
                    if (state.myLobbyReady) {
                        br.classList.remove('not-active');
                        br.textContent = 'Annuler prêt';
                        br.classList.toggle('ready', true);
                    } else {
                        br.classList.add('not-active');
                        br.textContent = 'Je suis prêt';
                        br.classList.toggle('ready', false);
                    }
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
            
            // Nettoyer le code de salle du localStorage
            localStorage.removeItem('hol_room_code');
            
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
            
            // Tentative de reconnexion automatique si on a un code de salle en mémoire
            const savedRoomCode = localStorage.getItem('hol_room_code');
            if (savedRoomCode && /^\d{4}$/.test(savedRoomCode)) {
                // Attendre un court délai pour que le socket soit bien établi
                setTimeout(() => {
                    const persistentId = window.HOL.getPersistentId();
                    const deviceId = window.HOL.getDeviceId();
                    
                    // Tenter de rejoindre automatiquement la salle
                    socket.emit('hello', { deviceId, persistentId });
                    socket.emit('joinRoom', { 
                        code: savedRoomCode, 
                        deviceId, 
                        persistentId,
                        autoReconnect: true // Flag pour indiquer que c'est une reconnexion auto
                    });
                }, 300);
            }
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
            
            // Stocker le code de salle dans localStorage pour persistance
            localStorage.setItem('hol_room_code', code);
            
            const lobbyCode = $('lobby-code');
            if (lobbyCode) lobbyCode.textContent = code;
            show('screen-lobby');
            state.myLobbyReady = false;
            
            // Réinitialiser le bouton ready avec l'animation pulse
            const btnReady = $('btn-ready');
            if (btnReady) {
                btnReady.textContent = 'Je suis prêt';
                btnReady.classList.add('not-active'); // Ajouter l'animation pulse
                btnReady.classList.remove('ready');
            }
        };

        socket.on('roomCreated', onRoomEntry);
        socket.on('roomJoined', onRoomEntry);
        socket.on('errorMsg', (message) => {
            // Si erreur de reconnexion automatique, nettoyer le localStorage
            const savedRoomCode = localStorage.getItem('hol_room_code');
            if (savedRoomCode && (message.includes('introuvable') || message.includes('invalide'))) {
                localStorage.removeItem('hol_room_code');
            }
            toast(message || 'Erreur de salle.');
        });




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
            
            // Nettoyer le code de salle du localStorage
            localStorage.removeItem('hol_room_code');
            
            const btnReady = $('btn-ready');
            if (btnReady) {
                btnReady.textContent = 'Je suis prêt';
                btnReady.disabled = false;
            }
            window.HOL.show('screen-home');
        });

        // Listener pour la liste des salons publics
        socket.on('publicRoomsList', (rooms) => {
            const list = $('public-rooms-list');
            if (!list) return;

            // Vider la liste
            list.innerHTML = '';

            // Si aucune salle publique
            if (!rooms || rooms.length === 0) {
                const emptyMsg = document.createElement('li');
                emptyMsg.className = 'public-rooms-empty';
                emptyMsg.textContent = 'Aucun salon public disponible';
                list.appendChild(emptyMsg);
                return;
            }

            // Remplir la liste
            rooms.forEach(room => {
                const item = document.createElement('li');
                item.className = 'public-room-item';
                
                const roomName = document.createElement('span');
                roomName.textContent = `Salon ${room.code}`;
                
                const playersBadge = document.createElement('span');
                playersBadge.className = 'public-room-players';
                playersBadge.textContent = `${room.playerCount}/${room.maxPlayers || 8}`;
                
                item.appendChild(roomName);
                item.appendChild(playersBadge);
                
                // Rendre l'élément cliquable
                item.addEventListener('click', () => {
                    // Remplir l'input code
                    const codeInput = $('join-code');
                    if (codeInput) {
                        codeInput.value = room.code;
                    }
                    
                    // Rejoindre automatiquement
                    const nameInput = $('name-join');
                    const name = nameInput?.value.trim() || '';
                    const persistentId = window.HOL.getPersistentId();
                    
                    socket.emit('hello', { deviceId: getDeviceId(), pseudo: name, name, persistentId });
                    socket.emit('joinRoom', { code: room.code, pseudo: name, name, deviceId: getDeviceId(), persistentId });
                    
                    // Feedback haptique
                    if (navigator.vibrate) {
                        navigator.vibrate([30, 50, 30]);
                    }
                });
                
                list.appendChild(item);
            });
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