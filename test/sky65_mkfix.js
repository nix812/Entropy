// Writes test/fixtures/rec_650_sky65.json: a 6.5 (frV 5) Frontier run in Ghost Lanes in which a Black Hole rolls, drifts in,
// holds and collapses, recorded through act(), plus its end state (hash, black holes seen, explored fog). test/sky65.js replays it
// on newer code and must match bit for bit. Regenerate only if the 6.5 rules change before release. usage: node test/sky65_mkfix.js
const { load } = require('./harness.js'), fs = require('fs');
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// a scripted player: builds base towers beside the roads, upgrades, answers every pick; every input goes through act()
function play(S, opts, seed, maxw, untilHole) {
  const R = rng(seed); S.newRun(opts); const G = S.G; let guard = 0, holeSeen = 0;
  const spots = () => { const out = []; for (const L of G.map.lanes) for (const p of L.tiles) for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) if (S.canBuildAt(p.x + dx, p.y + dy)) out.push([p.x + dx, p.y + dy]); return out; };
  while (!G.over && G.wave < maxw && guard++ < 600000) {
    if (G.hole) holeSeen = 1;
    if (untilHole && holeSeen && !G.hole && G.wave >= untilHole) break;
    if (G.draft) { S.act('boon', Math.floor(R() * G.draft.length)); continue; }
    if (G.huntChoice) { S.act('push'); continue; }
    if (G.checkpoint && !G.enemies.length) { S.act('cpResume', 4); continue; }
    if (guard % 25 === 0) {
      const x = R();
      if (x < 0.45 && S.gridFree() > 0) { const type = ['pulse', 'rail', 'cryo', 'missile', 'pulse', 'coil'][Math.floor(R() * 6)], sp = spots();
        if (sp.length && G.credits >= S.towerCost(type)) { const [tx, ty] = sp[Math.floor(R() * sp.length)]; S.act('build', type, tx, ty); } }
      else if (x < 0.85 && G.towers.length) { const t = G.towers[Math.floor(R() * G.towers.length)]; S.act('up', t.x, t.y, t.lvl === 3 ? 1 + Math.floor(R() * 2) : null); }
      else if (x < 0.88 && G.caches && G.caches.length) S.act('cache', G.caches[0].x, G.caches[0].y);
    }
    if (!G.draft && !G.huntChoice && !(G.checkpoint && !G.enemies.length)) S.simStep(S.SIM_STEP);
  }
  return G;
}
const prof = S => { S.PROF = S.defaultProfile(); S.PROF.bestWave = 60; S.PROF.xp = 2e6; S.Hooks.sfx = () => {}; };
const OPTS = { chaos: 1, frontier: 1, startWave: 10, sector: 'ghost' };
module.exports = { play, prof, OPTS };
if (require.main === module) {
  let S, G, seed = 6500;
  for (; seed < 6600; seed++) { S = load(); prof(S); G = play(S, Object.assign({ seed }, OPTS), 65, 30, 1); if (G.stats.holes && !G.hole && !G.over) break; }
  // run a little past the collapse so the replay covers the time after it too
  const fix = { made: '6.5 sky65', opts: JSON.parse(JSON.stringify(G.recOpts)), inputs: JSON.parse(JSON.stringify(G.inputs)),
    end: { tick: G.tick, wave: G.wave, score: Math.round(G.score), hash: S.runHash(), over: G.over, holes: G.stats.holes || 0, fog: S.fogPack(G.fogEx) } };
  fs.writeFileSync(__dirname + '/fixtures/rec_650_sky65.json', JSON.stringify(fix));
  console.log('seed', seed, 'frV', G.frV, 'wave', G.wave, 'tick', G.tick, 'holes', fix.end.holes, 'inputs', G.inputs.length, 'towers', G.towers.length, 'explored', G.fogEx.reduce((a, b) => a + b, 0), '/', G.fogEx.length);
}
