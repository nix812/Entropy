// 6.5 sky65: the Black Hole event and fog of war, headless.
// usage: node test/sky65.js   (prints ok/FAIL lines and "N/M checks · FAILED: [...]")
const { load } = require('./harness.js'), fs = require('fs');
const { play, prof, OPTS } = require('./sky65_mkfix.js');
let n = 0; const failed = [];
const ok = (c, msg) => { n++; if (!c) failed.push(msg); console.log((c ? 'ok   ' : 'FAIL ') + msg); };
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-9);
const fresh = () => { const S = load(); prof(S); return S; };

// ---- 1. the event exists only at frV 5: older rules roll exactly as before
{
  const S = fresh();
  const E = S.EVENTS.find(e => e.id === 'hole');
  ok(!!E && E.fr === 5 && E.from === 10, 'Black Hole is an event from Wave 10, gated on fr 5');
  ok(S.FR_VER >= 5, 'FR_VER is 5 or later');
  const rolls = (frV, strip) => { const S2 = fresh(); let G = S2.newRun({ seed: 77, chaos: 2, frontier: 1, v: '6.4.0', frV, hk: S2.HOOK_VER, sector: 'ghost' });
    if (strip) { const i = S2.EVENTS.findIndex(e => e.id === 'hole'); S2.EVENTS.splice(i, 1); }
    const out = []; for (let w = 5; w < 400; w++) out.push(S2.rollEvents(w).list.map(e => e.id).join('+')); return out; };
  const a = rolls(4, false), b = rolls(4, true), c = rolls(5, false);
  ok(a.join() === b.join(), 'frV 4: 395 event rolls are identical with or without the new entry (same draws, same picks)');
  ok(!a.some(x => x.includes('hole')), 'frV 4: the Black Hole never rolls');
  ok(c.filter(x => x.includes('hole')).length > 5, `frV 5 Ghost Lanes: it rolls (${c.filter(x => x.includes('hole')).length} of 395 waves)`);
  ok(a.join() !== c.join(), 'frV 5 rolls differ (the new entry is in the pool)');
  let G = S.newRun({ seed: 7, chaos: 1, frontier: 1, v: '6.4.0', frV: 4, hk: S.HOOK_VER });
  ok(G.fogEx === null && !G.hole, 'a frV 4 run has no fog grid and no hole');
  G = S.newRun({ seed: 7, chaos: 1, cols: 44 }); ok(G.fogEx === null, 'a Classic run has no fog grid');
  G = S.newRun({ tut: S.TUT ? undefined : undefined, seed: 7, chaos: 1, frontier: 1 }); ok(!!G.fogEx && G.frV >= 5, 'a new Frontier run is frV 5+ with a fog grid');
}
// ---- 2. spawn, drift, hold, collapse
{
  const S = fresh(); const G = S.newRun({ seed: 1234, chaos: 1, frontier: 1 }); G.wave = 12;
  const R = G.region; S.holeSpawn(); const h = G.hole;
  const inR = (x, y) => x >= R.x0 && y >= R.y0 && x <= R.x1 && y <= R.y1;
  ok(!!h && h.ph === 0 && !inR(h.x, h.y), `it spawns past the sector edge (${h.x.toFixed(1)}, ${h.y.toFixed(1)})`);
  ok(inR(h.tx, h.ty), 'its target is inside the sector');
  const roadD = Math.min(...G.map.lanes.flatMap(L => L.tiles.map(p => Math.hypot(p.x + 0.5 - h.tx, p.y + 0.5 - h.ty))));
  ok(roadD <= 1.5, `its target is on or next to a road (${roadD.toFixed(2)} tiles)`);
  const back = Math.hypot(h.tx - h.x, h.ty - h.y);
  let t = 0, tHold = null, tOut = null, tEnd = null; const dt = 1 / 30;
  while (G.hole && t < 200) { S.holeUpdate(dt); t += dt; if (G.hole && G.hole.ph === 1 && tHold === null) tHold = t; if (G.hole && G.hole.ph === 2 && tOut === null) tOut = t; if (!G.hole) tEnd = t; }
  ok(near(tHold, back / S.HOLE.inSpd, 0.05), `drifts in at ${S.HOLE.inSpd} tiles/s (${tHold.toFixed(2)} s for ${back.toFixed(1)} tiles)`);
  ok(near(tOut - tHold, S.HOLE.hold, 0.05), `holds ${S.HOLE.hold} s`);
  ok(near(tEnd - tOut, S.HOLE.out, 0.05), `collapses over ${S.HOLE.out} s, then it is gone`);
  G.wave = 12; S.holeSpawn(); const h1 = JSON.stringify(G.hole); S.holeSpawn(); ok(JSON.stringify(G.hole) === h1, 'a second roll while one is out does nothing');
}
// ---- 3. enemy numbers: dilation and the drag along the road
{
  const S = fresh(); const G = S.newRun({ seed: 99, chaos: 1, frontier: 1 }); G.wave = 12;
  const L = G.map.lanes[0], e = S.spawnEnemy('drone', { d: 6 }); e.L = L; e.d = 6; S.lanePos(L, 6, e);
  const P = S.lanePos(L, 6.25, { seg: 0 }), ux = P.x - e.x, uy = P.y - e.y, ul = Math.hypot(ux, uy);
  const put = (dist, ahead, k) => { G.hole = { x: e.x + (ahead ? ux : -ux) / ul * dist, y: e.y + (ahead ? uy : -uy) / ul * dist, ph: k ? 2 : 1, t: 0, k: k || 1, dx: 1, dy: 0, tx: 0, ty: 0 }; return S.holeEnemy(e); };
  let m = put(0.001, true); ok(near(e.hk, 0.5, 0.001), `at the centre: moves and acts at 50% (time factor ${e.hk.toFixed(3)})`);
  m = put(3, true); ok(near(e.hk, 0.75, 1e-6) && near(m, 0.75 * (1 + 0.6 * 0.5), 1e-3), `3 tiles away, heading in: time ×0.75, speed ×${m.toFixed(3)} (×0.75 dilation × 1.3 drag)`);
  m = put(3, false); ok(near(m, 0.75 * (1 - 0.6 * 0.5), 1e-3), `3 tiles away, heading out: speed ×${m.toFixed(3)} (×0.75 × 0.7)`);
  m = put(0.2, false); ok(near(m, S.HOLE.floor, 1e-9), `near the centre heading out: never under ${S.HOLE.floor * 100}% speed (${m.toFixed(3)})`);
  m = put(6.5, true); ok(m === 1 && e.hk === 1, 'outside the 6 tile reach: no effect');
  e.boss = 'behemoth'; m = put(3, true); ok(near(e.hk, 0.875, 1e-6) && near(m, 0.875 * (1 + 0.6 * 0.25), 1e-3), `a boss feels half (time ×${e.hk.toFixed(3)}, speed ×${m.toFixed(3)})`); e.boss = null;
  m = put(3, true, 0.5); ok(near(e.hk, 1 - 0.5 * 0.5 * 0.5, 1e-6), 'collapsing: effects scale with its strength');
  // a walk through the hole: the enemy stays on its road and takes longer to pass
  const walk = (withHole) => { const S2 = fresh(), G2 = S2.newRun({ seed: 99, chaos: 1, frontier: 1 }); G2.wave = 12; const L2 = G2.map.lanes[0]; G2.queue = []; G2.enemies = [];
    const q = S2.spawnEnemy('tank', { d: 1 }); q.L = L2; q.d = 1; q.hp = q.maxHp = 1e12; const mid = S2.lanePos(L2, Math.min(L2.len - 4, 14), { seg: 0 });
    G2.hole = withHole ? { x: mid.x + 0.7, y: mid.y + 0.4, tx: 0, ty: 0, dx: 0, dy: 0, ph: 1, t: 0, k: 1 } : null; G2.towers = []; let tIn = 0, off = 0, tick = 0;
    while (!q.dead && q.d < L2.len - 1 && tick++ < 30 * 400) { if (G2.hole) { G2.hole.t = 0; } S2.simStep(1 / 30); if (Math.hypot(q.x - mid.x, q.y - mid.y) < 6) tIn += 1 / 30; const p = S2.lanePos(L2, q.d, { seg: 0 }); off = Math.max(off, Math.hypot(p.x - q.x, p.y - q.y)); }
    return { tIn, off }; };
  const w0 = walk(false), w1 = walk(true);
  ok(w1.tIn > w0.tIn * 1.3, `a tank spends ${w1.tIn.toFixed(1)} s near the hole against ${w0.tIn.toFixed(1)} s without it`);
  ok(w1.off < 1e-6, 'it never leaves its road (position always on its lane)');
}
// ---- 4. towers: the ring fires faster, the horizon slower
{
  const S = fresh(); const G = S.newRun({ seed: 99, chaos: 1, frontier: 1 });
  const t = { cx: 10, cy: 10 }, at = d => { G.hole = { x: 10 + d, y: 10, ph: 1, k: 1 }; return S.holeRate(t); };
  ok(near(at(1), 0.5) && near(at(2.4), 0.5), 'within 2.5 tiles: −50% Attack Speed');
  ok(near(at(2.6), 1.4) && near(at(4), 1.4) && near(at(6), 1.4), '2.5 to 6 tiles: +40% Attack Speed');
  ok(at(6.1) === 1, 'past 6 tiles: no change');
  G.hole.k = 0.5; G.hole.x = 14; ok(near(S.holeRate(t), 1.2), 'collapsing at half strength: +20%');
  G.hole = { x: 14, y: 10, ph: 1, k: 1 }; const tw = { cx: 10, cy: 10, s: { el: 'K' }, disabled: 0, buff: {} };
  const c = S.towerConditions(Object.assign(tw, { s: { el: 'K' } })).map(o => o.t).join(' | ');
  ok(c.includes('Black Hole edge: +40% Attack Speed'), `the tower panel says so (${c})`);
  // the real fire loop: a Pulse Blaster in the ring fires 1.4× as often as one outside it
  const shots = (d) => { const S2 = fresh(), G2 = S2.newRun({ seed: 99, chaos: 1, frontier: 1 }); G2.credits = 1e6; const L = G2.map.lanes[0], p = L.tiles[Math.floor(L.tiles.length / 2)];
    let spot = null; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!spot && S2.canBuildAt(p.x + dx, p.y + dy)) spot = [p.x + dx, p.y + dy];
    S2.act('build', 'pulse', spot[0], spot[1]); const T = G2.towers[0]; G2.hole = d == null ? null : { x: T.cx + d, y: T.cy, ph: 1, k: 1, t: 0, dx: 0, dy: 0, tx: 0, ty: 0 };
    G2.queue = []; G2.enemies = []; let fired = 0; const e = S2.spawnEnemy('tank', { d: 0 }); e.hp = e.maxHp = 1e15; e.spd = 0;
    e.d = L.cum[Math.floor(L.tiles.length / 2)]; S2.lanePos(L, e.d, e);
    for (let i = 0; i < 30 * 20; i++) { if (G2.hole) G2.hole.t = 0; const before = T.cd; S2.simStep(1 / 30); if (T.cd > before + 0.5) fired++; } return fired; };
  const f0 = shots(null), f1 = shots(4), f2 = shots(1);
  ok(near(f1 / f0, 1.4, 0.08) && near(f2 / f0, 0.5, 0.08), `a Pulse Blaster fires ${f0} shots in 20 s, ${f1} in the ring (×${(f1 / f0).toFixed(2)}), ${f2} inside the horizon (×${(f2 / f0).toFixed(2)})`);
  // boss sizing: a ring tower's extra damage does not raise the defence's peak (G.power, which sizes bosses)
  { const S2 = fresh(), G2 = S2.newRun({ seed: 99, chaos: 1, frontier: 1 }); G2.credits = 1e6; const L = G2.map.lanes[0], p = L.tiles[8];
    let spot = null; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!spot && S2.canBuildAt(p.x + dx, p.y + dy)) spot = [p.x + dx, p.y + dy];
    S2.act('build', 'pulse', spot[0], spot[1]); const T = G2.towers[0]; G2.hole = { x: T.cx + 4, y: T.cy, ph: 1, k: 1, t: 0, dx: 0, dy: 0, tx: 0, ty: 0 };
    G2.queue = []; G2.enemies = []; T.dps = 140; T.dpsAcc = 0; G2.power = 0; G2.dpsClock = 0.999; S2.simStep(1 / 30);
    ok(near(G2.power, 100, 1e-6), `boss sizing ignores the ring bonus (a tower at 140 DPS ×1.4 counts as ${G2.power.toFixed(1)})`); }
}
// ---- 5. fog of war: sources, explored grid, snapshots, and no effect on the sim
{
  const S = fresh(); let G = S.newRun({ seed: 4242, chaos: 1, frontier: 1 });
  const src = S.fogSources(); ok(src.length === 3 * (1 + G.towers.length + (G.probe && G.probe.alive && G.probe.vis > 0 ? 1 : 0)) && /* 6.5 merge: the real probe is a source too */ src[2] >= S.FOG.core, `sources: the core (radius ${src[2]} = its gun range)`);
  G.probe = { x: 3, y: 3, alive: false, vis: 5 }; ok(S.fogSources().length === 3, 'a dead probe gives no vision');
  G.probe.alive = true; ok(S.fogSources().slice(-3).join() === '3,3,5', 'a live probe gives vision at G.probe.vis');
  const before = G.fogEx.reduce((a, b) => a + b, 0); S.fogMark(S.fogSources()); const after = G.fogEx.reduce((a, b) => a + b, 0);
  ok(after > before && G.fogEx[3 * S.COLS + 3] === 1, `the probe explores ground (${before} → ${after} tiles)`);
  ok(G.map.lanes.every(L => L.tiles.every(p => G.fogEx[p.y * S.COLS + p.x] === 1)), 'every road tile is known');
  G.probe = null;
  S.snapshotRun(G.wave + 1); const snap = JSON.parse(JSON.stringify(S.PROF.runSnap)); const ex0 = Array.from(G.fogEx);
  ok(typeof snap.fog === 'string' && snap.fog.length < 1500, `the snapshot carries explored tiles as run lengths (${snap.fog.length} chars)`);
  S.resumeRun(snap); ok(ex0.every((v, i) => !v || S.G.fogEx[i] === 1), 'a resume keeps every explored tile');
  delete snap.fog; S.resumeRun(snap); ok(!!S.G.fogEx && S.G.fogEx[S.G.map.core.y * S.COLS + S.G.map.core.x] === 1, 'an older snapshot without fog resumes with what the core shows');
  // with a hole out, the snapshot carries it
  G = S.newRun({ seed: 4242, chaos: 1, frontier: 1 }); G.wave = 12; S.holeSpawn(); S.snapshotRun(G.wave + 1); const sn2 = JSON.parse(JSON.stringify(S.PROF.runSnap));
  S.resumeRun(sn2); ok(!!S.G.hole && near(S.G.hole.tx, sn2.hole.tx), 'a black hole still out comes back on resume');
  // the sim never reads fog: the same run with the fog grid removed ends in the same state
  const runTo = () => { const S2 = fresh(); const G2 = play(S2, Object.assign({ seed: 6510 }, OPTS), 3, 18); return S2.runHash() + ':' + G2.wave; };
  const a = runTo();
  const b = (() => { const S2 = fresh(); const opts = Object.assign({ seed: 6510 }, OPTS); const orig = S2.newRun; S2.newRun = o => { const g = orig(o); g.fogEx = null; return g; }; play(S2, opts, 3, 18); return S2.runHash() + ':' + S2.G.wave; })();
  ok(a === b, `fog is presentation only: a run with and without the fog grid ends identically (${a})`);
}
// ---- 6. replays: the frV 5 fixture (a black hole rolls) matches bit for bit; a fresh run replays and resumes
{
  const F = JSON.parse(fs.readFileSync(__dirname + '/fixtures/rec_650_sky65.json', 'utf8'));
  const S = fresh(); S.replayRun({ opts: F.opts, inputs: F.inputs }, { quiet: 1, until: F.end.tick }); const G = S.G;
  ok(F.opts.frV === 5 && F.end.holes >= 1, `the fixture is frV 5 and has ${F.end.holes} black hole(s)`);
  ok(S.runHash() === F.end.hash && G.wave === F.end.wave && Math.round(G.score) === F.end.score && (G.stats.holes || 0) === F.end.holes, `the fixture replays bit for bit (wave ${G.wave}, hash ${S.runHash()})`);
  ok(S.fogPack(G.fogEx) === F.end.fog, 'the explored fog matches too');
  const S2 = fresh(); const G2 = play(S2, Object.assign({ seed: 6500 }, OPTS), 65, 30, 1); const h = S2.runHash(), rec = { opts: JSON.parse(JSON.stringify(G2.recOpts)), inputs: JSON.parse(JSON.stringify(G2.inputs)) };
  const S3 = fresh(); S3.replayRun(rec, { quiet: 1, until: G2.tick }); ok(S3.runHash() === h, 'a fresh frV 5 run replays to the same hash');
  for (const f of ['rec_640_fr4.json', 'rec_640_tower64.json']) { const R = JSON.parse(fs.readFileSync(__dirname + '/fixtures/' + f, 'utf8')); const S4 = fresh(); S4.PROF.bestWave = 80; S4.PROF.xp = 4e6; if (f.includes('fr4')) require('./cards64_mkfix.js').boost(S4);
    S4.replayRun({ opts: R.opts, inputs: R.inputs }, { quiet: 1, until: R.end.over ? Infinity : R.end.tick }); ok(S4.runHash() === R.end.hash && !S4.G.fogEx && !S4.G.hole, `${f} (frV ${R.opts.frV}) still replays bit for bit, with no fog grid or hole`); }
}
console.log(`${n - failed.length}/${n} checks · FAILED: ${JSON.stringify(failed)}`);
