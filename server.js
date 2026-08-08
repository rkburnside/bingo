const path = require('path');
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const rooms = require('./server/rooms');
const { letterForNumber } = require('./server/card');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

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

io.on('connection', (socket) => {
  socket.on('createRoom', ({ name }) => {
    const playerName = String(name || 'Player').slice(0, 20).trim() || 'Player';
    const room = rooms.createRoom(socket.id, playerName);
    socket.join(room.code);
    sendPrivateCard(socket, room, socket.id);
    broadcastRoom(room);
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

  socket.on('startGame', ({ roomCode }) => {
    const { room, error } = rooms.startGame(roomCode, socket.id);
    if (error) {
      socket.emit('errorMessage', error);
      return;
    }
    for (const player of room.players) {
      const playerSocket = io.sockets.sockets.get(player.id);
      if (playerSocket) sendPrivateCard(playerSocket, room, player.id);
    }
    broadcastRoom(room);
  });

  socket.on('drawBall', ({ roomCode }) => {
    const { room, number, error } = rooms.drawBall(roomCode, socket.id);
    if (error) {
      socket.emit('errorMessage', error);
      return;
    }
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
  });

  socket.on('claimBingo', ({ roomCode }) => {
    const { room, winnerName, error } = rooms.claimBingo(roomCode, socket.id);
    if (error) {
      socket.emit('errorMessage', error);
      return;
    }
    io.to(room.code).emit('gameOver', { winnerId: socket.id, winnerName });
    broadcastRoom(room);
  });

  socket.on('disconnect', () => {
    const { room } = rooms.removePlayer(socket.id);
    if (room && room.players.length > 0) {
      broadcastRoom(room);
    }
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Bingo server listening on port ${PORT}`);
});
