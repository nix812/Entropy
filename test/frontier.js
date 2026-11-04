// Frontier checks (G.fr; the only run type since 6.1, Daily Hunts and Training included): board size, slower and heavier waves, lift-off and flight, docking, links, tower moves,
// the cooldown, enemies re-routing to the landing spot, and that a scripted Frontier run (lift-offs, docks and moves through act())
// replays bit for bit, rebuilds halfway (mid-flight), and resumes from a snapshot taken mid-flight.
// usage: node test/frontier.js [maxWave]
const { load } = require('./harness.js');
const MAXW = +(process.argv[2] || 16);
let fails = 0, n = 0;
const ok = (c, msg) => { n++; if (!c) { fails++; console.log('FAIL ' + msg); } else if (process.env.V) console.log('ok   ' + msg); };
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const fresh = () => { const S = load(); S.PROF = S.defaultProfile(); S.PROF.bestWave = 40; S.PROF.xp = 2e5; return S; };
const spots = (S, G) => { const out = []; for (const L of G.map.lanes) for (const p of L.tiles) for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1]]) if (S.canBuildAt(p.x + dx, p.y + dy)) out.push([p.x + dx, p.y + dy]); return out; };
const step = (S, k) => { for (let i = 0; i < k; i++) { const G = S.G; if (G.over) return; if (G.draft) { S.act('boon', 0); continue; } if (G.huntChoice) { S.act('push'); continue; } if (G.checkpoint && !G.enemies.length) { S.act('cpResume', 4); continue; } S.simStep(S.SIM_STEP); } };
const till = (S, f, cap) => { for (let i = 0; i < (cap || 60000) && !f() && !S.G.over; i++) step(S, 1); return f(); };

// ---- 1. Classic is untouched: no flag, no Frontier fields in the recording
{
  const S = fresh(); const G = S.newRun({ seed: 11, chaos: 1, cols: 44 });
  ok(!G.fr && !('frontier' in G.recOpts) && G.frFly === undefined, 'a Classic run has no Frontier state');
  ok(S.ROWS === 26 && S.COLS === 44, `Classic board stays ${S.COLS}x${S.ROWS}`);
  ok(S.act('frFly', 10, 10) === false && S.act('frMove', 1, 1, 2, 2) === false, 'Frontier acts do nothing in a Classic run');
  const D0 = S.newRun({ seed: 12, chaos: 2, cols: 44, daily: S.dailySpec('2026-11-03'), huntBuild: { tal: {}, caps: [], remnants: [], lvl: 40 } });
  ok(!D0.fr && !('frontier' in D0.recOpts), 'a Daily Hunt without the flag (old recordings and hunt codes) stays Classic');
  const D = S.newRun({ seed: 12, chaos: 2, frontier: 1, daily: S.dailySpec('2026-11-03'), huntBuild: { tal: {}, caps: [], remnants: [], lvl: 40 } });
  ok(D.fr === 1 && D.daily && D.recOpts.frontier === 1 && S.ROWS === S.frRows(2) && S.COLS === S.frCols(S.ROWS), `6.1: a flagged Daily Hunt runs Frontier rules on the ${S.COLS}x${S.ROWS} board`);
  ok(D.frV === S.FR_VER && D.recOpts.frV === S.FR_VER, `a new Frontier run records its rules version (frV ${D.recOpts.frV})`);
  const O = S.newRun({ seed: 13, chaos: 1, frontier: 1, cols: 64, rows: 36, v: '6.0.2', hk: 1 }); ok(O.fr === 1 && O.frV === 1, 'a lab recording (flag, no frV) replays on the prototype rules (frV 1)');
}
// ---- 1b. Training and lessons run on Frontier rules when flagged (6.1); without the flag they stay Classic
{
  const S = fresh(); const T = S.newRun({ tut: 1, frontier: 1, cols: 46 });
  ok(T.fr === 1 && T.tut && S.ROWS === S.TUT.fr.rows && S.COLS === 46 && T.tutS.waves === S.TUT.fr.waves, `Frontier Training: ${S.COLS}x${S.ROWS}, its own wave script`);
  ok(S.frCanFly() && T.recOpts.frontier === 1, 'Lift Off is open in Training');
  const L = S.newRun({ tut: 1, frontier: 1, cols: 46, lesson: 'lift' });
  ok(L.fr === 1 && L.lesson === 'lift' && L.towers.length === 3 && L.towers.some(t => t.type === 'rail' && t.lvl === 3), 'the Lift Off lesson starts with a Rail Lance and two Pulse Blasters beside the road');
  const dock = L.towers.filter(t => S.frCands().includes(S.tIdx(t.x, t.y)) && S.frPlan(t.x, t.y)); ok(dock.length >= 1, `the lesson has a tower to dock on (${dock.map(t => t.type).join(', ')})`);
  const C = S.newRun({ tut: 1, cols: 44 }); ok(!C.fr && S.ROWS === S.TUT.rows, 'an old Training recording (no flag) stays Classic');
}

