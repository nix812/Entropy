// v5.4: how each tower handles Shell. Equal budget (~1,800 credits of LV 5 spec A towers at the same spot) against a stream of
// drones with fixed HP, with and without the Shell gene. Prints the share of the stream's HP removed (shields only matter for how much HP gets through).
// usage: node test/shellbench.js [hp]
const { load } = require('./harness');
const HP = +(process.argv[2] || 2200);
function run(type, shell) {
  const S = load(); S.PROF = Object.assign(S.defaultProfile(), { bestWave: 99 });
  S.newRun({ seed: 7, chaos: 0, startWave: 1 });
  const G = S.G; G.next = 1e9; G.storms = []; G.stormT = 1e9; G.map.tiles.fill(0);
  const pts = []; for (let x = 0; x < S.COLS; x++) { pts.push({ x, y: 7 }); G.map.tiles[S.tIdx(x, 7)] = 1; }
  G.map.lanes = [S.makeLane(pts, { x: S.COLS - 1, y: 7 })]; G.credits = 1e9;
  let spent = 0, x = 6; const ts = [];
  while (spent < 1800 && x < 30) { const t = S.buildTower(type, x, 6); if (!t) { x++; continue; } t.affixes = []; for (let l = 1; l < 5; l++) S.upgradeTower(t, 1); t.affixes = []; spent += t.invested; ts.push(t); x += 3; }
  for (const t of ts) t.s = S.towerStats(t); S.recomputeAuras();
  let spawnT = 0, n = 0, T = 0; const N = 50, all = [];
  while (T < 90) {
    spawnT -= 1 / 30;
    if (spawnT <= 0 && n < N) { spawnT = 0.9; n++; const e = S.spawnEnemy('drone', { d: 0 }); e.maxHp = e.hp = HP * (shell ? +(process.env.SHP || 0.65) : 1); if (shell) { e.shield = e.shellMax = e.maxHp * +(process.env.SHS || 0.6); e.shHitT = -9; e.genes = ['shell']; } e.spd = 1.2; e.tot0 = e.hp; all.push(e); }
    S.simStep(1 / 30); T += 1 / 30; G.core.hp = G.core.max;
  }
  let t0 = 0, left = 0; for (const e of all) { t0 += e.tot0; if (e.hp > 0) left += e.hp; }
  return { killed: (t0 - left) / t0, cost: spent, n: ts.length };
}
const rows = [];
for (const type of ['pulse', 'rail', 'missile', 'coil', 'lens', 'emp', 'flame']) {
  const a = run(type, false), b = run(type, true);
  rows.push({ tower: type, towers: a.n, cost: a.cost, plain: Math.round(a.killed * 100) + '%', shelled: Math.round(b.killed * 100) + '%', change: Math.round((b.killed - a.killed) * 100) });
}
console.table(rows);
