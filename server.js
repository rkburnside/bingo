const path = require('path');
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const rooms = require('./server/rooms');
const { letterForNumber } = require('./server/card');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const AUTO_DRAW_INTERVAL_MS = 5000;
const autoDrawTimers = new Map();

app.use(express.static(path.join(__dirname, 'public')));

function publicRoomState(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    players: room.players.map((p) => ({ id: p.id, name: p.name })),
    turnOrder: room.turnOrder,
    currentTurnPlayerId: rooms.currentTurnPlayerId(room),
    drawnBalls: room.drawnBalls,
    winnerId: room.winnerId,
    autoDraw: room.autoDraw,
  };
}

function sendPrivateCard(socket, room, playerId) {
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return;
  socket.emit('cardAssigned', { card: player.card, marked: player.marked });
}

function broadcastRoom(room) {
  io.to(room.code).emit('roomUpdate', publicRoomState(room));
}

function broadcastDraw(room, number) {
  for (const player of room.players) {
    const playerSocket = io.sockets.sockets.get(player.id);
    if (playerSocket) sendPrivateCard(playerSocket, room, player.id);
  }
  io.to(room.code).emit('ballDrawn', {
    number,
    letter: letterForNumber(number),
    drawnBalls: room.drawnBalls,
  });
  broadcastRoom(room);
}

function stopAutoDraw(roomCode) {
  const timer = autoDrawTimers.get(roomCode);
  if (timer) {
    clearInterval(timer);
    autoDrawTimers.delete(roomCode);
  }
}

function startAutoDraw(roomCode) {
  stopAutoDraw(roomCode);
  const timer = setInterval(() => {
    const { room, number, error } = rooms.forceDrawBall(roomCode);
    if (error) {
      stopAutoDraw(roomCode);
      return;
    }
    broadcastDraw(room, number);
  }, AUTO_DRAW_INTERVAL_MS);
  autoDrawTimers.set(roomCode, timer);
}

function joinUrlFor(socket, roomCode) {
  const proto = socket.handshake.headers['x-forwarded-proto'] || 'http';
  const host = socket.handshake.headers.host;
  return `${proto}://${host}/?room=${roomCode}`;
}

io.on('connection', (socket) => {
  socket.on('createRoom', ({ name }) => {
    const playerName = String(name || 'Player').slice(0, 20).trim() || 'Player';
    const room = rooms.createRoom(socket.id, playerName);
    socket.join(room.code);
    sendPrivateCard(socket, room, socket.id);
    broadcastRoom(room);

    const joinUrl = joinUrlFor(socket, room.code);
    QRCode.toDataURL(joinUrl)
      .then((qrCodeDataUrl) => {
        socket.emit('roomCreated', { joinUrl, qrCodeDataUrl });
      })
      .catch(() => {
        // QR code is a convenience feature; the room still works without it.
      });
  });

  socket.on('joinRoom', ({ roomCode, name }) => {
    const playerName = String(name || 'Player').slice(0, 20).trim() || 'Player';
    const { room, error } = rooms.joinRoom(roomCode, socket.id, playerName);
    if (error) {
      socket.emit('errorMessage', error);
      return;
    }
    socket.join(room.code);
    sendPrivateCard(socket, room, socket.id);
    broadcastRoom(room);
  });

  socket.on('startGame', ({ roomCode, autoDraw }) => {
    const { room, error } = rooms.startGame(roomCode, socket.id, { autoDraw });
    if (error) {
      socket.emit('errorMessage', error);
      return;
    }
    for (const player of room.players) {
      const playerSocket = io.sockets.sockets.get(player.id);
      if (playerSocket) sendPrivateCard(playerSocket, room, player.id);
    }
    broadcastRoom(room);

    if (room.autoDraw) {
      startAutoDraw(room.code);
    }
  });

  socket.on('drawBall', ({ roomCode }) => {
    const { room, number, error } = rooms.drawBall(roomCode, socket.id);
    if (error) {
      socket.emit('errorMessage', error);
      return;
    }
    broadcastDraw(room, number);
  });

  socket.on('claimBingo', ({ roomCode }) => {
    const { room, winnerName, error } = rooms.claimBingo(roomCode, socket.id);
    if (error) {
      socket.emit('errorMessage', error);
      return;
    }
    stopAutoDraw(roomCode);
    io.to(room.code).emit('gameOver', { winnerId: socket.id, winnerName });
    broadcastRoom(room);
  });

  socket.on('disconnect', () => {
    const { room, empty } = rooms.removePlayer(socket.id);
    if (!room) return;
    if (empty) {
      stopAutoDraw(room.code);
      return;
    }
    broadcastRoom(room);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Bingo server listening on port ${PORT}`);
});
