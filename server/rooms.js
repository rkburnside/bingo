const { generateCard, createBallPool } = require('./card');

const rooms = new Map();
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const EMPTY_ROOM_GRACE_MS = 60_000;

function generateRoomCode() {
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
    }
  } while (rooms.has(code));
  return code;
}

function createRoom(hostId, hostName) {
  const code = generateRoomCode();
  const { card, marked } = generateCard();
  const room = {
    code,
    hostId,
    players: [{ id: hostId, name: hostName, card, marked }],
    turnOrder: [hostId],
    currentTurnIndex: 0,
    drawnBalls: [],
    remainingBalls: [],
    status: 'lobby',
    winnerId: null,
    emptyTimer: null,
  };
  rooms.set(code, room);
  return room;
}

function getRoom(code) {
  return rooms.get(String(code || '').toUpperCase());
}

function joinRoom(code, playerId, name) {
  const room = getRoom(code);
  if (!room) return { error: 'Room not found' };
  if (room.status !== 'lobby') return { error: 'Game already in progress' };
  if (room.players.some((p) => p.id === playerId)) return { room };

  const { card, marked } = generateCard();
  room.players.push({ id: playerId, name, card, marked });
  room.turnOrder.push(playerId);
  clearEmptyTimer(room);
  return { room };
}

function startGame(code, requesterId) {
  const room = getRoom(code);
  if (!room) return { error: 'Room not found' };
  if (room.hostId !== requesterId) return { error: 'Only the host can start the game' };
  if (room.players.length < 2) return { error: 'Need at least 2 players to start' };

  room.turnOrder = shuffle(room.players.map((p) => p.id));
  room.currentTurnIndex = 0;
  room.drawnBalls = [];
  room.remainingBalls = createBallPool();
  room.status = 'playing';
  room.winnerId = null;
  return { room };
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function currentTurnPlayerId(room) {
  return room.turnOrder[room.currentTurnIndex];
}

function drawBall(code, requesterId) {
  const room = getRoom(code);
  if (!room) return { error: 'Room not found' };
  if (room.status !== 'playing') return { error: 'Game is not in progress' };
  if (currentTurnPlayerId(room) !== requesterId) return { error: 'Not your turn' };
  if (room.remainingBalls.length === 0) return { error: 'No balls left' };

  const number = room.remainingBalls.pop();
  room.drawnBalls.push(number);

  for (const player of room.players) {
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 5; col++) {
        if (player.card[row][col] === number) {
          player.marked[row][col] = true;
        }
      }
    }
  }

  advanceTurn(room);
  return { room, number };
}

function advanceTurn(room) {
  if (room.turnOrder.length === 0) return;
  room.currentTurnIndex = (room.currentTurnIndex + 1) % room.turnOrder.length;
}

function claimBingo(code, requesterId) {
  const { checkWin } = require('./card');
  const room = getRoom(code);
  if (!room) return { error: 'Room not found' };
  if (room.status !== 'playing') return { error: 'Game is not in progress' };
  const player = room.players.find((p) => p.id === requesterId);
  if (!player) return { error: 'Player not in room' };
  if (!checkWin(player.marked)) return { error: 'Not a valid bingo yet' };

  room.status = 'finished';
  room.winnerId = requesterId;
  return { room, winnerName: player.name };
}

function removePlayer(socketId) {
  for (const room of rooms.values()) {
    const idx = room.players.findIndex((p) => p.id === socketId);
    if (idx === -1) continue;

    const wasCurrentTurn = currentTurnPlayerId(room) === socketId;
    room.players.splice(idx, 1);
    room.turnOrder = room.turnOrder.filter((id) => id !== socketId);

    if (room.hostId === socketId && room.players.length > 0) {
      room.hostId = room.players[0].id;
    }

    if (room.players.length === 0) {
      scheduleRoomCleanup(room);
      return { room, empty: true };
    }

    if (room.status === 'playing' && wasCurrentTurn && room.turnOrder.length > 0) {
      room.currentTurnIndex = room.currentTurnIndex % room.turnOrder.length;
    }

    return { room, empty: false };
  }
  return { room: null };
}

function scheduleRoomCleanup(room) {
  clearEmptyTimer(room);
  room.emptyTimer = setTimeout(() => {
    if (room.players.length === 0) rooms.delete(room.code);
  }, EMPTY_ROOM_GRACE_MS);
}

function clearEmptyTimer(room) {
  if (room.emptyTimer) {
    clearTimeout(room.emptyTimer);
    room.emptyTimer = null;
  }
}

module.exports = {
  createRoom,
  getRoom,
  joinRoom,
  startGame,
  drawBall,
  claimBingo,
  removePlayer,
  currentTurnPlayerId,
};
