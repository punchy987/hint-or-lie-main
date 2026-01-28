﻿(function () {
  const { $, fmt, state, socket, startPhaseAnim } = window.HOL;

  function updateUIFromState(snap) {
      state.room = snap;

      if ($('round-num')) $('round-num').textContent = snap.round;
      
      // Mettre à jour le scoreboard systématiquement pour tous les états, y compris lobby
      if (window.HOL.updateScoreboard) {
        window.HOL.updateScoreboard(snap.players);
      }

      // Mapper les états serveur vers les IDs d'écrans
      const stateToScreen = {
        'lobby': 'screen-lobby',
        'hints': 'screen-hint',
        'voting': 'screen-vote',
        'reveal': 'screen-result'
      };

      const targetScreen = stateToScreen[snap.state];
      const currentScreen = document.body.getAttribute('data-screen');

      // RÈGLE D'OR : Gestion du tiroir de réactions
      const reactionTriggers = document.getElementById('reaction-triggers');
      const reactionDisplayArea = document.getElementById('reaction-display-area');
      
      if (reactionTriggers) {
        // Masquage total sur l'écran d'accueil
        if (!targetScreen) {
          // Retour à l'accueil : masquer complètement (y compris le bouton)
          reactionTriggers.style.display = 'none';
          if (reactionDisplayArea) reactionDisplayArea.style.display = 'none';
          reactionTriggers.classList.remove('is-persistent', 'is-open');
        } else if (targetScreen === 'screen-lobby') {
          // Au lobby : afficher et ouvrir automatiquement
          reactionTriggers.style.display = 'flex';
          if (reactionDisplayArea) reactionDisplayArea.style.display = 'block';
          if (!reactionTriggers.classList.contains('is-persistent')) {
            reactionTriggers.classList.add('is-persistent');
          }
          // Ouverture automatique au lobby
          reactionTriggers.classList.add('is-open');
        } else if (targetScreen === 'screen-hint') {
          // Phase hints : afficher, fermer automatiquement mais garder poignée visible
          reactionTriggers.style.display = 'flex';
          if (reactionDisplayArea) reactionDisplayArea.style.display = 'block';
          reactionTriggers.classList.remove('is-open');
          if (!reactionTriggers.classList.contains('is-persistent')) {
            reactionTriggers.classList.add('is-persistent');
          }
        } else if (targetScreen) {
          // Autres écrans de jeu : afficher et s'assurer que .is-persistent est présent
          reactionTriggers.style.display = 'flex';
          if (reactionDisplayArea) reactionDisplayArea.style.display = 'block';
          if (!reactionTriggers.classList.contains('is-persistent')) {
            reactionTriggers.classList.add('is-persistent');
          }
        }
      }

      // Gestion du scoreboard (rendu permanent, contrôle utilisateur)
      const scoreboardPanel = document.querySelector('.scoreboard-panel');
      if (scoreboardPanel) {
        if (!targetScreen) {
          // Retour à l'accueil : masquer complètement
          scoreboardPanel.style.display = 'none';
          scoreboardPanel.classList.add('is-hidden');
        } else {
          // Scoreboard toujours rendu, mais jamais forcer ouvert
          scoreboardPanel.style.display = '';
          scoreboardPanel.classList.remove('is-hidden');
          // Contrôle manuel : ne forcer ouvert que si pas fermé manuellement
          if (targetScreen === 'screen-lobby') {
            if (!scoreboardPanel.dataset.manuallyClosed) {
              scoreboardPanel.classList.add('is-open');
            }
          }
        }
      }

      // Transition SEULEMENT si on change réellement d'écran
      if (targetScreen && targetScreen !== currentScreen) {
        window.HOL.transitionTo(targetScreen);
      } else if (targetScreen) {
        // Déjà sur le bon écran, simple mise à jour sans transition
        window.HOL.show(targetScreen);
      }
      
      const list = $('players');
      if (list) {
          list.innerHTML = '';
          snap.players.forEach(p => {
              const card = document.createElement('div');
              card.className = 'player-card';
              
              // Déterminer si le joueur est prêt
              const isReady = p.ready || false;
              
              // Ajouter les classes appropriées
              if (isReady) {
                  card.classList.add('is-ready');
              } else {
                  card.classList.add('not-ready');
              }
              
              // Determine status
              let statusText = '';
              if (p.disconnected) {
                  statusText = 'Déconnecté';
              } else if (snap.state === 'lobby') {
                  // En lobby, afficher le statut prêt/attente
                  if (isReady) {
                      statusText = 'PRÊT ✓';
                  } else {
                      statusText = 'ATTENTE ⏳';
                  }
              } else if (p.ready) {
                  statusText = 'Prêt ✓';
              }

              const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(p.name || 'default')}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
              card.innerHTML = `
                  <img src="${avatarUrl}" alt="Avatar de ${p.name}">
                  <div class="player-name">${p.name}</div>
                  ${statusText ? `<div class="player-status">${statusText}</div>` : ''}
              `;
              list.appendChild(card);
          });
      }

      const meNow = snap.players?.find(p => p.id === state.me.id);
      const meBefore = state.room?.players?.find(p => p.id === state.me.id);
      if (meBefore?.spectator && meNow && !meNow.spectator && snap.state === 'lobby') {
        window.HOL.toast('Vous rejoignez la partie !', 1500);
      }
      
      if (snap.state === 'lobby') {
        const modal = $('modal');
        if (modal && modal.style.display === 'flex') {
          const box = modal.querySelector('.box');
          if (box && box.innerHTML.includes('PARTIE TERMINEE')) {
            modal.style.display = 'none';
          }
          if (box && box.textContent.includes('Partie en cours')) {
            modal.style.display = 'none';
          }
        }
        const btnReady = $('btn-ready');
        if (btnReady) {
          btnReady.textContent = 'Je suis pret';
          btnReady.disabled = false;
        }
        
        // Gestion du bouton toggle privacy (visible uniquement pour le host)
        const btnTogglePrivacy = $('btn-toggle-privacy');
        if (btnTogglePrivacy) {
          const isHost = socket.id === snap.hostId;
          btnTogglePrivacy.style.display = isHost ? 'block' : 'none';
          
          // Mettre à jour l'état du bouton
          const isPublic = snap.isPublic || false;
          btnTogglePrivacy.textContent = isPublic ? '🌍 PUBLIC' : '🔒 PRIVÉ';
          btnTogglePrivacy.className = isPublic ? 'btn btn-secondary public' : 'btn btn-secondary private';
          
          // Supprimer les anciens listeners pour éviter les doublons
          const newBtn = btnTogglePrivacy.cloneNode(true);
          btnTogglePrivacy.parentNode.replaceChild(newBtn, btnTogglePrivacy);
          
          // Ajouter le listener onclick
          newBtn.addEventListener('click', () => {
            socket.emit('togglePrivacy');
            
            // Feedback haptique
            if (navigator.vibrate) {
              navigator.vibrate([20, 40, 20]);
            }
          });
        }
        
        // Rafraîchir les contrôles de host (badge, etc.)
        if (window.HOL.refreshHostControls) {
          window.HOL.refreshHostControls();
        }
      }
    }
  window.HOL.updateUIFromState = updateUIFromState;
  
  function refreshHostControls() {
    const { $, socket, state } = window.HOL;
    
    if (!state.room) return;
    
    const isHost = socket.id === state.room.hostId;
    
    // Afficher/masquer le bouton toggle privacy
    const btnTogglePrivacy = $('btn-toggle-privacy');
    if (btnTogglePrivacy) {
      btnTogglePrivacy.style.display = isHost ? 'block' : 'none';
      
      if (isHost) {
        // Mettre à jour l'état du bouton
        const isPublic = state.room.isPublic || false;
        btnTogglePrivacy.textContent = isPublic ? '🌍 PUBLIC' : '🔒 PRIVÉ';
        btnTogglePrivacy.className = isPublic ? 'btn btn-secondary public' : 'btn btn-secondary private';
      }
    }
    
    // Ajouter un badge HOST dans la liste des joueurs
    const list = $('players');
    if (list && state.room.players) {
      state.room.players.forEach(player => {
        const cards = list.querySelectorAll('.player-card');
        cards.forEach(card => {
          const nameEl = card.querySelector('.player-name');
          if (nameEl && nameEl.textContent === player.name) {
            // Retirer l'ancien badge s'il existe
            const oldBadge = card.querySelector('.host-badge');
            if (oldBadge) oldBadge.remove();
            
            // Ajouter le badge si c'est le host
            if (player.id === state.room.hostId) {
              const badge = document.createElement('div');
              badge.className = 'host-badge';
              badge.textContent = '👑 HOST';
              badge.style.cssText = 'font-size: 0.7rem; color: var(--color-crew); font-weight: 700; margin-top: 0.25rem;';
              card.appendChild(badge);
            }
          }
        });
      });
    }
  }
  
  window.HOL.refreshHostControls = refreshHostControls;
  
  function initLobbyQuitButtons() {
    const buttons = document.querySelectorAll('.btn-quit-to-lobby');
    
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const confirmed = confirm('Quitter la manche en cours et revenir au lobby ?');
        
        if (confirmed) {
          // Vibration feedback
          if (navigator.vibrate) {
            navigator.vibrate([30, 50, 30]);
          }
          
          // Émettre l'événement au serveur
          socket.emit('requestReturnToLobby');
          
          // Transition vers le lobby
          window.HOL.transitionTo('screen-lobby');
          
          // Toast de confirmation
          window.HOL.toast('Mode spectateur : tu reviens au lobby');
        }
      });
    });
  }
  
  function initTimersFromServer() {
    let lastDeadline = null;
    let localTimerRAF = null;

    socket.on('timer', ({ phase, leftMs, totalMs }) => {
      if (phase !== state.currentPhase) state.currentPhase = phase;

      lastDeadline = Date.now() + leftMs;

      startPhaseAnim(phase, totalMs || state.DUR[phase] || 0, leftMs);

      if (localTimerRAF) cancelAnimationFrame(localTimerRAF);

      function updateLocalTimer() {
        const now = Date.now();
        const remaining = Math.max(0, lastDeadline - now);

        if (phase === 'hints') {
          const el = $('timer-hints'); if (el) el.textContent = fmt(remaining);
          if (remaining <= 0) { $('btn-send-hint')?.setAttribute('disabled', 'true'); $('hint-input')?.setAttribute('disabled', 'true'); }
        } else if (phase === 'voting') {
          const el = $('timer-vote'); if (el) el.textContent = fmt(remaining);
          if (remaining <= 0) { document.querySelectorAll('#hints .vote-card').forEach(b => b.disabled = true); }
        } else if (phase === 'prestart') {
          const el = $('timer-lobby'); if (el) el.textContent = fmt(remaining);
        } else if (phase === 'reveal') {
          const el = $('timer-reveal'); if (el) el.textContent = fmt(remaining);
        } else if (phase === 'lobby') {
          const el = $('timer-lobby'); if (el) { el.textContent = fmt(remaining); if (remaining <= 0) el.style.display = 'none'; }
        }

        if (remaining > 0) {
          localTimerRAF = requestAnimationFrame(updateLocalTimer);
        } else {
          localTimerRAF = null;
        }
      }

      updateLocalTimer();
    });

    socket.on('phaseProgress', ({ phase, submitted, total }) => {
      if (phase === 'hints') {
        const el = $('progress-hints');
        if (el) el.textContent = `${submitted}/${total}`;
      } else if (phase === 'voting') {
        const el = $('progress-vote');
        if (el) el.textContent = `${submitted}/${total}`;
      }
    });

    socket.on('roomState', (snap) => {
      window.HOL.updateUIFromState(snap);
    });

    socket.on('scoresReset', () => {
      window.HOL.transitionTo('screen-lobby');
      const btnReady = $('btn-ready');
      if (btnReady) {
        btnReady.textContent = 'Je suis pret';
        btnReady.disabled = false;
      }
      state.myLobbyReady = false;
      window.HOL.toast('Partie reinitalisee !', 1500);
    });

    // Listener pour la confirmation du toggle privacy
    socket.on('privacyToggled', ({ isPublic }) => {
      const message = isPublic ? 'Salon désormais PUBLIC 🌍' : 'Salon désormais PRIVÉ 🔒';
      window.HOL.toast(message, 1500);
    });
  }

  function init() {
    window.HOL.features.home.init();
    window.HOL.features.hints.init();
    window.HOL.features.vote.init();
    window.HOL.features.results.init();
    window.HOL.features.leaderboard.init();
    initTimersFromServer();
    initLobbyQuitButtons();
    initReactionSystem();
    initScoreboardSystem();
    initGlobalSwipeSystem(); // v6.5 : Gestion pass-through des swipes
    initKeyboardDetection();
    document.body.setAttribute('data-screen', 'screen-home');
    
    // RÈGLE D'OR : Initialisation état masqué sur page d'accueil
    const reactionTriggers = document.getElementById('reaction-triggers');
    const reactionDisplayArea = document.getElementById('reaction-display-area');
    const scoreboardPanel = document.querySelector('.scoreboard-panel');
    
    if (reactionTriggers) {
      reactionTriggers.style.display = 'none';
    }
    if (reactionDisplayArea) {
      reactionDisplayArea.style.display = 'none';
    }
    if (scoreboardPanel) {
      scoreboardPanel.style.display = 'none';
    }
  }
  
  // ========== SYSTÈME DE SWIPE GLOBAL PASS-THROUGH (v6.5) ==========
  function initGlobalSwipeSystem() {
    const { $ } = window.HOL;
    const reactionTriggers = document.getElementById('reaction-triggers');
    const scoreboardPanel = document.querySelector('.scoreboard-panel');

    if (!reactionTriggers || !scoreboardPanel) {
      console.warn('Global Swipe: éléments manquants');
      return;
    }

    const SCREEN_W = window.innerWidth;
    const SCREEN_H = window.innerHeight;
    const SAFETY_MARGIN = 10; // Pixels de sécurité pour Android

    let touchState = {
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      isTracking: false,
      zone: null,
      axis: null,
      locked: false,
      target: null
    };

    let swipeDetection = false;
    document.addEventListener('touchstart', function(e) {
      swipeDetection = false;
      const touch = e.touches[0];
      const startX = touch.clientX;
      const startY = touch.clientY;
      const modal = $('modal');
      const modalRules = $('modal-rules-lobby');
      if ((modal && modal.style.display === 'flex') || (modalRules && modalRules.classList.contains('active'))) return;
      let zone = null, target = null;
      if (startX > SCREEN_W * 0.5) { zone = 'right'; target = reactionTriggers; }
      else if (startY > SCREEN_H * 0.6) { zone = 'bottom'; target = scoreboardPanel; }
      if (target) {
        touchState = { startX, startY, currentX: startX, currentY: startY, isTracking: true, zone, axis: null, locked: false, target };
        target.classList.add('is-dragging');
        target.style.transition = 'none';
        swipeDetection = true;
      }
    }, { passive: true });

    document.addEventListener('touchmove', function(e) {
      if (!touchState.isTracking) return;
      const touch = e.touches[0];
      touchState.currentX = touch.clientX;
      touchState.currentY = touch.clientY;
      const dx = touchState.currentX - touchState.startX;
      const dy = touchState.currentY - touchState.startY;
      if (!touchState.locked && (Math.abs(dx) > 30 || Math.abs(dy) > 30)) {
        // On bloque le scroll natif uniquement si un vrai swipe est détecté
        e.preventDefault();
        touchState.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        touchState.locked = true;
      }
      if (touchState.axis === 'y' && touchState.zone === 'bottom') {
        touchState.target.style.transform = `translateX(-50%) translateY(${dy > 0 ? dy : 0}px)`;
      } else if (touchState.axis === 'x' && touchState.zone === 'right') {
        touchState.target.style.transform = `translateY(-50%) translateX(${dx < 0 ? dx : 0}px)`;
      }
    }, { passive: false });

    document.addEventListener('touchmove', function(e) {
      if (!touchState.isTracking) return;
      e.preventDefault();
      const touch = e.touches[0];
      touchState.currentX = touch.clientX;
      touchState.currentY = touch.clientY;
      const dx = touchState.currentX - touchState.startX;
      const dy = touchState.currentY - touchState.startY;
      if (!touchState.locked && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
        touchState.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        touchState.locked = true;
      }
      if (touchState.axis === 'y' && touchState.zone === 'bottom') {
        touchState.target.style.transform = `translateX(-50%) translateY(${dy > 0 ? dy : 0}px)`;
      } else if (touchState.axis === 'x' && touchState.zone === 'right') {
        touchState.target.style.transform = `translateY(-50%) translateX(${dx < 0 ? dx : 0}px)`;
      }
    }, { passive: false });

    document.addEventListener('touchend', function(e) {
      if (!touchState.isTracking || !touchState.locked) {
        if (touchState.target) touchState.target.classList.remove('is-dragging');
        touchState.isTracking = false;
        return;
      }
      const dx = touchState.currentX - touchState.startX;
      const dy = touchState.currentY - touchState.startY;
      const endX = touchState.currentX;
      const endY = touchState.currentY;
      touchState.target.classList.remove('is-dragging');
      touchState.target.style.transition = '';
      // Scoreboard (Vertical)
      if (touchState.zone === 'bottom' && touchState.axis === 'y') {
        const velocity = dy / (e.timeStamp || 1);
        const snap = (endY > SCREEN_H * 0.7) || (velocity > 0.3) || (endY > SCREEN_H - SAFETY_MARGIN);
        if (snap) {
          scoreboardPanel.classList.add('is-hidden');
          scoreboardPanel.dataset.manuallyClosed = '1';
        } else {
          scoreboardPanel.classList.remove('is-hidden');
          delete scoreboardPanel.dataset.manuallyClosed;
        }
        scoreboardPanel.style.transform = '';
      }
      // Réactions (Horizontal)
      if (touchState.zone === 'right' && touchState.axis === 'x') {
        const velocity = dx / (e.timeStamp || 1);
        const snap = (endX > SCREEN_W * 0.7) || (velocity > 0.3) || (endX > SCREEN_W - SAFETY_MARGIN);
        if (snap) {
          reactionTriggers.classList.remove('is-open');
          if (navigator.vibrate) navigator.vibrate(15);
        } else {
          reactionTriggers.classList.add('is-open');
          if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
        }
        reactionTriggers.style.transform = '';
      }
      touchState.isTracking = false;
      touchState.target = null;
    }, { passive: false });

    console.log('[HOL-System] v7.3 : Syntaxe réparée et Swipe activé');
  }

