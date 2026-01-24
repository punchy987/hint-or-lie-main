// routes/sockets/game/controller.js
const path = require('path');

const { rooms, broadcast } =
  require(path.join(__dirname, '..', 'state', 'room.js'));
const { labelWordByDomain } =
  require(path.join(__dirname, 'words.js'));
const { pickPair } =
  require(path.join(__dirname, 'picker.js'));
const { clearRoomTimer, startPhaseTimer } =
  require(path.join(__dirname, '..', 'timer.js'));

function createController({ io, upsertRoundResult, applyPenaltyIfNotWinner, HINT_SECONDS, VOTE_SECONDS }) {

  function startRound(code) {
    const r = rooms.get(code); if (!r) return;

    // Nettoyage des joueurs déconnectés depuis trop longtemps
    for (const [id, p] of r.players.entries()) {
      if (p.disconnected && (r.round - p.disconnectedSince) >= 2) {
        r.players.delete(id);
        if(r.active?.has(id)) r.active.delete(id);
        console.log(`[GC] Joueur ${p.name} (id: ${id}) supprimé pour inactivité prolongée.`);
      }
    }
    
    // ✅ RÉINITIALISER TOUS les flags de spectateur au début du round
    for (const p of r.players.values()) {
      p.spectator = false;  // Tout le monde devient potentiellement actif
    }

    clearRoomTimer(r);
    r.lobbyReady = new Set();
    r.readyNext  = new Set();

    // Fige les joueurs actifs pour TOUT le round (ceux qui ne sont pas déconnectés, y compris les ex-spectateurs)
    r.active = new Set(Array.from(r.players.entries()).filter(([_, p]) => !p.disconnected).map(([id]) => id));

    if (r.active.size < 3) {
      io.to(code).emit('errorMsg', 'Minimum 3 joueurs');
      r.state = 'lobby';
      return broadcast(io, code);
    }

    // Reset des états de round (par joueur)
    for (const p of r.players.values()) {
      p.hint = null;
      p.vote = null;
      p.isImpostor = false;
    }

    // === NEW: structures pour vote par indice anonyme ===
    r.hints = [];                 // [{ id, playerId, text, ts }]
    r.hintAuthor = new Map();     // hintId -> playerId

    // Tirage des mots (imposteur n'a PAS de mot)
    const pair = pickPair(r);
    r.words = { common: pair.common, impostor: null, domain: pair.domain };
    r.lastDomain = pair.domain;
    r.lastCommon = pair.common;

    // Choix de l’imposteur parmi les actifs
    const activeIds = Array.from(r.active);
    const impId = activeIds[Math.floor(Math.random() * activeIds.length)];
    r.impostor = impId;
    const imp = r.players.get(impId);
    if (imp) imp.isImpostor = true;

    r.usedHints = new Set();
    r.liveCrewHints = [];

    r.round = (r.round || 0) + 1;
    r.state = 'hints';

    // Envoi des infos de manche aux ACTIFS
    for (const id of r.active) {
      const p = r.players.get(id);
      if (!p) continue;

      if (p.isImpostor) {
        io.to(id).emit('roundInfo', {
          word: null,
          wordDisplay: 'Aucun mot — observe les indices',
          isImpostor: true,
          domain: r.words.domain,
          round: r.round,
        });
      } else {
        const myword = r.words.common;
        io.to(id).emit('roundInfo', {
          word: myword,
          wordDisplay: labelWordByDomain(myword, r.words.domain),
          isImpostor: false,
          domain: r.words.domain,
          round: r.round,
        });
      }
    }

    // L'imposteur reçoit le flux live des indices d'équipiers
    if (r.impostor) io.to(r.impostor).emit('crewHintsLive', { hints: r.liveCrewHints });

    // Progress initial
    io.to(code).emit('phaseProgress', { phase: 'hints', submitted: 0, total: r.active.size, round: r.round });

    // Timer phase indices
    startPhaseTimer(io, code, HINT_SECONDS, 'hints', () => {
      const room = rooms.get(code); if (!room) return;
      // Hints vides pour les ACTIFS qui n’ont rien envoyé
      for (const id of room.active) {
        const p = room.players.get(id);
        if (p && typeof p.hint !== 'string') p.hint = '';
      }
      maybeStartVoting(code);
    });

    broadcast(io, code);
  }

  function maybeStartVoting(code) {
    const r = rooms.get(code); if (!r) return;
    if (r.state !== 'hints') return;

    // Ne compte que les joueurs actifs et connectés
    const activeConnected = Array.from(r.active).filter(id => !r.players.get(id)?.disconnected);
    const submitted = activeConnected.filter(id => typeof r.players.get(id)?.hint === 'string').length;
    const total = activeConnected.length;

    if (submitted === total && total > 0) {
      clearRoomTimer(r);
      r.state = 'voting';

      // === NEW: reconstruire la liste d'indices anonymes + mapping auteur ===
      r.hints = [];
      r.hintAuthor = new Map();
      const now = Date.now();

      // On inclut les indices de tous les joueurs du set `active` original, même déconnectés
      for (const id of r.active) {
        const p = r.players.get(id);
        if (!p || typeof p.hint !== 'string') continue; // Ne pas inclure si le joueur a été purgé ou n'a pas joué
        const text = p.hint.trim();
        const hid  = `H_${r.round || 1}_${id}`;
        r.hints.push({ id: hid, playerId: id, text, ts: now });
        r.hintAuthor.set(hid, id);
      }

      // === NEW: payload anonyme (tableau) pour compat client ===
      const hintsPayload = r.hints.map(h => ({ id: h.id, hint: h.text }));
      io.to(code).emit('hintsList', hintsPayload);

      startPhaseTimer(io, code, VOTE_SECONDS, 'voting', () => finishVoting(code));
      broadcast(io, code);
    } else {
      // Mise à jour de la progression si tout le monde n'a pas encore soumis
      io.to(code).emit('phaseProgress', { phase: 'hints', submitted, total, round: r.round });
    }
  }

  function finishVoting(code) {
    const r = rooms.get(code); if (!r) return;
    if (r.state !== 'voting') return;

    clearRoomTimer(r);

    const activeConnected = Array.from(r.active).filter(id => !r.players.get(id)?.disconnected);
    const impId = r.impostor;

    // === NEW: conversion éventuelle des votes "hintId" -> "playerId"
    if (r.hintAuthor && typeof r.hintAuthor.get === 'function') {
      for (const id of activeConnected) {
        const p = r.players.get(id);
        if (p?.vote && r.hintAuthor.has(p.vote)) {
          p.vote = r.hintAuthor.get(p.vote);
        }
      }
    }

    // Tally des votes (sur playerId) - uniquement des joueurs connectés
    const tally = {};
    for (const id of activeConnected) {
      const p = r.players.get(id);
      if (p?.vote) tally[p.vote] = (tally[p.vote] || 0) + 1;
    }

    // 👉 Démasqué SEULEMENT si top unique ET que c'est l'imposteur
    let max = -1;
    let leaders = [];
    for (const [candidate, v] of Object.entries(tally)) {
      if (v > max) { max = v; leaders = [candidate]; }
      else if (v === max) { leaders.push(candidate); }
    }
    const caught = (leaders.length === 1 && leaders[0] === impId);

    // Attribution des points
    if (caught) {
      for (const id of activeConnected) {
        const p = r.players.get(id);
        if (p && !p.isImpostor) p.score = (p.score || 0) + 1;
      }
    } else {
      const imp = r.players.get(impId);
      if (imp) imp.score = (imp.score || 0) + 2;
    }

    // Détermination des vainqueurs de la manche
    const winners = new Set();
    if (caught) {
      for (const id of activeConnected) {
        if (!r.players.get(id)?.isImpostor) winners.add(id);
      }
    } else if (impId) {
      winners.add(impId);
    }

    // Persistance (si Firestore branché)
    for (const id of activeConnected) {
       const p = r.players.get(id);
       const didWin = winners.has(id);
       if (p?.deviceId) {
         upsertRoundResult?.({ deviceId: p.deviceId, pseudo: p.name, didWin, isImpostor: !!p.isImpostor });
       }
    }
// ... (après calcul de `caught`, attribution des points, winners, etc.)

// 👉 Récupère l'indice (mensonge) tapé par l'imposteur pour l'afficher dans le résumé
const impostorHint =
  (Array.isArray(r.hints) ? r.hints.find(h => h.playerId === impId)?.text : '') || '—';

// Résultat de manche — version officielle
const votesDetail = {};
for (const id of activeConnected) {
  const p = r.players.get(id);
  if (p?.vote) {
    votesDetail[id] = p.vote;
  }
}
io.to(code).emit('roundResult', {
  round: r.round,
  impostorId: impId,
  impostorName: r.players.get(impId)?.name,
  common: r.words.common,
  impostor: null,                        // l’imposteur n’a pas de mot dans ta V2
  impostorHint,                          // ✅ NOUVEAU
  commonDisplay: labelWordByDomain(r.words.common, r.words.domain),
  impostorDisplay: '—',
  votes: tally,
  votesDetail: votesDetail,
  impostorCaught: caught,
  domain: r.words.domain,
});

    // ✅ VÉRIFICATION FIN DE PARTIE (10 pts)
    const activePlayers = Array.from(r.players.entries()).filter(([_, p]) => !p.disconnected);
    const maxScore = Math.max(0, ...activePlayers.map(([_, p]) => p.score || 0));
    const isGameOver = maxScore >= 10;

    if (!isGameOver) {
      // === CONTINUATION : passer à reveal ===
      r.state = 'reveal';
      r.readyNext = new Set();
      io.to(code).emit('readyProgress', { ready: 0, total: r.players.size });
      broadcast(io, code);

    } else {
      // === FIN DE PARTIE : Gagnants finaux ===
      const winnersArr = activePlayers
        .filter(([_, p]) => (p.score || 0) === maxScore)
        .map(([id, p]) => ({ id, name: p.name, score: p.score || 0, deviceId: p.deviceId }));

      // ✅ Appliquer les pénalités de fin de partie
      if (typeof applyPenaltyIfNotWinner === 'function') {
        const winnerIds = new Set(winnersArr.map(w => w.id));
        for (const [id, p] of activePlayers) {
          if (!winnerIds.has(id) && p?.deviceId) {
            applyPenaltyIfNotWinner({ deviceId: p.deviceId, pseudo: p.name })
              .catch(() => {}); // Silencieux
          }
        }
      }

      // État final
      r.state = 'gameOver';

      // Signal gameOver avec contexte complet
      io.to(code).emit('gameOver', {
        winners: winnersArr,
        round: r.round,
        finalScores: Object.fromEntries(activePlayers.map(([id, p]) => [id, p.score || 0])),
        winnersCount: winnersArr.length,
        isGameOver: true,
      });

      // Reset pour la prochaine partie
      for (const p of r.players.values()) {
        p.score = 0;
        p.hint = null;
        p.vote = null;
        p.isImpostor = false;
        p.spectator = false;
      }
      r.round = 0;
      r.state = 'lobby';
      r.lobbyReady = new Set();
      r.readyNext = new Set();
      r.used = {};
      r.impostor = null;

      // Notify everyone
      broadcast(io, code);
    }
  }

  return { startRound, maybeStartVoting, finishVoting };
}

module.exports = { createController };
