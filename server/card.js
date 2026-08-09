const COLUMN_RANGES = [
  [1, 15],   // B
  [16, 30],  // I
  [31, 45],  // N
  [46, 60],  // G
  [61, 75],  // O
];

const LETTERS = ['B', 'I', 'N', 'G', 'O'];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function letterForNumber(n) {
  const idx = COLUMN_RANGES.findIndex(([lo, hi]) => n >= lo && n <= hi);
  return LETTERS[idx];
}

function generateCard() {
  const columns = COLUMN_RANGES.map(([lo, hi]) => {
    const range = [];
    for (let n = lo; n <= hi; n++) range.push(n);
    return shuffle(range).slice(0, 5);
  });

  const card = [];
  const marked = [];
  for (let row = 0; row < 5; row++) {
    const cardRow = [];
    const markedRow = [];
    for (let col = 0; col < 5; col++) {
      const isFree = row === 2 && col === 2;
      cardRow.push(isFree ? 'FREE' : columns[col][row]);
      markedRow.push(isFree);
    }
    card.push(cardRow);
    marked.push(markedRow);
  }
  return { card, marked };
}

function checkWin(marked) {
  for (let row = 0; row < 5; row++) {
    if (marked[row].every(Boolean)) return true;
  }
  for (let col = 0; col < 5; col++) {
    if (marked.every((row) => row[col])) return true;
  }
  if ([0, 1, 2, 3, 4].every((i) => marked[i][i])) return true;
  if ([0, 1, 2, 3, 4].every((i) => marked[i][4 - i])) return true;
  return false;
}

function checkBlackout(marked) {
  return marked.every((row) => row.every(Boolean));
}

function createBallPool() {
  const balls = [];
  for (let n = 1; n <= 75; n++) balls.push(n);
  return shuffle(balls);
}

module.exports = { generateCard, checkWin, checkBlackout, createBallPool, letterForNumber };
