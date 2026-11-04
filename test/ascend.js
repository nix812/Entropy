// v5.8 Ascension perks and Tower Mastery (Node, headless). usage: node test/ascend.js
// Checks: perk offers are deterministic and never touch G.r; a pick applies and blocks the next Ascend until made;
// perks, the pending pick and its offer survive a snapshot and resume; a 5.7.4 recording (×1.3, no perks) still replays
// exactly; every perk runs in combat without errors; Mastery XP, migration, Daily fairness, the 4th card and rank-5 legendaries.
const { load } = require('./harness.js');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
function fresh(mastery) {
  const S = load(); S.PROF = S.defaultProfile(); S.PROF.bestWave = 80; S.PROF.xp = 4e6;
  S.Hooks.sfx = () => {};
  S.newRun({ seed: 4242, chaos: 1, startWave: 1, cols: 44, mastery: mastery || {} });
  S.G.credits = 1e7; S.G.gridBonus = 99;
  return S;
}
function spot(S, i) { const G = S.G, out = []; for (const L of G.map.lanes) for (const p of L.tiles) for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) if (S.canBuildAt(p.x + dx, p.y + dy)) out.push([p.x + dx, p.y + dy]); return out[i % out.length]; }
function maxed(S, type, spec, i) {
  const [x, y] = spot(S, i || 0); S.act('build', type, x, y);
  const t = S.G.towerAt[S.tIdx(x, y)];
  while (t.lvl < 5) S.act('up', x, y, t.lvl === 3 ? spec || 1 : null);
  return t;
}

// 1. offers: deterministic, own stream, refreshed per Ascension
{
  const A = fresh(), B = fresh();
  const ta = maxed(A, 'lens', 1), tb = maxed(B, 'lens', 1);
  A.act('up', ta.x, ta.y); B.act('up', tb.x, tb.y);
  ok(ta.asc === 1 && ta.ascPend === 1, 'Ascend opens a pending perk pick');
  const oa = A.ascOffer(ta).slice(), ob = B.ascOffer(tb).slice();
  ok(oa.length === 3 && JSON.stringify(oa) === JSON.stringify(ob), `same seed, same offer (${oa.join(', ')})`);
  ok(new Set(oa).size === 3, 'three different perks');
  // looking at the offer never moves the run's dice
  const C = fresh(); const tc = maxed(C, 'lens', 1); C.act('up', tc.x, tc.y);
  const nA = A.G.r(), nC = C.G.r();
  ok(nA === nC, 'opening the offer does not consume G.r');
  ok(!A.act('up', ta.x, ta.y), 'cannot Ascend again before picking');
  const before = ta.s.range, id = oa[0];
  ok(A.act('ascPick', ta.x, ta.y, 0) && ta.perks[0] === id && !ta.ascPend, `pick applies (${id})`);
  ok(A.act('up', ta.x, ta.y) && ta.asc === 2 && ta.ascPend === 1, 'next Ascend opens the next pick');
  const o2 = A.ascOffer(ta);
  ok(o2.length === 3, 'second offer drawn (' + o2.join(', ') + ')');
  ok(!A.act('ascPick', ta.x, ta.y, 7), 'an out-of-range pick is refused');
  // the offer depends on seed, tower and Ascension count only
  const D = fresh(); const td = maxed(D, 'lens', 1); D.act('up', td.x, td.y); D.act('ascPick', td.x, td.y, 0); D.act('up', td.x, td.y);
  ok(JSON.stringify(D.ascOffer(td)) === JSON.stringify(o2), 'second offer is the same in a second sim');
  // ×1.15 per Ascend in new runs
  const E = fresh(); const te = maxed(E, 'rail', 1); const af = te.affixes.slice(), d0 = te.s.dmg; E.act('up', te.x, te.y); te.affixes = af; te.s = E.towerStats(te);
  ok(Math.abs(te.s.dmg / d0 - 1.15) < 1e-9, `new runs: Ascend is ×1.15 (got ×${(te.s.dmg / d0).toFixed(4)})`);
  // offers vary across towers: count distinct first offers for 12 Lenses
  const F = fresh(), seen = new Set();
  for (let i = 0; i < 12; i++) { const t = maxed(F, 'lens', 1 + (i % 2), i * 3); F.act('up', t.x, t.y); seen.add(F.ascOffer(t).join(',')); }
  ok(seen.size >= 6, `offers vary between towers (${seen.size} distinct of 12)`);
  // stats: Focal Length adds range; Long Bore adds pierce
  const P = fresh(); const tp = maxed(P, 'lens', 1); tp.perks = ['focal']; const r1 = P.towerStats(tp).range; tp.perks = []; ok(r1 > P.towerStats(tp).range + 0.9, 'Focal Length: +1 range');
  const tr = maxed(P, 'rail', 2, 5); tr.perks = ['pierce', 'pierce']; ok(P.towerStats(tr).pierce === 2 + 4 + 3, 'Long Bore ×2: +3 pierce (diminishing)');
}

