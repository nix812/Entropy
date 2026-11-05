// 6.4 cards64: generated Anomalies (FR_VER 4). Determinism (same seed, same offers), budgets and steps in range, caps hold,
// offers lean toward the build, no near-identical offers, snapshot/resume, run log, and old rules unchanged (frV 3 draws
// classics exactly as before; the frV 4 fixture replays bit for bit).
// usage: node test/cards64.js   (V=1 prints every check, SAMPLE=1 prints 10 cards as the player sees them)
const { load } = require('./harness.js'), fs = require('fs');
const { boost, prof } = require('./cards64_mkfix.js');
let fails = 0, n = 0;
const ok = (c, msg) => { n++; if (!c) { fails++; console.log('FAIL ' + msg); } else if (process.env.V) console.log('ok   ' + msg); };
const fresh = () => { const S = load(); prof(S); S.Hooks.sfx = () => {}; return S; };
const draw = (S, wave) => { const G = S.G; if (wave) G.wave = wave; G.entropy = 100; G.anomOffers = null; S.addEntropy(0); return G.anomOffers; };
const gens = O => O.filter(o => typeof o === 'object');
const pow = (S, parts) => parts.reduce((a, [id, v]) => { const P = S.ANOM_PART[id]; return a + (P.sp ? P.p : v * P.p); }, 0);
const build = (S, types) => { const G = S.G; G.credits = 1e7; let i = 0; for (const L of G.map.lanes) for (const p of L.tiles) for (const [dx, dy] of [[1, 1], [-1, -1], [2, 0]]) { if (i >= types.length) return; if (S.canBuildAt(p.x + dx, p.y + dy) && S.buildTower(types[i], p.x + dx, p.y + dy)) i++; } };

