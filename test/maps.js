const { load } = require('./harness');
const S = load();
for (const cols of [32, 36, 39, 42]) {
  const lens = [], spans = [];
  for (let i = 0; i < 40; i++) {
    S.PROF = S.defaultProfile();
    S.newRun({ seed: 100 + i, cols, chaos: 1 });
    const L = S.G.map.lanes[0];
    lens.push(L.tiles.length);
  }
  lens.sort((a, b) => a - b);
  console.log('cols', cols, 'path len min/med/max', lens[0], lens[20], lens[39]);
}
S.newRun({ seed: 5, cols: 39, chaos: 1 });
const G = S.G; let o = '';
for (let y = 0; y < S.ROWS; y++) { for (let x = 0; x < S.COLS; x++) { const t = G.map.tiles[y * S.COLS + x]; o += t === 1 ? '#' : t === 2 ? 'o' : t === 4 ? 'C' : '.'; } o += '\n'; }
console.log(o);
