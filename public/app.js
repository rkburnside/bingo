const socket = io();

let myId = null;
let currentRoomCode = null;
let latestRoomState = null;
let myCard = null;
let myMarked = null;

const views = {
  join: document.getElementById('view-join'),
  lobby: document.getElementById('view-lobby'),
  game: document.getElementById('view-game'),
  gameover: document.getElementById('view-gameover'),
};

function showView(name) {
  Object.values(views).forEach((v) => v.classList.add('hidden'));
  views[name].classList.remove('hidden');
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3000);
}

socket.on('connect', () => {
  myId = socket.id;
});

// ----- Join / Create -----

document.getElementById('create-room-btn').addEventListener('click', () => {
  const name = document.getElementById('name-input').value.trim();
  if (!name) return showToast('Enter your name first');
  socket.emit('createRoom', { name });
});

document.getElementById('join-room-btn').addEventListener('click', () => {
  const name = document.getElementById('name-input').value.trim();
  const roomCode = document.getElementById('room-code-input').value.trim().toUpperCase();
  if (!name) return showToast('Enter your name first');
  if (!roomCode) return showToast('Enter a room code');
  socket.emit('joinRoom', { roomCode, name });
});

// ----- Lobby -----

document.getElementById('start-game-btn').addEventListener('click', () => {
  socket.emit('startGame', { roomCode: currentRoomCode });
});

// ----- Game -----

document.getElementById('draw-ball-btn').addEventListener('click', () => {
  socket.emit('drawBall', { roomCode: currentRoomCode });
});

document.getElementById('claim-bingo-btn').addEventListener('click', () => {
  socket.emit('claimBingo', { roomCode: currentRoomCode });
});

document.getElementById('play-again-btn').addEventListener('click', () => {
  window.location.reload();
});

// ----- Socket events -----

socket.on('errorMessage', (message) => {
  showToast(message);
});

socket.on('cardAssigned', ({ card, marked }) => {
  myCard = card;
  myMarked = marked;
  renderCard();
});

socket.on('roomUpdate', (roomState) => {
  latestRoomState = roomState;
  currentRoomCode = roomState.code;

  if (roomState.status === 'lobby') {
    renderLobby(roomState);
    showView('lobby');
  } else if (roomState.status === 'playing') {
    renderGame(roomState);
    showView('game');
  } else if (roomState.status === 'finished') {
    showView('gameover');
  }
});

socket.on('ballDrawn', ({ number, letter }) => {
  const lastBall = document.getElementById('last-ball');
  lastBall.textContent = `${letter}-${number}`;
  lastBall.classList.remove('hidden');
});

socket.on('gameOver', ({ winnerName }) => {
  document.getElementById('winner-text').textContent = `${winnerName} won the game!`;
  showView('gameover');
});

// ----- Rendering -----

function renderLobby(roomState) {
  document.getElementById('room-code-display').textContent = roomState.code;

  const list = document.getElementById('player-list');
  list.innerHTML = '';
  roomState.players.forEach((p) => {
    const li = document.createElement('li');
    const nameSpan = document.createElement('span');
    nameSpan.textContent = p.name;
    li.appendChild(nameSpan);
    if (p.id === roomState.hostId) {
      const tag = document.createElement('span');
      tag.className = 'host-tag';
      tag.textContent = 'HOST';
      li.appendChild(tag);
    }
    list.appendChild(li);
  });

  const isHost = roomState.hostId === myId;
  const startBtn = document.getElementById('start-game-btn');
  const waitMsg = document.getElementById('lobby-wait-msg');
  if (isHost) {
    startBtn.classList.remove('hidden');
    waitMsg.classList.add('hidden');
    startBtn.disabled = roomState.players.length < 2;
    startBtn.textContent = roomState.players.length < 2
      ? 'Need at least 2 players'
      : 'Start Game';
  } else {
    startBtn.classList.add('hidden');
    waitMsg.classList.remove('hidden');
  }
}

function renderGame(roomState) {
  const isMyTurn = roomState.currentTurnPlayerId === myId;
  const banner = document.getElementById('turn-banner');
  if (isMyTurn) {
    banner.textContent = "It's your turn — draw a ball!";
    banner.classList.add('my-turn');
  } else {
    const player = roomState.players.find((p) => p.id === roomState.currentTurnPlayerId);
    banner.textContent = player ? `Waiting for ${player.name} to draw...` : 'Waiting...';
    banner.classList.remove('my-turn');
  }

  document.getElementById('draw-ball-btn').disabled = !isMyTurn;

  const calledList = document.getElementById('called-list');
  calledList.innerHTML = '';
  roomState.drawnBalls.forEach((n) => {
    const el = document.createElement('span');
    el.className = 'called-ball';
    el.textContent = n;
    calledList.appendChild(el);
  });

  renderCard();
}

function renderCard() {
  if (!myCard) return;
  const grid = document.getElementById('bingo-grid');
  grid.innerHTML = '';
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const cell = document.createElement('div');
      const value = myCard[row][col];
      const isFree = value === 'FREE';
      cell.className = 'bingo-cell' + (isFree ? ' free' : '') + (myMarked[row][col] ? ' marked' : '');
      cell.textContent = isFree ? '★' : value;
      grid.appendChild(cell);
    }
  }
}
