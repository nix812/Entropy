// v5.8 Techniques, play-style Capstones, the earlier talent pacing and the WEB_VER 5 migration (headless).
// usage: node test/techniques.js        prints PASS/FAIL lines and a summary
const { load } = require('./harness');
let fails = 0, passes = 0;
const check = (c, m) => { if (c) passes++; else { fails++; console.log('FAIL ' + m); } };
const quiet = S => { for (const k of ['sfx', 'fx', 'log', 'toast', 'onLevel', 'onChange', 'onSave', 'newEnemy']) S.Hooks[k] = () => {}; S.Hooks.onDraft = o => S.takeBoon(o[0]); };
function prof(S, opts) {
  const P = S.defaultProfile(); P.bestWave = 60; P.xp = S.xpToLevel(opts.lvl || 90) + 1; S.PROF = P;
  for (const id of opts.tal || []) S.talentAdd(id);
  return P;
}
// learn a talent with whatever rows it needs (fills the tree's first rows in order)
function learn(S, id) {
  const T = S.TAL[id], tr = S.TALENTS.find(x => x.id === T.tree);
  for (let g = 0; g < 60 && S.talentBlock(id); g++) {
    const b = S.talentBlock(id);
    if (b !== 'row') break;
    const filler = tr.rows.flat().find(x => !x.tech && x.row < (T.cap ? 4 : T.row) && !S.talentBlock(x.id));
    if (!filler) break; S.talentAdd(filler.id);
  }
  return S.talentAdd(id);
}
function runWith(S, seed, build, waves) {
  const G = S.newRun({ seed, chaos: 1, startWave: 12, cols: 40 });
  G.credits = 1e6;
  build(G);
  let guard = 0;
  while (!G.over && G.wave < 12 + waves && guard++ < 30 * 60 * 40) { S.simStep(1 / 30); if (S.G.checkpoint) S.resumeCheckpoint(); if (S.G.huntChoice) S.huntPush(); }
  return G;
}
// spots next to the road, in order of how much road they see
function roadSpots(S, G, n) {
  const out = [];
  for (let y = 0; y < S.ROWS; y++) for (let x = 0; x < S.COLS; x++) if (S.canBuildAt(x, y)) {
    let c = 0; for (const L of G.map.lanes) for (const p of L.pts) if ((p.x - x - 0.5) ** 2 + (p.y - y - 0.5) ** 2 <= 4) c++;
    if (c) out.push({ x, y, c });
  }
  return out.sort((a, b) => b.c - a.c).slice(0, n);
}
const finite = G => G.towers.every(t => isFinite(t.dmgDone) && isFinite(t.s.dmg) && isFinite(t.s.range)) && G.enemies.every(e => isFinite(e.hp) && isFinite(e.d));

// ---- pacing constants ----
{
  const S = load();
  check(S.TCAP === 12 && S.TROW === 3, 'TCAP 12, TROW 3');
  check(S.capSlots(24) === 1 && S.capSlots(25) === 2 && S.capSlots(59) === 2 && S.capSlots(60) === 3, 'cap slots at 25 and 60');
  check(S.TALENTS.every(tr => tr.rows.flat().every(t => t.max <= 3)), 'no talent above 3 ranks');
  for (const [type, modes] of Object.entries(S.TOWER_FIRE)) for (const F of modes) {
    const T = S.TAL[F.need];
    check(T && T.tech === type && T.max === 1 && T.row <= 1, `technique ${F.id} has a one-point talent in row 1-2 (${F.need})`);
  }
  for (const t of ['pulse', 'rail', 'cryo', 'missile', 'coil', 'flame', 'lens', 'emp', 'grav']) check((S.TOWER_FIRE[t] || []).length >= 1, 'technique for ' + t);
  // fresh profile: XP from a first run around Wave 15 (about 4.5k XP) is 3-5 levels
  check(S.levelFromXP(4500).level >= 3 && S.levelFromXP(4500).level <= 5, 'first run gives 3-5 levels: ' + S.levelFromXP(4500).level);
}

// ---- lock state: no talent, no Technique ----
{
  const S = load(); quiet(S); prof(S, { lvl: 0 });
  const G = S.newRun({ seed: 5, chaos: 1, startWave: 1, cols: 40 }); G.credits = 1e5;
  const sp = roadSpots(S, G, 1)[0], t = S.buildTower('pulse', sp.x, sp.y);
  check(S.act('fire', t.x, t.y, 'supp') === false && !t.fire, 'locked Technique is refused');
  check(S.act('fire', t.x, t.y, 'nonsense') === false, 'unknown Technique is refused');
}

