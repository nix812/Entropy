// 6.4 tower64: the capstone tier and its seven towers, headless.
// usage: node test/tower64.js   (prints ok/FAIL lines and "N/M checks · FAILED: [...]")
const { load } = require('./harness.js'), fs = require('fs');
const { play } = require('./tower64_mkfix.js');
let n = 0, fails = 0;
const ok = (c, msg) => { n++; if (!c) fails++; console.log((c ? 'ok   ' : 'FAIL ') + msg); };
const fresh = () => { const S = load(); S.PROF = S.defaultProfile(); S.PROF.bestWave = 80; S.PROF.xp = 4e6; S.Hooks.sfx = () => {}; return S; };
const K16 = { kDmg: 3, kCrit: 3, kSupp: 1, kRate: 3, kPen: 2, kOver: 1, kHollow: 1, kLeth: 2 }; // 16 points in Ballistics
const roadSpots = (S, G) => { const out = [], seen = new Set(); for (const L of G.map.lanes) for (const p of L.tiles) for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) { const k = (p.x + dx) + ',' + (p.y + dy); if (!seen.has(k) && S.canBuildAt(p.x + dx, p.y + dy)) { seen.add(k); out.push([p.x + dx, p.y + dy]); } } return out; };

// ---- 1. the tier in the talent rules
{
  const S = fresh();
  ok(S.CAP_TOWERS.length === 7 && S.TALENTS.every((tr, i) => tr.top && S.TAL[tr.top.id] === tr.top && tr.top.unlockT === S.CAP_TOWERS[i] && tr.top.row === 5), 'every tree has one capstone tier node, row 5, unlocking its own tower');
  ok(S.talentBlock('kTop') === 'row' && S.rowNeed(5) === S.TTOP && S.TTOP === 16, 'the node needs 16 points in its tree');
  S.PROF.tal = Object.assign({}, K16); S.PROF.tal.kLeth = 1;
  ok(S.talentBlock('kTop') === 'row', '15 points: still locked');
  S.PROF.tal.kLeth = 2;
  ok(S.talentBlock('kTop') === '' && S.talentAdd('kTop') && S.PROF.tal.kTop === 1, '16 points: learned for 1 point');
  ok(S.treePts('K') === 16 && S.pointsSpent() === 17 && S.capsHeld().length === 0, 'it costs 1 point, is not a tree point and takes no Capstone slot');
  ok(S.talentCanRemove('kLeth') === 'row', 'a talent under it cannot drop the tree below 16 while it is held');
  ok(S.talentCanRemove('kTop') === '' && JSON.stringify(S.capTowersOwned()) === '["saw"]', 'the node itself can be removed; the profile owns the Buzzsaw');
  ok(S.talentAdd('nest') && S.capsHeld().includes('nest') && S.PROF.tal.kTop === 1, 'a Capstone in the same tree sits beside it');
  S.treeSaveBuild(0, 'b'); S.talentReset(); ok(S.treeLoadBuild(0) === 'ok' && S.PROF.tal.kTop === 1 && S.capsHeld().includes('nest'), 'a saved build reloads the node (row 5)');
  // the Daily Hunt build never learns it
  S.TAL_EDIT = S.huntBuildProf(); S.TAL_EDIT.lvl = 40; S.TAL_EDIT.tal = Object.assign({}, K16);
  ok(S.talentBlock('kTop') === 'daily', 'the Daily Hunt build cannot learn a capstone tier node');
  S.TAL_EDIT = null;
}
// ---- 2. an old profile loads unchanged
{
  const S = fresh();
  const old = S.defaultProfile(); old.webV = S.WEB_VER; old.tal = Object.assign({}, K16); old.caps = ['marksman']; old.builds[1] = { name: 'old', tal: Object.assign({}, K16), caps: ['marksman'], lvl: 17 };
  S.PROF = JSON.parse(JSON.stringify(old)); S.PROF.xp = 4e6;
  ok(S.migrateWeb() === false && S.PROF.tal.kDmg === 3 && S.capsHeld()[0] === 'marksman', 'a 6.3 profile (WEB_VER 5) keeps its talents: no refund');
  ok(S.capTowersOwned().length === 0 && S.talentBlock('kTop') === '', 'it owns no new tower yet, and can learn Ballistics\' at once');
  ok(S.treeLoadBuild(1) === 'ok' && S.treePts('K') === 16, 'its saved builds still load');
}
// ---- 3. unlocks enter a run only through newRun opts
{
  const S = fresh(); S.PROF.tal = Object.assign({ kTop: 1 }, K16);
  let G = S.newRun({ seed: 7, chaos: 1, frontier: 1, capT: ['saw'] });
  ok(G.frV >= 4 && JSON.stringify(G.capT) === '["saw"]' && JSON.stringify(G.recOpts.capT) === '["saw"]', 'a Frontier run carries opts.capT in G.capT and recOpts');
  ok(S.towerUnlocked('saw') && !S.towerUnlocked('rime'), 'only the listed tower is buildable');
  const sp = roadSpots(S, G); G.credits = 1e5;
  ok(!S.act('build', 'rime', sp[0][0], sp[0][1]) && !!S.act('build', 'saw', sp[0][0], sp[0][1]), 'act("build") refuses an unlisted tier tower and builds a listed one');
  S.PROF.tal.cTop = 1; ok(!S.towerUnlocked('rime'), 'learning a node mid-run does not unlock it in that run (the sim never reads PROF)');
  G = S.newRun({ seed: 7, chaos: 1, frontier: 1 }); ok(G.capT.length === 0 && !S.towerUnlocked('saw'), 'no opts.capT: nothing unlocked, whatever the profile holds');
  const D = S.dailySpec('2026-11-05'); S.PROF.huntBuild = null;
  G = S.newRun({ seed: D.seed, chaos: D.chaos, startWave: 1, daily: D, frontier: 1, huntBuild: { tal: {}, caps: [], remnants: [], lvl: 30 }, capT: S.CAP_TOWERS.slice() });
  ok(G.capT.length === 0 && S.CAP_TOWERS.every(k => !S.towerUnlocked(k)) && S.towerUnlocked('grav'), 'Daily Hunt: fixed to none (base towers all open as before)');
  G = S.newRun({ tut: S.TUT.v, frontier: 1, capT: ['saw'] }); ok(G.capT.length === 0, 'Training: none');
  G = S.newRun({ seed: 7, chaos: 1, frontier: 1, v: '6.3.0', frV: 3, hk: S.HOOK_VER, capT: ['saw'] }); ok(G.capT.length === 0, 'a frV 3 recording: none (the 6.4 rules are gated on frV >= 4)');
  G = S.newRun({ seed: 7, chaos: 1, cols: 44, capT: ['saw'] }); ok(G.capT.length === 0, 'a Classic (non-Frontier) run: none');
  // snapshot and resume keep the list
  G = S.newRun({ seed: 9, chaos: 1, frontier: 1, capT: ['saw', 'rime'] }); S.snapshotRun(G.wave + 1); const snap = JSON.parse(JSON.stringify(S.PROF.runSnap));
  S.resumeRun(snap); ok(JSON.stringify(S.G.capT) === '["saw","rime"]', 'a snapshot resumes with the same tier towers');
  ok(S.TOWER_ORDER.slice(-7).join() === S.CAP_TOWERS.join() && S.CAP_TOWERS.every(k => S.TOWERS[k].unlock === 999), 'tier towers follow the base 12 and never unlock by wave');
}
// ---- 4. stats are sane at every level, both specs, with every perk
{
  const S = fresh(); const G = S.newRun({ seed: 11, chaos: 1, frontier: 1, capT: S.CAP_TOWERS.slice() }); G.credits = 1e9; G.gridBonus = 99; S.recomputeAll();
  const sp = roadSpots(S, G); let bad = [];
  const fin = v => typeof v === 'number' && isFinite(v);
  S.CAP_TOWERS.forEach((k, i) => {
    for (const spec of [1, 2]) {
      const t = S.buildTower(k, sp[i * 3 + spec][0], sp[i * 3 + spec][1]); if (!t) { bad.push(k + ' build'); continue; }
      for (let lv = 1; lv <= 5; lv++) {
        const s = t.s;
        if (!fin(s.dmg) || !(s.dmg > 0) || !fin(s.rate) || !(s.rate > 0) || !(s.range > 1) || s.range > 8) bad.push(`${k} L${lv}s${spec} ${s.dmg}/${s.rate}/${s.range}`);
        if ((k === 'saw' && !(s.sawLen >= 5 && s.sawSpd > 0 && s.sawR > 0)) || (k === 'rime' && !(s.hold >= 8)) || (k === 'tangle' && !(s.links >= 3 && s.share > 0 && s.share <= 0.9)) ||
          (k === 'aegis' && !(s.guards >= 2)) || (k === 'joker' && !(s.jack >= 3)) || (k === 'surge' && !(s.cells >= 10)) || (k === 'flashover' && !(s.detX >= 2.5))) bad.push(`${k} L${lv} kind stats`);
        if (lv < 5) S.upgradeTower(t, lv === 3 ? spec : undefined);
      }
      t.perks = []; for (const P of S.PERKS[k]) for (let j = 0; j < P.v.length; j++) t.perks.push(P.id);
      t.s = S.towerStats(t); const s = t.s;
      if (!fin(s.dmg) || !fin(s.rate) || !fin(s.range) || !fin(s.critC) || s.range > 9) bad.push(`${k} all perks ${s.dmg}/${s.rate}/${s.range}`);
    }
    if (!S.LEGENDARIES.some(L => L.tower === k && L.pkv)) bad.push(k + ' mastery legendary');
    if (!(S.PERKS[k] && S.PERKS[k].length >= 6)) bad.push(k + ' perks');
  });
  ok(!bad.length, `seven towers × 2 specs × LV 1-5 and all perks: finite, positive, in range ${bad.slice(0, 4).join(' | ')}`);
  const L1 = Object.fromEntries(S.CAP_TOWERS.map(k => [k, S.TOWERS[k].cost]));
  ok(Object.values(L1).every(c => c >= 120 && c <= 150), 'costs sit with the late towers (120-150): ' + JSON.stringify(L1));
}
// ---- 5. each tower does its job
{
  const S = fresh();
  const setup = (type, spec) => {
    const G = S.newRun({ seed: 21, chaos: 1, frontier: 1, capT: S.CAP_TOWERS.slice() }); G.credits = 1e9; G.gridBonus = 99; G.next = 9999; G.queue = [];
    const L = G.map.lanes[0], D = Math.min(L.len * 0.5, L.len - 8), at = {}; S.lanePos(L, D, at);
    let best = null; for (let y = 0; y < S.ROWS; y++) for (let x = 0; x < S.COLS; x++) if (S.canBuildAt(x, y) && (!best || Math.hypot(x + 0.5 - at.x, y + 0.5 - at.y) < Math.hypot(best[0] + 0.5 - at.x, best[1] + 0.5 - at.y))) best = [x, y];
    const t = S.buildTower(type, best[0], best[1]); if (spec) { S.upgradeTower(t); S.upgradeTower(t); S.upgradeTower(t, spec); }
    return { G, t, L, D };
  };
  const steps = (G, k) => { for (let i = 0; i < k; i++) { G.core.cd = 1e9; S.simStep(1 / 30); } }; // the core gun stays quiet so every hit is the tower's
  const mob = (G, L, d, o) => { const e = S.spawnEnemy((o && o.type) || 'drone', { L, d }); e.hp = e.maxHp = (o && o.hp) || 1e6; e.spd = o && o.spd !== undefined ? o.spd : 0; if (o && o.fly) e.fly = true; return e; };
  { // Buzzsaw: a blade cuts ground enemies along the road, not fliers
    const { G, t, L, D } = setup('saw'); const a = mob(G, L, D), b = mob(G, L, D - 1.5), c = mob(G, L, D - 3), f = mob(G, L, D - 1, { fly: true, type: 'flyer' });
    steps(G, 60); ok(a.hp < 1e6 && b.hp < 1e6 && c.hp < 1e6 && f.hp === 1e6, `Buzzsaw: one blade cuts 3 ground enemies along 3 tiles of road, never the flier (${[a, b, c, f].map(e => Math.round(1e6 - e.hp)).join('/')})`);
  }
  { // Flashover: a burning enemy explodes for its remaining Burn; a cold one catches fire
    const { G, t, L, D } = setup('flashover'); const a = mob(G, L, D), b = mob(G, L, D + 0.4);
    a.st.burn = { dps: 100, t: 3, src: null }; t.cd = 0; steps(G, 2);
    ok(!a.st.burn && 1e6 - a.hp > 100 * 2.5 * 2.5 && !!b.st.burn, `Flashover: the burning enemy explodes (${Math.round(1e6 - a.hp)} dmg, Burn gone), the other is set alight`);
  }
  { // Surge Spire: idle time fills its cells; with charge it fires 4× as fast and spends it
    const { G, t, L, D } = setup('surge'); steps(G, 30 * 6); const c0 = t.charge;
    const a = mob(G, L, D); let shots = 0, h0 = a.hp; for (let i = 0; i < 30; i++) { G.core.cd = 1e9; S.simStep(1 / 30); if (a.hp < h0) { shots++; h0 = a.hp; } }
    ok(c0 >= 5.5 && c0 <= 10 && t.charge < c0 && shots >= 3, `Surge Spire: 6 idle seconds store ${c0.toFixed(1)} charges; 1 s of burst lands ${shots} bolts and spends ${(c0 - t.charge).toFixed(1)}`);
  }
  { // Rimewall: a wall stops a walking enemy until it wears through; a boss smashes it
    const { G, t, L, D } = setup('rime'); steps(G, 60); const w = t.wall;
    ok(!!w, 'Rimewall: raises a wall on the nearest road tile');
    let d0 = 0; for (let i = 0; i < L.pts.length - 1; i++) { const p = L.pts[i]; if (Math.hypot(p.x - w.x, p.y - w.y) < 0.01) d0 = L.cum[i]; }
    const e = mob(G, L, Math.max(0, d0 - 1.2), { spd: 1.5, hp: 1e9 }); steps(G, 30 * 3);
    ok(e.jammed && Math.hypot(e.x - w.x, e.y - w.y) < 1 && e.st.frozen > 0 || e.st.chill > 0, `Rimewall: the enemy stops at the wall and Chills (jammed ${e.jammed}, chill ${e.st.chill}, frozen ${(e.st.frozen || 0).toFixed(1)})`);
    steps(G, 30 * 7); ok(!t.wall && t.cd > 0, 'Rimewall: one enemy wears the 8-second wall down, then it regrows on a timer');
    const { G: G2, t: t2, L: L2 } = setup('rime'); steps(G2, 60); const w2 = t2.wall; let d2 = 0; for (let i = 0; i < L2.pts.length - 1; i++) if (Math.hypot(L2.pts[i].x - w2.x, L2.pts[i].y - w2.y) < 0.01) d2 = L2.cum[i];
    const bo = mob(G2, L2, Math.max(0, d2 - 0.6), { spd: 1, hp: 1e9 }); bo.boss = 'behemoth'; steps(G2, 10); ok(!t2.wall, 'Rimewall: a boss smashes the wall');
  }
  { // Entangler: a hit on one linked enemy is copied to the others
    const { G, t, L, D } = setup('tangle'); const es = [mob(G, L, D), mob(G, L, D + 0.5), mob(G, L, D + 1)]; t.cd = 0; steps(G, 2);
    const g = (G.tangles || [])[0]; const hp = es.map(e => e.hp); S.hit(es[0], 1000, 'K', null, {});
    const c1 = hp[1] - es[1].hp, c2 = hp[2] - es[2].hp; ok(g && g.m.length === 3 && c1 >= 300 && c1 < 400 && Math.abs(c1 - c2) < 1, `Entangler: links 3; a 1000 hit on one copies 30% to each other, before their Marks (${Math.round(c1)}, ${Math.round(c2)})`);
    steps(G, 30 * 5); ok(!es[0].lnk || es[0].lnk !== g, 'Entangler: the link ends after 4 s');
  }
  { // Gatekeeper: stops 2 leaks a wave while the core is in range; never a boss; resets next wave
    const { G, t } = setup('aegis'); G.core.x = t.cx + 1; G.core.y = t.cy;
    const hp0 = G.core.hp + G.core.shield, kills0 = G.kills, L = G.map.lanes[0];
    for (let i = 0; i < 3; i++) S.leak(mob(G, L, L.len - 0.1, { hp: 50 }));
    ok(G.stats.aegis === 2 && G.kills === kills0 + 2 && G.core.hp + G.core.shield < hp0, `Aegis: 2 of 3 leaks stopped and paid as kills, the third hits the core (${G.stats.aegis} stops)`);
    G.core.x = t.cx + 6; S.startWave(); S.leak(mob(G, L, L.len - 0.1, { hp: 50 })); ok(G.stats.aegis === 2, 'Aegis: no stop with the core out of range');
    G.core.x = t.cx + 1; S.leak(mob(G, L, L.len - 0.1, { hp: 50 })); ok(G.stats.aegis === 3, 'Aegis: its stops reset each wave');
  }
  { // Wildcard: rolls elements and forms; every 10th shot is a Jackpot
    const { G, t, L, D } = setup('joker'); const es = []; for (let i = 0; i < 4; i++) es.push(mob(G, L, D + i * 0.3)); const els = new Set(), forms = new Set(); let jack = 0;
    for (let i = 0; i < 30 * 25; i++) { const j0 = t.jn || 0; G.core.cd = 1e9; S.simStep(1 / 30); if ((t.jn || 0) > j0) { els.add(t.s.el); forms.add(t.jForm); if (t.jackT === G.time) jack++; } }
    ok(els.size >= 4 && forms.size >= 3 && jack >= 1 && t.jn >= 15, `Wildcard: ${t.jn} shots rolled ${els.size} elements, ${forms.size} forms, ${jack} Jackpots`);
  }
}
// ---- 6. replays: the 6.4 fixture matches bit for bit; a fresh run with all seven towers replays and resumes exactly
{
  const F = JSON.parse(fs.readFileSync(__dirname + '/fixtures/rec_640_tower64.json', 'utf8'));
  const S = fresh(); S.replayRun({ opts: F.opts, inputs: F.inputs }, { quiet: true, until: F.end.over ? Infinity : F.end.tick }); const G = S.G;
  const built = new Set(G.towers.map(t => t.type));
  ok(F.opts.frV === 4 && S.CAP_TOWERS.every(k => built.has(k)) && S.runHash() === F.end.hash && G.wave === F.end.wave && Math.round(G.score) === F.end.score,
    `the 6.4 recording (frV 4, all seven tier towers, wave ${F.end.wave}) replays bit for bit (${S.runHash()} vs ${F.end.hash})`);
}
{
  const S1 = fresh(); const G1 = play(S1, { seed: 6402, chaos: 1, frontier: 1, startWave: 1, capT: S1.CAP_TOWERS.slice() }, 77, 18);
  const rec = { opts: JSON.parse(JSON.stringify(G1.recOpts)), inputs: JSON.parse(JSON.stringify(G1.inputs)) }, h1 = S1.runHash();
  const S2 = fresh(); S2.replayRun(rec, { quiet: true, until: G1.over ? Infinity : G1.tick });
  const S3 = fresh(); const mid = Math.floor(G1.tick / 2); S3.replayRun(rec, { quiet: true, until: mid }); const G3 = S3.G; let i = G3.inputs.length;
  for (let g = 0; g < 5e6 && !G3.over; g++) {
    while (i < rec.inputs.length && rec.inputs[i][0] <= G3.tick) { const [, nm, ...a] = rec.inputs[i++]; S3.act(nm, ...a); }
    if (G3.over || (!G1.over && G3.tick >= G1.tick)) break;
    if (G3.draft || G3.huntChoice || (G3.checkpoint && !G3.enemies.length)) { if (i >= rec.inputs.length) break; if (rec.inputs[i][0] > G3.tick) G3.tick = rec.inputs[i][0]; continue; }
    S3.simStep(S3.SIM_STEP);
  }
  ok(S2.runHash() === h1 && S3.runHash() === h1, `a fresh frV 4 run with the seven towers (wave ${G1.wave}) replays and resumes halfway exactly (${S2.runHash()} / ${S3.runHash()} vs ${h1})`);
}
console.log(`${n - fails}/${n} checks · FAILED: [${fails ? fails + ' failed' : ''}]`);
process.exit(fails ? 1 : 0);
