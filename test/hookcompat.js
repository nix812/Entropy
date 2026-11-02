// Old recordings must replay exactly on new code. test/fixtures/rec_574.json holds runs recorded on 5.7.4 (before sectors, the
// Bounty Purse and escalations) by the same scripted player as replay.js, with each run's final hash. This replays them on the
// current code and compares. usage: node test/hookcompat.js        (check)
//                                   node test/hookcompat.js make   (re-record: only on the old code!)
const fs = require('fs'), { load } = require('./harness.js');
const FILE = __dirname + '/fixtures/rec_574.json';
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const prof = S => { S.PROF = S.defaultProfile(); S.PROF.bestWave = 80; S.PROF.xp = 4e6; };
function play(S, opts, seed, MAXW) {
  const R = rng(seed);
  S.newRun(opts);
  let G = S.G, guard = 0;
  const spots = () => { const out = []; for (const L of G.map.lanes) for (const p of L.tiles) for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1]]) if (S.canBuildAt(p.x + dx, p.y + dy)) out.push([p.x + dx, p.y + dy]); return out; };
  while (!G.over && G.wave < MAXW && guard++ < 400000) {
    if (G.draft) { S.act('boon', Math.floor(R() * G.draft.length)); continue; }
    if (G.huntChoice) { S.act(G.bounties.length < 2 ? 'push' : 'extract'); continue; }
    if (G.anomOffers) { if (R() < 0.5) S.act('anom', G.anomOffers[0].id || G.anomOffers[0]); else S.act('stab'); }
    if (G.checkpoint && !G.enemies.length) { S.act('cpResume', 3 + R() * 10); continue; }
    if (opts.startWave > 30 && guard % 4 === 0) { // a late start needs a real defence at once: greedy builds on the busiest road tiles, then upgrades
      const cov = (x, y) => { let c = 0; for (const L of G.map.lanes) for (const p of L.tiles) if ((p.x - x) ** 2 + (p.y - y) ** 2 <= 9) c++; return c; };
      const k = ['pulse', 'rail', 'missile', 'cryo'][Math.floor(R() * 4)];
      if (S.gridFree() > 0 && G.credits >= S.towerCost(k)) { let b = null, bs = -1; for (const [x, y] of spots()) { const c = cov(x, y); if (c > bs) { bs = c; b = [x, y]; } } if (b) S.act('build', k, b[0], b[1]); }
      else if (G.towers.length) { const t = G.towers.reduce((a, t) => (S.upgradeCost(t) < S.upgradeCost(a) ? t : a)); if (G.credits >= S.upgradeCost(t)) S.act('up', t.x, t.y, t.lvl === 3 ? 0 : null); }
    }
    else if (guard % 25 === 0) {
      const x = R();
      if (x < 0.4 && S.gridFree() > 0) { const sp = spots(); if (sp.length) { const [tx, ty] = sp[Math.floor(R() * sp.length)]; const ok = S.TOWER_ORDER.filter(k => S.towerUnlocked(k)); S.act('build', ok[Math.floor(R() * ok.length)], tx, ty); } }
      else if (x < 0.7 && G.towers.length) { const t = G.towers[Math.floor(R() * G.towers.length)]; S.act('up', t.x, t.y, t.lvl === 3 ? Math.floor(R() * 2) : null); }
      else if (x < 0.76) S.act('core', ['weapon', 'shield', 'uplink', 'hull'][Math.floor(R() * 4)]);
      else if (x < 0.82) { const k = ['strike', 'stasis', 'scan', 'overclock', 'nova'][Math.floor(R() * 5)]; const e = G.enemies[0]; S.act('abil', k, e ? e.x : 5, e ? e.y : 5); }
      else if (x < 0.85) S.act('call');
    }
    if (!G.draft && !G.huntChoice && !(G.checkpoint && !G.enemies.length)) S.simStep(S.SIM_STEP);
  }
  return G;
}
if (process.argv[2] === 'make') {
  const out = [];
  for (let n = 0; n < 4; n++) {
    const S = load(); prof(S);
    const daily = n % 2 === 1 ? S.dailySpec('2026-10-2' + n) : null;
    const opts = daily ? { seed: daily.seed, chaos: daily.chaos, startWave: 1, daily, cols: 40, huntBuild: { tal: {}, caps: [], remnants: [], lvl: 40 }, nemesis: daily.nemesis }
      : { seed: n === 2 ? +(process.env.S2 || 7002) : 5000 + n, chaos: n === 2 ? 0 : 1, startWave: [15, 1, 1, 1][n], cols: 40, nemesis: { kind: 'strain', type: 'drone', genes: ['haste', 'bulk'], el: 'T', rank: 1 } };
    const G = play(S, opts, 300 + n, 64);
    out.push({ rec: { opts: G.recOpts, inputs: G.inputs }, end: { tick: G.tick, wave: G.wave, score: Math.round(G.score), hash: S.runHash(), over: G.over, bounties: G.bounties.length, ext: G.extracted || 0, pushes: G.pushes || 0, boons: G.boonsTaken.length } });
    console.log('recorded', n, JSON.stringify(out[n].end));
  }
  fs.mkdirSync(__dirname + '/fixtures', { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(out));
  process.exit(0);
}
let fails = 0;
for (const [n, F] of JSON.parse(fs.readFileSync(FILE, 'utf8')).entries()) {
  const S = load(); prof(S);
  const r = S.replayRun(F.rec, { quiet: true, until: F.end.over ? Infinity : F.end.tick });
  const h = S.runHash(), G = S.G, ok = h === F.end.hash && r.wave === F.end.wave && r.score === F.end.score && r.tick === F.end.tick && !G.sector && !(G.purse > 0);
  console.log(`${ok ? 'ok  ' : 'FAIL'} old run ${n} (${F.rec.opts.v}${F.rec.opts.daily ? ', daily' : ''}) wave ${r.wave}/${F.end.wave} score ${r.score}/${F.end.score} tick ${r.tick}/${F.end.tick} hash ${h}/${F.end.hash} · ${F.end.bounties} bounties, ${F.end.pushes} pushes, ${F.end.boons} boons${F.end.ext ? ', extracted' : ''}`);
  if (!ok) fails++;
}
console.log(fails ? `FAILED: ${fails} old recordings drifted` : 'old recordings match');
process.exit(fails ? 1 : 0);
