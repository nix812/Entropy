// v4.2 Doctrines: seal rules (lock, slots, refund), and each Doctrine's effect in a real sim
const S = require('./harness.js').load();
const lvlXP = L => { let x = 0; for (let i = 0; i < L; i++) x += 3000 + 250 * i + 3 * i * i; return x + 1; };
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
function prof(level) { const P = S.defaultProfile(); P.bestWave = 60; P.xp = lvlXP(level); S.PROF = P; return P; }
// rules
prof(60);
ok(!S.treeAllocate('c1_0n'), 'Wildfire notable is locked without its seal');
ok(S.treeBlock('c1_0n').startsWith('seal'), 'block reason names the seal');
ok(S.treeAllocate('d1'), 'Wildfire seal can be taken');
ok(S.treeAllocate('c1_0n'), 'notable opens after the seal');
ok(S.treeBlock('d0') === 'slots' && !S.treeAllocate('d0'), 'second seal blocked at level 60');
const had = S.PROF.alloc.length; S.treeRefund('d1');
ok(!S.PROF.alloc.includes('c1_0n') && S.PROF.alloc.length < had, 'refunding the seal releases its notables');
prof(80); S.treeAllocate('d1');
ok(S.treeAllocate('d0'), 'second seal allowed at level 80');
ok(S.treeAllocate('h0'), 'hybrid notables stay open');
// Marksman
function run(seal, setup) {
  prof(60); if (seal) S.treeAllocate(seal);
  S.newRun({ startWave: 1, chaos: 1 }); const G = S.G; G.credits = 99999;
  return G;
}
let G = run(null); const cap0 = S.gridCap();
G = run('d0'); const cap1 = S.gridCap();
ok(cap1 < cap0, `Marksman grid ${cap0} -> ${cap1}`);
const spots = () => { const a = []; for (let y = 0; y < S.ROWS; y++) for (let x = 0; x < S.COLS; x++) if (S.canBuildAt(x, y)) a.push([x, y]); return a; };
let sp = spots();
let t = S.buildTower('pulse', sp[5][0], sp[5][1]);
G = run(null); sp = spots(); const t0 = S.buildTower('pulse', sp[5][0], sp[5][1]);
ok(t.s.dmg > t0.s.dmg * 1.6, `Marksman free Overcharge: pulse dmg ${t0.s.dmg.toFixed(1)} -> ${t.s.dmg.toFixed(1)}`);
// War Economy
G = run('d5'); const c0 = S.towerCost('pulse'); G.credits = 0; const d0 = S.coreStats().dmg; G.credits = 99999; const d1 = S.coreStats().dmg;
G = run(null); const cN = S.towerCost('pulse');
ok(c0 > cN, `War Economy tower cost ${cN} -> ${c0}`);
ok(d1 > d0 * 3, `War Economy core dmg ${d0.toFixed(1)} -> ${d1.toFixed(1)} with ${S.warTier ? '' : ''}a full chest`);
// Wildfire: burning enemies leave road fire, towers by it overheat
G = run('d1'); G.wave = 5;
const e = S.spawnEnemy('drone', { lane: G.map.lanes[0], hpm: 50 });
e.st.burn = { dps: 10, t: 5, src: null }; e.d = 5;
for (let i = 0; i < 60; i++) S.simStep(1 / 30);
const fires = G.zones.filter(z => z.k === 'roadfire').length;
ok(fires > 0, `Wildfire road fire zones: ${fires}, heat ${G.heat.toFixed(2)}`);
// ---- part 2 ----
prof(60);
ok(!S.treeAllocate('zo1'), 'Zenith Orbit locked without the Artisan seal');
ok(S.treeAllocate('d6') && S.treeAllocate('zo1'), 'Artisan seal opens the Zenith orbits');
// Circuit: a wired chain of 4 throws lightning, a disabled member stalls the chain
G = run('d2'); G.wave = 8; sp = spots();
const lane = G.map.lanes[0], mid = lane.tiles[Math.floor(lane.tiles.length / 2)];
const near = sp.filter(([x, y]) => Math.abs(x - mid.x) + Math.abs(y - mid.y) <= 4).sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
let built = []; for (const [x, y] of near) { if (built.length >= 4) break; if (built.every(t2 => Math.abs(t2.x - x) <= 1 && Math.abs(t2.y - y) <= 1) || !built.length) { const tt = S.buildTower('pulse', x, y); if (tt) built.push(tt); } }
S.recomputeAuras();
ok((G.chains || []).some(c => c.m.length >= 2), `Circuit chains: ${(G.chains || []).map(c => c.m.length).join(',')}`);
ok(built[0].buff.rate > 0.07, `wired tower +${Math.round(built[0].buff.rate * 100)}% attack speed`);
built[0].disabled = 2; S.simStep(1 / 30);
ok(built.slice(1).filter(t2 => t2.chain === built[0].chain).every(t2 => t2.disabled > 0), 'disabling one tower stalls its chain');
// Glacier: a frozen enemy jams the one behind it
G = run('d3'); G.wave = 8;
const a1 = S.spawnEnemy('drone', { lane: G.map.lanes[0], hpm: 99 }), a2 = S.spawnEnemy('drone', { lane: G.map.lanes[0], hpm: 99 });
a1.d = 6; a2.d = 5.7; a1.st.frozen = 5; const d2a = a2.d;
for (let i = 0; i < 20; i++) S.simStep(1 / 30);
ok(a2.d === d2a && a2.jammed, `Glacier jam holds the enemy behind (d ${d2a} -> ${a2.d.toFixed(2)})`);
ok(S.G.mods.dmg < 1, 'Glacier lowers damage');
// Event Horizon: kills open wells that drag enemies back
G = run('d4'); G.wave = 8;
const v1 = S.spawnEnemy('drone', { lane: G.map.lanes[0], hpm: 99 }), v2 = S.spawnEnemy('drone', { lane: G.map.lanes[0], hpm: 99 });
v1.d = 8; v2.d = 8.3; S.simStep(1 / 30); const before = v2.d; S.kill(v1, null, {});
for (let i = 0; i < 10; i++) S.simStep(1 / 30);
ok(v2.d < before, `Event Horizon well drags back (${before.toFixed(2)} -> ${v2.d.toFixed(2)})`);
// Artisan and Gambler
G = run('d6'); sp = spots(); const r0 = S.buildTower('rail', sp[3][0], sp[3][1]); const rk0 = r0.s.dmg; r0.rank = 2; r0.s = S.towerStats(r0);
ok(r0.s.dmg > rk0 * 1.4, `Artisan rank 2 rail ${rk0.toFixed(0)} -> ${r0.s.dmg.toFixed(0)}`);
G = run('d7'); ok(G.scoreMult >= 1.25, `Gambler score ×${G.scoreMult}`);
