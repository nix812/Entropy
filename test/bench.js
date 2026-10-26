// Tower benchmark: DPS per credit across levels in three scenarios
const { load } = require('./harness');
const S = load();
S.PROF = Object.assign(S.defaultProfile(), { bestWave: 99 });
function scenario(type, lvl, spec, mode) {
  S.newRun({ seed: 7, chaos: 0, startWave: 1 });
  const G = S.G;
  G.next = 1e9; G.storms = []; G.stormT = 1e9;
  G.map.tiles.fill(0);
  const pts = []; for (let x = 0; x < S.COLS; x++) { pts.push({ x, y: 7 }); G.map.tiles[S.tIdx(x, 7)] = 1; }
  G.map.lanes = [S.makeLane(pts, { x: S.COLS - 1, y: 7 })];
  G.credits = 1e9;
  const t = S.buildTower(type, 15, 6);
  t.affixes = [];
  for (let l = 1; l < lvl; l++) S.upgradeTower(t, spec);
  t.affixes = []; t.s = S.towerStats(t); S.recomputeAuras();
  const cost = t.invested;
  const mk = (d) => { const e = S.spawnEnemy('drone', { d }); e.maxHp = e.hp = 1e12; e.spd = 0; return e; };
  if (mode === 'single') { mk(15.5); }
  else if (mode === 'pack') { for (let i = 0; i < 6; i++) { const e = mk(14.6 + i * 0.35); } }
  let T = 0, total = 0, spawnT = 0;
  const dur = mode === 'stream' ? 40 : 20;
  const hp0 = new Map();
  while (T < dur) {
    if (mode === 'stream') { spawnT -= 1 / 30; if (spawnT <= 0) { spawnT = 0.7; const e = S.spawnEnemy('drone', { d: 0 }); e.maxHp = e.hp = 1e12; e.spd = 1.15; } }
    S.simStep(1 / 30); T += 1 / 30;
    G.core.hp = G.core.max; // ignore leaks
  }
  total = t.dmgDone;
  return { dps: total / dur, cost };
}
const rows = [];
for (const type of S.TOWER_ORDER) {
  const D = S.TOWERS[type]; if (D.kind === 'support' || D.kind === 'eco') continue;
  for (const [lvl, spec] of [[1, 0], [3, 0], [5, 1], [5, 2]]) {
    const r = {};
    for (const mode of ['single', 'pack', 'stream']) r[mode] = scenario(type, lvl, spec || 1, mode);
    const c = r.single.cost;
    rows.push({ tower: type + ' L' + lvl + (spec ? (spec === 1 ? 'A' : 'B') : ''), cost: c,
      single: +(r.single.dps / c * 100).toFixed(1), pack: +(r.pack.dps / c * 100).toFixed(1), stream: +(r.stream.dps / c * 100).toFixed(1),
      rawSingle: Math.round(r.single.dps), rawStream: Math.round(r.stream.dps) });
  }
}
console.log('DPS per 100 credits (no affixes, no tree)');
console.table(rows);
