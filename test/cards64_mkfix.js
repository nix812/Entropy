// Writes test/fixtures/rec_640_fr4.json: a 6.4 (frV 4) Frontier run that draws generated Anomalies, takes generated and
// classic cards and stabilizes, recorded through act(), plus its end state. test/cards64.js replays it and must match bit for bit.
// The run starts with the classic Entropy Engine (fills 2× faster) and a bigger bank, set by the same 'Run started' hook in
// the test, so it reaches several draws by Wave 30. Generated once on the cards64 branch. usage: node test/cards64_mkfix.js
const { load } = require('./harness.js'), fs = require('fs');
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const prof = S => { S.PROF = S.defaultProfile(); S.PROF.bestWave = 80; S.PROF.xp = 4e6; };
// the start-of-run boost (not enumerable, so replays keep it quietly)
const boost = S => Object.defineProperty(S.Hooks, 'log', { enumerable: false, configurable: true, writable: true,
  value: t => { if (/^Run started/.test(t) && S.G) { S.G.anoms.push('engine'); S.G.credits += 4000; S.G.runMods.dmg = (S.G.runMods.dmg || 0) + 300; S.G.core.hpBonus = 3; S.recomputeAll(); S.G.core.hp = S.G.core.max; } } });
function play(S, opts, seed, maxw) {
  const R = rng(seed); S.newRun(opts); const G = S.G; let guard = 0;
  const spots = () => { const out = []; for (const L of G.map.lanes) for (const p of L.tiles) for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1]]) if (S.canBuildAt(p.x + dx, p.y + dy)) out.push([p.x + dx, p.y + dy]); return out; };
  let k = 0;
  while (!G.over && G.wave < maxw && guard++ < 600000) {
    if (G.draft) { S.act('boon', Math.floor(R() * G.draft.length)); continue; }
    if (G.huntChoice) { S.act('push'); continue; }
    if (G.anomOffers) { // take a generated card twice, then a classic if offered, then stabilize; repeat
      const O = G.anomOffers, g = O.find(o => typeof o === 'object'), c = O.find(o => typeof o === 'string'), m = k++ % 4;
      if (m < 2 && g) S.act('anom', g.id); else if (m === 2 && c) S.act('anom', c); else if (m === 3) S.act('stab'); else if (O.length) S.act('anom', O[0].id || O[0]); else S.act('stab');
      continue;
    }
    if (G.checkpoint && !G.enemies.length) { S.act('cpResume', 4); continue; }
    if (guard % 25 === 0) {
      const x = R();
      if (x < 0.45 && S.gridFree() > 0) { const sp = spots(); if (sp.length) { const [tx, ty] = sp[Math.floor(R() * sp.length)]; const t = ['pulse', 'rail', 'cryo', 'missile', 'coil', 'flame'][Math.floor(R() * 6)]; if (S.towerUnlocked(t)) S.act('build', t, tx, ty); } }
      else if (x < 0.8 && G.towers.length) { const t = G.towers[Math.floor(R() * G.towers.length)]; S.act('up', t.x, t.y, t.lvl === 3 ? 1 + Math.floor(R() * 2) : null); }
    }
    S.simStep(S.SIM_STEP);
  }
  return G;
}
module.exports = { boost, prof };
if (require.main === module) {
  const S = load(); prof(S); boost(S);
  const G = play(S, { seed: 6401, chaos: 1, frontier: 1, startWave: 1 }, 64, 36);
  const fix = { made: '6.4 cards64', opts: JSON.parse(JSON.stringify(G.recOpts)), inputs: JSON.parse(JSON.stringify(G.inputs)),
    end: { tick: G.tick, wave: G.wave, score: Math.round(G.score), hash: S.runHash(), over: G.over, anoms: G.anoms.slice(), ganoms: JSON.parse(JSON.stringify(G.ganoms)), stabilized: G.stabilized } };
  fs.writeFileSync(__dirname + '/fixtures/rec_640_fr4.json', JSON.stringify(fix));
  console.log('frV', G.frV, 'wave', G.wave, 'over', G.over, 'inputs', G.inputs.length, 'classic', G.anoms.join(','), 'generated', G.ganoms.map(a => a.name).join(', '), 'stabilized', G.stabilized);
}
