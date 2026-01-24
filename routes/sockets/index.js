// routes/sockets/index.js
const path = require('path');

const { HINT_SECONDS, VOTE_SECONDS, LOBBY_READY_SECONDS } =
  require(path.join(__dirname, '..', '..', 'config', 'index.js'));

const { rooms, snapshot, broadcast, createRoom } =
  require(path.join(__dirname, 'state', 'room.js'));

const { clearRoomTimer, startPhaseTimer } =
  require(path.join(__dirname, 'timer.js'));

const { isHintAllowed } =
  require(path.join(__dirname, 'game', 'validate.js'));

let makePersistence = () => ({
  upsertRoundResult: async () => {},
  getTop50:          async () => [],
  getMyStats:        async () => null,
  applyPenaltyIfNotWinner: async () => ({ ok:false, reason:'no-db' }),
});
try {
  makePersistence = require(path.join(__dirname, '..', 'utils', 'persistence.js')).makePersistence;
} catch {
  console.log('ℹ️ Persistence non branchée (utils/persistence.js introuvable).');
}

const { createController } =
  require(path.join(__dirname, 'game', 'controller.js'));

function normalizeLocal(s) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim().replace(/\s+/g, ' ');
}

module.exports = function setupSockets(io, db){
  const { upsertRoundResult, getTop50, getMyStats, applyPenaltyIfNotWinner } = makePersistence(db);
  const controller = createController({ io, upsertRoundResult, applyPenaltyIfNotWinner, HINT_SECONDS, VOTE_SECONDS });

  io.on('connection',(socket)=>{
    let joined  = { code:null };
    let profile = { deviceId:null, lastPseudo:null };

    if (socket.onAny) socket.onAny((ev, ...args) => console.debug('⟵', socket.id, ev, ...args));

    socket.on('hello', ({ deviceId, pseudo } = {})=>{
      if (deviceId) profile.deviceId   = String(deviceId).slice(0,64);
      if (pseudo)   profile.lastPseudo = String(pseudo).slice(0,16);
    });

    socket.on('getLeaderboard', async ()=>{
      try{
        const top = await getTop50();
        const payload = top.map(x => ({
          deviceId: x.deviceId,
          pseudo:   x.lastPseudo || 'Joueur',
          wins:     Number(x.wins || 0),
          rp:       Number(x.rp || 0),
        }));
        socket.emit('leaderboard', payload);
        socket.emit('leaderboardData', payload);
      }catch{
        socket.emit('errorMsg','Impossible de charger le Top 50');
      }
    });

    socket.on('getMyStats', async ({ deviceId })=>{
      const doc = await getMyStats(String(deviceId||''));
      socket.emit('myStats', doc ? {
        rp:Number(doc.rp||0), rounds:Number(doc.rounds||0), wins:Number(doc.wins||0),
        winsCrew:Number(doc.winsCrew||0), winsImpostor:Number(doc.winsImpostor||0)
      } : { rp:0, rounds:0, wins:0, winsCrew:0, winsImpostor:0 });
    });

// ---- createRoom
    socket.on('createRoom', ({ name, deviceId, pseudo } = {}) => {
      try {
        const displayName = String(name || pseudo || profile.lastPseudo || 'Joueur').slice(0, 16);
        
        const code = createRoom(socket.id, displayName);
        console.log('[Socket] Salle créée avec le code:', code);

        socket.join(code);
        joined.code = code;
        profile.lastPseudo = displayName;
        profile.deviceId = String(deviceId || profile.deviceId || '').slice(0, 64) || null;

        const r = rooms.get(code);
        if (r && r.players.has(socket.id)) {
          r.players.get(socket.id).deviceId = profile.deviceId;
        }

        socket.emit('roomCreated', { code });
        broadcast(io, code);
      } catch (err) {
        console.error('[Error] Création de salle échouée:', err);
        socket.emit('errorMsg', 'Erreur lors de la création de la salle.');
      }
    });
    // ---- joinRoom
    socket.on('joinRoom', ({ code, name, deviceId, pseudo } = {})=>{
      code = String(code || '').trim();
      if (!/^\d{4}$/.test(code)) return socket.emit('errorMsg','Code invalide (4 chiffres)');
      const r = rooms.get(code); if (!r) return socket.emit('errorMsg','Salle introuvable');

      socket.join(code);
      joined.code = code;

      const displayName = String(name || pseudo || profile.lastPseudo || 'Joueur').slice(0,16);
      profile.lastPseudo = displayName;
      profile.deviceId   = String(deviceId || profile.deviceId || '').slice(0,64) || null;

      // Persistance: recherche d'un joueur déconnecté avec le même pseudo
      let disconnectedPlayerEntry = null;
      for (const [id, p] of r.players.entries()) {
        if (p.name === displayName && p.disconnected) {
          disconnectedPlayerEntry = [id, p];
          break;
        }
      }

      if (disconnectedPlayerEntry) {
        const [oldId, pData] = disconnectedPlayerEntry;
        r.players.delete(oldId); // Supprime l'ancienne entrée
        if(r.active?.has(oldId)) {
          r.active.delete(oldId);
          // ⚠️ NE PAS réintégrer immédiatement, le flag spectator sera restauré ci-dessous
        }
        // Restaure les données sur le nouveau socket.id
        pData.disconnected = false;
        pData.disconnectedSince = undefined;
        // ✅ IMPORTANT : Ne pas réinitialiser spectator ici - maintenir son état précédent
        r.players.set(socket.id, pData);
        console.log(`[Socket] Joueur reconnecté: ${displayName} (nouveau ID: ${socket.id})`);

        io.to(code).emit('system', { text: `🎉 ${displayName} est de retour !` });

        // ✅ NOUVEAU : Si c'était un spectateur ET qu'on est encore en partie → rester spectateur
        if (r.state !== 'lobby' && pData.spectator) {
          socket.emit('spectatorMode', { 
            phase: r.state, 
            message: 'Vous continuez à regarder la manche en cours.' 
          });
        }

      } else {
        // Vérification de l'unicité du pseudo pour les nouveaux joueurs
        const isPseudoTaken = Array.from(r.players.values()).some(p => !p.disconnected && p.name === displayName);
        if (isPseudoTaken) {
          socket.leave(code);
          joined.code = null;
          return socket.emit('errorMsg', 'Ce pseudo est déjà pris, merci d\'en choisir un autre.');
        }

        r.players.set(socket.id, {
          name: displayName, hint:null, vote:null, isImpostor:false, score:0,
          deviceId: profile.deviceId,
          spectator: false  // ✅ Nouveaux joueurs ne sont PAS spectateurs au début
        });
      }

      // Rejoint en cours de manche → spectateur
      if (r.state !== 'lobby') {
        const p = r.players.get(socket.id);
        if (p) p.spectator = true;  // ✅ Marquer TOUS les arrivants en cours de partie
        socket.emit('spectatorMode', { 
          phase: r.state, 
          message: 'Manche en cours. Vous rejoindrez la prochaine manche.' 
        });

        if (r.active && r.active.size) {
          if (r.state === 'hints') {
            const submitted = Array.from(r.active).filter(id => typeof r.players.get(id)?.hint === 'string').length;
            io.to(code).emit('phaseProgress', { phase:'hints', submitted, total: r.active.size });
          } else if (r.state === 'voting') {
            const submitted = Array.from(r.active).filter(id => !!r.players.get(id)?.vote).length;
            io.to(code).emit('phaseProgress', { phase:'voting', submitted, total: r.active.size });
          }
        }
      }

      socket.emit('roomJoined', { code });
      broadcast(io, code);

      r.lobbyReady ||= new Set();
      io.to(code).emit('lobbyReadyProgress', { ready: r.lobbyReady.size, total: r.players.size });
    });

    // ---- leaveRoom
    socket.on('leaveRoom', ()=>{
      const code = joined.code; if(!code) return;
      const r = rooms.get(code); if(!r) return;
      
      const me = r.players.get(socket.id);
      const name = me?.name || 'Un joueur';

      // Suppression définitive du joueur
      r.players.delete(socket.id);
      if (r.active?.has(socket.id)) r.active.delete(socket.id);
      if (r.lobbyReady?.has(socket.id)) r.lobbyReady.delete(socket.id);
      if (r.readyNext?.has(socket.id)) r.readyNext.delete(socket.id);

      // Si la salle est vide, supprimez-la
      if (r.players.size === 0) {
        rooms.delete(code);
        socket.leave(code);
        joined.code = null;
        return;
      }

      // Gérer le compte à rebours du lobby si un joueur part
      if (r.timer?.phase === 'lobby') {
        clearRoomTimer(r);
        io.to(code).emit('lobbyCountdownCancelled');
      }

      // Transférer l'hôte si nécessaire
      if (r.hostId === socket.id) {
        const first = r.players.keys().next().value;
        if (first) r.hostId = first;
      }
      
      io.to(code).emit('system', { text: `👋 ${name} a quitté la partie.` });

      // Si on est en manche et que les actifs < 3 → retour lobby
      const activePlayers = Array.from(r.players.values()).filter(p => !p.disconnected);
      if ((r.state === 'hints' || r.state === 'voting') && activePlayers.length < 3) {
        clearRoomTimer(r);
        for (const p of r.players.values()) {
          p.hint = null; p.vote = null; p.isImpostor = false;
        }
        r.state = 'lobby';
        r.lobbyReady = new Set();
        r.readyNext  = new Set();
        r.used = {};
        r.impostor = null;

        io.to(code).emit('lobbyCountdownCancelled');
        io.to(code).emit('errorMsg', 'Pas assez de joueurs actifs, retour au lobby');
      }

      socket.leave(code);
      joined.code = null;
      broadcast(io, code);
      socket.emit('leftRoom');
    });

    // ---- playerReadyLobby
    socket.on('playerReadyLobby', ({ ready })=>{
      const r = rooms.get(joined.code); if(!r) return; if (r.state !== 'lobby') return;

      r.lobbyReady ||= new Set();
      if (ready) r.lobbyReady.add(socket.id); else r.lobbyReady.delete(socket.id);

      io.to(joined.code).emit('lobbyReadyProgress', { ready: r.lobbyReady.size, total: r.players.size });

      if (r.lobbyReady.size === r.players.size && r.players.size >= 3){
        clearRoomTimer(r);
        startPhaseTimer(io, joined.code, LOBBY_READY_SECONDS, 'lobby', ()=> controller.startRound(joined.code));
        io.to(joined.code).emit('lobbyCountdownStarted', { seconds: LOBBY_READY_SECONDS });
      } else if (r.timer?.phase === 'lobby'){
        clearRoomTimer(r);
        io.to(joined.code).emit('lobbyCountdownCancelled');
      }
    });

    // ---- startRound (host only)
    socket.on('startRound', ()=>{
      const r = rooms.get(joined.code); if(!r) return;
      if (r.hostId !== socket.id) return socket.emit('errorMsg',"Seul l'hôte peut démarrer");
      controller.startRound(joined.code);
      socket.emit('actionAck', { action:'startRound', status:'ok' });
    });

    // ---- submitHint
    socket.on('submitHint', ({ hint })=>{
      const r = rooms.get(joined.code); if(!r || r.state!=='hints') return;
      if (r.state === 'gameOver') return socket.emit('errorMsg', 'La partie est terminée');
      const p = r.players.get(socket.id); if(!p) return;

      // ✅ DOUBLE vérification spectateur
      if (p.spectator || !r.active?.has(socket.id)) return socket.emit('errorMsg', 'Tu participeras au prochain round (spectateur)');
      if (typeof p.hint === 'string') return;

      const raw = String(hint||'').trim().slice(0,40);

      const mySecret = r.words.common;
      const check = isHintAllowed(mySecret, raw, r.words.domain);
      if (!check.ok) return socket.emit('hintRejected', { reason: check.reason });

      r.usedHints ||= new Set();
      const key = normalizeLocal(raw);
      if (r.usedHints.has(key)) return socket.emit('hintRejected', { reason: "Indice déjà utilisé par un autre joueur." });
      r.usedHints.add(key);

      p.hint = raw;
      socket.emit('hintAck');

      if (!p.isImpostor) {
        r.liveCrewHints ||= [];
        const item = { id: socket.id, name: p.name, hint: raw };
        r.liveCrewHints.push({ name: p.name, hint: raw });

        if (r.impostor) {
          const impSock = io.sockets.sockets.get(r.impostor);
          if (impSock) impSock.emit('crewHintAdded', item);
          else io.to(r.impostor).emit('crewHintAdded', item);
        }
      }

      const submitted = Array.from(r.active).filter(id => typeof r.players.get(id)?.hint === 'string').length;
      io.to(joined.code).emit('phaseProgress', { phase:'hints', submitted, total: r.active.size });

      controller.maybeStartVoting(joined.code);
    });

    // ---- submitVote
    socket.on('submitVote', ({ hintId, targetId } = {}) => {
      const r = rooms.get(joined.code); if (!r || r.state !== 'voting') return;
      if (r.state === 'gameOver') return socket.emit('errorMsg', 'La partie est terminée');
      const me = r.players.get(socket.id); if (!me) return;

      // ✅ DOUBLE vérification spectateur
      if (me.spectator || !r.active?.has(socket.id)) {
        return socket.emit('errorMsg', 'Tu voteras à la prochaine manche (spectateur)');
      }

      // Résolution robuste de l'auteur à partir de l'indice
      let authorId = null;
      if (hintId && r.hintAuthor && typeof r.hintAuthor.get === 'function') {
        authorId = r.hintAuthor.get(hintId) || null; // format nouveau
      }
      if (!authorId && targetId && r.players.has(targetId)) {
        authorId = targetId; // rétro-compat: targetId = playerId
      }
      if (!authorId && hintId && r.players.has(hintId)) {
        authorId = hintId; // rétro-compat: anciens payloads (id == playerId)
      }
      if (!authorId) return;

      // Enregistre le vote (toujours un playerId)
      me.vote = authorId;
      socket.emit('voteAck');

      // Compteur
      const submitted = Array.from(r.active).reduce(
        (acc, id) => acc + (r.players.get(id)?.vote ? 1 : 0),
        0
      );
      const total = r.active.size;

      io.to(joined.code).emit('phaseProgress', { phase: 'voting', submitted, total });

      // Fin anticipée
      if (submitted === total) {
        controller.finishVoting(joined.code);
      } else {
        broadcast(io, joined.code);
      }
    });

    // ---- playerReadyNext (reveal -> manche suivante)
    socket.on('playerReadyNext', ()=>{
      const r = rooms.get(joined.code); if(!r) return; if (r.state !== 'reveal') return;
      r.readyNext ||= new Set();
      r.readyNext.add(socket.id);
      io.to(joined.code).emit('readyProgress', { ready: r.readyNext.size, total: r.players.size });
      if (r.readyNext.size === r.players.size){
        startPhaseTimer(io, joined.code, 3, 'prestart', ()=> controller.startRound(joined.code));
      }
    });

    // ---- resetScores (host only)
    socket.on('resetScores', ()=>{
      const r = rooms.get(joined.code); if(!r) return;
      if (r.hostId !== socket.id) return socket.emit('errorMsg',"Seul l'hôte peut réinitialiser");
      for (const p of r.players.values()) p.score = 0;
      r.round = 0; r.state='lobby'; r.used={}; r.lobbyReady = new Set(); r.readyNext = new Set();
      clearRoomTimer(r);
      io.to(joined.code).emit('lobbyCountdownCancelled');
      io.to(joined.code).emit('scoresReset');
      broadcast(io, joined.code);
    });

    // ---- disconnect
    socket.on('disconnect', () => {
      const code = joined.code; if (!code) return;
      const r = rooms.get(code); if (!r) return;

      const me = r.players.get(socket.id);
      if (!me) return; // Joueur déjà supprimé ou jamais vraiment ajouté

      me.disconnected = true;
      me.disconnectedSince = r.round;
      const name = me.name || 'Un joueur';
      const wasHost = (r.hostId === socket.id);
      const wasImpostor = !!me.isImpostor;

      // Ne pas supprimer le joueur, juste le marquer.
      // Le nettoyage se fera au début des manches.

      // si plus personne D'ACTIF → supprimer la room
      const activePlayers = Array.from(r.players.values()).filter(p => !p.disconnected);
      if (activePlayers.length === 0) {
        rooms.delete(code);
        return;
      }

      // transfert d’hôte si besoin
      if (wasHost) {
        const firstActive = Array.from(r.players.entries()).find(([id, p]) => !p.disconnected);
        if (firstActive) {
          r.hostId = firstActive[0];
        }
      }

      // message système
      io.to(code).emit('system', { text: `👋 ${name} a quitté la partie` });

      // Mettre à jour le nombre total de joueurs (uniquement les actifs)
      const totalPlayers = activePlayers.length;
      if (r.lobbyReady) {
        io.to(code).emit('lobbyReadyProgress', { ready: r.lobbyReady.size, total: totalPlayers });
      }
      if (r.readyNext) {
        io.to(code).emit('readyProgress', { ready: r.readyNext.size, total: totalPlayers });
      }


      // si on est en manche et que les actifs < 3 → retour lobby immédiat
      const activeInGame = Array.from(r.active || []).filter(id => !r.players.get(id)?.disconnected);
      if ((r.state === 'hints' || r.state === 'voting') && activeInGame.length < 3) {
        clearRoomTimer(r);
        for (const id of r.players.keys()) {
          const p = r.players.get(id);
          if (p) { p.hint = null; p.vote = null; p.isImpostor = false; }
        }
        r.state = 'lobby';
        r.lobbyReady = new Set();
        r.readyNext  = new Set();
        r.used = {};
        r.impostor = null;

        io.to(code).emit('lobbyCountdownCancelled');
        io.to(code).emit('errorMsg', 'Pas assez de joueurs actifs, retour au lobby');
        broadcast(io, code);
        return;
      }

      // réconcilier la phase en cours (compteurs avec r.active)
      if (r.state === 'hints') {
        const activeConnected = Array.from(r.active).filter(id => !r.players.get(id)?.disconnected);
        const submitted = activeConnected.filter(id => typeof r.players.get(id)?.hint === 'string').length;
        io.to(code).emit('phaseProgress', { phase:'hints', submitted, total: activeConnected.length });
        if (submitted === activeConnected.length && activeConnected.length > 0) {
          controller.maybeStartVoting(code);
        }
      } else if (r.state === 'voting') {
        const activeConnected = Array.from(r.active).filter(id => !r.players.get(id)?.disconnected);
        const submitted = activeConnected.filter(id => !!r.players.get(id)?.vote).length;
        io.to(code).emit('phaseProgress', { phase:'voting', submitted, total: activeConnected.length });
        if (submitted === activeConnected.length && activeConnected.length > 0) {
          controller.finishVoting(code);
        }
      }

      if (wasImpostor && (r.state === 'hints' || r.state === 'voting')) {
        // ... la logique de victoire des équipiers reste la même
        clearRoomTimer(r);
        for (const id of r.active || []) {
          const p = r.players.get(id);
          if (p && !p.isImpostor && !p.disconnected) p.score = (p.score || 0) + 1;
        }

        io.to(code).emit('roundResult', {
          round: r.round,
          impostorId: socket.id,
          impostorName: name,
          common: r.words?.common,
          impostor: null,
          impostorHint: null,
          commonDisplay: r.words?.common,
          impostorDisplay: "—",
          votes: {},
          impostorCaught: true,
          domain: r.words?.domain
        });

        r.state = 'reveal';
        r.readyNext = new Set();
        io.to(code).emit('readyProgress', { ready: 0, total: totalPlayers });

        const scores = Array.from(r.players.values()).filter(p => !p.disconnected).map(p => p.score || 0);
        const maxScore = Math.max(0, ...scores);
        if (maxScore >= 10) {
           const winnersArr = Array.from(r.players.entries())
            .filter(([_, p]) => !p.disconnected && (p.score || 0) === maxScore)
            .map(([id, p]) => ({ id, name: p.name, score: p.score || 0 }));
          io.to(code).emit('gameOver', { winners: winnersArr, round: r.round, autoReset: true });

          for (const p of r.players.values()) { p.score = 0; p.hint = null; p.vote = null; p.isImpostor = false; p.spectator = false; }
          r.round = 0; r.state = 'lobby'; r.lobbyReady = new Set(); r.readyNext = new Set(); r.used = {};
          clearRoomTimer(r);
        }
      }

      broadcast(io, code);
    });
  });
};