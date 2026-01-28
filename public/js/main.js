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

      // Gestion du scoreboard (même logique de visibilité)
      const scoreboardPanel = document.querySelector('.scoreboard-panel');
      if (scoreboardPanel) {
        if (!targetScreen) {
          // Retour à l'accueil : masquer complètement
          scoreboardPanel.style.display = 'none';
          scoreboardPanel.classList.add('is-hidden');
        } else {
          // Sur tous les autres écrans : visible avec poignée
          scoreboardPanel.style.display = '';
          scoreboardPanel.classList.remove('is-hidden');
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

  // ========== SYSTÈME DE SCOREBOARD ==========
  function initScoreboardSystem() {
    const scoreboardTouchZone = document.getElementById('scoreboard-touch-zone');
    const scoreboardPanel = document.querySelector('.scoreboard-panel');
    const scoreboardHandle = document.querySelector('.scoreboard-handle');
    
    if (scoreboardTouchZone && scoreboardPanel) {
      // ========== DESKTOP : Clic sur zone ou poignée pour toggle ==========
      const toggleScoreboard = (e) => {
        // Seulement sur desktop (pas mobile)
        if (e.pointerType === 'mouse' || e.type === 'click') {
          scoreboardPanel.classList.toggle('is-hidden');
        }
      };

      scoreboardTouchZone.addEventListener('click', toggleScoreboard);
      
      // Clic sur la poignée elle-même (desktop)
      if (scoreboardHandle) {
        scoreboardHandle.addEventListener('click', (e) => {
          e.stopPropagation();
          scoreboardPanel.classList.toggle('is-hidden');
        });
      }

      // ========== MOBILE : Swipe vertical pour ouvrir/fermer ==========
      let startY = 0;
      let currentY = 0;
      let isDragging = false;

      const handleStart = (e) => {
        console.log('👆 Scoreboard touchstart détecté', { y: e.touches?.[0]?.clientY });
        isDragging = true;
        startY = e.touches ? e.touches[0].clientY : e.clientY;
        currentY = startY;
        e.preventDefault();
      };

      const handleMove = (e) => {
        if (!isDragging) return;
        currentY = e.touches ? e.touches[0].clientY : e.clientY;
        e.preventDefault();
      };

      const handleEnd = () => {
        if (!isDragging) return;
        isDragging = false;

        const deltaY = currentY - startY;
        const threshold = 30; // Seuil optimisé pour déclencher le swipe
        console.log('👆 Scoreboard swipe détecté', { deltaY, threshold });

        if (deltaY > threshold) {
          // Swipe vers le bas -> fermer
          console.log('✅ Fermeture scoreboard');
          scoreboardPanel.classList.add('is-hidden');
          if (navigator.vibrate) {
            navigator.vibrate(10);
          }
        } else if (deltaY < -threshold) {
          // Swipe vers le haut -> ouvrir
          console.log('✅ Ouverture scoreboard');
          scoreboardPanel.classList.remove('is-hidden');
          if (navigator.vibrate) {
            navigator.vibrate(10);
          }
        } else {
          console.log('❌ Swipe trop faible', { deltaY });
        }
      };

      // Touch events (mobile)
      scoreboardTouchZone.addEventListener('touchstart', handleStart, { passive: false });
      scoreboardTouchZone.addEventListener('touchmove', handleMove, { passive: false });
      scoreboardTouchZone.addEventListener('touchend', handleEnd);

      // Mouse events (desktop) - seulement pour le drag
      scoreboardTouchZone.addEventListener('mousedown', handleStart);
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleEnd);
    }
  }

  // ==================== ARCADE BUBBLES : Réactions ====================
  function initReactionSystem() {
    const { $, socket, state } = window.HOL;
    let isOnCooldown = false;

    const triggers = document.querySelectorAll('.btn-reaction');
    const displayArea = document.getElementById('reaction-display-area');
    const reactionTriggers = document.getElementById('reaction-triggers');
    const reactionHandle = document.querySelector('.reaction-handle');
    const reactionTouchZone = document.getElementById('reaction-touch-zone');

    if (!triggers.length || !displayArea) {
      console.warn('Arcade Bubbles: éléments manquants', { triggers: triggers.length, displayArea: !!displayArea });
      return;
    }

    console.log('Arcade Bubbles initialisé', { triggers: triggers.length, displayArea: displayArea.id });

    // ========== GESTION DE LA ZONE TACTILE INVISIBLE ==========
    
    if (reactionTouchZone && reactionTriggers) {
      // ========== DESKTOP : Clic sur zone ou poignée pour toggle ==========
      const toggleReactions = (e) => {
        // Seulement sur desktop (pas mobile)
        if (e.pointerType === 'mouse' || e.type === 'click') {
          reactionTriggers.classList.toggle('is-open');
        }
      };

      reactionTouchZone.addEventListener('click', toggleReactions);
      
      // Clic sur la poignée elle-même (desktop)
      if (reactionHandle) {
        reactionHandle.addEventListener('click', (e) => {
          e.stopPropagation();
          reactionTriggers.classList.toggle('is-open');
        });
      }

      // ========== MOBILE : Swipe horizontal pour ouvrir/fermer ==========
      let startX = 0;
      let currentX = 0;
      let isDragging = false;

      const handleStart = (e) => {
        console.log('👆 Reactions touchstart détecté', { x: e.touches?.[0]?.clientX });
        isDragging = true;
        startX = e.touches ? e.touches[0].clientX : e.clientX;
        currentX = startX;
        e.preventDefault();
      };

      const handleMove = (e) => {
        if (!isDragging) return;
        currentX = e.touches ? e.touches[0].clientX : e.clientX;
        e.preventDefault();
      };

      const handleEnd = () => {
        if (!isDragging) return;
        isDragging = false;

        const deltaX = currentX - startX;
        const threshold = 30; // Seuil optimisé pour déclencher le swipe
        console.log('👆 Reactions swipe détecté', { deltaX, threshold });

        if (deltaX > threshold) {
          // Swipe vers la droite -> fermer
          console.log('✅ Fermeture réactions');
          reactionTriggers.classList.remove('is-open');
          if (navigator.vibrate) {
            navigator.vibrate(10);
          }
        } else if (deltaX < -threshold) {
          // Swipe vers la gauche -> ouvrir
          console.log('✅ Ouverture réactions');
          reactionTriggers.classList.add('is-open');
          if (navigator.vibrate) {
            navigator.vibrate(10);
          }
        } else {
          console.log('❌ Swipe trop faible', { deltaX });
        }
      };

      // Touch events (mobile)
      reactionTouchZone.addEventListener('touchstart', handleStart, { passive: false });
      reactionTouchZone.addEventListener('touchmove', handleMove, { passive: false });
      reactionTouchZone.addEventListener('touchend', handleEnd);

      // Mouse events (desktop) - seulement pour le drag
      reactionTouchZone.addEventListener('mousedown', handleStart);
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleEnd);
    }

    // Gestion des clics sur les boutons de réaction
    triggers.forEach(btn => {
      btn.addEventListener('click', () => {
        if (isOnCooldown) return;

        const emoji = btn.getAttribute('data-emoji');
        const playerName = state.me?.name || 'Joueur';

        console.log('Réaction envoyée:', { emoji, playerName });

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
      console.log('[REACTION] 📨 Broadcast reçu:', { emoji, name });
      createReactionBubble(emoji, name, displayArea);
    });
    
    // DEBUG : Test automatique au chargement (à supprimer en production)
    if (displayArea) {
      setTimeout(() => {
        console.log('[REACTION] 🧪 Test automatique de bulle...');
        createReactionBubble('🎉', 'Test Auto', displayArea);
      }, 2000);
    }
  }

  function createReactionBubble(emoji, playerName, container) {
    console.log('[REACTION] Création bulle:', { emoji, playerName, container: container?.id });
    console.log('[REACTION] Container display:', container ? window.getComputedStyle(container).display : 'N/A');
    console.log('[REACTION] Container z-index:', container ? window.getComputedStyle(container).zIndex : 'N/A');
    
    if (!container) {
      console.error('[REACTION] ❌ Container manquant pour bulle');
      return;
    }
    
    if (window.getComputedStyle(container).display === 'none') {
      console.error('[REACTION] ❌ Container est display:none!');
      return;
    }

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

    console.log('[REACTION] ✅ Bulle ajoutée au DOM:', bubble);
    console.log('[REACTION] Position bulle:', {
      bottom: bubble.style.bottom || window.getComputedStyle(bubble).bottom,
      left: bubble.style.left,
      zIndex: window.getComputedStyle(bubble).zIndex,
      animation: window.getComputedStyle(bubble).animation
    });

    // Suppression automatique après l'animation (3.2s)
    setTimeout(() => {
      bubble.remove();
      console.log('[REACTION] 🗑️ Bulle supprimée:', emoji);
    }, 3200);
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
