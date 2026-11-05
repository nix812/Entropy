// Writes test/fixtures/rec_650_probe.json: a 6.5 (frV 5) Frontier run that uses the probe through act(): it sends the probe to
// loot sites, recalls it, buys upgrades, loses it once (parked at a guarded site with no Lance until it falls) and rebuilds it. test/probe65.js
// replays it and must match bit for bit. The run starts with extra tower damage and credits (the same 'Run started' hook in the
// test), so it reaches Wave 30 with guards and rich sites. usage: node test/probe65_mkfix.js
const { load } = require('./harness.js'), fs = require('fs');
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const prof = S => { S.PROF = S.defaultProfile(); S.PROF.bestWave = 80; S.PROF.xp = 4e6; };
const boost = S => Object.defineProperty(S.Hooks, 'log', { enumerable: false, configurable: true, writable: true,
  value: t => { if (/^Run started/.test(t) && S.G) { S.G.credits += 3000; S.G.runMods.dmg = (S.G.runMods.dmg || 0) + 300; S.G.core.hpBonus = 3; S.recomputeAll(); S.G.core.hp = S.G.core.max; } } });
function play(S, opts, seed, maxw) {
  const R = rng(seed); S.newRun(opts); const G = S.G; let guard = 0, k = 0, sac = 0, lost = 0;
  const spots = () => { const out = []; for (const L of G.map.lanes) for (const p of L.tiles) for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1]]) if (S.canBuildAt(p.x + dx, p.y + dy)) out.push([p.x + dx, p.y + dy]); return out; };
  while (!G.over && G.wave < maxw && guard++ < 600000) {
    if (G.draft) { S.act('boon', Math.floor(R() * G.draft.length)); continue; }
    if (G.huntChoice) { S.act('push'); continue; }
    if (G.anomOffers) { S.act('stab'); continue; }
    if (G.checkpoint && !G.enemies.length) { S.act('cpResume', 4); continue; }
    if (guard % 25 === 0) {
      const x = R();
      if (x < 0.4 && S.gridFree() > 0) { const sp = spots(); if (sp.length) { const [tx, ty] = sp[Math.floor(R() * sp.length)]; S.act('build', ['pulse', 'rail', 'cryo', 'missile', 'coil'][Math.floor(R() * 5)], tx, ty); } }
      else if (x < 0.7 && G.towers.length) { const t = G.towers[Math.floor(R() * G.towers.length)]; S.act('up', t.x, t.y, t.lvl === 3 ? 1 : null); }
    }
    if (guard % 40 === 20) { // the probe: upgrades in a fixed order, a site (every 4th pick a guarded one regardless of risk), recall when hurt or full
      const P = G.probe;
      if (sac && P.alive) { if (!G.sites.some(o => o.g.length && Math.hypot(o.x - P.x, o.y - P.y) < 4)) { const s = G.sites.find(o => o.g.length && !o.done); if (s) S.act('prGo', Math.round(s.x * 10) / 10, Math.round(s.y * 10) / 10); } } // parked under the guns of a guarded site until it falls
      else if (!P.alive) { sac = 0; lost++; if (!(P.rb > 0) && G.credits >= S.prRebuildCost()) S.act('prBuild'); }
      else if (!lost && G.wave >= 8 && P.home && G.sites.some(o => o.g.length && !o.done)) { const s = G.sites.find(o => o.g.length && !o.done); S.act('prGo', Math.round(s.x * 10) / 10, Math.round(s.y * 10) / 10); sac = 1; }
      else {
        const up = ['hull', 'rig', 'eng', 'scan', 'gun'][k % 5]; if (P.lv[up] < 2 && G.credits > S.prUpCost(up) * 2) { S.act('prUp', up); k++; }
        if (!P.home && !P.ret && (P.hp < P.max * 0.3 || P.cargo.cr > S.prVal() * 3)) S.act('prHome');
        else if ((P.home && P.hp > P.max * 0.8) || (!P.home && !P.ret && !P.task)) {
          const sites = G.sites.filter(o => !o.done).sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b.x - P.x, b.y - P.y)), bold = R() < 0.25;
          const s = bold ? sites.find(o => o.g.length) || sites[0] : sites.find(o => !o.g.length) || sites[0];
          if (s) S.act('prGo', Math.round(s.x * 10) / 10, Math.round(s.y * 10) / 10); else if (!P.home) S.act('prHome');
        }
      }
    }
    S.simStep(S.SIM_STEP);
  }
  return G;
}
module.exports = { boost, prof, play };
if (require.main === module) {
  const S = load(); prof(S); boost(S);
  const G = play(S, { seed: 6501, chaos: 1, frontier: 1, startWave: 1 }, 65, 30);
  const pr = G.stats.pr || {};
  const fix = { made: '6.5 probe65', opts: JSON.parse(JSON.stringify(G.recOpts)), inputs: JSON.parse(JSON.stringify(G.inputs)),
    end: { tick: G.tick, wave: G.wave, score: Math.round(G.score), hash: S.runHash(), over: G.over, probe: JSON.parse(JSON.stringify(G.probe)), sites: G.sites.length, pr } };
  fs.writeFileSync(__dirname + '/fixtures/rec_650_probe.json', JSON.stringify(fix));
  const n = {}; for (const i of G.inputs) if (/^pr/.test(i[1])) n[i[1]] = (n[i[1]] || 0) + 1;
  console.log('frV', G.frV, 'wave', G.wave, 'over', G.over, 'inputs', G.inputs.length, 'probe acts', JSON.stringify(n), 'stats', JSON.stringify(pr), 'lv', JSON.stringify(G.probe.lv));
}