// ---- 2. the board, the waves and the enemies
{
  const S = fresh(); const G = S.newRun({ seed: 21, chaos: 1, frontier: 1 });
  ok(G.fr === 1 && S.COLS === 64 && S.ROWS === 36, `Frontier Normal board is ${S.COLS}x${S.ROWS}`);
  const R = G.region; ok(R.x1 - R.x0 < S.COLS && R.y1 - R.y0 < S.ROWS, `the sector still starts small (${R.x1 - R.x0}x${R.y1 - R.y0}) and grows`);
  const e = S.spawnEnemy('drone', { lane: G.map.lanes[0], hpm: 1 }); ok(Math.abs(e.spd - S.ENEMIES.drone.spd * S.FRONTIER.spd) < 1e-9, 'enemies walk at 60% speed');
  G.enemies.length = 0;
  const S2 = fresh(); S2.newRun({ seed: 21, chaos: 1, cols: 64, rows: 36 });
  const w = 20, qa = S.genWave(w, {}).queue.filter(q => q.type !== 'boss'), qb = S2.genWave(w, {}).queue.filter(q => q.type !== 'boss');
  ok(qa.length < qb.length * 0.8, `fewer units per wave (${qa.length} vs Classic ${qb.length})`);
  ok(Math.abs(qa[0].hpm / qb[0].hpm - S.FRONTIER.hp) < 1e-9 && S.FRONTIER.hp > 1.5, `each unit is ×${S.FRONTIER.hp} as tough`);
  const span = q => q[q.length - 1].t - q[0].t; ok(span(qa) > span(qb) * 0.7, `the wave still takes as long to arrive (${span(qa).toFixed(1)} s vs ${span(qb).toFixed(1)} s)`);
  const heavy = q => q.filter(x => x.type === 'tank').length / q.length; ok(heavy(qa) > heavy(qb), 'a heavier roster (more Juggernauts)');
  for (const [ch, rows] of [[0, 30], [2, 40], [3, 40]]) { const S3 = fresh(); S3.newRun({ seed: 5, chaos: ch, frontier: 1 }); ok(S3.ROWS === rows && S3.COLS === S3.frCols(rows), `chaos ${ch}: ${S3.COLS}x${S3.ROWS}`); }
}

