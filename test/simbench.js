// 6.6 perf66: how long one simStep takes (ms per 1/30 s tick) in three fixed scenes and in a played run.
// usage: node test/simbench.js [rounds]
//  - early / mid / late: a fixed map (seed 4242), towers around the core and tanky enemies spread down the roads
//    (early W5: 8 towers, 30 enemies; mid W30: 24 towers, 100 enemies; late W60: 48 towers with the 7 capstone tier
//    towers at LV 4, 220 enemies, a boss, 2 storms, a Black Hole, 5 loot sites and the probe out). Enemies never die, so
//    every tick does the same work. Prints the median over `rounds` rounds of 300 ticks.
//  - played: the replay.js scripted player from Wave 1 to 34 (seed 11); ms per tick by wave band.
// Prints a run hash for each fixed scene so a change that alters the simulation shows up.
const { load } = require('./harness.js');
const ROUNDS = +(process.argv[2] || 5);
const S = load();
S.PROF = Object.assign(S.defaultProfile ? S.defaultProfile() : S.PROF, { bestWave: 99 });
for (const k of Object.keys(S.Hooks)) if (typeof S.Hooks[k] === 'function') S.Hooks[k] = () => {};
function scene(kind) {
  S.newRun({ seed: 4242, chaos: 1, startWave: 1, frontier: 1, capT: S.CAP_TOWERS.slice() });
  const G = S.G, cfg = { early: [5, 8, 30, 0], mid: [30, 24, 100, 1], late: [60, 48, 220, 2] }[kind];
  G.wave = cfg[0]; G.credits = 1e9; G.next = 1e9; if (G.gridBonus !== undefined) G.gridBonus = 300;
  const spots = []; for (let y = 0; y < S.ROWS; y++) for (let x = 0; x < S.COLS; x++) if (S.canBuildAt(x, y) && (!G.region || (x >= G.region.x0 && x <= G.region.x1 && y >= G.region.y0 && y <= G.region.y1))) spots.push([x, y]);
  const c = G.map.core; spots.sort((a, b) => Math.hypot(a[0] - c.x, a[1] - c.y) - Math.hypot(b[0] - c.x, b[1] - c.y));
  const types = Object.keys(S.TOWERS).filter(t => cfg[3] === 2 || !S.TOWERS[t].capT);
  for (let i = 0; i < cfg[1] && spots.length; i++) { const s = spots.shift(); const t = S.buildTower(types[i % types.length], s[0], s[1]); if (t && cfg[3]) for (let l = 1; l < (cfg[3] === 2 ? 4 : 3); l++) S.upgradeTower(t, 1 + (i % 2)); }
  const ety = ['drone', 'swarmer', 'tank', 'flyer', 'splitter', 'medic', 'shielder', 'phantom', 'reflector', 'carrier', 'sapper', 'leech'];
  for (let i = 0; i < cfg[2]; i++) { const e = S.spawnEnemy(ety[i % ety.length], { d: (i * 0.29) % 30 }); if (e) e.maxHp = e.hp = 1e12; }
  if (kind === 'late') {
    const b = S.spawnBoss({ boss: S.BOSSES[2].id, lane: G.map.lanes[0], hpm: 1 }); if (b) b.maxHp = b.hp = 1e13;
    S.G.storms.length = 0; S.G.stormT = 1e9;
    G.storms.push({ id: G.eid++, types: ['ion', 'void'], x: c.x + 4, y: c.y - 2, vx: 0, vy: 0, r: 3.5, life: 1e9, age: 0, mael: false, spawnT: 0, rot: 0 });
    G.storms.push({ id: G.eid++, types: ['solar'], x: c.x - 5, y: c.y + 2, vx: 0, vy: 0, r: 3.5, life: 1e9, age: 0, mael: false, spawnT: 0, rot: 0 });
    G.hole = { x: c.x + 6, y: c.y + 1, tx: c.x + 6, ty: c.y + 1, dx: 1, dy: 0, ph: 1, t: 5, k: 1 };
    if (G.probe) { G.sites = []; for (let i = 0; i < 5; i++) { const s = S.siteSpawn(); if (!s) continue; const a = i * 1.3; s.x = c.x + Math.cos(a) * 6; s.y = c.y + Math.sin(a) * 4; for (const g of s.g) { g.x = s.x + 1; g.y = s.y; g.hx = g.x; g.hy = g.y; } }
      const P = G.probe; P.home = 0; P.x = c.x + 3; P.y = c.y + 2; P.tx = c.x - 6; P.ty = c.y; }
  }
  return G;
}
function tick() { const G = S.G; G.next = 1e9; S.simStep(1 / 30); G.core.hp = G.core.max; if (G.hole) { G.hole.t = 5; G.hole.ph = 1; } }
const out = {};
for (const kind of ['early', 'mid', 'late']) {
  const ms = [];
  for (let r = 0; r < ROUNDS; r++) {
    scene(kind); for (let i = 0; i < 60; i++) tick(); // warm up
    const t0 = process.hrtime.bigint(); for (let i = 0; i < 300; i++) tick(); ms.push(Number(process.hrtime.bigint() - t0) / 1e6 / 300);
  }
  ms.sort((a, b) => a - b);
  out[kind] = { msPerTick: +ms[ms.length >> 1].toFixed(3), min: +ms[0].toFixed(3), enemies: S.G.enemies.length, towers: S.G.towers.length, hash: S.runHash ? S.runHash() : '' };
}
// a played run: replay.js's scripted player (only act() and simStep), timing the ticks per wave band
{
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const R = rng(11); S.newRun({ seed: 11, chaos: 1, startWave: 1, frontier: 1 }); const G = S.G; let guard = 0; const band = {};
  const spots = () => { const o = []; for (const L of G.map.lanes) for (const p of L.tiles) for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) if (S.canBuildAt(p.x + dx, p.y + dy)) o.push([p.x + dx, p.y + dy]); return o; };
  G.credits += 3000;
  while (!G.over && G.wave < 34 && guard++ < 400000) {
    if (G.draft) { S.act('boon', Math.floor(R() * G.draft.length)); continue; }
    if (G.huntChoice) { S.act('push'); continue; }
    if (G.anomOffers) S.act('stab');
    if (G.checkpoint && !G.enemies.length) { S.act('cpResume', 3); continue; }
    if (guard % 25 === 0) { const x = R();
      if (x < 0.45 && S.gridFree() > 0) { const sp = spots(); if (sp.length) { const [tx, ty] = sp[Math.floor(R() * sp.length)]; const ok = S.TOWER_ORDER.filter(k => S.towerUnlocked ? S.towerUnlocked(k) : true); S.act('build', ok[Math.floor(R() * ok.length)], tx, ty); } }
      else if (x < 0.8 && G.towers.length) { const t = G.towers[Math.floor(R() * G.towers.length)]; S.act('up', t.x, t.y, t.lvl === 3 ? 1 + Math.floor(R() * 2) : null); } }
    const b = G.wave <= 10 ? 'W1-10' : G.wave <= 20 ? 'W11-20' : 'W21-34', t0 = process.hrtime.bigint();
    S.simStep(S.SIM_STEP); const d = Number(process.hrtime.bigint() - t0) / 1e6;
    const e = band[b] || (band[b] = { ms: 0, n: 0, maxEn: 0 }); e.ms += d; e.n++; e.maxEn = Math.max(e.maxEn, G.enemies.length);
  }
  out.played = Object.fromEntries(Object.entries(band).map(([k, v]) => [k, { msPerTick: +(v.ms / v.n).toFixed(3), ticks: v.n, maxEnemies: v.maxEn }]));
  out.played.endWave = G.wave; out.played.hash = S.runHash ? S.runHash() : '';
}
console.log(JSON.stringify(out, null, 1));
