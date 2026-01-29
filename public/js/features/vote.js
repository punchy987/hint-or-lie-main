// public/js/features/vote.js
// Phase "Vote" — Affichage en mode "Cartes / Tuiles" 🃏

(function () {
  const { $, show, socket, resetPhaseProgress, state } = window.HOL;

  let myTarget = null;     // dernier choix local (hintId)
  let votingClosed = false;
  let myOwnHintText = null; // Stockage de mon propre indice pour l'identifier
  let voteConfirmTimer = null; // Timer pour le feedback temporaire
  let selectedCard = null; // Carte actuellement sélectionnée dans la preview
  let originalCardParent = null; // Emplacement d'origine dans le carrousel

  // Affiche un message temporaire d'interdiction
  function showNoSelfVoteMessage() {
    let msg = document.getElementById('no-self-vote-msg');
    if (!msg) {
      msg = document.createElement('div');
      msg.id = 'no-self-vote-msg';
      msg.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(255, 96, 92, 0.95);
        color: #FFFFFF;
        padding: 16px 24px;
        border-radius: 12px;
        font-family: 'Lexend', sans-serif;
        font-size: 1.1rem;
        font-weight: 700;
        z-index: 2000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideDown 0.3s ease-out;
        text-align: center;
      `;
      msg.textContent = "Tu ne peux pas voter contre toi-même !";
      document.body.appendChild(msg);
    }
    msg.style.display = 'block';
    msg.style.animation = 'slideDown 0.3s ease-out';
    
    setTimeout(() => {
      msg.style.animation = 'slideUp 0.3s ease-out';
      setTimeout(() => { msg.style.display = 'none'; }, 300);
    }, 2500);
  }

  // Fixe le thème avec fallback
  function setVoteTheme(domainMaybe) {
    const text =
      (domainMaybe && String(domainMaybe).trim()) ||
      (state?.roundDomain && String(state.roundDomain).trim()) ||
      ($('theme-hint-name')?.textContent?.trim()) ||
      '—';
    const el = $('theme-vote-name');
    if (el) el.textContent = text;
  }

  // --- NOUVEAU RENDU : CARTES CLIQUABLES ---
  function renderHintsWithVote(hints) {
    const box = $('hints'); if (!box) return;
    
    // Nettoyage ancien système (si encore présent)
    // Le conteneur #hints contient maintenant directement les cartes

    box.style.display = '';   
    box.innerHTML = ''; // On efface la liste précédente

    const shuffledHints = [...(hints || [])].sort(() => Math.random() - 0.5);
    myOwnHintText = state?.myOwnHintText || null;

    shuffledHints.forEach(h => {
      // Création de la CARTE 3D (conteneur parent scroll-snap)
      const card = document.createElement('div');
      card.className = 'vote-card';
      card.dataset.id = h.id;

      // Pivot 3D interne
      const cardInner = document.createElement('div');
      cardInner.className = 'vote-card-inner';

      // FACE ARRIÈRE (visible au départ - emoji 🤫)
      const cardBack = document.createElement('div');
      cardBack.className = 'card-back';
      cardBack.textContent = '🤫';

      // FACE AVANT (cachée - indice révélé)
      const cardFront = document.createElement('div');
      cardFront.className = 'card-front';
      
      const fullText = (h.text ?? h.hint ?? '').toString().trim();
      
      // Texte de l'indice
      const hintText = document.createElement('div');
      hintText.className = 'hint-text';
      hintText.textContent = fullText || '—';
      cardFront.appendChild(hintText);
      
      // Nom du joueur (si disponible)
      if (h.playerName) {
        const playerName = document.createElement('div');
        playerName.className = 'player-name-hint';
        playerName.textContent = h.playerName;
        cardFront.appendChild(playerName);
      }

      // Assemblage de la hiérarchie
      cardInner.appendChild(cardBack);
      cardInner.appendChild(cardFront);
      card.appendChild(cardInner);

      // Vérifier si c'est ma propre carte
      const isMyOwnHint = myOwnHintText && fullText === myOwnHintText;
      if (isMyOwnHint) {
        card.classList.add('is-me');
        card.title = "C'est ton propre indice !";
      }

      // Le clic sur la carte
      card.onclick = (e) => {
        console.log('[HOL] Carte cliquée:', h.id);
        if (votingClosed) return;
        // INTERDICTION DE L'AUTO-VOTE
        if (isMyOwnHint) {
          card.classList.add('shake-error');
          setTimeout(() => { card.classList.remove('shake-error'); }, 300);
          if (navigator.vibrate) navigator.vibrate(50);
          showNoSelfVoteMessage();
          return;
        }
        // Si une carte est déjà sélectionnée, la renvoyer dans le carrousel
        if (selectedCard && selectedCard !== card) {
          returnCardToCarousel(selectedCard);
        }
        // Si drag détecté, mais mouvement <5px, forcer le clic
        if (typeof window.voteDragMoved !== 'undefined' && window.voteDragMoved && window.voteLastDragDist < 5) {
          window.voteDragMoved = false;
        }
        moveCardToPreview(card, h.id);
      };

      box.appendChild(card);
    });
  }
  
  // --- NOUVELLE FONCTION : Déplacer une carte vers la preview zone ---
  function moveCardToPreview(card, hintId) {
    const previewSlot = document.getElementById('vote-preview-slot');
    const btnConfirm = document.getElementById('btn-confirm-vote');
    if (!previewSlot || !btnConfirm) return;

    // Sauvegarder l'emplacement d'origine
    originalCardParent = card.parentElement;
    selectedCard = card;
    myTarget = hintId;

    // Déplacer la carte dans la zone de preview (sans fade-out)
    previewSlot.innerHTML = '';
    previewSlot.appendChild(card);
    card.classList.remove('revealed');
    console.log('[VOTE] remove revealed', card, card.parentElement?.id);
    card.classList.add('in-preview');
    card.style.left = '';
    card.style.top = '';
    card.style.transform = '';

    // Vibration de sélection
    if (navigator.vibrate) {
      navigator.vibrate(20);
    }

    // Animation de flip : on force le reflow puis on ajoute revealed une seule fois
    void card.offsetWidth;
    card.classList.add('revealed');
    console.log('[VOTE] add revealed', card, card.parentElement?.id);
    btnConfirm.classList.add('visible');
    // Vibration de flip
    if (navigator.vibrate) {
      navigator.vibrate([10, 20, 10]);
    }
  }
  
  // --- NOUVELLE FONCTION : Renvoyer une carte dans le carrousel ---
  function returnCardToCarousel(card) {
    const previewSlot = document.getElementById('vote-preview-slot');
    const btnConfirm = document.getElementById('btn-confirm-vote');
    // Masquer le bouton
    if (btnConfirm) {
      btnConfirm.classList.remove('visible');
    }
    // Animation de retour : on anime la carte de la preview vers sa place d'origine
    if (originalCardParent) {
      // Obtenir la position actuelle (preview)
      const previewRect = card.getBoundingClientRect();
      // Créer un placeholder à la place d'origine
      const placeholder = document.createElement('div');
      placeholder.className = 'vote-card placeholder';
      placeholder.style.width = card.offsetWidth + 'px';
      placeholder.style.height = card.offsetHeight + 'px';
      originalCardParent.insertBefore(placeholder, originalCardParent.children[Array.from(originalCardParent.children).indexOf(card)]);
      // Obtenir la position cible (carrousel)
      const targetRect = placeholder.getBoundingClientRect();
      // Appliquer la position absolue à la carte
      card.style.position = 'fixed';
      card.style.left = previewRect.left + 'px';
      card.style.top = previewRect.top + 'px';
      card.style.zIndex = 2000;
      document.body.appendChild(card);
      // Forcer le reflow
      void card.offsetWidth;
      // Lancer l'animation
      card.style.transition = 'all 0.4s cubic-bezier(0.4,0,0.2,1)';
      card.style.left = targetRect.left + 'px';
      card.style.top = targetRect.top + 'px';
      card.style.transform = 'scale(1)';
      setTimeout(() => {
        // Nettoyer l'animation
        card.style.transition = '';
        card.style.position = '';
        card.style.left = '';
        card.style.top = '';
        card.style.zIndex = '';
        card.classList.remove('in-preview', 'revealed');
        console.log('[VOTE] remove revealed (return)', card, card.parentElement?.id);
        // Remettre la carte dans le carrousel
        originalCardParent.replaceChild(card, placeholder);
        // Vider la zone de preview
        if (previewSlot) previewSlot.innerHTML = '';
        // Réinitialiser les variables
        selectedCard = null;
        myTarget = null;
      }, 400);
    } else {
      // Fallback sans animation
      card.classList.remove('in-preview', 'revealed');
      console.log('[VOTE] remove revealed (return fallback)', card, card.parentElement?.id);
      card.style.transform = '';
      card.style.left = '';
      card.style.top = '';
      if (previewSlot) previewSlot.innerHTML = '';
      selectedCard = null;
      myTarget = null;
    }
  }
  // ------------------------------------------

  // Handler commun pour recevoir la liste des indices
  function handleHintsForVote(hints, domain, round) {
    votingClosed = false;
    myTarget = null;
    selectedCard = null;

    show('screen-vote');
    resetPhaseProgress();

    setVoteTheme(domain);           
    renderHintsWithVote(hints);     // Affiche les cartes

    const pv = $('progress-vote'); if (pv) pv.textContent = `0/${(hints || []).length}`;
    
    // Configurer le bouton de confirmation
    const btnConfirm = document.getElementById('btn-confirm-vote');
    if (btnConfirm) {
      btnConfirm.onclick = () => {
        if (!myTarget || !selectedCard) return;
        
        // Retour haptique de validation
        if (navigator.vibrate) {
          navigator.vibrate([30, 50, 30]);
        }
        
        // Envoi du vote au serveur
        socket.emit('submitVote', { hintId: myTarget });
        
        // Feedback visuel
        const instruction = document.querySelector('.vote-instruction');
        if (instruction) {
          clearTimeout(voteConfirmTimer);
          if (!instruction.dataset.originalText) {
            instruction.dataset.originalText = instruction.textContent;
          }
          instruction.textContent = 'Vote enregistré ! ✓';
          instruction.classList.add('voted');
          
          voteConfirmTimer = setTimeout(() => {
            instruction.textContent = instruction.dataset.originalText || "Touche une carte pour l'inspecter";
            instruction.classList.remove('voted');
          }, 2500);
        }
        
        // Mise à jour du compteur
        const pv = $('progress-vote');
        if (pv) {
          const [cur, tot] = (pv.textContent || '0/0').split('/').map(x => parseInt(x, 10) || 0);
          if (cur < tot) pv.textContent = `${cur + 1}/${tot}`;
        }
        
        // Masquer le bouton
        btnConfirm.classList.remove('visible');
        
        // Désactiver la carte (vote confirmé)
        if (selectedCard) {
          selectedCard.classList.add('selected');
          selectedCard.style.pointerEvents = 'none';
        }
      };
    }
  }

  function initSocket() {
    socket.on('hintsList', (hints) => {
      const mapped = (hints || []).map(h => ({
        id: h.id,
        text: (typeof h.text === 'string') ? h.text : (h.hint || ''),
        playerName: h.playerName || h.name || ''
      }));
      handleHintsForVote(mapped, null, null);
    });

    socket.on('phaseProgress', ({ phase, submitted, total }) => {
      if (phase === 'voting') {
        const elv = $('progress-vote'); if (elv) elv.textContent = `${submitted}/${total}`;
      }
    });

    socket.on('voteAck', () => {
    });

    socket.on('timer', ({ phase, leftMs }) => {
      if (phase === 'voting' && leftMs <= 0) {
        votingClosed = true;
        document.querySelectorAll('.vote-card').forEach(b => b.disabled = true);
      }
    });
  }

  // --- DRAG-TO-SCROLL pour la grille de vote (PC) ---
  function enableVoteGridDragScroll() {
    const grid = document.getElementById('hints');
    if (!grid) return;
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let dragMoved = false;
    let lastDragDist = 0;

    grid.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // seulement clic gauche
      isDown = true;
      dragMoved = false;
      lastDragDist = 0;
      grid.classList.add('is-dragging');
      startX = e.pageX - grid.offsetLeft;
      scrollLeft = grid.scrollLeft;
    });
    grid.addEventListener('mouseleave', () => {
      isDown = false;
      grid.classList.remove('is-dragging');
    });
    grid.addEventListener('mouseup', () => {
      isDown = false;
      setTimeout(() => grid.classList.remove('is-dragging'), 10);
    });
    grid.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - grid.offsetLeft;
      const walk = x - startX;
      lastDragDist = Math.abs(walk);
      if (lastDragDist > 5) dragMoved = true;
      grid.scrollLeft = scrollLeft - walk;
    });
    // Désactive le clic sur les cartes si drag détecté
    grid.addEventListener('click', (e) => {
      window.voteDragMoved = dragMoved;
      window.voteLastDragDist = lastDragDist;
      if (dragMoved) {
        e.stopPropagation();
        e.preventDefault();
        dragMoved = false;
        lastDragDist = 0;
      }
    }, true);
  }

  function init() {
    initSocket();
    enableVoteGridDragScroll();
  }
  
  window.HOL.features = window.HOL.features || {};
  window.HOL.features.vote = { init };
})();