// 2. snapshot + resume keep perks, the pending pick and its offer, and the rules version
{
  const A = fresh({ lens: 4 });
  const t = maxed(A, 'lens', 2); A.act('up', t.x, t.y); A.act('ascPick', t.x, t.y, 1); A.act('up', t.x, t.y);
  const offer = A.ascOffer(t).slice(), perks = t.perks.slice();
  ok(offer.length === 4, 'Mastery 4: Ascend offers 4 perks');
  A.snapshotRun(); const snap = JSON.parse(JSON.stringify(A.PROF.runSnap));
  const B = load(); B.PROF = B.defaultProfile(); B.PROF.bestWave = 80; B.resumeRun(snap);
  const u = B.G.towers.find(o => o.type === 'lens');
  ok(u && JSON.stringify(u.perks) === JSON.stringify(perks) && u.ascPend === 1, 'resume keeps perks and the pending pick');
  ok(JSON.stringify(B.ascOffer(u)) === JSON.stringify(offer), 'resume shows the same perk cards');
  ok(B.G.ascV === 2 && B.G.mastery.lens === 4, 'resume keeps the rules version and Mastery');
  const s0 = JSON.parse(JSON.stringify(snap)); delete s0.ascV; delete s0.mastery; for (const T of s0.towers) { delete T.perks; delete T.ascPend; delete T.aOffer; }
  const C = load(); C.PROF = C.defaultProfile(); C.PROF.bestWave = 80; C.resumeRun(s0);
  ok(C.G.ascV === 1 && !C.G.towers.find(o => o.type === 'lens').ascPend, 'a save from before perks resumes on the old rules');
}

// 3. a 5.7.4 recording replays exactly (×1.3, no perk picks)
{
  const rec = require('./rec/v574_ascend.json');
  const S = load(); S.PROF = S.defaultProfile(); S.PROF.bestWave = 80; S.PROF.xp = 4e6;
  const r = S.replayRun(rec, { quiet: true }), h = S.runHash();
  ok(S.G.ascV === 1 && h === rec.end.hash && r.tick === rec.end.tick && r.score === rec.end.score, `5.7.4 recording replays exactly (${rec.end.ascends} Ascends, hash ${h} vs ${rec.end.hash})`);
}

// 4. every perk in combat: max stacks on both specs, a few waves, no errors or NaN
{
  let err = '', n = 0;
  for (const type of Object.keys(TYPES())) for (const spec of [1, 2]) {
    try {
      const S = fresh(); if (S.TOWERS[type].capT) { S.newRun({ seed: 4242, chaos: 1, startWave: 1, frontier: 1, capT: [type] }); S.G.credits = 1e7; S.G.gridBonus = 99; } // 6.4: tier towers need a Frontier run that lists them
      const t = maxed(S, type, spec);
      t.perks = []; for (const P of S.PERKS[type]) if (!P.spec || P.spec === spec) for (let k = 0; k < P.v.length; k++) t.perks.push(P.id);
      t.affixes.push({ id: S.LEGENDARIES.find(L => L.tower === type).id, tier: 3, v: 0 });
      t.s = S.towerStats(t); S.recomputeAuras(); n += t.perks.length;
      for (let w = 0; w < 3; w++) { S.startWave(); for (let i = 0; i < 30 * 40 && !S.G.over; i++) S.simStep(1 / 30); }
      const bad = S.G.enemies.find(e => !isFinite(e.hp) || !isFinite(e.d)); if (bad || !isFinite(t.dmgDone)) err += ` ${type}/${spec}: NaN`;
      if (type !== 'pylon' && type !== 'forge' && type !== 'snare' && !(t.dmgDone > 0)) err += ` ${type}/${spec}: no damage`;
    } catch (e) { err += ` ${type}/${spec}: ${e.message}`; }
  }
  ok(!err, `all perks fight (${n} perk stacks across ${Object.keys(TYPES()).length} towers × 2 specs)${err}`);
}
function TYPES() { return load().TOWERS; }

