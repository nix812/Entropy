// Boss time-to-kill: a focused defence (the budget a player has by that wave, spent on towers at the best road spots,
// upgraded to level 3) against a lone boss. Prints seconds under fire, how far down the road it got, and its HP.
// usage: node test/bossttk.js [mix] [budgetMult]   mix = comma list of tower types (default a typical mix)
const { load } = require('./harness');
const MIX = (process.argv[2] || 'pulse,rail,missile,cryo,coil,flame,lens').split(','), BM = +(process.argv[3] || 1);
const budgetAt = w => Math.round(320 + 70 * (w - 1) * (1 + 0.045 * (w - 1)));
function cover(G, x, y, r) { let c = 0; for (const L of G.map.lanes) if (!L.openWave) for (const p of L.pts) if ((p.x - x - 0.5) ** 2 + (p.y - y - 0.5) ** 2 <= r * r) c++; return c; }
const out = [];
for (const w of [10, 20, 30, 40, 50]) for (let seed = 0; seed < 4; seed++) {
  const S = load(); S.PROF = S.defaultProfile(); S.PROF.bestWave = 120; S.Hooks.onDraft = o => S.takeBoon(o[0]);
  const G = S.newRun({ seed: 300 + seed * 7, chaos: 1, startWave: w, cols: 46 });
  G.CH = Object.assign({}, G.CH, { ev: 0, storm: 0 }); G.stormT = 1e9; G.cacheT = 1e9; G.prep = null; G.queue.length = 0;
  G.credits = Math.round(budgetAt(w) * BM);
  const mix = MIX.filter(k => S.TOWERS[k].unlock <= w);
  for (let i = 0; i < 60; i++) {
    const k = mix[i % mix.length], D = S.TOWERS[k], per = D.cost * 3; if (G.credits < per) break;
    let best = null, bs = -1;
    for (let y = 0; y < S.ROWS; y++) for (let x = 0; x < S.COLS; x++) if (S.canBuildAt(x, y)) { const sc = cover(G, x, y, Math.min(D.range, 4)); if (sc > bs) { bs = sc; best = [x, y]; } }
    const t = best && S.buildTower(k, best[0], best[1]); if (!t) break; S.upgradeTower(t); S.upgradeTower(t);
  }
  G.wave = w; G.next = 1e9; G.spawningDone = true;
  const B = ['behemoth', 'queen', 'wraith', 'overmind', 'titan'][(w / 10 - 1) % 5];
  const e = S.spawnBoss({ boss: B, lane: G.map.lanes[0], L: S.BOSSES.find(b => b.id === B).fly ? G.map.lanes[0].fly : G.map.lanes[0], hpm: S.hpMult(w) * (G.CH.hp || 1) });
  let t = 0, fire = 0;
  while (!e.dead && t < 400) { G.core.hp = G.core.max; S.simStep(1 / 30); t += 1 / 30; if (G.towers.some(tw => tw.target === e || tw.lastT === e) || e.hp < e.maxHp) fire += 1 / 30; }
  out.push({ w, B, towers: G.towers.length, hp: Math.round(e.maxHp), underFire: +fire.toFixed(1), road: +(e.d / e.L.len).toFixed(2), killed: e.hp <= 0 });
}
const by = {}; for (const r of out) (by[r.w] = by[r.w] || []).push(r);
for (const w in by) { const rs = by[w]; const avg = k => rs.reduce((a, r) => a + r[k], 0) / rs.length; console.log(JSON.stringify({ w: +w, boss: rs[0].B, towers: avg('towers'), hp: Math.round(avg('hp')), underFire: +avg('underFire').toFixed(1), road: +avg('road').toFixed(2), killed: rs.filter(r => r.killed).length + '/' + rs.length })); }
