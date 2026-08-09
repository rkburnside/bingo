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

// Pre-fill the room code from a shared/QR join link, e.g. ?room=ABCD
const prefillRoomCode = new URLSearchParams(window.location.search).get('room');
if (prefillRoomCode) {
  document.getElementById('room-code-input').value = prefillRoomCode.toUpperCase();
}

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

document.getElementById('auto-draw-toggle').addEventListener('change', (e) => {
  document.getElementById('auto-draw-interval-row').classList.toggle('hidden', !e.target.checked);
});

document.getElementById('auto-draw-interval').addEventListener('input', (e) => {
  document.getElementById('auto-draw-interval-value').textContent = parseFloat(e.target.value).toFixed(1);
});

document.getElementById('start-game-btn').addEventListener('click', () => {
  const autoDraw = document.getElementById('auto-draw-toggle').checked;
  const autoDrawIntervalMs = Math.round(Number(document.getElementById('auto-draw-interval').value) * 1000);
  const blackout = document.getElementById('blackout-toggle').checked;
  socket.emit('startGame', { roomCode: currentRoomCode, autoDraw, autoDrawIntervalMs, blackout });
});

// ----- Game -----

document.getElementById('draw-ball-btn').addEventListener('click', () => {
  socket.emit('drawBall', { roomCode: currentRoomCode });
});

document.getElementById('claim-bingo-btn').addEventListener('click', () => {
  socket.emit('claimBingo', { roomCode: currentRoomCode });
});

document.getElementById('pause-auto-draw-btn').addEventListener('click', () => {
  if (latestRoomState && latestRoomState.autoDrawPaused) {
    socket.emit('resumeAutoDraw', { roomCode: currentRoomCode });
  } else {
    socket.emit('pauseAutoDraw', { roomCode: currentRoomCode });
  }
});

document.getElementById('restart-game-btn').addEventListener('click', () => {
  socket.emit('restartGame', { roomCode: currentRoomCode });
  document.getElementById('splash-overlay').classList.add('hidden');
});

document.getElementById('home-btn').addEventListener('click', () => {
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

socket.on('roomCreated', ({ qrCodeDataUrl }) => {
  const wrapper = document.getElementById('qr-wrapper');
  const img = document.getElementById('room-qr-code');
  img.src = qrCodeDataUrl;
  wrapper.classList.remove('hidden');
});

socket.on('roomUpdate', (roomState) => {
  latestRoomState = roomState;
  currentRoomCode = roomState.code;

  if (roomState.status !== 'finished') {
    document.getElementById('splash-overlay').classList.add('hidden');
  }

  if (roomState.status === 'lobby') {
    renderLobby(roomState);
    showView('lobby');
  } else if (roomState.status === 'playing' || roomState.status === 'finished') {
    renderGame(roomState);
    showView('game');
  }
});

socket.on('ballDrawn', ({ number, letter }) => {
  const lastBall = document.getElementById('last-ball');
  lastBall.textContent = `${letter}-${number}`;
  lastBall.classList.remove('hidden');
});

socket.on('gameOver', ({ winnerName, blackout }) => {
  document.getElementById('splash-title').textContent = blackout ? '⬛ BLACKOUT!' : '🎉 Bingo!';
  document.getElementById('winner-text').textContent = blackout
    ? `${winnerName} covered the whole card!`
    : `${winnerName} won the game!`;
  document.getElementById('splash-overlay').classList.remove('hidden');
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
  const autoDrawLabel = document.getElementById('auto-draw-label');
  const autoDrawToggle = document.getElementById('auto-draw-toggle');
  const intervalRow = document.getElementById('auto-draw-interval-row');
  const blackoutLabel = document.getElementById('blackout-label');
  if (isHost) {
    startBtn.classList.remove('hidden');
    waitMsg.classList.add('hidden');
    autoDrawLabel.classList.remove('hidden');
    intervalRow.classList.toggle('hidden', !autoDrawToggle.checked);
    blackoutLabel.classList.remove('hidden');
    startBtn.disabled = false;
    startBtn.textContent = roomState.players.length < 2
      ? 'Start Solo Game'
      : 'Start Game';
  } else {
    startBtn.classList.add('hidden');
    waitMsg.classList.remove('hidden');
    autoDrawLabel.classList.add('hidden');
    intervalRow.classList.add('hidden');
    blackoutLabel.classList.add('hidden');
  }
}

function renderGame(roomState) {
  const banner = document.getElementById('turn-banner');
  const autoDrawBanner = document.getElementById('auto-draw-banner');
  const drawBtn = document.getElementById('draw-ball-btn');
  const pauseBtn = document.getElementById('pause-auto-draw-btn');
  const claimBtn = document.getElementById('claim-bingo-btn');
  const isHost = roomState.hostId === myId;

  claimBtn.textContent = roomState.blackout ? 'Claim Blackout!' : 'Claim Bingo!';

  if (roomState.status === 'finished') {
    banner.classList.add('hidden');
    autoDrawBanner.classList.add('hidden');
    pauseBtn.classList.add('hidden');
    drawBtn.classList.add('hidden');
    claimBtn.classList.add('hidden');
    renderCalledList(roomState);
    renderCard();
    return;
  }
  claimBtn.classList.remove('hidden');

  if (roomState.autoDraw) {
    banner.classList.add('hidden');
    autoDrawBanner.classList.remove('hidden');
    drawBtn.classList.add('hidden');

    const seconds = ((roomState.autoDrawIntervalMs || 5000) / 1000).toFixed(1);
    autoDrawBanner.textContent = roomState.autoDrawPaused
      ? '⏸ Auto-draw paused'
      : `🎲 Drawing a ball every ${seconds}s…`;

    if (isHost) {
      pauseBtn.classList.remove('hidden');
      pauseBtn.textContent = roomState.autoDrawPaused ? 'Resume' : 'Pause';
    } else {
      pauseBtn.classList.add('hidden');
    }
  } else {
    autoDrawBanner.classList.add('hidden');
    pauseBtn.classList.add('hidden');
    banner.classList.remove('hidden');
    drawBtn.classList.remove('hidden');

    const isMyTurn = roomState.currentTurnPlayerId === myId;
    if (isMyTurn) {
      banner.textContent = "It's your turn — draw a ball!";
      banner.classList.add('my-turn');
    } else {
      const player = roomState.players.find((p) => p.id === roomState.currentTurnPlayerId);
      banner.textContent = player ? `Waiting for ${player.name} to draw...` : 'Waiting...';
      banner.classList.remove('my-turn');
    }
    drawBtn.disabled = !isMyTurn;
  }

  renderCalledList(roomState);
  renderCard();
}

function renderCalledList(roomState) {
  const calledList = document.getElementById('called-list');
  calledList.innerHTML = '';
  roomState.drawnBalls.forEach((n) => {
    const el = document.createElement('span');
    el.className = 'called-ball';
    el.textContent = n;
    calledList.appendChild(el);
  });
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