// ---- 2b. no building within FRONTIER.wormBuild tiles of a wormhole
{
  const S = fresh(); const G = S.newRun({ seed: 7, chaos: 1, frontier: 1 }); G.credits = 1e6;
  const p = G.map.lanes[0].tiles[0]; let bad = 0, ok2 = 0;
  for (let y = 0; y < S.ROWS; y++) for (let x = 0; x < S.COLS; x++) if (S.canBuildAt(x, y)) { for (const L of G.map.lanes) { const q = L.tiles[0]; if (Math.hypot(x - q.x, y - q.y) < S.FRONTIER.wormBuild) bad++; } ok2++; }
  ok(bad === 0 && ok2 > 50, `no buildable tile within ${S.FRONTIER.wormBuild} of a wormhole (${ok2} buildable)`);
  const c = S.newRun({ seed: 7, chaos: 1 }); let near = 0; for (const L of c.map.lanes) { const q = L.tiles[0]; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (S.canBuildAt(q.x + dx, q.y + dy)) near++; }
  ok(near > 0, 'Classic can still build beside a wormhole');
}
// ---- 3. lift-off, flight, docking, links, cooldown, re-routing, moving a tower
{
  const S = fresh(); const G = S.newRun({ seed: 31, chaos: 1, frontier: 1 }); G.credits = 1e6;
  const sp = spots(S, G), core = G.map.core;
  // three Pulse towers around a Rail Lance, all away from the core
  const far = sp.filter(([x, y]) => Math.abs(x - core.x) + Math.abs(y - core.y) > 8);
  const [rx, ry] = far[Math.floor(far.length / 2)];
  ok(!!S.act('build', 'rail', rx, ry), 'built a Rail Lance');
  const rail = G.towerAt[S.tIdx(rx, ry)];
  let near = 0; for (let dy = -2; dy <= 2 && near < 4; dy++) for (let dx = -2; dx <= 2 && near < 4; dx++) if ((dx || dy) && S.canBuildAt(rx + dx, ry + dy) && S.act('build', near === 3 ? 'pylon' : 'pulse', rx + dx, ry + dy)) near++;
  ok(near >= 3, `built ${near} towers around it`);
  const base = { dmg: rail.s.dmg, range: rail.s.range };
  ok(S.frCanFly(), 'lift-off is open from Wave 1');
  ok(!S.frCands().includes(S.tIdx(G.towers.find(t => t.type === 'pylon').x, G.towers.find(t => t.type === 'pylon').y)), 'a support tower is not a landing spot');
  // let the first wave walk in, then fly
  S.act('call'); till(S, () => G.enemies.filter(e => !e.fly).length >= 3);
  const P = S.frPlan(rx, ry); ok(!!P && P.dock === rail, 'the preview docks on the Rail Lance');
  ok(P && P.links.length >= 1 && P.links.length <= 3 && !P.links.includes(rail) && P.links.every(t => t.type !== 'pylon'), `the preview links ${P && P.links.length} attack towers`);
  ok(P && Math.abs(P.secs - Math.max(1, P.dist / 3)) < 1e-6, `flight takes ${P && P.secs.toFixed(1)} s for ${P && P.dist.toFixed(1)} tiles`);
  const sh0 = G.core.smax;
  ok(S.act('frFly', rx, ry) === true, 'lift off');
  ok(G.frFly && G.core.shield === 0 && sh0 > 0, 'shield down in the air');
  ok(G.map.core.x === rx && G.map.core.y === ry && G.map.tiles[S.tIdx(rx, ry)] === 4, 'the roads already lead to the landing spot');
  const ground = G.enemies.filter(e => !e.fly && !e.dead);
  ok(ground.length > 0 && ground.every(e => { const p = e.L.pts[e.L.pts.length - 1]; return Math.abs(p.x - (rx + 0.5)) < 0.01 && Math.abs(p.y - (ry + 0.5)) < 0.01; }), `${ground.length} walking enemies re-routed to the landing spot`);
  ok(G.map.lanes.every(L => { const p = L.tiles[L.tiles.length - 1]; return p.x === rx && p.y === ry; }), 'every lane ends at the landing spot');
  ok(ground.every(e => S.eProg(e) > 0 && S.eProg(e) < 1) && ground.some(e => e.L.pre > 0), `FR_VER 2: re-routed enemies keep their place in line ('First' targeting: ${ground.map(e => S.eProg(e).toFixed(2)).join(' ')})`);
  ok(!S.frDockT() && !rail.s.docked, 'nothing is docked while flying');
  let shots = 0; const pc = G.projs.length; step(S, 10); shots = G.projs.filter(p => p.src === G.core).length;
  ok(shots === 0 && G.core.shield === 0, 'the core gun is offline in the air');
  ok(S.act('frFly', core.x, core.y) === false, 'no second lift-off mid-flight');
  till(S, () => !G.frFly, 3000);
  ok(!G.frFly && Math.abs(G.core.x - (rx + 0.5)) < 1e-9, 'landed');
  ok(S.frDockT() === rail && rail.s.docked === 1, 'docked: the Rail Lance is the core weapon');
  const x = S.FRONTIER.dockDmg; ok(Math.abs(rail.s.dmg / base.dmg - x) < 1e-6 && Math.abs(rail.s.range - base.range - 1) < 1e-6, `docked Rail: ×${(rail.s.dmg / base.dmg).toFixed(2)} damage, +${(rail.s.range - base.range).toFixed(2)} range`);
  ok(G.frLinks.length >= 1 && G.frLinks.every(t => t.buff.dmg >= 0.1 - 1e-9 && t.buff.rate >= 0.1 - 1e-9), `${G.frLinks.length} linked towers get +10% damage and rate`);
  ok(rail.buff.dmg >= 0.05 * G.frLinks.length - 1e-9, 'the docked weapon gets +5% per link');
  ok(!S.frCanFly() && G.frReady === G.wave + 3, `cooldown: next lift-off on Wave ${G.frReady}`);
  step(S, 60); ok(!G.projs.some(p => p.src === G.core), 'docked: the plain core gun stays quiet');
  // Battery scales the docked weapon
  const d0 = rail.s.dmg; S.act('core', 'weapon'); ok(Math.abs(rail.s.dmg / d0 - 1.2) < 1e-6, `Battery LV ${G.core.wLvl} raises the docked weapon ×${(rail.s.dmg / d0).toFixed(2)}`);
  // moving a tower
  const pt = G.frLinks[0], fee = S.frMoveFee(pt), cr0 = G.credits, from = [pt.x, pt.y];
  const dest = spots(S, G).find(([a, b]) => Math.hypot(a + 0.5 - G.core.x, b + 0.5 - G.core.y) > 6);
  ok(S.act('frMove', rail.x, rail.y, dest[0], dest[1]) === false, 'the docked tower cannot move');
  ok(S.act('frMove', from[0], from[1], dest[0], dest[1]) === true, 'move a linked tower');
  ok(G.credits === cr0 - fee && fee === Math.round(pt.invested * 0.1), `fee ${fee} (10%)`);
  ok(!G.towerAt[S.tIdx(from[0], from[1])] && G.towerAt[S.tIdx(dest[0], dest[1])] === pt, 'it holds its new tile at once');
  ok(pt.disabled > 3.9 && pt.disCause === 'MOVING' && !G.frLinks.includes(pt), 'offline while it relocates, and the link breaks');
  step(S, 30 * 4 + 3); ok(pt.disabled <= 0 && !pt.mvT, 'back online after 4 s');
  // cooldown runs out three waves later; lift off again: the Rail is set back down intact
  till(S, () => S.frCanFly(), 200000);
  ok(S.frCanFly() && G.wave >= G.frReady, `lift-off open again on Wave ${G.wave}`);
  const empty = S.frCands().map(i => [i % S.COLS, (i / S.COLS) | 0]).find(([a, b]) => !G.towerAt[S.tIdx(a, b)] && S.frPlan(a, b));
  ok(!!empty && S.act('frFly', empty[0], empty[1]), 'lift off to open ground');
  ok(G.towerAt[S.tIdx(rx, ry)] === rail && !rail.s.docked && rail.s.dmg < base.dmg * 1.25 && Math.abs(rail.s.range - base.range) < 1e-6, 'the Rail Lance is back on its tile, undocked and intact (damage may have grown from kills)');
  till(S, () => !G.frFly, 3000);
  ok(!S.frDockT(), 'landed on open ground: the plain cannon');
  till(S, () => G.projs.some(p => p.src === G.core) || G.over, 30 * 120); ok(G.projs.some(p => p.src === G.core) || !G.enemies.length, 'the plain cannon fires again');
  ok(S.act('coreEl', 'T') === false && G.core.el === 'K', 'no free element switch in Frontier');
}

