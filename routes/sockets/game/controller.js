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

    for (const [id, p] of r.players.entries()) {
      if (p.disconnected && (r.round - p.disconnectedSince) >= 2) {
        r.players.delete(id);
        if(r.active?.has(id)) r.active.delete(id);
      }
    }
    
    for (const p of r.players.values()) {
      p.spectator = false;
    }

    clearRoomTimer(r);
    r.lobbyReady = new Set();
    r.readyNext  = new Set();

    r.active = new Set(Array.from(r.players.entries()).filter(([_, p]) => !p.disconnected).map(([id]) => id));

    if (r.active.size < 3) {
      io.to(code).emit('errorMsg', 'Minimum 3 joueurs');
      r.state = 'lobby';
      return broadcast(io, code);
    }

    for (const p of r.players.values()) {
      p.hint = null;
      p.vote = null;
      p.isImpostor = false;
    }

    r.hints = [];
    r.hintAuthor = new Map();

    const pair = pickPair(r);
    r.words = { common: pair.common, impostor: null, domain: pair.domain };
    r.lastDomain = pair.domain;
    r.lastCommon = pair.common;

    const activeIds = Array.from(r.active);
    const impId = activeIds[Math.floor(Math.random() * activeIds.length)];
    r.impostor = impId;
    const imp = r.players.get(impId);
    if (imp) imp.isImpostor = true;

    r.usedHints = new Set();
    r.liveCrewHints = [];

    r.round = (r.round || 0) + 1;
    r.state = 'hints';

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

    if (r.impostor) io.to(r.impostor).emit('crewHintsLive', { hints: r.liveCrewHints });

    io.to(code).emit('phaseProgress', { phase: 'hints', submitted: 0, total: r.active.size, round: r.round });

    startPhaseTimer(io, code, HINT_SECONDS, 'hints', () => {
      const room = rooms.get(code); if (!room) return;
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
    const activeConnected = Array.from(r.active || []).filter(id => !r.players.get(id)?.disconnected);
    const submitted = activeConnected.filter(id => typeof r.players.get(id)?.hint === 'string').length;
    const total = activeConnected.length;

    if (submitted === total && total > 0) {
      clearRoomTimer(r);
      r.state = 'voting';

      r.hints = [];
      r.hintAuthor = new Map();
      const now = Date.now();

      for (const id of r.active) {
        const p = r.players.get(id);
        if (!p || typeof p.hint !== 'string') continue;
        const text = p.hint.trim();
        const hid  = `H_${r.round || 1}_${id}`;
        r.hints.push({ id: hid, playerId: id, text, ts: now });
        r.hintAuthor.set(hid, id);
      }

      const hintsPayload = r.hints.map(h => ({ id: h.id, hint: h.text }));
      io.to(code).emit('hintsList', hintsPayload);

      startPhaseTimer(io, code, VOTE_SECONDS, 'voting', () => finishVoting(code));
      broadcast(io, code);
    } else {
      io.to(code).emit('phaseProgress', { phase: 'hints', submitted, total, round: r.round });
    }
  }

  function handleVote(code, playerId, voteId) {
    const r = rooms.get(code);
    if (!r || r.state !== 'voting') return;

    const p = r.players.get(playerId);
    if (!p) return;

    p.vote = voteId;

    const activeConnected = Array.from(r.active || []).filter(id => !r.players.get(id)?.disconnected);
    const submitted = activeConnected.filter(id => r.players.get(id)?.vote).length;
    const total = activeConnected.length;

    io.to(code).emit('phaseProgress', { phase: 'voting', submitted, total, round: r.round });

    if (submitted === total && total > 0) {
      finishVoting(code);
    }
  }

  function finishVoting(code) {
    const r = rooms.get(code); if (!r) return;
    if (r.state !== 'voting') return;

    clearRoomTimer(r);

    const activeConnected = Array.from(r.active || []).filter(id => !r.players.get(id)?.disconnected);
    const impId = r.impostor;

    if (r.hintAuthor && typeof r.hintAuthor.get === 'function') {
      for (const id of activeConnected) {
        const p = r.players.get(id);
        if (p?.vote && r.hintAuthor.has(p.vote)) {
          p.vote = r.hintAuthor.get(p.vote);
        }
      }
    }

    const tally = {};
    for (const id of activeConnected) {
      const p = r.players.get(id);
      if (p?.vote) tally[p.vote] = (tally[p.vote] || 0) + 1;
    }

    let max = -1;
    let leaders = [];
    for (const [candidate, v] of Object.entries(tally)) {
      if (v > max) { max = v; leaders = [candidate]; }
      else if (v === max) { leaders.push(candidate); }
    }
    const caught = (leaders.length === 1 && leaders[0] === impId);

    if (caught) {
      for (const id of activeConnected) {
        const p = r.players.get(id);
        if (p && !p.isImpostor) p.score = (p.score || 0) + 1;
      }
    } else {
      const imp = r.players.get(impId);
      if (imp) imp.score = (imp.score || 0) + 2;
    }

    const winners = new Set();
    if (caught) {
      for (const id of activeConnected) {
        if (!r.players.get(id)?.isImpostor) winners.add(id);
      }
    } else if (impId) {
      winners.add(impId);
    }

    for (const id of activeConnected) {
       const p = r.players.get(id);
       const didWin = winners.has(id);
       if (p?.deviceId) {
         upsertRoundResult?.({ deviceId: p.deviceId, pseudo: p.name, didWin, isImpostor: !!p.isImpostor });
       }
    }

const impostorHint =
  (Array.isArray(r.hints) ? r.hints.find(h => h.playerId === impId)?.text : '') || '—';

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
  impostorName: r.players.get(impId)?.name || '?',
  common: r.words?.common,
  impostor: null,
  impostorHint,
  commonDisplay: labelWordByDomain(r.words?.common, r.words?.domain),
  impostorDisplay: '—',
  votes: tally,
  votesDetail: votesDetail,
  impostorCaught: caught,
  domain: r.words?.domain,
});

    const activePlayers = Array.from(r.players.entries()).filter(([_, p]) => !p.disconnected);
    const maxScore = Math.max(0, ...activePlayers.map(([_, p]) => p.score || 0));
    const isGameOver = maxScore >= 10;

    if (!isGameOver) {
      r.state = 'reveal';
      r.readyNext = new Set();
      io.to(code).emit('readyProgress', { ready: 0, total: activePlayers.length });
      
      broadcast(io, code);

    } else {
      const winnersArr = activePlayers
        .filter(([_, p]) => (p.score || 0) === maxScore)
        .map(([id, p]) => ({ id, name: p.name, score: p.score || 0, deviceId: p.deviceId }));

      if (typeof applyPenaltyIfNotWinner === 'function') {
        const winnerIds = new Set(winnersArr.map(w => w.id));
        for (const [id, p] of activePlayers) {
          if (!winnerIds.has(id) && p?.deviceId) {
            applyPenaltyIfNotWinner({ deviceId: p.deviceId, pseudo: p.name })
              .catch(() => {});
          }
        }
      }

      r.state = 'gameOver';

      io.to(code).emit('gameOver', {
        winners: winnersArr,
        round: r.round,
        finalScores: Object.fromEntries(activePlayers.map(([id, p]) => [id, p.score || 0])),
        winnersCount: winnersArr.length,
        isGameOver: true,
      });

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

      broadcast(io, code);
    }
  }

  return { startRound, maybeStartVoting, finishVoting, handleVote };
}

module.exports = { createController };
