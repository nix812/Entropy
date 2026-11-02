// v5.3 replay check: a scripted player drives runs only through act(), then each run is rebuilt from its recording
// (newRun(G.recOpts) + G.inputs) and must match the original state exactly, at the end and when resumed halfway.
// usage: node test/replay.js [runs] [maxWave]
const { load } = require('./harness.js');
const RUNS = +(process.argv[2] || 4), MAXW = +(process.argv[3] || 34);
let fails = 0;
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function play(S, opts, seed) {
  const R = rng(seed);
  S.newRun(opts);
  let G = S.G, guard = 0;
  const spots = () => { const out = []; for (const L of G.map.lanes) for (const p of L.tiles) for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1]]) if (S.canBuildAt(p.x + dx, p.y + dy)) out.push([p.x + dx, p.y + dy]); return out; };
  while (!G.over && G.wave < MAXW && guard++ < 400000) {
    if (G.draft) { S.act('boon', Math.floor(R() * G.draft.length)); continue; }
    if (G.huntChoice) { S.act(R() < 0.5 && G.wave < 30 ? 'push' : 'extract'); continue; }
    if (G.anomOffers) { if (R() < 0.5) S.act('anom', G.anomOffers[0].id || G.anomOffers[0]); else S.act('stab'); }
    if (G.checkpoint && !G.enemies.length) { S.act('cpResume', 3 + R() * 10); continue; }
    if (guard % 25 === 12) { const t = G.towers.find(o => o.ascPend > 0); if (t && R() < 0.8) { S.ascOffer(t); S.act('ascPick', t.x, t.y, Math.floor(R() * 4)); } } // v5.8 perk picks (index 3 is refused without Mastery 4)
    if (guard % 25 === 0) {
      const x = R();
      if (x < 0.35 && S.gridFree() > 0) { const sp = spots(); if (sp.length) { const [tx, ty] = sp[Math.floor(R() * sp.length)]; const ok = S.TOWER_ORDER.filter(k => S.towerUnlocked(k)); S.act('build', ok[Math.floor(R() * ok.length)], tx, ty); } }
      else if (x < 0.6 && G.towers.length) { const t = G.towers[Math.floor(R() * G.towers.length)]; S.act('up', t.x, t.y, t.lvl === 3 ? Math.floor(R() * 2) : null); }
      else if (x < 0.64 && G.towers.length) { const t = G.towers[Math.floor(R() * G.towers.length)]; if (t.pending) { S.vetOffer(t); S.act('vet', t.x, t.y, Math.floor(R() * 3)); } else S.act('mode', t.x, t.y, ['first', 'strong', 'close'][Math.floor(R() * 3)]); }
      else if (x < 0.7) S.act('core', ['weapon', 'shield', 'uplink', 'hull'][Math.floor(R() * 4)]);
      else if (x < 0.76) { const k = ['strike', 'stasis', 'scan', 'overclock', 'nova'][Math.floor(R() * 5)]; const e = G.enemies[0]; S.act('abil', k, e ? e.x : 5, e ? e.y : 5); }
      else if (x < 0.78 && G.towers.length > 6) { const t = G.towers[Math.floor(R() * G.towers.length)]; S.act('sell', t.x, t.y); }
      else if (x < 0.8) S.act('call');
      else if (x < 0.82 && G.caches && G.caches.length) S.act('cache', G.caches[0].x, G.caches[0].y);
      else if (x < 0.83) S.act('reactor');
      else if (x < 0.84) { const m = G.market; if (m && m.stock) S.act('buy', m.stock[Math.floor(R() * m.stock.length)]); }
    }
    if (!G.draft && !G.huntChoice && !(G.checkpoint && !G.enemies.length)) S.simStep(S.SIM_STEP);
  }
  return G;
}
for (let n = +(process.env.FROM || 0); n < RUNS; n++) {
  const S = load();
  S.PROF = S.defaultProfile(); S.PROF.bestWave = 80; S.PROF.xp = 4e6;
  const daily = n % 2 === 1 ? S.dailySpec('2026-11-0' + (n + 1)) : null;
  const opts = daily ? { seed: daily.seed, chaos: daily.chaos, startWave: 1, daily, cols: 44, huntBuild: { tal: {}, caps: [], remnants: [], lvl: 40 }, nemesis: daily.nemesis }
    : { seed: 1000 + n, chaos: 1, startWave: 1, cols: 44, nemesis: n === 2 ? { kind: 'boss', boss: 'cat', rank: 2 } : { kind: 'strain', type: 'drone', genes: ['haste', 'plating'], el: 'K', rank: 1 } };
  const G1 = play(S, opts, 77 + n);
  if (process.env.TRACE) console.log(G1.rlog.filter(e => ['bounty', 'push', 'extract', 'wanted', 'nemesis', 'boss'].includes(e.k)).map(e => JSON.stringify(e)).join('\n'));
  const end = { tick: G1.tick, wave: G1.wave, score: Math.round(G1.score), hash: S.runHash(), inputs: G1.inputs.length, over: G1.over, ext: G1.extracted || 0, bounties: G1.bounties.length, nem: G1.nemesis && G1.nemesis.name };
  const rec = { opts: JSON.parse(JSON.stringify(G1.recOpts)), inputs: JSON.parse(JSON.stringify(G1.inputs)) };
  // a fresh sim (separate VM) rebuilds it from the recording alone
  const S2 = load(); S2.PROF = S2.defaultProfile(); S2.PROF.bestWave = 80; S2.PROF.xp = 4e6;
  const r2 = S2.replayRun(rec, { quiet: true, until: G1.over ? Infinity : G1.tick });
  const h2 = S2.runHash();
  const same = h2 === end.hash && r2.wave === end.wave && r2.score === end.score && r2.tick === end.tick;
  // resume halfway: replay to the middle tick, then feed the rest live through act() on the next ticks
  const S3 = load(); S3.PROF = S3.defaultProfile(); S3.PROF.bestWave = 80; S3.PROF.xp = 4e6;
  const mid = Math.floor(end.tick / 2); S3.replayRun(rec, { quiet: true, until: mid });
  let G3 = S3.G, i = G3.inputs.length; const inp = rec.inputs;
  for (let g = 0; g < 5e6 && !G3.over; g++) {
    while (i < inp.length && inp[i][0] <= G3.tick) { const [, nm, ...a] = inp[i++]; S3.act(nm, ...a); }
    if (G3.over || (!G1.over && G3.tick >= end.tick)) break;
    if (G3.draft || G3.huntChoice || (G3.checkpoint && !G3.enemies.length)) { if (i >= inp.length) break; if (inp[i][0] > G3.tick) G3.tick = inp[i][0]; continue; }
    S3.simStep(S3.SIM_STEP);
  }
  const h3 = S3.runHash(), same3 = h3 === end.hash && G3.inputs.length === end.inputs;
  console.log(`${same && same3 ? 'ok  ' : 'FAIL'} run ${n} ${daily ? 'daily' : 'std'} wave ${end.wave} score ${end.score} tick ${end.tick} inputs ${end.inputs} bounties ${end.bounties} ${end.ext ? 'extracted W' + end.ext : end.over ? 'died' : 'stopped'} nemesis ${end.nem || '-'} · replay ${r2.wave}/${r2.score}/${h2} vs ${end.hash} · resume ${h3}`);
  if (!(same && same3)) fails++;
}
console.log(fails ? `${fails} FAILED` : 'all replays match');
process.exit(fails ? 1 : 0);