// ---- every Technique works on the field (switch, fight 3 waves, damage, no NaN) ----
for (const [type, modes] of Object.entries(load().TOWER_FIRE)) for (const F of modes) {
  const S = load(); quiet(S); prof(S, { lvl: 90 });
  check(learn(S, F.need), `learn ${F.need}`);
  let tw = null;
  const G = runWith(S, 77, G => {
    const sp = roadSpots(S, G, 6);
    tw = S.buildTower(type, sp[0].x, sp[0].y);
    for (let i = 0; i < 3; i++) S.upgradeTower(tw);
    if (type === 'coil') S.buildTower('coil', sp[1].x, sp[1].y);
    for (const k of ['pulse', 'rail', 'missile']) { const q = sp.find(p => S.canBuildAt(p.x, p.y)); if (q) S.buildTower(k, q.x, q.y); }
    check(S.act('fire', tw.x, tw.y, F.id) === true && tw.fire === F.id && tw.s.fire === F.id, `switch ${type} to ${F.id}`);
  }, 3);
  check(finite(G), `${F.id}: finite numbers`);
  check(tw.dmgDone > 0 || type === 'coil' && !tw.fenceTo, `${F.id}: deals damage (${Math.round(tw.dmgDone)})`);
  if (F.id === 'lance') check(tw.s.kind === 'beam', 'Cold Lance is a beam');
  if (F.id === 'repulse') check(tw.s.ground === false, 'Repulsor reaches fliers');
  if (F.id === 'bunker') check(tw.s.splash === 0 && tw.s.pierceArmor, 'Bunker Buster has no splash and pierces armour');
  // back to Standard
  check(S.setFireMode(tw, '') === true && !tw.fire && tw.s.fire === '', `${F.id}: back to Standard`);
}

// ---- refund turns the mode off without losing t.fire; snapshot and resume keep it ----
{
  const S = load(); quiet(S); prof(S, { lvl: 90 }); learn(S, 'kOver');
  const G = S.newRun({ seed: 9, chaos: 1, startWave: 1, cols: 40 }); G.credits = 1e5;
  const sp = roadSpots(S, G, 1)[0], t = S.buildTower('rail', sp.x, sp.y);
  S.act('fire', t.x, t.y, 'over');
  const r0 = t.s.rate;
  S.snapshotRun(G.wave + 1);
  const snap = JSON.parse(JSON.stringify(S.PROF.runSnap));
  check(snap.towers[0].fire === 'over', 'snapshot carries fire');
  S.resumeRun(snap);
  const t2 = S.G.towers[0];
  check(t2.fire === 'over' && t2.s.fire === 'over' && Math.abs(t2.s.rate - r0) < 1e-9, 'resume keeps the Technique');
  S.G.checkpoint = 1; // refunds are free at checkpoints
  check(S.talentRemove('kOver'), 'refund kOver at a checkpoint');
  check(t2.fire === 'over' && !S.fireDef(t2) && t2.s.fire === '', 'refunded Technique falls back to Standard');
  // old snapshot without fire
  delete snap.towers[0].fire; S.resumeRun(snap);
  check(!S.G.towers[0].fire && S.G.towers[0].s.fire === '', 'old snapshot resumes as Standard');
}

// ---- replay: a run that switches modes through act() replays bit for bit ----
{
  const S = load(); quiet(S); prof(S, { lvl: 90 }); for (const id of ['kSupp', 'kOver', 'tBack', 'aFence']) learn(S, id);
  const G = S.newRun({ seed: 31, chaos: 1, startWave: 10, cols: 40 });
  S.act('cash', 0);
  const sp = roadSpots(S, G, 8);
  let n = 0;
  for (let i = 0; i < 30 * 240 && !G.over; i++) {
    if (G.draft) { S.act('boon', 0); continue; }
    if (G.huntChoice) { S.act('push'); continue; }
    if (G.checkpoint && !G.enemies.length) { S.act('cpResume', 5); continue; }
    if (i % 300 === 10 && n < 6) { const k = ['pulse', 'rail', 'coil', 'coil', 'flame', 'pulse'][n]; const p = sp[n]; if (S.act('build', k, p.x, p.y)) n++; }
    if (i === 2000) for (const t of G.towers) S.act('fire', t.x, t.y, { pulse: 'supp', rail: 'over', coil: 'fence', flame: 'back' }[t.type]);
    if (i === 4000 && G.towers[0]) S.act('fire', G.towers[0].x, G.towers[0].y, '');
    S.simStep(S.SIM_STEP);
  }
  const h1 = S.runHash(), rec = { opts: G.recOpts, inputs: G.inputs.slice(), end: G.tick };
  check(rec.inputs.some(x => x[1] === 'fire'), 'recording holds fire inputs');
  const S2 = load(); quiet(S2); S2.PROF = JSON.parse(JSON.stringify(S.PROF));
  const r = S2.replayRun(rec, { quiet: true, until: G.over ? Infinity : rec.end });
  check(S2.runHash() === h1, `replay with Techniques matches (${S2.runHash()} vs ${h1}, wave ${r.wave})`);
}

// ---- every new Capstone runs on the field ----
const CAP_SETUP = { nest: ['rail'], rico: ['pulse', 'rail'], stormrider: ['coil', 'emp'], blackout: ['emp', 'coil'], artillery: ['cryo'], hoarfrost: ['cryo', 'cryo', 'pulse'],
  garden: ['grav', 'grav', 'lens'], forgeworks: ['forge'], bulwark: ['pulse'], chaos: ['pulse', 'cryo', 'coil'] };
