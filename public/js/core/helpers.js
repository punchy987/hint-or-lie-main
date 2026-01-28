// public/js/core/helpers.js
(function () {
  const HOL = (window.HOL = window.HOL || {});

  // Écrans où le scoreboard doit être visible (ajout de screen-lobby)
  HOL.SCORE_SCREENS = new Set(['screen-lobby', 'screen-hint', 'screen-vote', 'screen-result']);

  // Sélecteurs
  HOL.$ = HOL.$ || ((s, r = document) => {
    if (!s) return null;
    const bySel = s.startsWith('#') || s.startsWith('.') || /[>\[\]:\s]/.test(s);
    return bySel ? r.querySelector(s) : r.getElementById(s);
  });

  HOL.el = HOL.el || function el(tag, text = '', attrs = {}) {
    const n = document.createElement(tag);
    if (text != null && text !== '') n.textContent = String(text);
    for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, String(v));
    return n;
  };

  HOL.onEnter = HOL.onEnter || function (idOrSel, fn) {
    const input = HOL.$(idOrSel);
    if (!input) return;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); fn && fn(); }
    });
  };

  HOL.show = HOL.show || function (screenId) {
    const ids = ['screen-home', 'screen-lobby', 'screen-hint', 'screen-vote', 'screen-result'];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) el.style.display = (id === screenId) ? '' : 'none';
    }
    document.body.setAttribute('data-screen', screenId);
    // RÈGLE D'OR : Gérer l'affichage du scoreboard selon l'écran
    const sb = document.getElementById('scoreboard');
    if (sb) {
      if (HOL.SCORE_SCREENS.has(screenId)) {
        // Visible dans les écrans de jeu
        sb.style.display = 'block';
        document.getElementById(screenId).appendChild(sb);
      } else {
        // Masqué sur la page d'accueil
        sb.style.display = 'none';
      }
    }
  };

  // Transition système anti-FOPC (Flash of Page Content)
  HOL.transitionTo = HOL.transitionTo || async function (screenId, updateCallback) {
    const overlay = document.getElementById('global-transition-overlay');
    if (!overlay) {
      // Fallback si l'overlay n'existe pas encore
      if (updateCallback) updateCallback();
      HOL.show(screenId);
      return;
    }

    // Étape A : Lever le rideau
    overlay.classList.add('active');
    await new Promise(resolve => setTimeout(resolve, 400)); // Attendre la transition opacity (0.4s)

    // Étape B : Garantir une durée minimale pour éviter l'effet flash
    const minDelay = new Promise(resolve => setTimeout(resolve, 600));
    const dataInjected = Promise.resolve(
      updateCallback ? updateCallback() : null
    );
    
    // Attendre que les deux promesses soient résolues
    await Promise.all([minDelay, dataInjected]);

    // Étape C : Changer l'écran
    HOL.show(screenId);

    // Étape D : Baisser le rideau après un court délai
    await new Promise(resolve => setTimeout(resolve, 50));
    overlay.classList.remove('active');
  };

  HOL.toast = HOL.toast || function (msg, ms = 2200, isError = false) {
    let t = document.getElementById('toast');
    if (!t) return console.log("Toast:", msg);
    t.textContent = String(msg || '');
    
    // Ajouter ou retirer la classe error
    if (isError) {
      t.classList.add('error');
    } else {
      t.classList.remove('error');
    }
    
    clearTimeout(HOL._toastTimer);
    HOL._toastTimer = setTimeout(() => { 
      t.textContent = ''; // Vider pour déclencher l'animation de sortie
      t.classList.remove('error');
    }, ms);
  };

  HOL.getDeviceId = HOL.getDeviceId || function () {
    const K = 'hol_device_id';
    let id = localStorage.getItem(K);
    if (!id) { id = 'd-' + Math.random().toString(36).slice(2, 9); localStorage.setItem(K, id); }
    return id;
  };

  HOL.fmt = HOL.fmt || function fmt(ms) {
    const s = Math.max(0, Math.floor((ms ?? 0) / 1000));
    return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  };

  HOL.shareInviteLink = async function({ code, name }) {
    const url = `${location.origin}${location.pathname}?code=${code}${name ? '&n='+name : ''}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Hint or Lie', text: `Code ${code}`, url }); return; } catch {}
    }
    try { await navigator.clipboard.writeText(url); HOL.toast('Lien copié ✅'); } catch { HOL.toast('Erreur copie'); }
  };

})();