// 5. Mastery
{
  const S = fresh();
  S.PROF.mastery = { someOldMastery: 1 }; // the old web's shape
  ok(S.masteryProf().v === 2 && Object.keys(S.masteryProf().xp).length === 0, 'old PROF.mastery migrates to { v: 2, xp: {} }');
  const G = S.G; G.wave = 40;
  const mk = (type, dmg) => { const [x, y] = spot(S, G.towers.length * 2); S.act('build', type, x, y); G.towerAt[S.tIdx(x, y)].dmgDone = dmg; };
  mk('lens', 8000); mk('rail', 1500); mk('pulse', 500); mk('pylon', 0);
  const g = S.masteryGains(), by = Object.fromEntries(g.map(x => [x.k, x.xp]));
  ok(by.lens && by.rail && by.pulse && by.pylon, 'every tower that fought (and support that stood) earns XP: ' + JSON.stringify(by));
  ok(by.rail > 0.6 * by.lens, 'the top tower is weighted down (Rail at 15% earns > 60% of Lens at 80%)');
  ok(S.masteryRankOf(0) === 0 && S.masteryRankOf(60) === 1 && S.masteryRankOf(1250) === 5 && S.masteryRankOf(99999) === 5, 'rank thresholds');
  S.PROF.mastery = { v: 2, xp: { coil: 400, lens: 59 } }; ok(JSON.stringify(S.masteryRanks()) === '{"coil":3}', 'masteryRanks from XP');
  // Daily: fixed empty Mastery
  const D = load(); D.PROF = D.defaultProfile(); D.PROF.bestWave = 80; const sp = D.dailySpec('2026-11-02');
  D.newRun({ seed: sp.seed, chaos: sp.chaos, startWave: 1, daily: sp, cols: 44, huntBuild: { tal: {}, caps: [], remnants: [], lvl: 40 }, mastery: { lens: 5 } });
  ok(JSON.stringify(D.G.mastery) === '{}', 'Daily Hunt ignores Mastery');
  // Mastery 2 stat, Mastery 5 legendary pool
  const M = fresh({ rail: 5 }), N = fresh({});
  const a = maxed(M, 'rail', 1), b = maxed(N, 'rail', 1);
  a.affixes = []; b.affixes = []; ok(Math.abs(M.towerStats(a).dmg / N.towerStats(b).dmg - 1.05) < 1e-9, 'Mastery 2: ×1.05 Damage');
  let got = 0; for (let i = 0; i < 200; i++) { const x = M.rollAffix(a, 3); if (x.id === 'mRail') got++; } ok(got > 0, `Mastery 5: Railstorm rolls (${got}/200 legendaries)`);
  let none = 0; for (let i = 0; i < 200; i++) { const x = N.rollAffix(b, 3); if (N.LEGENDARIES.find(L => L.id === x.id && L.tower)) none++; } ok(none === 0, 'without Mastery 5 no tower legendary rolls');
  // only real runs grant mastery: a replay leaves PROF.mastery alone
  const R = fresh(); R.PROF.mastery = { v: 2, xp: {} }; const t = maxed(R, 'coil', 1); R.G.wave = 30; t.dmgDone = 5000; R.act('abandon');
  const xp1 = R.PROF.mastery.xp.coil || 0; ok(xp1 > 0 && R.G.masteryGain.length, `a real run grants Mastery (Arc Coil +${xp1})`);
  const rec = { opts: R.G.recOpts, inputs: R.G.inputs };
  R.replayRun(rec, { quiet: true }); ok((R.PROF.mastery.xp.coil || 0) === xp1, 'a replay grants none');
}
console.log(fails ? `${fails} FAILED` : 'all ascend checks pass');
process.exit(fails ? 1 : 0);
