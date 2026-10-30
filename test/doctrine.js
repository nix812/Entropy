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
ok(S.treeAllocate('c2_0n'), 'non-Doctrine regions stay open');
// Marksman
function run(seal, setup) {
  prof(60); if (seal) S.treeAllocate(seal);
  S.newRun({ startWave: 1, chaos: 1 }); const G = S.G; G.credits = 99999;
  return G;
}
let G = run(null); const cap0 = S.gridCap();
G = run('d0'); const cap1 = S.gridCap();
ok(cap1 < cap0, `Marksman grid ${cap0} -> ${cap1}`);
const sp = []; for (let y = 0; y < S.ROWS; y++) for (let x = 0; x < S.COLS; x++) if (S.canBuildAt(x, y)) sp.push([x, y]);
let t = S.buildTower('pulse', sp[5][0], sp[5][1]);
G = run(null); const t0 = S.buildTower('pulse', sp[5][0], sp[5][1]);
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