for (const [cap, towers] of Object.entries(CAP_SETUP)) {
  const S = load(); quiet(S); prof(S, { lvl: 90 });
  check(learn(S, cap) && S.capsHeld().includes(cap), `take Capstone ${cap}`);
  const G = runWith(S, 101, G => { const sp = roadSpots(S, G, towers.length); towers.forEach((k, i) => { const t = S.buildTower(k, sp[i].x, sp[i].y); if (t) for (let j = 0; j < 2; j++) S.upgradeTower(t); }); }, 3);
  check(finite(G), `${cap}: finite numbers`);
  const dmg = G.towers.reduce((a, t) => a + t.dmgDone, 0);
  check(dmg > 0, `${cap}: towers dealt damage (${Math.round(dmg)})`);
  if (cap === 'forgeworks') check(G.towers.some(t => t.type === 'forge' && t.dmgDone > 0), 'Forge Works: the Forge shoots');
  if (cap === 'chaos') check(G.towers.some(t => t.wild), 'Chaos Engine: towers rolled an element');
  if (cap === 'garden') { const W = G.towers.filter(t => t.type === 'grav'); check(W.length < 2 || (W[0].cx - W[1].cx) ** 2 + (W[0].cy - W[1].cy) ** 2 > 25 || (G.gardens || []).length >= 1, 'Gravity Garden pairs the Wells'); }
}
// conflicts
{
  const S = load(); quiet(S); prof(S, { lvl: 90 });
  learn(S, 'conflag');
  check(!learn(S, 'artillery') && /^conflict/.test(S.talentBlock('artillery')), 'Conflagration conflicts with Cryo Artillery: ' + S.talentBlock('artillery'));
}

// ---- migration: WEB_VER 4 profile -> 5 ----
{
  const S = load(); quiet(S);
  const P = S.defaultProfile(); P.webV = 4; P.tal = { kDmg: 5, kCrit: 5, kRate: 5, kPen: 3 }; P.caps = ['glass']; P.remnants = ['singularity', 'horizon'];
  let xp = 0; for (let L = 0; L < 47; L++) xp += S.xpForLevelV5(L); P.xp = xp + Math.round(S.xpForLevelV5(47) / 2);
  P.huntBuild = { tal: { tDmg: 5 }, caps: ['pyre'], remnants: [] }; P.builds = [{ name: 'x', tal: { kDmg: 5 }, caps: [] }, null, null, null, null];
  S.PROF = P;
  const lv0 = S.levelFromXP(P.xp, S.xpForLevelV5).level;
  const res = S.migrateWeb();
  check(res === 'rework', 'migration reports a rework: ' + res);
  check(S.PROF.webV === S.WEB_VER && Object.keys(S.PROF.tal).length === 0 && S.PROF.caps.length === 0, 'talents refunded');
  check(S.profLevel().level === lv0 && lv0 === 47, `level kept (${lv0} -> ${S.profLevel().level})`);
  check(Math.abs(S.profLevel().into / S.profLevel().need - 0.5) < 0.02, 'progress into the level kept');
  check(S.PROF.remnants.join() === 'garden,horizon', 'remnants renamed: ' + S.PROF.remnants.join());
  check(Object.keys(S.PROF.huntBuild.tal).length === 0 && S.PROF.huntBuild.caps.length === 0, 'Hunt build refunded');
  check(S.PROF.builds.every(b => !b), 'saved builds cleared');
  check(S.migrateWeb() === false, 'migration runs once');
  // a profile with nothing spent migrates silently
  const Q = S.defaultProfile(); Q.webV = 4; Q.xp = 5000; S.PROF = Q;
  check(S.migrateWeb() === false && S.PROF.webV === S.WEB_VER, 'empty profile migrates silently');
}

// ---- Daily Hunt build: 30 points, one Capstone, locked in the run ----
{
  const S = load(); quiet(S); prof(S, { lvl: 90 });
  const hb = S.huntBuildProf(); S.TAL_EDIT = hb;
  check(S.talLevel() === 30 && S.slotsNow() === 1, 'Hunt build: 30 points, 1 slot');
  learn(S, 'marksman'); check(S.capsHeld().includes('marksman'), 'Hunt build takes a Capstone');
  learn(S, 'circuit'); check(!S.capsHeld().includes('circuit'), 'Hunt build holds only one Capstone');
  learn(S, 'kOver');
  S.TAL_EDIT = null;
  const G = S.newRun({ seed: 3, chaos: 1, startWave: 1, cols: 40, huntBuild: JSON.parse(JSON.stringify(hb)) });
  check(S.huntRun() && S.talentAdd('kSupp') === false, 'Hunt run is locked');
  check(G.mods.tech.kOver === 1 && !G.mods.tech.kSupp, 'Hunt run reads its frozen build for Techniques');
}

console.log(`techniques.js: ${passes} passed, ${fails} failed`);
console.log(fails ? 'FAILED' : 'ALL PASS');
