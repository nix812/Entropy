// Writes test/fixtures/rec_640_tower64.json: a 6.4 (frV 4) Frontier run with every capstone tier tower built, upgraded and
// specialized, recorded through act(), plus its end state. test/tower64.js replays it on newer code and must match bit for bit.
// Generated once on the tower64 branch; regenerate only if the 6.4 rules change before release. usage: node test/tower64_mkfix.js
const { load } = require('./harness.js'), fs = require('fs');
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// a scripted player: every input goes through act(); it favours the new towers so all seven get built
function play(S, opts, seed, maxw) {
  const R = rng(seed); S.newRun(opts); const G = S.G; let guard = 0;
  const spots = () => { const out = []; for (const L of G.map.lanes) for (const p of L.tiles) for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1]]) if (S.canBuildAt(p.x + dx, p.y + dy)) out.push([p.x + dx, p.y + dy]); return out; };
  const nearCore = () => { const c = G.map.core, out = []; for (let y = c.y - 2; y <= c.y + 2; y++) for (let x = c.x - 2; x <= c.x + 2; x++) if (S.canBuildAt(x, y)) out.push([x, y]); return out; };
  let k = 0;
  while (!G.over && G.wave < maxw && guard++ < 400000) {
    if (G.draft) { S.act('boon', Math.floor(R() * G.draft.length)); continue; }
    if (G.huntChoice) { S.act('push'); continue; }
    if (G.checkpoint && !G.enemies.length) { S.act('cpResume', 4); continue; }
    if (guard % 25 === 12) { const t = G.towers.find(o => o.ascPend > 0); if (t) { S.ascOffer(t); S.act('ascPick', t.x, t.y, Math.floor(R() * 3)); } }
    if (guard % 25 === 0) {
      const x = R();
      if (x < 0.42 && S.gridFree() > 0) {
        const type = k < 7 ? S.CAP_TOWERS[k] : R() < 0.6 ? S.CAP_TOWERS[Math.floor(R() * 7)] : ['pulse', 'rail', 'flame', 'missile'][Math.floor(R() * 4)];
        const sp = type === 'aegis' ? nearCore() : spots();
        if (sp.length && G.credits >= S.towerCost(type)) { const [tx, ty] = sp[Math.floor(R() * sp.length)]; if (S.act('build', type, tx, ty) && k < 7) k++; }
      }
      else if (x < 0.8 && G.towers.length) { const t = G.towers[Math.floor(R() * G.towers.length)]; S.act('up', t.x, t.y, t.lvl === 3 ? 1 + Math.floor(R() * 2) : null); }
      else if (x < 0.83 && G.towers.length) { const t = G.towers[Math.floor(R() * G.towers.length)]; S.act('mode', t.x, t.y, ['first', 'strong', 'close'][Math.floor(R() * 3)]); }
      else if (x < 0.85 && G.towers.length > 9) { const t = G.towers[Math.floor(R() * G.towers.length)]; if (!S.CAP_TOWERS.includes(t.type)) S.act('sell', t.x, t.y); }
      else if (x < 0.87 && G.caches && G.caches.length) S.act('cache', G.caches[0].x, G.caches[0].y);
    }
    if (!G.draft && !G.huntChoice && !(G.checkpoint && !G.enemies.length)) S.simStep(S.SIM_STEP);
  }
  return G;
}
const prof = S => { S.PROF = S.defaultProfile(); S.PROF.bestWave = 80; S.PROF.xp = 4e6; };
module.exports = { play, prof };
if (require.main === module) {
  const S = load(); prof(S);
  const G = play(S, { seed: 6401, chaos: 1, frontier: 1, startWave: 1, capT: S.CAP_TOWERS.slice() }, 64, 26);
  const fix = { made: '6.4 tower64', opts: JSON.parse(JSON.stringify(G.recOpts)), inputs: JSON.parse(JSON.stringify(G.inputs)),
    end: { tick: G.tick, wave: G.wave, score: Math.round(G.score), hash: S.runHash(), over: G.over, towers: G.towers.map(t => [t.type, t.lvl, t.spec]), dmg: Object.fromEntries(S.CAP_TOWERS.map(k => [k, Math.round(G.towers.filter(t => t.type === k).reduce((a, t) => a + t.dmgDone, 0))])), aegis: G.stats.aegis || 0 } };
  fs.writeFileSync(__dirname + '/fixtures/rec_640_tower64.json', JSON.stringify(fix));
  console.log('frV', G.frV, 'capT', G.capT.join(','), 'wave', G.wave, 'over', G.over, 'inputs', G.inputs.length, 'towers', fix.end.towers.map(t => t.join('')).join(' '), 'dmg', JSON.stringify(fix.end.dmg), 'aegis stops', fix.end.aegis);
}
