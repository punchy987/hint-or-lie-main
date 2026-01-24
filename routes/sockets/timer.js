// routes/sockets/timer.js
const path = require('path');

// ✅ chemin corrigé: state/room.js
const { rooms: _rooms } =
  require(path.join(__dirname, 'state', 'room.js'));

function clearRoomTimer(room){
  if (room?.timer?.interval) clearInterval(room.timer.interval);
  if (room) room.timer = { interval:null, deadline:0, phase:null };
}

function startPhaseTimer(io, code, seconds, phase, onExpire){
  const room = _rooms.get(code); if(!room) return;
  clearRoomTimer(room);
  const deadline = Date.now() + seconds*1000;
  const totalMs = seconds * 1000;

  const thisTimerInterval = setInterval(()=>{
    const currentRoom = _rooms.get(code);
    if (!currentRoom) {
        clearInterval(thisTimerInterval);
        return;
    }

    // If the room's current timer isn't this one, this one is stale and should just stop.
    if (currentRoom.timer.interval !== thisTimerInterval) {
        clearInterval(thisTimerInterval);
        return;
    }

    const leftMs = Math.max(0, deadline - Date.now());
    io.to(code).emit('timer', { phase, leftMs, totalMs });

    if (leftMs <= 0){
      // This timer is expiring. Clear it from the room state BEFORE calling onExpire.
      // This prevents onExpire from clearing a *new* timer if it creates one.
      clearInterval(thisTimerInterval);
      currentRoom.timer = { interval:null, deadline:0, phase:null };

      // Now call the original callback.
      onExpire?.();
    }
  }, 500);

  // Store the new timer's identity in the room.
  room.timer = { interval: thisTimerInterval, deadline, phase };
}

module.exports = { clearRoomTimer, startPhaseTimer };