// ...existing code...
  
  // ========== DÉTECTION INTELLIGENTE DU CLAVIER ==========
  function initKeyboardDetection() {
    // Détecte l'ouverture du clavier via focus sur input/textarea
    document.addEventListener('focusin', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        document.body.classList.add('keyboard-open');
        // Game Juice : vibration confirmation focus
        if (navigator.vibrate) {
          navigator.vibrate(10);
        }
      }
    });
    // Détecte la fermeture du clavier via perte de focus
    document.addEventListener('focusout', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        // Petit délai pour éviter le flicker si on passe d'un input à un autre
        setTimeout(() => {
          const activeElement = document.activeElement;
          if (activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA') {
            document.body.classList.remove('keyboard-open');
          }
        }, 100);
      }
    });
  }

  // ========== SYSTÈME DE SCOREBOARD ==========
  function initScoreboardSystem() {
    const scoreboardPanel = document.querySelector('.scoreboard-panel');
    const scoreboardHandle = document.querySelector('.scoreboard-handle');
    
    if (!scoreboardPanel) return;

    // ========== Clic sur la poignée pour ouvrir/fermer ========== 
    if (scoreboardHandle) {
      scoreboardHandle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (scoreboardPanel.classList.contains('is-hidden')) {
          scoreboardPanel.classList.remove('is-hidden');
          delete scoreboardPanel.dataset.manuallyClosed;
        } else {
          scoreboardPanel.classList.add('is-hidden');
          scoreboardPanel.dataset.manuallyClosed = '1';
        }
      });
    }

    // ========== MOBILE : PASS-THROUGH SWIPE (v6.5) ==========
    // Les événements sont gérés globalement dans initGlobalSwipeSystem()
  }

  // ==================== ARCADE BUBBLES : Réactions ====================
  function initReactionSystem() {
    const { $, socket, state } = window.HOL;
    let isOnCooldown = false;

    const triggers = document.querySelectorAll('.btn-reaction');
    const displayArea = document.getElementById('reaction-display-area');
    const reactionTriggers = document.getElementById('reaction-triggers');
    const reactionHandle = document.querySelector('.reaction-handle');

    if (!triggers.length || !displayArea) return;

    // ========== DESKTOP : Clic sur handle pour toggle ==========
    if (reactionHandle) {
      reactionHandle.addEventListener('click', (e) => {
        e.stopPropagation();
        if (reactionTriggers.classList.contains('is-open')) {
          reactionTriggers.classList.remove('is-open');
        } else {
          reactionTriggers.classList.add('is-open');
        }
      });
    }

    // ========== MOBILE : PASS-THROUGH SWIPE (v6.5) ==========
    // Les événements sont gérés globalement dans initGlobalSwipeSystem()

    // Gestion des clics sur les boutons de réaction
    triggers.forEach(btn => {
      btn.addEventListener('click', () => {
        if (isOnCooldown) return;

        const emoji = btn.getAttribute('data-emoji');
        const playerName = state.me?.name || 'Joueur';

        // Émettre la réaction au serveur (affichage centralisé via broadcast)
        socket.emit('player-reaction', { emoji, name: playerName });

        // Feedback haptique
        if (navigator.vibrate) {
          navigator.vibrate(30);
        }

        // Auto-fermeture du tiroir après sélection
        if (reactionTriggers) {
          reactionTriggers.classList.remove('is-open');
        }

        // Activer le cooldown (2 secondes)
        isOnCooldown = true;
        triggers.forEach(b => b.disabled = true);

        setTimeout(() => {
          isOnCooldown = false;
          triggers.forEach(b => b.disabled = false);
        }, 2000);
      });
    });

    // Réception des réactions des autres joueurs
    socket.on('reaction-broadcast', ({ emoji, name }) => {
      createReactionBubble(emoji, name, displayArea);
    });
  }

  function createReactionBubble(emoji, playerName, container) {
    if (!container) return;
    if (window.getComputedStyle(container).display === 'none') return;

    const bubble = document.createElement('div');
    bubble.className = 'reaction-bubble';
    
    // Variation horizontale aléatoire
    bubble.style.left = Math.random() * 50 + 'px';

    const emojiSpan = document.createElement('div');
    emojiSpan.className = 'reaction-bubble-emoji';
    emojiSpan.textContent = emoji;

    const nameSpan = document.createElement('div');
    nameSpan.className = 'reaction-bubble-name';
    nameSpan.textContent = playerName;

    bubble.appendChild(emojiSpan);
    bubble.appendChild(nameSpan);
    container.appendChild(bubble);

    // Suppression automatique après l'animation (3.2s)
    setTimeout(() => bubble.remove(), 3200);
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
