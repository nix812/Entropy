// v4.4 regression tests for the bug hunt: assault scheduling, pirate lure, daily resume, Marksman grid, web conflicts
const S = require('./harness.js').load();
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const lvlXP = L => { let x = 0; for (let i = 0; i < L; i++) x += 3000 + 250 * i + 3 * i * i; return x + 1; };
function prof(level, bw) { const P = S.defaultProfile(); P.bestWave = bw || 60; P.xp = lvlXP(level || 0); S.PROF = P; return P; }
S.Hooks.onDraft = o => S.takeBoon(o[0]);

// 1. a run started at Wave 30 (Normal: first assault 14, every 8) still gets assaults
prof(0, 60);
let G = S.newRun({ seed: 7, chaos: 1, startWave: 30 });
ok(G.assaultNext >= 31, `late start: next assault scheduled at Wave ${G.assaultNext} (not stuck at 14)`);
G.wave = G.assaultNext - 2; G.prep = null; S.prepareWave(G.assaultNext - 1);
ok(G.assault && G.assault.w === G.assaultNext, `the assault is announced a wave ahead (Wave ${G.assault && G.assault.w})`);

// 2. a Snare Beacon never lures a pirate skiff
prof(0, 60); G = S.newRun({ seed: 11, chaos: 1, startWave: 10 }); G.credits = 9999; G.wave = 10;
const spots = []; for (let y = 0; y < S.ROWS; y++) for (let x = 0; x < S.COLS; x++) if (S.canBuildAt(x, y)) spots.push([x, y]);
const core = G.map.core, nearCore = spots.sort((a, b) => Math.hypot(a[0] - core.x, a[1] - core.y) - Math.hypot(b[0] - core.x, b[1] - core.y));
for (let i = 0; i < 6; i++) S.buildTower('snare', nearCore[i][0], nearCore[i][1]);
G.caches = [{ x: core.x + 3, y: core.y, t: 5, id: 1, kind: 'normal' }];
const thief = S.spawnThief(G.caches[0]);
ok(!thief.lured && thief.L.pts.length === 3, 'pirate skiff keeps its own three-point course past Snare Beacons');

// 3. a resumed Daily carries no Cosmic Laws
prof(0, 60); S.PROF.laws = ['lean', 'gravity']; S.PROF.nova = 2;
G = S.newRun({ seed: 5, chaos: 2, startWave: 1, daily: { date: '2026-10-30', anoms: ['glasssky', 'goldfever'], seed: 5, chaos: 2 } });
ok(G.laws.length === 0 && G.novaN === 0, 'daily run ignores laws');
for (let i = 0; i < 30 * 40; i++) S.simStep(1 / 30);
S.snapshotNow(); const snap = JSON.parse(JSON.stringify(S.PROF.runSnap));
G = S.resumeRun(snap);
ok(G.daily && G.laws.length === 0 && G.novaN === 0 && G.anoms.length === 2, `resumed daily: laws ${G.laws.length}, anomalies ${G.anoms.length}, scoreMult ${G.scoreMult.toFixed(2)}`);

// 4. Marksman: a reactor expansion always adds a whole point of power
prof(60, 60); S.treeAllocate('d0'); G = S.newRun({ seed: 3, chaos: 1, startWave: 1 }); G.credits = 99999;
const c0 = S.gridCap(); S.expandReactor(); const c1 = S.gridCap(); S.expandReactor(); const c2 = S.gridCap();
ok(c1 === c0 + 1 && c2 === c1 + 1, `Marksman reactor: ${c0} -> ${c1} -> ${c2}`);

// 5. a live assault saved mid-wave replays as an assault
prof(0, 60); G = S.newRun({ seed: 21, chaos: 1, startWave: 13 }); G.credits = 30000;
for (let i = 0; i < 30 * 400 && !(G.assault && G.assault.state === 'live'); i++) { S.simStep(1 / 30); if (G.spawningDone && G.next > 2) S.callEarly(); }
ok(G.assault && G.assault.state === 'live', `assault live at Wave ${G.wave}`);
S.snapshotNow(); const snap2 = JSON.parse(JSON.stringify(S.PROF.runSnap));
G = S.resumeRun(snap2);
ok(G.assault && G.assault.state === 'warn' && G.prep.queue.some(q => q.assault), 'resumed mid-assault: the wave is re-converted to the strain');

// 6. Conflagration and the Glacier Doctrine refuse each other
prof(90, 60); ok(S.treeAllocate('d3') && S.treeAllocate('d1'), 'Glacier and Wildfire seals taken (2 slots at level 90)');
ok(S.treeBlock('k1').startsWith('conflict'), `Conflagration blocked under Glacier (${S.treeBlock('k1')})`);
prof(90, 60); ok(S.treeAllocate('d1') && S.treeAllocate('k1'), 'Conflagration taken'); ok(S.treeBlock('d3').startsWith('conflict'), 'Glacier blocked under Conflagration');
ok(!S.treeBlock('d4'), 'other seals unaffected');

// 7. Most Wanted: planned at run start, forced onto its wave, twins pay on the second kill, survives a resume
G = S.newRun({ seed: 9, chaos: 1, startWave: 15 });
ok(G.wanted && G.wanted.w === 30, `wanted planned for Wave ${G.wanted && G.wanted.w} (start 15): ${G.wanted && G.wanted.name}`);
G.wanted.mod = 'twins'; G.wanted.name = 'Twin ' + G.wanted.boss;
G.wave = 29; G.prep = null; S.prepareWave(30);
ok(G.prep.boss && G.prep.boss.id === G.wanted.boss, `the wanted boss is forced onto Wave ${G.wanted.w} (${G.prep.boss && G.prep.boss.id})`);
G.credits = 50000; G.towers.length = 0; // no towers: just spawn and inspect
G.next = 0; S.simStep(1/30);
for (let i = 0; i < 30 * 60 && !G.enemies.some(e => e.boss); i++) S.simStep(1 / 30);
let bosses = G.enemies.filter(e => e.boss);
for (let i = 0; i < 30 * 4; i++) S.simStep(1 / 30);
bosses = G.enemies.filter(e => e.boss);
ok(bosses.length === 2 && bosses.every(e => e.wanted === 'twins'), `twins: ${bosses.length} wanted bosses on the field`);
let cr0 = G.credits, lq0 = G.legendQueue;
S.kill(bosses[0], null, {}); ok(!G.wanted.done && !G.stats.bounty, 'first twin pays no bounty yet');
S.kill(bosses[1], null, {}); ok(G.credits > cr0 && G.legendQueue === lq0 + 1 && G.wanted.done && G.stats.bounty, `second twin pays the bounty: +${G.credits - cr0} credits, legend queue +1`);
// snapshot
S.snapshotNow(); const snap3 = JSON.parse(JSON.stringify(S.PROF.runSnap)); const G2 = S.resumeRun(snap3);
ok(G2.wanted && G2.wanted.done, 'wanted state survives a resume');