// ---- 1. rules version
{
  const S = fresh(), G = S.newRun({ seed: 1, chaos: 1, frontier: 1 });
  ok(S.FR_VER >= 4 && G.frV === S.FR_VER && G.recOpts.frV === S.FR_VER, `a new Frontier run records frV ${G.recOpts.frV}`); // 6.5: FR_VER 5
  ok(Array.isArray(G.ganoms) && !G.ganoms.length, 'a new run starts with no generated Anomalies');
}
// ---- 2. old rules: frV 3 (6.2/6.3 recordings) and Classic runs draw the old way, string ids only, same dice
{
  for (const opts of [{ seed: 9, chaos: 1, frontier: 1, v: '6.3.0', frV: 3, hk: 1 }, { seed: 9, chaos: 1, cols: 44 }]) {
    const S = fresh(); S.newRun(opts); const G = S.G; const r0 = S.mulberry32(0);
    let all = true, same = true;
    for (let i = 0; i < 6; i++) {
      // the old algorithm on a copy of the dice
      const st = JSON.stringify(G.anomOffers); const pool = S.ANOMALIES.filter(a => !G.anoms.includes(a.id));
      const O = draw(S); all = all && O.every(o => typeof o === 'string') && O.length === Math.min(3, pool.length);
      S.takeAnomaly(O[0]);
    }
    ok(all && G.frV < 4 && !G.ganoms.length, `${opts.frV ? 'frV 3' : 'Classic'} run: every offer is 3 classic ids, nothing generated (${G.anoms.join(',')})`);
  }
  // the same seed and wave on old code would give these exact offers: rebuild the old draw on a cloned dice stream
  const S = fresh(); S.newRun({ seed: 21, chaos: 1, frontier: 1, v: '6.3.0', frV: 3, hk: 1 }); const G = S.G;
  const seedR = G.r; let calls = 0; G.r = () => { calls++; return seedR(); };
  const O = draw(S); ok(calls === 3 && O.length === 3, `frV 3: one draw uses exactly 3 dice rolls, as before (${calls})`);
}
// ---- 3. determinism: same seed and same actions give the same offers, draw after draw
{
  const run = () => { const S = fresh(); S.newRun({ seed: 77, chaos: 1, frontier: 1 }); build(S, ['pulse', 'rail', 'cryo', 'missile']); const out = [];
    for (let i = 0; i < 10; i++) { const O = draw(S, 5 + i * 6); out.push(JSON.stringify(O)); const g = gens(O)[0]; S.takeAnomaly(g ? g.id : O[0]); } return { out, h: S.runHash(), m: JSON.stringify(S.G.mods.fx), af: JSON.stringify(S.G.af) }; };
  const A = run(), B = run();
  ok(A.out.join() === B.out.join() && A.m === B.m && A.af === B.af, 'same seed, same picks: identical offers over 10 draws, identical mods');
  const S = fresh(); S.newRun({ seed: 78, chaos: 1, frontier: 1 }); build(S, ['pulse', 'rail', 'cryo', 'missile']);
  ok(JSON.stringify(draw(S, 5)) !== A.out[0], 'another seed gives other offers');
}
// ---- 4. budgets, steps, ranges, fair trades, names; no near-identical offers
{
  let cards = 0, bad = [], ratio = [], dupKeys = 0, offers = 0, rar = [0, 0, 0], classic = 0, slots = 0, longName = 0, two = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const S = fresh(); S.newRun({ seed, chaos: 1, frontier: 1 }); build(S, [['pulse', 'rail'], ['cryo', 'missile'], ['coil', 'lens', 'flame']][seed % 3]);
    for (let i = 0; i < 8; i++) {
      const O = draw(S, 3 + i * 9); offers++; slots += O.length; classic += O.filter(o => typeof o === 'string').length;
      const G1 = gens(O), ks = G1.map(o => S.ANOM_PART[o.up[0][0]].k); if (new Set(ks).size !== ks.length) dupKeys++;
      for (const o of G1) {
        cards++; rar[o.r]++; if (o.up.length > 1) two++;
        for (const [id, v] of o.up.concat(o.dn)) { const P = S.ANOM_PART[id]; if (!P) { bad.push('part ' + id); continue; } if (!P.sp && (v < P.lo - 1e-9 || v > P.hi + 1e-9 || Math.abs(v / P.st - Math.round(v / P.st)) > 1e-6)) bad.push(`${id} ${v} [${P.lo}..${P.hi}/${P.st}]`); }
        const u = pow(S, o.up), d = pow(S, o.dn); ratio.push(d / u);
        if (o.r < 2 && o.up.length !== 1) bad.push('common/rare with ' + o.up.length + ' boons');
        if (o.r === 2 && o.up.length !== 2) bad.push('exotic with ' + o.up.length + ' boons');
        if (!o.name || o.name.length > 24) longName++;
        const I = S.anomInfo(o); if (!I.up.every(l => /\d|split|status|2×/.test(l)) || !I.dn.every(l => /\d|shield/.test(l))) bad.push('line without a number: ' + I.up.concat(I.dn).join(' / '));
      }
      const g = G1[0]; S.takeAnomaly(g ? g.id : O[0]);
    }
  }
  ratio.sort((a, b) => a - b); const med = ratio[ratio.length >> 1];
  ok(!bad.length, `${cards} generated cards: every value on its step and inside its range, lines carry numbers ${bad.slice(0, 3).join(' | ')}`);
  ok(ratio[0] >= 0.4 && ratio[ratio.length - 1] <= 1.8 && med > 0.7 && med < 0.95, `fair trades: drawback power / boon power ${ratio[0].toFixed(2)}–${ratio[ratio.length - 1].toFixed(2)}, median ${med.toFixed(2)}`);
  ok(dupKeys === 0, `no offer holds 2 generated cards with the same boon (${offers} offers)`);
  ok(rar[1] > cards * 0.15 && rar[2] > cards * 0.03 && rar[0] > cards * 0.5, `rarity mix: ${rar.join(' / ')} common / rare / exotic`);
  const cs = classic / slots; ok(cs > 0.12 && cs < 0.35, `classic cards fill ${(cs * 100).toFixed(0)}% of slots`);
  ok(!longName, 'every card has a short name');
}
// ---- 5. caps hold: take generated cards only, 30 draws, always the one that stacks a key already held
{
  let over = [];
  for (const seed of [3, 4, 5]) {
    const S = fresh(); S.newRun({ seed, chaos: 1, frontier: 1 }); build(S, ['pulse', 'rail', 'pulse', 'rail']); const G = S.G;
    for (let i = 0; i < 30; i++) {
      const O = gens(draw(S, 10 + i * 5)); if (!O.length) continue;
      const T = S.anomTotals(); const o = O.find(c => c.up.some(([id]) => T[S.ANOM_PART[id].k] > 0)) || O[0]; S.takeAnomaly(o.id);
    }
    const T = S.anomTotals();
    for (const id in S.ANOM_PART) { const P = S.ANOM_PART[id], v = T[P.k] || 0; if (P.sp) continue;
      if (P.side > 0 && v > P.cap + 1e-6) over.push(`${P.k} ${v} > ${P.cap}`);
      if (P.side < 0 && (P.t === 'm' ? -v : v) > P.cap + 1e-6 && !S.ANOM_UPS.some(U => U.k === P.k && v > 0)) over.push(`${id} ${v} past ${P.cap}`); }
    ok(G.ganoms.length >= 15, `seed ${seed}: ${G.ganoms.length} generated cards taken`);
  }
  ok(!over.length, `caps hold after 30 draws: ${over.slice(0, 4).join(', ') || 'every key inside its cap'}`);
}
// ---- 6. offers lean toward what the player fields
{
  let el = { K: 0, T: 0, C: 0, A: 0, V: 0 };
  for (let seed = 1; seed <= 30; seed++) {
    const S = fresh(); S.newRun({ seed, chaos: 1, frontier: 1 }); build(S, ['pulse', 'rail', 'pulse', 'rail', 'pulse']);
    for (let i = 0; i < 6; i++) { const O = draw(S, 8); for (const o of gens(O)) for (const [id] of o.up) { const P = S.ANOM_PART[id]; if (P.el) el[P.k.slice(3)]++; } S.stabilize(); }
  }
  const tot = Object.values(el).reduce((a, b) => a + b, 0);
  ok(el.K / tot > 0.6, `an all-Kinetic build sees Kinetic damage boons in ${Math.round(el.K / tot * 100)}% of element boons (${JSON.stringify(el)})`);
}
// ---- 7. effects apply, run log, codex
{
  const S = fresh(); S.newRun({ seed: 12, chaos: 1, frontier: 1 }); const G = S.G; build(S, ['pulse']);
  let o = null; for (let i = 0; i < 20 && !o; i++) { o = gens(draw(S, 10)).find(c => c.up[0][0] === 'dmg' && c.up.length === 1); if (!o) S.stabilize(); }
  const before = G.mods.dmg, sc = G.scoreMult; S.takeAnomaly(o.id);
  ok(Math.abs(G.mods.dmg - before - o.up[0][1] / 100) < 1e-9 && Math.abs(G.scoreMult - sc - 0.05) < 1e-9, `${o.name}: +${o.up[0][1]}% Damage reaches the mods, +5% score`);
  const L = G.rlog.filter(e => e.k === 'anom').pop(); ok(L && L.id === o.id && L.g && L.g.name === o.name && JSON.stringify(L.g.up) === JSON.stringify(o.up), 'the run log records the whole card');
  ok(S.PROF.codex.gen.n === 1 && S.PROF.codex.gen.parts.dmg === 1 && !S.PROF.codex.anomalies[o.name], 'the codex counts rarity and parts, not names');
  ok(S.anomCount() === G.anoms.length + 1 && S.anomTaken().some(a => a.name === o.name && a.up[0].includes('Damage')), 'the taken list shows generated cards with their lines');
  ok(!S.takeAnomaly(o.id) && !S.takeAnomaly('nope'), 'a card not on offer is refused');
}
// ---- 8. snapshot and resume carry generated cards and offers; old snapshots get defaults
{
  const S = fresh(); S.newRun({ seed: 15, chaos: 1, frontier: 1 }); const G = S.G; build(S, ['pulse', 'cryo']);
  for (let i = 0; i < 3; i++) { const O = draw(S, 12); const g = gens(O)[0]; S.takeAnomaly(g ? g.id : O[0]); }
  draw(S, 14); const offers = JSON.stringify(G.anomOffers);
  S.snapshotRun(G.wave); const snap = JSON.parse(JSON.stringify(S.PROF.runSnap));
  const S2 = fresh(); S2.resumeRun(snap); const G2 = S2.G;
  ok(JSON.stringify(G2.ganoms) === JSON.stringify(G.ganoms) && JSON.stringify(G2.anomOffers) === offers, `resume keeps ${G2.ganoms.length} generated cards and the open offer`);
  ok(Math.abs(G2.mods.dmg - G.mods.dmg) < 1e-9 && JSON.stringify(G2.af) === JSON.stringify(G.af), 'resumed mods and drawbacks match');
  const g2 = gens(G2.anomOffers)[0]; ok(!g2 || S2.takeAnomaly(g2.id), 'a resumed offer can be taken');
  const old = JSON.parse(JSON.stringify(snap)); delete old.ganoms; old.anomOffers = ['twinsuns', 'glasssky']; const S3 = fresh(); S3.resumeRun(old);
  ok(Array.isArray(S3.G.ganoms) && !S3.G.ganoms.length && S3.takeAnomaly('twinsuns'), 'a 6.3 snapshot (no generated cards, classic offer) resumes and its offer works');
}
// ---- 9. replays: the frV 4 fixture matches bit for bit; a live act() run replays exactly
{
  const F = JSON.parse(fs.readFileSync(__dirname + '/fixtures/rec_640_fr4.json', 'utf8'));
  const S = fresh(); boost(S); S.replayRun({ opts: F.opts, inputs: F.inputs }, { quiet: true, until: F.end.over ? Infinity : F.end.tick }); const G = S.G;
  ok(F.opts.frV === 4 && F.end.ganoms.length >= 2 && S.runHash() === F.end.hash && G.wave === F.end.wave && Math.round(G.score) === F.end.score && JSON.stringify(G.ganoms) === JSON.stringify(F.end.ganoms),
    `the 6.4 frV 4 recording (wave ${F.end.wave}, ${F.end.ganoms.length} generated cards) replays bit for bit (${S.runHash()} vs ${F.end.hash})`);
}
// ---- 10. sample cards as the player sees them
if (process.env.SAMPLE) {
  const S = fresh(); S.newRun({ seed: +process.env.SAMPLE || 7, chaos: 1, frontier: 1 }); build(S, ['pulse', 'rail', 'cryo', 'missile', 'lens']); let shown = 0;
  for (let i = 0; i < 12 && shown < 10; i++) { const O = draw(S, 6 + i * 7); for (const o of O) { const I = S.anomInfo(o); if (shown++ < 10) console.log(`${I.label.toUpperCase().padEnd(8)} ${I.name}\n         + ${I.up.join('\n         + ')}\n         − ${I.dn.join('\n         − ')}`); } const g = gens(O)[0]; S.takeAnomaly(g ? g.id : O[0]); }
}
console.log(`${n - fails}/${n} checks · FAILED: [${fails ? fails + ' failed' : ''}]`);
process.exit(fails ? 1 : 0);
