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
    let profile = { deviceId:null, lastPseudo:null, persistentId:null };

    socket.on('hello', ({ deviceId, pseudo, persistentId } = {})=>{
      if (deviceId) profile.deviceId   = String(deviceId).slice(0,64);
      if (pseudo)   profile.lastPseudo = String(pseudo).slice(0,16);
      if (persistentId) profile.persistentId = String(persistentId).slice(0,64);
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

    socket.on('createRoom', ({ name, deviceId, pseudo, persistentId } = {}) => {
      try {
        let displayName = String(name || pseudo || profile.lastPseudo || '').trim();
        
        // Attribution automatique si nom vide
        if (!displayName) {
          displayName = 'Joueur 1';
        }
        
        displayName = displayName.slice(0, 16);
        
        const code = createRoom(socket.id, displayName);

        socket.join(code);
        joined.code = code;
        profile.lastPseudo = displayName;
        profile.deviceId = String(deviceId || profile.deviceId || '').slice(0, 64) || null;
        profile.persistentId = String(persistentId || profile.persistentId || '').slice(0, 64) || null;

        const r = rooms.get(code);
        if (r && r.players.has(socket.id)) {
          const p = r.players.get(socket.id);
          p.deviceId = profile.deviceId;
          p.persistentId = profile.persistentId;
        }

        socket.emit('roomCreated', { code });
        broadcast(io, code);
      } catch (err) {
        socket.emit('errorMsg', 'Erreur lors de la création de la salle.');
      }
    });
    socket.on('joinRoom', ({ code, name, deviceId, pseudo, persistentId } = {})=>{
      code = String(code || '').trim();
      if (!/^\d{4}$/.test(code)) return socket.emit('errorMsg','Code invalide (4 chiffres)');
      const r = rooms.get(code); if (!r) return socket.emit('errorMsg','Salle introuvable');

      socket.join(code);
      joined.code = code;

      let displayName = String(name || pseudo || profile.lastPseudo || '').trim();
      profile.lastPseudo = displayName;
      profile.deviceId   = String(deviceId || profile.deviceId || '').slice(0,64) || null;
      profile.persistentId = String(persistentId || profile.persistentId || '').slice(0,64) || null;

      // Tentative de reconnexion via persistentId
      let reconnectedPlayer = null;
      if (profile.persistentId) {
        for (const [oldSocketId, p] of r.players.entries()) {
          // Chercher un joueur avec le même persistentId (déconnecté OU avec un socket différent)
          if (p.persistentId === profile.persistentId && oldSocketId !== socket.id) {
            reconnectedPlayer = { oldSocketId, playerData: p };
            break;
          }
        }
      }

      if (reconnectedPlayer) {
        // RECONNEXION DÉTECÉE
        const { oldSocketId, playerData } = reconnectedPlayer;
        
        // Annuler le timeout de déconnexion
        if (playerData.disconnectTimeout) {
          clearTimeout(playerData.disconnectTimeout);
          playerData.disconnectTimeout = null;
        }
        
        // Transférer le joueur vers le nouveau socket.id
        r.players.delete(oldSocketId);
        if (r.active?.has(oldSocketId)) {
          r.active.delete(oldSocketId);
          r.active.add(socket.id);
        }
        if (r.lobbyReady?.has(oldSocketId)) {
          r.lobbyReady.delete(oldSocketId);
          r.lobbyReady.add(socket.id);
        }
        if (r.readyNext?.has(oldSocketId)) {
          r.readyNext.delete(oldSocketId);
          r.readyNext.add(socket.id);
        }
        
        // Mettre à jour les données du joueur
        playerData.disconnected = false;
        playerData.disconnectedSince = undefined;
        r.players.set(socket.id, playerData);
        
        // Conserver le nom si le joueur reconnecté n'a pas fourni de nouveau nom
        if (!displayName) {
          displayName = playerData.name || 'Joueur';
        } else {
          playerData.name = displayName;
        }

        io.to(code).emit('system', { text: `🎉 ${displayName} est de retour !` });

        // Synchroniser l'état actuel avec le joueur reconnecté
        const gameState = {
          state: r.state,
          phase: r.state,
          round: r.round || 0,
          theme: r.words?.domain || '',
          players: Array.from(r.players.entries()).map(([id, p]) => ({
            id: id,
            name: p.name,
            score: p.score || 0,
            disconnected: !!p.disconnected,
            ready: r.lobbyReady?.has(id) || false,
            isReady: r.lobbyReady?.has(id) || false
          })),
          scores: Object.fromEntries(
            Array.from(r.players.entries()).map(([id, p]) => [id, p.score || 0])
          )
        };
        
        // Envoyer l'état de synchronisation
        socket.emit('roomState', gameState);
        
        // Si en cours de partie, renvoyer les données de la manche
        if (r.state === 'hints' && playerData.isImpostor && r.liveCrewHints) {
          socket.emit('crewLiveHints', r.liveCrewHints);
        }
        if (r.state === 'hints' && !playerData.isImpostor && r.words?.common) {
          socket.emit('roundStarted', {
            round: r.round,
            domain: r.words.domain,
            common: r.words.common,
            isImpostor: false
          });
        }
        if (r.state === 'hints' && playerData.isImpostor && r.words?.domain) {
          socket.emit('roundStarted', {
            round: r.round,
            domain: r.words.domain,
            isImpostor: true
          });
        }
        
        broadcast(io, code);
        socket.emit('roomJoined', { code });
        return;
      }
      
      // Attribution automatique si nom vide et pas de reconnexion
      if (!displayName) {
        const playerNumber = r.players.size + 1;
        displayName = `Joueur ${playerNumber}`;
      }
      
      displayName = displayName.slice(0,16);

      // Recherche par nom (ancienne logique)
      let disconnectedPlayerEntry = null;
      for (const [id, p] of r.players.entries()) {
        if (p.name === displayName && p.disconnected) {
          disconnectedPlayerEntry = [id, p];
          break;
        }
      }

      if (disconnectedPlayerEntry) {
        const [oldId, pData] = disconnectedPlayerEntry;
        r.players.delete(oldId); 
        if(r.active?.has(oldId)) {
          r.active.delete(oldId);
        }
        pData.disconnected = false;
        pData.disconnectedSince = undefined;
        r.players.set(socket.id, pData);

        io.to(code).emit('system', { text: `🎉 ${displayName} est de retour !` });

        const gameState = {
          state: r.state,
          phase: r.state,
          round: r.round || 0,
          players: Array.from(r.players.entries()).map(([id, p]) => ({
            id: id,
            name: p.name,
            score: p.score || 0,
            disconnected: !!p.disconnected
          })),
          scores: Object.fromEntries(
            Array.from(r.players.entries()).map(([id, p]) => [id, p.score || 0])
          )
        };
        socket.emit('gameStateSync', gameState);

        if (r.state !== 'lobby' && pData.spectator) {
          socket.emit('spectatorMode', { 
            phase: r.state, 
            message: 'Vous continuez à regarder la manche en cours.' 
          });
        }

      } else {
        const isPseudoTaken = Array.from(r.players.values()).some(p => !p.disconnected && p.name === displayName);
        if (isPseudoTaken) {
          socket.leave(code);
          joined.code = null;
          return socket.emit('errorMsg', 'Ce pseudo est déjà pris, merci d\'en choisir un autre.');
        }

        r.players.set(socket.id, {
          name: displayName, hint:null, vote:null, isImpostor:false, score:0,
          deviceId: profile.deviceId,
          persistentId: profile.persistentId,
          spectator: false
        });
      }

      if (r.state !== 'lobby') {
        const p = r.players.get(socket.id);
        if (p) p.spectator = true;
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
      const connectedCount = Array.from(r.players.values()).filter(p => !p.disconnected).length;
      io.to(code).emit('lobbyReadyProgress', { ready: r.lobbyReady.size, total: connectedCount });
    });

    socket.on('leaveRoom', ()=>{
      const code = joined.code; if(!code) return;
      const r = rooms.get(code); if(!r) return;
      
      const me = r.players.get(socket.id);
      const name = me?.name || 'Un joueur';

      r.players.delete(socket.id);
      if (r.active?.has(socket.id)) r.active.delete(socket.id);
      if (r.lobbyReady?.has(socket.id)) r.lobbyReady.delete(socket.id);
      if (r.readyNext?.has(socket.id)) r.readyNext.delete(socket.id);

      if (r.players.size === 0) {
        rooms.delete(code);
        socket.leave(code);
        joined.code = null;
        return;
      }

      if (r.timer?.phase === 'lobby') {
        clearRoomTimer(r);
        io.to(code).emit('lobbyCountdownCancelled');
      }

      if (r.hostId === socket.id) {
        const first = r.players.keys().next().value;
        if (first) r.hostId = first;
      }
      
      io.to(code).emit('system', { text: `👋 ${name} a quitté la partie.` });

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

    socket.on('playerReadyLobby', ({ ready })=>{
      const r = rooms.get(joined.code); if(!r) return; if (r.state !== 'lobby') return;

      r.lobbyReady ||= new Set();
      if (ready) r.lobbyReady.add(socket.id); else r.lobbyReady.delete(socket.id);

      const connectedCount = Array.from(r.players.values()).filter(p => !p.disconnected).length;
      io.to(joined.code).emit('lobbyReadyProgress', { ready: r.lobbyReady.size, total: connectedCount });

      if (r.lobbyReady.size === connectedCount && connectedCount >= 3){
        clearRoomTimer(r);
        startPhaseTimer(io, joined.code, LOBBY_READY_SECONDS, 'lobby', ()=> controller.startRound(joined.code));
        io.to(joined.code).emit('lobbyCountdownStarted', { seconds: LOBBY_READY_SECONDS });
      } else if (r.timer?.phase === 'lobby'){
        clearRoomTimer(r);
        io.to(joined.code).emit('lobbyCountdownCancelled');
      }
    });

    socket.on('startRound', ()=>{
      const r = rooms.get(joined.code); if(!r) return;
      if (r.hostId !== socket.id) return socket.emit('errorMsg',"Seul l'hôte peut démarrer");
      controller.startRound(joined.code);
      socket.emit('actionAck', { action:'startRound', status:'ok' });
    });

    socket.on('submitHint', ({ hint })=>{
      const r = rooms.get(joined.code); if(!r || r.state!=='hints') return;
      if (r.state === 'gameOver') return socket.emit('errorMsg', 'La partie est terminée');
      const p = r.players.get(socket.id); if(!p) return;

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

    socket.on('submitVote', ({ hintId, targetId } = {}) => {
      const r = rooms.get(joined.code); if (!r || r.state !== 'voting') return;
      if (r.state === 'gameOver') return socket.emit('errorMsg', 'La partie est terminée');
      const me = r.players.get(socket.id); if (!me) return;

      if (me.spectator || !r.active?.has(socket.id)) {
        return socket.emit('errorMsg', 'Tu voteras à la prochaine manche (spectateur)');
      }

      const voteVal = hintId || targetId;
      if (!voteVal) return;

      controller.handleVote(joined.code, socket.id, voteVal);
      socket.emit('voteAck');
    });

    socket.on('playerReadyNext', ()=>{
      const r = rooms.get(joined.code); if(!r) return; if (r.state !== 'reveal') return;
      r.readyNext ||= new Set();
      r.readyNext.add(socket.id);
      const activeCount = Array.from(r.players.values()).filter(p => !p.disconnected).length;
      io.to(joined.code).emit('readyProgress', { ready: r.readyNext.size, total: activeCount });
      if (r.readyNext.size >= activeCount && activeCount > 0){
        startPhaseTimer(io, joined.code, 3, 'prestart', ()=> controller.startRound(joined.code));
      }
    });

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

    socket.on('disconnect', () => {
      const code = joined.code; if (!code) return;
      const r = rooms.get(code); if (!r) return;

      const me = r.players.get(socket.id);
      if (!me) return;

      me.disconnected = true;
      me.disconnectedSince = r.round;
      const name = me.name || 'Un joueur';
      const wasHost = (r.hostId === socket.id);
      const wasImpostor = !!me.isImpostor;
      const isInActiveGame = r.active?.has(socket.id) && (r.state === 'hints' || r.state === 'voting');

      const activePlayers = Array.from(r.players.values()).filter(p => !p.disconnected);
      if (activePlayers.length === 0) {
        rooms.delete(code);
        return;
      }

      if (wasHost) {
        const firstActive = Array.from(r.players.entries()).find(([id, p]) => !p.disconnected);
        if (firstActive) {
          r.hostId = firstActive[0];
        }
      }

      io.to(code).emit('system', { text: `👋 ${name} a quitté la partie` });

      const totalPlayers = activePlayers.length;
      if (r.lobbyReady) {
        io.to(code).emit('lobbyReadyProgress', { ready: r.lobbyReady.size, total: totalPlayers });
      }
      if (r.readyNext) {
        io.to(code).emit('readyProgress', { ready: r.readyNext.size, total: totalPlayers });
      }

      // Définir le délai de timeout selon le rôle
      const disconnectDelay = (wasImpostor && isInActiveGame) ? 15000 : 45000; // 15s pour imposteur, 45s pour équipiers
      
      // Lancer le timeout de déconnexion
      me.disconnectTimeout = setTimeout(() => {
        // Vérifier si le joueur est toujours déconnecté
        const currentPlayer = r.players.get(socket.id);
        if (!currentPlayer || !currentPlayer.disconnected) return;
        
        // Le délai a expiré, traiter la déconnexion définitive
        const activeInGame = Array.from(r.active || []).filter(id => !r.players.get(id)?.disconnected);
        
        // Condition de rupture : < 3 joueurs OU l'imposteur a expiré
        const needsReset = (activeInGame.length < 3) || (wasImpostor && (r.state === 'hints' || r.state === 'voting'));
        
        if (needsReset && (r.state === 'hints' || r.state === 'voting')) {
          clearRoomTimer(r);
          
          // Réinitialiser les drapeaux de phase SANS toucher aux scores
          for (const id of r.players.keys()) {
            const p = r.players.get(id);
            if (p) {
              p.hint = null;
              p.vote = null;
              p.isImpostor = false;
              p.spectator = false;
              p.hasSentHint = false;
              p.hasVoted = false;
              p.votedFor = null;
              if (p.disconnectTimeout) {
                clearTimeout(p.disconnectTimeout);
                p.disconnectTimeout = null;
              }
              // ⚠️ CONSERVATION DU SCORE : p.score n'est PAS réinitialisé
            }
          }
          
          r.state = 'lobby';
          r.lobbyReady = new Set();
          r.readyNext  = new Set();
          r.used = {};
          r.impostor = null;
          r.active = new Set();
          r.liveCrewHints = [];
          r.usedHints = new Set();

          io.to(code).emit('lobbyCountdownCancelled');
          
          const reason = wasImpostor 
            ? "Partie interrompue : l'imposteur a quitté la partie."
            : 'Partie interrompue : manque de joueurs.';
          
          io.to(code).emit('system', { text: reason });
          io.to(code).emit('toast', { message: reason, isError: true });
          
          broadcast(io, code);
          return;
        }
        
        // Mise à jour des progressions si toujours en jeu
        if (r.state === 'hints') {
          const activeConnected = Array.from(r.active || []).filter(id => !r.players.get(id)?.disconnected);
          const submitted = activeConnected.filter(id => typeof r.players.get(id)?.hint === 'string').length;
          io.to(code).emit('phaseProgress', { phase:'hints', submitted, total: activeConnected.length });
          if (submitted === activeConnected.length && activeConnected.length > 0) {
            controller.maybeStartVoting(code);
          }
        } else if (r.state === 'voting') {
          const activeConnected = Array.from(r.active || []).filter(id => !r.players.get(id)?.disconnected);
          const submitted = activeConnected.filter(id => !!r.players.get(id)?.vote).length;
          io.to(code).emit('phaseProgress', { phase:'voting', submitted, total: activeConnected.length });
          if (submitted === activeConnected.length && activeConnected.length > 0) {
            controller.finishVoting(code);
          }
        }
        
        broadcast(io, code);
      }, disconnectDelay);

      // Mise à jour immédiate des progressions
      const activeInGame = Array.from(r.active || []).filter(id => !r.players.get(id)?.disconnected);
      
      if (r.state === 'hints') {
        const activeConnected = Array.from(r.active || []).filter(id => !r.players.get(id)?.disconnected);
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

      broadcast(io, code);
    });
  });
};