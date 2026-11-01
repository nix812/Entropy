// v4.4 regression tests for the bug hunt: assault scheduling, pirate lure, daily resume, Marksman grid, web conflicts
const S = require('./harness.js').load();
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const lvlXP = L => { let x = 0; for (let i = 0; i < L; i++) x += 3000 + 250 * i + 3 * i * i; return x + 1; };
function prof(level, bw) { const P = S.defaultProfile(); P.bestWave = bw || 60; P.xp = lvlXP(level || 0); S.PROF = P; return P; }
S.Hooks.onDraft = o => S.takeBoon(o[0]);
// v5.0: fill a tree to 20 points (row by row) and take one of its Capstones
function cap(id) { const T = S.TAL[id], tr = S.TALENTS.find(t => t.id === T.tree); let g = 0; while (S.treePts(tr.id) < 20 && g++ < 60) { const t = tr.rows.flat().find(t => !S.talentBlock(t.id)); if (!t) break; S.talentAdd(t.id); } return S.talentAdd(id); }

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
prof(60, 60); cap('marksman'); G = S.newRun({ seed: 3, chaos: 1, startWave: 1 }); G.credits = 99999;
const c0 = S.gridCap(); S.expandReactor(); const c1 = S.gridCap(); S.expandReactor(); const c2 = S.gridCap();
ok(c1 === c0 + 1 && c2 === c1 + 1, `Marksman reactor: ${c0} -> ${c1} -> ${c2}`);

// 5. a live assault saved mid-wave replays as an assault
prof(0, 60); G = S.newRun({ seed: 21, chaos: 1, startWave: 13 }); G.credits = 30000;
for (let i = 0; i < 30 * 400 && !(G.assault && G.assault.state === 'live'); i++) { S.simStep(1 / 30); if (G.spawningDone && G.next > 2) S.callEarly(); }
ok(G.assault && G.assault.state === 'live', `assault live at Wave ${G.wave}`);
S.snapshotNow(); const snap2 = JSON.parse(JSON.stringify(S.PROF.runSnap));
G = S.resumeRun(snap2);
ok(G.assault && G.assault.state === 'warn' && G.prep.queue.some(q => q.assault), 'resumed mid-assault: the wave is re-converted to the strain');

// 6. Conflagration and the Chill/Freeze Capstones refuse each other
prof(90, 60); ok(cap('glacier'), 'Glacier taken'); ok(S.talentBlock('conflag') === 'row' || (S.treePts('T') < 20), 'Combustion not deep enough yet');
{ const tr = S.TALENTS.find(t => t.id === 'T'); let g = 0; while (S.treePts('T') < 20 && g++ < 60) { const t = tr.rows.flat().find(t => !S.talentBlock(t.id)); if (!t) break; S.talentAdd(t.id); } }
ok(S.talentBlock('conflag').startsWith('conflict'), `Conflagration blocked under Glacier (${S.talentBlock('conflag')})`);
ok(!S.talentBlock('wildfire'), 'other Capstones unaffected');

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

// v5.0.2: one Capstone per tree, and older saves holding two are tidied with the point back
prof(200, 60); S.newRun({ seed: 5, chaos: 1 });
ok(cap('abszero'), 'Absolute Zero taken');
ok(S.talentBlock('winter') === 'tree', `a second Cryogenics Capstone is refused (${S.talentBlock('winter')})`);
S.PROF.caps.push('winter'); const dropped = S.tidyCaps();
ok(dropped.length === 1 && dropped[0] === 'winter' && S.capsHeld().length === 1, 'tidyCaps drops the extra and keeps the first');

// v5.0.2: the breach warning names what got through
prof(0, 60); G = S.newRun({ seed: 9, chaos: 1 }); S.startWave(); S.startWave();
const toasts = []; const oldT = S.Hooks.toast; S.Hooks.toast = (a, b) => toasts.push(a + ' ' + b);
G.leaksAtStart = G.stats.leaks; G.lastLeakN = 3;
for (let i = 0; i < 6; i++) { const e = S.spawnEnemy('tank', {}); e.d = e.L.len; S.leak(e); }
G.core.hp = G.core.max; S.startWave();
S.Hooks.toast = oldT;
const bw = toasts.find(t => t.startsWith('BREACH WARNING'));
ok(bw && /Juggernaut/.test(bw), `breach warning names the leaker: ${bw}`);

