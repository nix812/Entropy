// 6.5 probe65: the probe, loot sites, neutral guards, upgrades, death and rebuild (sim rules gated on G.frV >= 5).
// Checks movement, each site kind, guard fights, the Lance, death and rebuild cost, scaling with the wave, old rules, Daily
// Hunts, snapshots, and replays (a live act() run and the frV 5 fixture). usage: node test/probe65.js
const { load } = require('./harness.js'), fs = require('fs');
const { boost, prof } = require('./probe65_mkfix.js');
let n = 0, fails = 0;
const ok = (c, m) => { n++; console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const near = (a, b, e) => Math.abs(a - b) <= e;
const fresh = () => { const S = load(); prof(S); return S; };
const step = (S, sec) => { for (let i = 0; i < Math.round(sec * 30); i++) S.simStep(1 / 30); };
// a run at a given wave with an empty field (no waves spawn while we test), the probe docked
function setup(S, wave, opts) {
  S.newRun(Object.assign({ seed: 6510, chaos: 1, frontier: 1, startWave: Math.max(1, wave) }, opts || {}));
  const G = S.G; G.wave = wave; G.next = 1e9; G.siteT = 1e9; G.credits = 1e6; G.sites = [];
  const P = G.probe, St = S.prStats(); P.max = P.hp = St.max;
  return G;
}
// a site of kind k at (x, y) with the given guards (copies the spawn rules for HP)
function site(S, k, x, y, guards) {
  const G = S.G, ws = 1 + G.wave / S.PROBE.wS, s = { id: G.eid++, k, x, y, t: 999, life: 999, val: 500, rich: 0, prog: 0, g: [], z: 0, jp: 0 };
  if (k === 'rock') { s.max = s.hp = S.PROBE.rockHp * ws; s.chunks = 0; s.vx = 0; s.vy = 0; s.crystal = 0; }
  if (k === 'cloud') s.ent = 15;
  (guards || []).forEach((gk, j) => { const D = S.PROBE.guard[gk], max = D.hp * Math.pow(ws, 1.2), a = j * 2; s.g.push({ id: G.eid++, k: gk, hp: max, max, a, x: x + Math.cos(a), y: y + Math.sin(a), hx: x + Math.cos(a), hy: y + Math.sin(a), cd: 0, calm: 9, hitT: -9 }); });
  G.sites.push(s); return s;
}
// ---- 1. who gets a probe
{
  const S = fresh(); S.newRun({ seed: 1, chaos: 1, frontier: 1 }); const P = S.G.probe;
  ok(S.G.frV === 5 && P && typeof P.x === 'number' && typeof P.y === 'number' && P.alive === true && typeof P.vis === 'number' && P.vis === 5 && Array.isArray(S.G.sites), 'a new Frontier run has G.probe { x, y, alive, vis } (vision 5 tiles), docked, and a site list');
  S.newRun({ seed: 1, chaos: 1, frontier: 1, frV: 4, v: '6.4.0' }); ok(S.G.probe === null && !S.G.sites.length, 'a frV 4 recording has no probe and no sites');
  S.newRun({ seed: 1, chaos: 1, cols: 44 }); ok(S.G.probe === null, 'a Classic run has no probe');
  S.newRun({ seed: 1, chaos: 1, frontier: 1, tut: 1 }); ok(S.G.probe === null, 'Basic Training has no probe');
  let t = 0; S.newRun({ seed: 1, chaos: 1, frontier: 1, frV: 4, v: '6.4.0' }); while (S.G.wave < 4 && t++ < 40000) { S.simStep(1 / 30); if (S.G.checkpoint) S.resumeCheckpoint(); }
  ok(S.G.probe === null && !S.G.sites.length, 'a frV 4 run plays 4 waves without spawning a site');
}
// ---- 2. Daily Hunts: the same probe for everyone (nothing comes from the profile)
{
  const A = fresh(), B = fresh(); B.PROF.xp = 0; B.PROF.bestWave = 0; B.PROF.settings = Object.assign({}, B.PROF.settings, { sfx: 0 });
  const d = A.dailySpec('2026-11-05'), o = S => ({ seed: d.seed, chaos: d.chaos, startWave: 1, daily: d, frontier: 1, huntBuild: { tal: {}, caps: [], remnants: [], lvl: 40 }, sector: d.sector });
  A.newRun(o(A)); B.newRun(o(B));
  for (let i = 0; i < 30 * 120; i++) { A.simStep(1 / 30); B.simStep(1 / 30); }
  ok(A.G.probe && JSON.stringify(A.G.probe) === JSON.stringify(B.G.probe) && JSON.stringify(A.G.sites) === JSON.stringify(B.G.sites) && A.G.sites.length > 0, `Daily Hunt: identical probe and ${A.G.sites.length} identical sites for two different profiles`);
}
// ---- 3. moving: a straight line at the Engine's speed, recall docks it
{
  const S = fresh(), G = setup(S, 10), P = G.probe, x0 = P.x, y0 = P.y, tx = x0 - 10, ty = y0 + 4;
  ok(S.act('prGo', tx, ty) && !P.home, 'prGo sends it');
  step(S, 1); const d1 = Math.hypot(P.x - x0, P.y - y0);
  ok(near(d1, S.PROBE.up.eng.v[0], 0.08), `1 s flies ${d1.toFixed(2)} tiles (Engine 0: ${S.PROBE.up.eng.v[0]})`);
  step(S, 6); ok(near(P.x, tx, 0.02) && near(P.y, ty, 0.02), 'it stops on the spot it was sent to');
  S.probeUpgrade('eng'); S.probeUpgrade('eng'); S.probeUpgrade('eng'); const xa = P.x, ya = P.y; S.act('prHome'); step(S, 1);
  ok(near(Math.hypot(P.x - xa, P.y - ya), 4, 0.1), 'Engine 3 flies 4 tiles per second');
  step(S, 4); ok(P.home && !P.ret, 'Recall flies home and docks');
  ok(!S.act('prHome'), 'recalling a docked probe does nothing');
  const cx = G.core.x, cy = G.core.y; S.act('prGo', cx - 6, cy); step(S, 1); S.act('prGo', cx, cy); ok(P.ret === 1, 'a send to the core tile is a recall');
}
// ---- 4. wreckage: a quick grab into the cargo; the bank pays only at the core
{
  const S = fresh(), G = setup(S, 10), P = G.probe, s = site(S, 'wreck', P.x - 4, P.y + 3), cr0 = G.credits;
  S.act('prGo', s.x, s.y); ok(P.task === s.id, 'a send onto a site targets it');
  step(S, 2.5 + 0.2); ok(S.siteById(s.id) && s.prog > 0 && s.prog < 1, 'salvage takes time on top of the wreck');
  step(S, 2.5); ok(!S.siteById(s.id) && near(P.cargo.cr, 500, 0.01) && G.credits === cr0, 'after 2.5 s on it the wreck is gone, 500 credits in the hold, none banked yet');
  S.act('prHome'); step(S, 4); ok(P.home && near(G.credits - cr0, 500, 0.6) && P.cargo.cr === 0 && G.stats.pr.trips === 1, 'docking banks the cargo (+500 credits)');
  // Scanner: +10% loot per level
  const s2 = site(S, 'wreck', P.x - 3, P.y); S.probeUpgrade('scan'); S.probeUpgrade('scan'); S.act('prGo', s2.x, s2.y); step(S, 5);
  ok(near(P.cargo.cr, 600, 0.01) && P.vis === S.PROBE.up.scan.v[2], 'Scanner 2: +20% loot (600) and vision 9 tiles');
}
// ---- 5. gas cloud: harvest while inside, the Rig speeds it, static costs hull
{
  const S = fresh(), G = setup(S, 10), P = G.probe, s = site(S, 'cloud', P.x - 5, P.y + 2);
  S.act('prGo', s.x, s.y); step(S, 2.4); const hp0 = P.hp, pg0 = s.prog; step(S, 3);
  ok(near(s.prog - pg0, 3 / S.PROBE.cloudT, 0.01), `3 s inside: ${((s.prog - pg0) * 100).toFixed(0)}% harvested (12 s for all)`);
  ok(near(hp0 - P.hp, P.max * S.PROBE.cloudZap * 3, 0.5), `static: ${(hp0 - P.hp).toFixed(1)} hull in 3 s (1.5% per second)`);
  ok(P.cargo.cr > 0 && P.cargo.ent > 0, 'credits and Entropy trickle into the hold as it drains');
  S.probeUpgrade('rig'); S.probeUpgrade('rig'); S.probeUpgrade('rig'); const pg1 = s.prog; step(S, 1); ok(near(s.prog - pg1, 3 / S.PROBE.cloudT, 0.01), 'Rig 3 harvests 3× as fast');
  step(S, 3); ok(!S.siteById(s.id) && near(P.cargo.cr, 500, 1) && near(P.cargo.ent, 15, 0.1), 'a drained cloud paid its whole value (500 credits, 15 Entropy)');
}
// ---- 6. asteroid: mined in 3 chunks
{
  const S = fresh(), G = setup(S, 10), P = G.probe, s = site(S, 'rock', P.x - 5, P.y);
  S.act('prGo', s.x, s.y); let chunks = [], t = 0; while (S.siteById(s.id) && t++ < 900) { S.simStep(1 / 30); if (s.chunks !== chunks[chunks.length - 1]) chunks.push(s.chunks); }
  const ws = 1 + 10 / S.PROBE.wS, secs = S.PROBE.rockHp * ws / (S.PROBE.mine * ws);
  ok(!S.siteById(s.id) && near(P.cargo.cr, 500, 1) && chunks.join() === '0,1,2', `the rock breaks in 3 chunks (${chunks.join(',')}) worth 500 in total, about ${secs.toFixed(1)} s of mining`);
}
// ---- 7. guards: a drone shoots the probe near its site; without a Lance it can't fight back; with one it wins
{
  const S = fresh(), G = setup(S, 10), P = G.probe, s = site(S, 'wreck', P.x - 6, P.y, ['drone']), g = s.g[0], ws = 1 + 10 / S.PROBE.wS, D = S.PROBE.guard.drone;
  step(S, 2); ok(P.hp === P.max, 'the drone ignores a docked probe 6 tiles away');
  S.act('prGo', s.x + 2, s.y); step(S, 3.5); const hp0 = P.hp; step(S, 6);
  ok(near(hp0 - P.hp, 5 * D.dmg * ws, D.dmg * ws + 0.1) && g.hp === g.max, `6 s inside its reach: ${(hp0 - P.hp).toFixed(0)} damage (${D.dmg} × wave scale per shot, 1 shot per ${D.cd} s), the guard is untouched`);
  S.act('prHome'); step(S, 8); const fullG = g.hp === g.max; S.probeUpgrade('gun');
  const St = S.prStats(), ttk = g.max / St.dps; P.hp = P.max; S.act('prGo', s.x + 2, s.y); let t = 0; while (s.g.length && t++ < 900) S.simStep(1 / 30);
  ok(fullG && !s.g.length && t / 30 >= ttk && t / 30 < ttk + 5, `Lance 1 (${St.dps.toFixed(0)} damage per second) kills a ${g.max.toFixed(0)} HP drone in ${(t / 30).toFixed(1)} s from the dock (${ttk.toFixed(1)} s of fire)`);
  ok(P.cargo.cr > 0 && G.stats.pr.kills === 1, 'a guard kill pays a bounty into the hold');
  ok(S.siteById(s.id) && !s.done, 'the wreck stays after its guard falls');
  // a looted site keeps its living guards until they settle
  const s2 = site(S, 'wreck', P.x + 0.1, P.y + 0.1, ['brute']); S.probeUpgrade('hull'); S.probeUpgrade('hull'); P.hp = P.max; S.act('prGo', s2.x, s2.y); step(S, 2.8);
  ok(s2.done === 1 && S.siteById(s2.id) && s2.g.length === 1, 'a guarded wreck grabbed under fire: the loot is gone, the brute stays');
  S.act('prHome'); step(S, 12); ok(!S.siteById(s2.id), 'with the probe gone, the brute settles and the site leaves');
}
// ---- 8. death and rebuild: cargo drops as a wreck, the price grows with the wave and the upgrades, it takes 40 s
{
  const S = fresh(), G = setup(S, 20), P = G.probe; S.probeUpgrade('gun'); S.probeUpgrade('hull');
  const s = site(S, 'wreck', P.x - 6, P.y + 1, ['brute', 'brute', 'drone']); P.cargo.cr = 777; P.cargo.ch = 1;
  S.act('prGo', s.x + 1.5, s.y); let t = 0; while (P.alive && t++ < 30 * 120) S.simStep(1 / 30);
  ok(!P.alive && G.stats.pr.lost === 1 && P.task === 0, `three guards kill the probe (${(t / 30).toFixed(1)} s)`);
  const L = G.sites.find(o => o.k === 'lost');
  ok(L && near(L.val * S.prStats().assay, 777, 0.01) && L.ch === 1 && P.cargo.cr === 0, 'its cargo (777 credits, 1 charge) lies in a probe wreck');
  const cost = S.prRebuildCost(), want = Math.round((S.PROBE.rb0 + S.PROBE.rbW * 20) * (1 + S.PROBE.rbLv * 2));
  ok(cost === want && cost === Math.round(360 * 1.3), `rebuild at Wave 20 with 2 upgrade levels: ${cost} credits ((120 + 12 × 20) × 1.3)`);
  G.wave = 40; ok(S.prRebuildCost() === Math.round(600 * 1.3), 'Wave 40: 780 credits'); G.wave = 20;
  ok(!S.act('prGo', 5, 5) && !S.act('prHome'), 'a lost probe takes no orders');
  G.credits = cost - 1; ok(!S.act('prBuild'), 'no rebuild without the credits');
  G.credits = cost + 50; ok(S.act('prBuild') && G.credits === 50 && P.rb === S.PROBE.rbT && !P.alive, 'rebuild: pays and starts 40 s in the yard');
  ok(!S.act('prBuild'), 'one rebuild at a time');
  step(S, 39); ok(!P.alive, 'still in the yard at 39 s');
  step(S, 1.1); ok(P.alive && P.home && P.hp === P.max && P.lv.gun === 1 && P.lv.hull === 1, 'back at 40 s: docked, full hull, upgrades kept');
  S.act('prGo', L.x, L.y); for (let i = 0; i < 30 * 30 && G.sites.includes(L); i++) S.simStep(1 / 30);
  ok(!G.sites.includes(L) && near(P.cargo.cr, 777, 0.5) && P.cargo.ch === 1, 'the new probe salvages its own wreck: the full cargo is back in the hold');
}
// ---- 9. scaling with the wave: guards harder, loot richer, the probe keeps pace
{
  const S = fresh(); setup(S, 5); const a = S.prStats(), va = S.prVal(); site(S, 'wreck', 5, 5, ['drone']); const ga = S.G.sites[0].g[0].max;
  setup(S, 45); const b = S.prStats(), vb = S.prVal(); site(S, 'wreck', 5, 5, ['drone']); const gb = S.G.sites[0].g[0].max;
  const wa = 1 + 5 / 15, wb = 1 + 45 / 15;
  ok(near(gb / ga, Math.pow(wb / wa, 1.2), 0.01) && near(b.max / a.max, wb / wa, 0.01) && near(b.dps / Math.max(1e-9, a.dps || b.dps), b.dps ? b.dps / (a.dps || b.dps) : 1, 1),
    `Wave 5 → 45: guard HP ×${(gb / ga).toFixed(2)}, probe hull ×${(b.max / a.max).toFixed(2)} (guards grow faster)`);
  ok(vb > va * 5 && near(vb, S.crateCr(45), 1), `loot value ×${(vb / va).toFixed(1)} (one crate's worth: ${Math.round(vb)} at Wave 45)`);
  ok(S.prUpCost('gun') === Math.round(150 * (1 + 45 / 30)), 'upgrade prices rise with the wave (Lance 1 at Wave 45: 375)');
  // spawned guards: more and tougher later
  const cnt = w => { const T = fresh(); T.newRun({ seed: 99, chaos: 1, frontier: 1, startWave: w }); T.G.wave = w; let g = 0, k = 0; for (let i = 0; i < 60; i++) { T.G.sites = []; const s = T.siteSpawn(); if (s) { k++; g += s.g.length; } } return g / Math.max(1, k); };
  const c5 = cnt(5), c60 = cnt(60); ok(c60 > c5 * 1.6, `guards per site: ${c5.toFixed(2)} at Wave 5, ${c60.toFixed(2)} at Wave 60`);
}
// ---- 10. sites spawn in the outer map, off the roads, and refresh
{
  const S = fresh(); S.newRun({ seed: 4242, chaos: 1, frontier: 1 }); const G = S.G; let seen = 0, out = 0, bad = 0, ids = new Set(), t = 0;
  while (G.wave < 9 && t++ < 30 * 900) { S.simStep(1 / 30); if (G.checkpoint) S.resumeCheckpoint(); for (const s of G.sites) if (!ids.has(s.id) && s.k !== 'lost') { ids.add(s.id); seen++; const x = Math.floor(s.x), y = Math.floor(s.y); if (!(x >= G.region.x0 && y >= G.region.y0 && x < G.region.x1 && y < G.region.y1)) out++; if (Math.hypot(s.x - G.core.x, s.y - G.core.y) < 11.9 || G.map.tiles[S.tIdx(x, y)] !== 0) bad++; } }
  ok(seen >= 3 && out / seen >= 0.5 && bad === 0, `${seen} sites by Wave 9, ${out} outside the sector, none on a road or within 12 tiles of the core`);
  ok(G.sites.filter(s => !s.done).length <= 2 + Math.floor(G.wave / 15), 'never more than the cap at once');
}
// ---- 11. jackpots bank as a boon pick or a full Entropy gauge
{
  const S = fresh(), G = setup(S, 15), P = G.probe; let drafts = 0; S.Hooks.onDraft = () => { drafts++; };
  P.cargo.jp = 1; P.home = 0; P.x -= 2; S.act('prHome'); step(S, 2);
  ok(P.home && (G.draft && G.draft.length === 3 || G.anomOffers), `a jackpot banks as ${G.draft ? 'a boon pick (3 boons)' : 'a full Entropy gauge'}`);
}
// ---- 12. snapshots keep the probe and the sites; an older snapshot gets a fresh probe
{
  const S = fresh(), G = setup(S, 12), P = G.probe; S.probeUpgrade('gun'); site(S, 'cloud', P.x - 9, P.y, ['drone']); S.act('prGo', P.x - 3, P.y); step(S, 1); P.cargo.cr = 321;
  S.snapshotRun(); const snap = JSON.parse(JSON.stringify(S.PROF.runSnap));
  const S2 = fresh(); S2.resumeRun(snap); const P2 = S2.G.probe;
  ok(P2 && P2.lv.gun === 1 && near(P2.x, P.x, 1e-9) && P2.cargo.cr === 321 && S2.G.sites.length === 1 && S2.G.sites[0].g.length === 1, 'resume keeps the probe (position, Lance, cargo) and the guarded site');
  const old = JSON.parse(JSON.stringify(snap)); delete old.probe; delete old.sites; delete old.siteT; const S3 = fresh(); S3.resumeRun(old);
  ok(S3.G.probe && S3.G.probe.alive && S3.G.probe.home && !S3.G.sites.length, 'a 6.4 snapshot resumes with a fresh docked probe');
}
// ---- 13. replays: a live act() run with every probe command replays exactly; the frV 5 fixture matches bit for bit
{
  const S = fresh(); boost(S); const { play } = require('./probe65_mkfix.js'); const G = play(S, { seed: 6599, chaos: 1, frontier: 1, startWave: 1 }, 77, 16);
  const kinds = new Set(G.inputs.filter(i => /^pr/.test(i[1])).map(i => i[1]));
  const S2 = fresh(); boost(S2); S2.replayRun({ opts: G.recOpts, inputs: G.inputs }, { quiet: true, until: G.over ? Infinity : G.tick });
  ok(kinds.has('prGo') && kinds.has('prHome') && kinds.has('prUp') && S2.runHash() === S.runHash() && JSON.stringify(S2.G.probe) === JSON.stringify(G.probe) && JSON.stringify(S2.G.sites) === JSON.stringify(G.sites),
    `a live run (${[...kinds].join(', ')}) replays to the same state (${S2.runHash()})`);
  const F = JSON.parse(fs.readFileSync(__dirname + '/fixtures/rec_650_probe.json', 'utf8'));
  const S3 = fresh(); boost(S3); S3.replayRun({ opts: F.opts, inputs: F.inputs }, { quiet: true, until: F.end.over ? Infinity : F.end.tick });
  ok(F.opts.frV === 5 && F.end.pr.lost >= 1 && F.inputs.some(i => i[1] === 'prBuild') && S3.runHash() === F.end.hash && S3.G.wave === F.end.wave && JSON.stringify(S3.G.probe) === JSON.stringify(F.end.probe),
    `the 6.5 frV 5 recording (wave ${F.end.wave}, ${F.end.pr.sites} sites, ${F.end.pr.lost} lost, a rebuild) replays bit for bit (${S3.runHash()} vs ${F.end.hash})`);
}
console.log(`${n - fails}/${n} checks · FAILED: [${fails ? fails + ' failed' : ''}]`);
process.exit(fails ? 1 : 0);