// ---- 4. a scripted Frontier run replays bit for bit, rebuilds halfway (mid-flight) and resumes from a mid-flight snapshot
function play(S, seed, maxw, mark) {
  const R = rng(seed); const G = S.newRun({ seed: 1000 + seed, chaos: 1, frontier: 1, cols: 64, rows: 36 });
  let guard = 0, flights = 0, docks = 0, moves = 0;
  while (!G.over && G.wave < maxw && guard++ < 400000) {
    if (G.draft) { S.act('boon', Math.floor(R() * G.draft.length)); continue; }
    if (G.huntChoice) { S.act('push'); continue; }
    if (G.checkpoint && !G.enemies.length) { S.act('cpResume', 3 + R() * 10); continue; }
    if (guard % 25 === 0) {
      const x = R();
      if (x < 0.4 && S.gridFree() > 0) { const sp = spots(S, G); if (sp.length) { const [tx, ty] = sp[Math.floor(R() * sp.length)]; S.act('build', ['pulse', 'rail', 'cryo', 'missile', 'pulse'][Math.floor(R() * 5)], tx, ty); } }
      else if (x < 0.6 && G.towers.length) { const t = G.towers[Math.floor(R() * G.towers.length)]; S.act('up', t.x, t.y, t.lvl === 3 ? 1 : null); }
      else if (x < 0.66) S.act('core', ['weapon', 'shield', 'uplink'][Math.floor(R() * 3)]);
      else if (x < 0.72 && G.towers.length > 3) { const t = G.towers[Math.floor(R() * G.towers.length)], sp = spots(S, G); if (sp.length && S.act('frMove', t.x, t.y, ...sp[Math.floor(R() * sp.length)])) moves++; }
      else if (x < 0.8 && S.frCanFly() && G.enemies.length > 2) { // lift off mid-wave: onto the best tower, or open ground
        const att = G.towers.filter(t => !['pylon', 'forge', 'snare'].includes(t.type)).sort((a, b) => b.dmgDone - a.dmgDone || a.id - b.id);
        const c = S.frCands(), tw = att.find(t => c.includes(S.tIdx(t.x, t.y)) && S.frPlan(t.x, t.y));
        const tgt = tw && R() < 0.7 ? [tw.x, tw.y] : (() => { for (let k = 0; k < 30; k++) { const i = c[Math.floor(R() * c.length)]; if (i !== undefined && S.frPlan(i % S.COLS, (i / S.COLS) | 0)) return [i % S.COLS, (i / S.COLS) | 0]; } return null; })();
        if (tgt && S.act('frFly', tgt[0], tgt[1])) { flights++; if (G.towerAt[S.tIdx(tgt[0], tgt[1])]) docks++; if (mark && !mark.tick && G.frFly && G.frFly.dur > 0.5) mark.arm = G.tick + 8; }
      }
      else if (x < 0.83) S.act('call');
    }
    if (mark && mark.arm && G.tick === mark.arm && G.frFly) { mark.tick = G.tick; mark.hash = S.runHash(); mark.core = [G.core.x, G.core.y]; S.snapshotRun(G.wave); mark.snap = JSON.parse(JSON.stringify(S.PROF.runSnap)); }
    if (!G.draft && !G.huntChoice && !(G.checkpoint && !G.enemies.length)) S.simStep(S.SIM_STEP);
  }
  return { G, flights, docks, moves };
}
for (const seed of [1, 2]) {
  const S = fresh(), mark = {};
  const { G, flights, docks, moves } = play(S, seed, MAXW, mark);
  const end = { tick: G.tick, wave: G.wave, score: Math.round(G.score), hash: S.runHash() };
  ok(flights >= 2 && docks >= 1 && moves >= 2, `seed ${seed}: run to Wave ${G.wave} with ${flights} lift-offs (${docks} docks) and ${moves} moves`);
  const rec = { opts: JSON.parse(JSON.stringify(G.recOpts)), inputs: JSON.parse(JSON.stringify(G.inputs)) };
  ok(rec.opts.frontier === 1 && rec.opts.cols === 64 && rec.opts.rows === 36, 'the recording carries the mode and the board');
  const S2 = fresh(); const r2 = S2.replayRun(rec, { quiet: true, until: G.over ? Infinity : G.tick });
  ok(S2.runHash() === end.hash && r2.wave === end.wave && r2.score === end.score && r2.tick === end.tick, `seed ${seed}: replay ${r2.wave}/${r2.score}/${S2.runHash()} vs ${end.hash}`);
  ok(!!mark.tick, `seed ${seed}: a lift-off spanned ticks (mid-flight mark at tick ${mark.tick})`);
  if (mark.tick) {
    const S3 = fresh(); S3.replayRun(rec, { quiet: true, until: mark.tick });
    ok(S3.runHash() === mark.hash && !!S3.G.frFly, `seed ${seed}: rebuilt halfway, mid-flight, matches (${S3.runHash()} vs ${mark.hash})`);
    // resume from the snapshot taken mid-flight: the flight carries on and lands where the roads lead
    const S4 = fresh(); S4.resumeRun(mark.snap); const G4 = S4.G;
    ok(G4.fr === 1 && S4.COLS === 64 && S4.ROWS === 36 && !!G4.frFly && G4.core.shield === 0, `seed ${seed}: snapshot resumes as Frontier, still in the air`);
    ok(Math.abs(G4.core.x - mark.core[0]) < 1e-6 && Math.abs(G4.core.y - mark.core[1]) < 1e-6, 'the core resumes where it was in the air');
    const tgt = [G4.map.core.x, G4.map.core.y]; till(S4, () => !G4.frFly, 3000);
    ok(!G4.frFly && G4.core.x === tgt[0] + 0.5 && G4.core.y === tgt[1] + 0.5, 'and lands on the spot the roads lead to');
    const dk = G4.towerAt[S4.tIdx(tgt[0], tgt[1])]; ok(!dk || S4.frDockT() === dk, 'docking comes back with it');
    const s2 = JSON.parse(JSON.stringify(mark.snap)); delete s2.fr; delete s2.frFly; delete s2.frReady; delete s2.frN;
    const S5 = fresh(); S5.resumeRun(Object.assign(s2, { cols: 44, rows: 26 })); ok(!S5.G.fr, 'a snapshot without the flag resumes as Classic');
  }
}
// ---- 5. a Daily Hunt on Frontier rules (6.1): lift-offs, docks, moves, a bounty and a jump door replay bit for bit from the
// recording (as resume, ladder checks and hunt codes rebuild it), rebuild halfway, and resume from the snapshot's recording
// 6.2: a bigger boost (was +400% damage, hull bonus 40): FR_VER 3 moves Power Nodes, which reshuffles the run's dice, and the random
// player then fell at Wave 11 on seed 4; this keeps the bounty and jump door exercised whatever the dice. 6.4: +3000% (was +1500%):
// FR_VER 4 draws generated Anomalies, another reshuffle, and seed 4 lost to the Wave 20 bounty
const boost = S => Object.defineProperty(S.Hooks, 'log', { enumerable: false, configurable: true, writable: true, value: t => { if (/^Run started/.test(t)) { S.G.runMods.dmg = (S.G.runMods.dmg || 0) + 3000; S.G.core.hpBonus = 200; S.recomputeAll(); S.G.core.hp = S.G.core.max; } } });
function playDaily(S, seed, maxw, mark) {
  const R = rng(seed), sp0 = S.dailySpec('2026-11-0' + seed);
  const G = S.newRun({ seed: sp0.seed, chaos: sp0.chaos, startWave: 1, daily: sp0, frontier: 1, huntBuild: { tal: {}, caps: [], remnants: [], lvl: 40 }, nemesis: sp0.nemesis, sector: sp0.sector });
  let guard = 0, flights = 0, docks = 0, moves = 0, doors = 0;
  while (!G.over && G.wave < maxw && guard++ < 600000) {
    if (G.draft) { S.act('boon', Math.floor(R() * G.draft.length)); continue; }
    if (G.huntChoice) { const D = G.huntChoice.doors; if (S.act('push', D ? 0 : undefined)) doors++; continue; }
    if (G.anomOffers) S.act('stab');
    if (G.checkpoint && !G.enemies.length) { S.act('cpResume', 3 + R() * 10); continue; }
    if (guard % 25 === 0) {
      const x = R();
      if (x < 0.4 && S.gridFree() > 0) { const sp = spots(S, G); if (sp.length) { const [tx, ty] = sp[Math.floor(R() * sp.length)]; S.act('build', ['pulse', 'rail', 'cryo', 'missile', 'pulse'][Math.floor(R() * 5)], tx, ty); } }
      else if (x < 0.62 && G.towers.length) { const t = G.towers[Math.floor(R() * G.towers.length)]; S.act('up', t.x, t.y, t.lvl === 3 ? 1 : null); }
      else if (x < 0.66) S.act('core', ['weapon', 'shield', 'uplink'][Math.floor(R() * 3)]);
      else if (x < 0.71 && G.towers.length > 3) { const t = G.towers[Math.floor(R() * G.towers.length)], sp = spots(S, G); if (sp.length && S.act('frMove', t.x, t.y, ...sp[Math.floor(R() * sp.length)])) moves++; }
      else if (x < 0.8 && S.frCanFly() && G.enemies.length > 2) {
        const c = S.frCands(), tw = G.towers.filter(t => !['pylon', 'forge', 'snare'].includes(t.type)).sort((a, b) => b.dmgDone - a.dmgDone || a.id - b.id).find(t => c.includes(S.tIdx(t.x, t.y)) && S.frPlan(t.x, t.y));
        if (tw && S.act('frFly', tw.x, tw.y)) { flights++; docks++; if (mark && !mark.tick && G.frFly && G.frFly.dur > 0.5) mark.arm = G.tick + 8; }
      }
      else if (x < 0.83) S.act('call');
    }
    if (mark && mark.arm && G.tick === mark.arm && G.frFly) { mark.tick = G.tick; mark.hash = S.runHash(); S.snapshotRun(G.wave); mark.snap = JSON.parse(JSON.stringify(S.PROF.runSnap)); }
    if (!G.draft && !G.huntChoice && !(G.checkpoint && !G.enemies.length)) S.simStep(S.SIM_STEP);
  }
  return { G, flights, docks, moves, doors };
}
for (const seed of [4, 6]) {
  const S = fresh(); boost(S); const mark = {};
  const { G, flights, docks, moves, doors } = playDaily(S, seed, Math.max(MAXW, 24), mark);
  const end = { tick: G.tick, wave: G.wave, score: Math.round(G.score), hash: S.runHash() };
  ok(G.fr === 1 && G.daily && flights >= 2 && docks >= 2 && moves >= 2, `daily ${seed}: Frontier Daily Hunt to Wave ${G.wave} with ${flights} lift-offs (${docks} docks), ${moves} moves, ${G.bounties.length} bounties, ${doors} doors`);
  if (seed === 4) ok(G.bounties.length >= 1 && doors >= 1, `daily ${seed}: claimed the bounty and pushed through a jump door`); else ok(true, `daily ${seed}: ${G.over ? 'the run ended (the replay covers game over)' : 'still running'}`);
  // a hunt code is the recording as JSON
  const rec = JSON.parse(JSON.stringify({ opts: G.recOpts, inputs: G.inputs, end: G.tick }));
  ok(rec.opts.frontier === 1 && rec.opts.daily && rec.opts.rows === S.frRows(2) && rec.opts.frV === S.FR_VER, 'the recording carries the Daily, the Frontier flag, its version and the board');
  const S2 = fresh(); boost(S2); const r2 = S2.replayRun(rec, { quiet: true, until: G.over ? Infinity : G.tick });
  ok(S2.runHash() === end.hash && r2.wave === end.wave && r2.score === end.score && r2.tick === end.tick && S2.G.fr === 1, `daily ${seed}: replay ${r2.wave}/${r2.score}/${S2.runHash()} vs ${end.hash}`);
  ok(!!mark.tick && !!mark.snap && !!mark.snap.rec && mark.snap.rec.opts.frontier === 1, `daily ${seed}: snapshot mid-flight (tick ${mark.tick}) carries its recording`);
  if (mark.snap && mark.snap.rec) { // the Daily resume path: replay the snapshot's recording to its end
    const S3 = fresh(); boost(S3); S3.replayRun(mark.snap.rec, { quiet: true, until: mark.snap.rec.end });
    ok(S3.runHash() === mark.hash && S3.G.tick === mark.tick && !!S3.G.frFly, `daily ${seed}: resume by replay lands mid-flight on the same state (${S3.runHash()} vs ${mark.hash})`);
  }
}
console.log(`frontier.js: ${n - fails} passed, ${fails} failed`);
console.log(fails ? 'FAILED: [frontier]' : 'FAILED: []');
process.exitCode = fails ? 1 : 0;