// v5.1: abilities come online by wave, recharge on a cooldown into slots, loot stacks above them
prof(0, 60); G = S.newRun({ seed: 3, chaos: 1 });
ok(S.abilOnline('strike') && !S.abilOnline('stasis'), 'only Orbital Strike is online at the start');
for (let w = 0; w < 12; w++) S.startWave();
ok(['strike', 'nova', 'stasis', 'overclock', 'scan'].every(S.abilOnline), 'every ability online by Wave 12');
G.charges.stasis = 0; G.abilCd.stasis = 1; G.paused = false; G.enemies = []; G.queue = [];
for (let i = 0; i < 40; i++) S.updateAbils(0.05);
ok(G.charges.stasis === 1, `stasis recharged into its slot (${G.charges.stasis})`);
for (let i = 0; i < 4000; i++) S.updateAbils(0.05);
ok(G.charges.stasis === 1, 'a full slot does not overfill');
G.charges.stasis += 5; ok(G.charges.stasis === 6, 'loot charges stack above the slot');
const cd0 = S.abilCdMax('strike'); G.credits = 1e7; for (let i = 0; i < 12; i++) S.coreUpgrade('uplink');
ok(G.core.uLvl === 9 && S.abilCdMax('strike') < cd0 * 0.6, `Command Uplink LV ${G.core.uLvl}: Strike ${cd0}s -> ${S.abilCdMax('strike').toFixed(1)}s`);
const e0 = S.spawnEnemy('phantom', {}); e0.cloaked = true; G.charges.scan = 1;
ok(S.useAbility('scan') && e0.scanned > 0 && G.scanThreat, 'Scan Marks and picks a threat');

// v5.1.1: a timed ability used again while running adds its time (capped at 3 uses), and the rail can read what's left
prof(0, 60); G = S.newRun({ seed: 4, chaos: 1 }); for (let w = 0; w < 12; w++) S.startWave();
G.charges.overclock = 5; S.useAbility('overclock'); const f1 = G.overclockT; S.useAbility('overclock');
ok(Math.abs(G.overclockT - 2 * f1) < 1e-6, `second Frenzy adds time: ${f1}s -> ${G.overclockT}s`);
S.useAbility('overclock'); S.useAbility('overclock');
ok(Math.abs(G.overclockT - 3 * f1) < 1e-6, `capped at three uses' worth (${G.overclockT}s)`);

// v5.1.3: Core Hull raises max hull and cuts leak damage; Elite Tide can't make a wave all elites
prof(0, 60); G = S.newRun({ seed: 6, chaos: 1 }); for (let w = 0; w < 30; w++) S.startWave();
const m0 = G.core.max; G.credits = 1e7; for (let i = 0; i < 12; i++) S.coreUpgrade('hull');
ok(G.core.hLvl === 10 && G.core.max > m0 * 2, `Hull 10: max ${Math.round(m0)} -> ${Math.round(G.core.max)}`);
G.core.hp = G.core.max; G.core.shield = 0; const hp0 = G.core.hp; const lk = S.spawnEnemy('drone', {}); S.leak(lk);
ok(hp0 - G.core.hp < 4 * (1 + 0.03 * G.wave) * 0.55, `leak damage cut by half: ${(hp0 - G.core.hp).toFixed(1)}`);
G.wave = 55; const q = S.genWave(56, { elite: 1 }).queue.filter(e => e.type !== 'boss'); const ef = q.filter(e => e.elite).length / q.length;
ok(ef < 0.7, `Elite Tide at Wave 56: ${Math.round(ef * 100)}% elites (non-swarmers capped at 60%, was 95%)`);
