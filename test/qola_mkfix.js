// Writes test/fixtures/rec_610_fr2.json: a 6.1.0 (frV 2) Frontier run with Pylons, Snares, upgrades, sells and wormholes,
// recorded through act(), plus its end state. test/qola.js replays it on newer code and must match bit for bit.
// Run only on the 6.1.0 sim (it was generated once at 996905d). usage: node test/qola_mkfix.js
const { load } = require('./harness.js'), fs = require('fs');
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function play(S, opts, seed, maxw) {
  const R = rng(seed); S.newRun(opts); const G = S.G; let guard = 0;
  const spots = () => { const out = []; for (const L of G.map.lanes) for (const p of L.tiles) for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1]]) if (S.canBuildAt(p.x + dx, p.y + dy)) out.push([p.x + dx, p.y + dy]); return out; };
  while (!G.over && G.wave < maxw && guard++ < 400000) {
    if (G.draft) { S.act('boon', Math.floor(R() * G.draft.length)); continue; }
    if (G.huntChoice) { S.act('push'); continue; }
    if (G.checkpoint && !G.enemies.length) { S.act('cpResume', 4); continue; }
    if (guard % 25 === 0) {
      const x = R();
      if (x < 0.4 && S.gridFree() > 0) { const sp = spots(); if (sp.length) { const [tx, ty] = sp[Math.floor(R() * sp.length)]; const k = R() < 0.3 ? (R() < 0.6 ? 'pylon' : 'snare') : ['pulse', 'rail', 'cryo', 'missile'][Math.floor(R() * 4)]; if (S.towerUnlocked(k)) S.act('build', k, tx, ty); } }
      else if (x < 0.75 && G.towers.length) { const t = G.towers[Math.floor(R() * G.towers.length)]; S.act('up', t.x, t.y, t.lvl === 3 ? 1 + Math.floor(R() * 2) : null); }
      else if (x < 0.78 && G.towers.length > 8) { const t = G.towers[Math.floor(R() * G.towers.length)]; S.act('sell', t.x, t.y); }
      else if (x < 0.8 && G.caches && G.caches.length) S.act('cache', G.caches[0].x, G.caches[0].y);
    }
    if (!G.draft && !G.huntChoice && !(G.checkpoint && !G.enemies.length)) S.simStep(S.SIM_STEP);
  }
  return G;
}
const prof = S => { S.PROF = S.defaultProfile(); S.PROF.bestWave = 80; S.PROF.xp = 4e6; };
const S = load(); prof(S);
const G = play(S, { seed: 6102, chaos: 1, frontier: 1, startWave: 1 }, 41, 22);
const fix = { made: '6.1.0 (996905d)', opts: JSON.parse(JSON.stringify(G.recOpts)), inputs: JSON.parse(JSON.stringify(G.inputs)),
  end: { tick: G.tick, wave: G.wave, score: Math.round(G.score), hash: S.runHash(), over: G.over, nodes: G.nodes.map(q => [q.x, q.y]), towers: G.towers.map(t => [t.type, t.lvl, t.spec]) } };
fs.writeFileSync(__dirname + '/fixtures/rec_610_fr2.json', JSON.stringify(fix));
console.log('frV', G.frV, 'wave', G.wave, 'inputs', G.inputs.length, 'towers', G.towers.map(t => t.type + t.lvl).join(' '), 'nodes', JSON.stringify(fix.end.nodes), 'lanes', G.map.lanes.length);
