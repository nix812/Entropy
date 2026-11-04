// 6.2 qolA sim rules (FR_VER 3): Power Nodes stay out of wormhole no-build zones, support towers grow with the attack towers
// they serve, and a 6.1.0 (frV 2) Frontier recording still replays bit for bit.
// usage: node test/qola.js   (V=1 prints every check)
const { load } = require('./harness.js'), fs = require('fs');
let fails = 0, n = 0;
const ok = (c, msg) => { n++; if (!c) { fails++; console.log('FAIL ' + msg); } else if (process.env.V) console.log('ok   ' + msg); };
const fresh = () => { const S = load(); S.PROF = S.defaultProfile(); S.PROF.bestWave = 80; S.PROF.xp = 4e6; return S; };
const inZone = (S, G, q) => G.map.lanes.some(L => { const p = L.tiles[0]; return (q.x - p.x) ** 2 + (q.y - p.y) ** 2 < S.FRONTIER.wormBuild ** 2; });
// open every wormhole the run will get (prepareWave grows the sector, adds the lane and places nodes)
const openAll = (S, G, upto) => { for (let w = 1; w <= upto; w++) { G.wave = w; S.prepareWave(w); } };

// ---- 1. the rules version
{
  const S = fresh(), G = S.newRun({ seed: 1, chaos: 1, frontier: 1 });
  ok(S.FR_VER === 3 && G.frV === 3 && G.recOpts.frV === 3, `a new Frontier run records frV ${G.recOpts.frV}`);
  const O = S.newRun({ seed: 1, chaos: 1, frontier: 1, v: '6.1.0', frV: 2, hk: S.HOOK_VER }); ok(O.frV === 2, 'a 6.1 recording keeps frV 2');
}

// ---- 2. Power Nodes never inside a no-build zone (start, sector growth, wormholes detected later); frV 2 did allow it
{
  let bad3 = 0, bad2 = 0, nodes3 = 0, moved = 0;
  for (let seed = 1; seed <= 40; seed++) for (const chaos of [1, 2]) {
    const S = fresh(), G = S.newRun({ seed, chaos, frontier: 1 }); const logs = []; S.Hooks.log = t => logs.push(t);
    openAll(S, G, 70);
    bad3 += G.nodes.filter(q => inZone(S, G, q)).length; nodes3 += G.nodes.length; moved += logs.filter(t => /moved out of a wormhole zone/.test(t)).length;
    const S2 = fresh(), G2 = S2.newRun({ seed, chaos, frontier: 1, v: '6.1.0', frV: 2, hk: S2.HOOK_VER });
    openAll(S2, G2, 70); bad2 += G2.nodes.filter(q => inZone(S2, G2, q)).length;
  }
  ok(bad3 === 0 && nodes3 > 300, `frV 3: no Power Node in a no-build zone over 80 runs, every wormhole open (${nodes3} nodes, ${moved} moves)`);
  ok(bad2 > 0, `frV 2 (6.1 recordings) keeps the old placement: ${bad2} nodes sat in a zone`);
}

// ---- 3. a wormhole detected next to a node: the node moves; one under a tower stays until the tower leaves
{
  const S = fresh(), G = S.newRun({ seed: 9, chaos: 1, frontier: 1 }); G.credits = 1e7;
  const p = G.map.lanes[0].tiles[0], R = G.region;
  const near = []; for (let y = R.y0; y < R.y1; y++) for (let x = R.x0; x < R.x1; x++) { const d2 = (x - p.x) ** 2 + (y - p.y) ** 2; if (d2 >= 4 && d2 < 16 && G.map.tiles[S.tIdx(x, y)] === 0 && !G.nodes.some(q => q.x === x && q.y === y)) near.push({ x, y }); }
  ok(near.length >= 2, 'test setup: two open tiles inside the main wormhole zone');
  const [a, b] = near; const before = G.nodes.length;
  // a tower that stood there before the zone existed (as when a wormhole is detected next to it): put it in directly
  S.setNodes(G.nodes.concat([a, b]));
  const t = { id: 999, type: 'pulse', x: b.x, y: b.y }; G.towerAt[S.tIdx(b.x, b.y)] = t;
  const m = S.frNodeFix();
  ok(m === 1 && !S.isNode(a.x, a.y) && S.isNode(b.x, b.y) && G.nodes.length === before + 2, 'the open node moves elsewhere; the one under a tower stays');
  ok(G.nodes.filter(q => !(q.x === b.x && q.y === b.y)).every(q => !inZone(S, G, q)), 'the replacement is outside every zone');
  delete G.towerAt[S.tIdx(b.x, b.y)]; S.frNodeFix();
  ok(!S.isNode(b.x, b.y) && G.nodes.every(q => !inZone(S, G, q)) && G.nodes.length === before + 2, 'once the tower leaves, that node moves too');
  // Node Beacon: refused inside a zone, fine outside it
  G.market = G.market || {}; G.placing = 'beacon';
  ok(S.marketPlaceNode(a.x, a.y) === false && G.placing === 'beacon', 'a Node Beacon cannot be planted inside a no-build zone');
  const free = []; for (let y = R.y0; y < R.y1; y++) for (let x = R.x0; x < R.x1; x++) if (S.canBuildAt(x, y) && !S.isNode(x, y) && Math.abs(x - G.map.core.x) + Math.abs(y - G.map.core.y) > 3) free.push({ x, y });
  ok(S.marketPlaceNode(free[0].x, free[0].y) === true, 'a Node Beacon outside the zones still works');
}

// ---- 4. support growth
const spotsNear = (S, G, cx, cy, r) => { const out = []; for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (S.canBuildAt(x, y)) out.push({ x, y }); return out; };
function setup(S, opts) {
  const G = S.newRun(opts); G.credits = 1e8; G.gridBonus = 50; S.recomputeAll();
  const L = G.map.lanes[0].tiles, mid = L[Math.floor(L.length * 0.6)];
  const sp = spotsNear(S, G, mid.x, mid.y, 4).sort((p, q) => Math.hypot(p.x - mid.x, p.y - mid.y) - Math.hypot(q.x - mid.x, q.y - mid.y));
  const pyl = sp.shift(); const P = S.buildTower('pylon', pyl.x, pyl.y);
  const atk = []; for (const s of sp) { if (atk.length >= 3) break; if (Math.hypot(s.x - pyl.x, s.y - pyl.y) <= P.s.range - 0.2) { const t = S.buildTower('pulse', s.x, s.y); if (t) atk.push(t); } }
  return { G, P, atk };
}
const up = (S, t, k, spec) => { for (let i = 0; i < k; i++) S.act('up', t.x, t.y, t.lvl === 3 ? (spec || 1) : null); };
{
  const S = fresh(); const { G, P, atk } = setup(S, { seed: 31, chaos: 1, frontier: 1 });
  ok(P && atk.length === 3, `test setup: a Relay Pylon with ${atk.length} Pulse Blasters in its range`);
  const paid = P.invested, aff0 = P.affixes.length;
  up(S, atk[0], 1); ok(P.lvl === 1, 'average LV 1.33 → the Pylon stays LV 1');
  up(S, atk[1], 1); up(S, atk[2], 1);
  ok(P.lvl === 2 && P.invested === paid && P.freeLv === 1 && P.affixes.length === aff0 + 1, 'every attack tower at LV 2 → the Pylon grows to LV 2 for free (an affix, no sell value)');
  ok(S.sellRefund(P) === Math.round(paid * 0.7) || S.sellRefund(P) <= paid, 'the sell value counts only what was paid');
  for (const t of atk) up(S, t, 1); ok(P.lvl === 3 && !P.grow, 'all at LV 3 → Pylon LV 3');
  for (const t of atk) up(S, t, 1, 1); ok(P.lvl === 3 && P.grow === 1 && !P.spec, 'all at LV 4 → the Pylon stops at LV 3: its Specialization is a pick (grow flag)');
  const cr = G.credits; ok(S.act('up', P.x, P.y, 2) && P.lvl === 4 && P.spec === 2 && G.credits === cr && P.invested === paid && !P.grow, 'the grown Specialization is free');
  for (const t of atk) up(S, t, 1); ok(P.lvl === 5 && P.invested === paid, 'all at LV 5 → the Pylon grows to LV 5');
  for (const t of atk.slice(1)) S.act('sell', t.x, t.y); ok(P.lvl === 5, 'selling the towers never lowers it');
  const cr2 = G.credits; ok(S.act('up', P.x, P.y, null) && P.asc === 1 && G.credits < cr2, 'above the grown level it upgrades as before (paid Ascension)');
  // manual upgrades above the target stay
  const S2 = fresh(); const B = setup(S2, { seed: 32, chaos: 1, frontier: 1 }); up(S2, B.P, 2); ok(B.P.lvl === 3 && B.P.invested > B.P.affixes.length, 'a support tower bought above its towers keeps its level');
  // the snapshot keeps the pick and the free levels
  const S3 = fresh(); const C = setup(S3, { seed: 33, chaos: 1, frontier: 1 }); for (const t of C.atk) up(S3, t, 4, 1);
  ok(C.P.lvl === 3 && C.P.grow === 1, 'test setup: a Pylon waiting on its free Specialization');
  S3.snapshotRun(); const snap = JSON.parse(JSON.stringify(S3.PROF.runSnap)); S3.resumeRun(snap);
  const P3 = S3.G.towers.find(t => t.type === 'pylon'); ok(P3 && P3.grow === 1 && P3.freeLv === 2 && P3.lvl === 3, 'resume keeps the free pick and the free levels');
  // a Snare Beacon grows the same way
  const S4 = fresh(); const G4 = S4.newRun({ seed: 34, chaos: 1, frontier: 1 }); G4.credits = 1e8; G4.gridBonus = 50; S4.recomputeAll();
  const L4 = G4.map.lanes[0].tiles, m4 = L4[Math.floor(L4.length * 0.6)], sp4 = spotsNear(S4, G4, m4.x, m4.y, 3);
  const N = S4.buildTower('snare', sp4[0].x, sp4[0].y), A4 = sp4.slice(1, 4).map(s => S4.buildTower('rail', s.x, s.y)).filter(Boolean);
  for (const t of A4) up(S4, t, 2); ok(N && N.lvl === 3 && N.freeLv === 2, `a Snare Beacon grows too (LV ${N && N.lvl})`);
}
// ---- 5. frV 2 runs (6.1 recordings): no growth, nothing moves
{
  const S = fresh(); const { P, atk } = setup(S, { seed: 31, chaos: 1, frontier: 1, v: '6.1.0', frV: 2, hk: S.HOOK_VER });
  for (const t of atk) up(S, t, 2); ok(P.lvl === 1 && !P.freeLv, 'frV 2: the Pylon does not grow');
}
// ---- 6. replays: the 6.1.0 fixture still matches; a frV 3 run with growth replays exactly
{
  const F = JSON.parse(fs.readFileSync(__dirname + '/fixtures/rec_610_fr2.json', 'utf8'));
  const S = fresh(); S.replayRun({ opts: F.opts, inputs: F.inputs }, { quiet: true, until: F.end.over ? Infinity : F.end.tick }); const G = S.G;
  ok(F.opts.frV === 2 && S.runHash() === F.end.hash && G.wave === F.end.wave && Math.round(G.score) === F.end.score && JSON.stringify(G.nodes.map(q => [q.x, q.y])) === JSON.stringify(F.end.nodes),
    `the 6.1.0 Frontier recording (frV 2, wave ${F.end.wave}) replays bit for bit (${S.runHash()} vs ${F.end.hash})`);
}
{
  const S = fresh(); const { G, P, atk } = setup(S, { seed: 41, chaos: 1, frontier: 1 });
  // the setup built directly; do it again through act() so the recording holds everything
  const S1 = fresh(); const G1 = S1.newRun({ seed: 41, chaos: 1, frontier: 1 }); G1.credits = 1e8; G1.gridBonus = 50; S1.recomputeAll();
  for (const t of [P].concat(atk)) S1.act('build', t.type, t.x, t.y);
  for (let i = 0; i < 4000 && !G1.over; i++) {
    if (G1.draft) { S1.act('boon', 0); continue; } if (G1.checkpoint && !G1.enemies.length) { S1.act('cpResume', 3); continue; }
    if (i % 400 === 50) for (const t of G1.towers) if (t.type === 'pulse') S1.act('up', t.x, t.y, t.lvl === 3 ? 1 : null);
    if (i % 400 === 60) { const p = G1.towers.find(t => t.grow); if (p) S1.act('up', p.x, p.y, 1); }
    S1.simStep(S1.SIM_STEP);
  }
  const P1 = G1.towers.find(t => t.type === 'pylon');
  ok(P1 && P1.lvl >= 4 && P1.freeLv >= 2, `test run: the Pylon grew to LV ${P1 && P1.lvl}`);
  // the credits and grid boost came from outside act(): apply them the same way at start in the rebuild
  const S2 = fresh(); const keep = S2.newRun; S2.Hooks.log = t => { if (/^Run started/.test(t)) { S2.G.credits = 1e8; S2.G.gridBonus = 50; S2.recomputeAll(); } };
  Object.defineProperty(S2.Hooks, 'log', { enumerable: false });
  S2.replayRun({ opts: G1.recOpts, inputs: G1.inputs }, { quiet: true, until: G1.tick }); const G2 = S2.G;
  const P2 = G2.towers.find(t => t.type === 'pylon');
  ok(S2.runHash() === S1.runHash() && P2 && P2.lvl === P1.lvl && P2.spec === P1.spec, `a frV 3 run with support growth replays bit for bit (${S2.runHash()} vs ${S1.runHash()})`);
}
console.log(`${n - fails}/${n} checks · FAILED: [${fails ? fails + ' failed' : ''}]`);
process.exit(fails ? 1 : 0);
