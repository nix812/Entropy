// Tower lab: equal-budget, controlled tests of every tower and specialization.
// usage: node test/lab.js WAVE SEEDS [filter]   (prints one JSON line per config)
// Each config spends the same budget (the game's own credits-by-wave curve) on its towers,
// placed at the best road-coverage spots for their range, then fights 3 waves with the core held alive.
// Storms, events, salvage and pirates are switched off so only the towers differ.
const { load } = require('./harness');
const W = +(process.argv[2] || 20), SEEDS = +(process.argv[3] || 3), FILTER = process.argv[4] || '', BMULT = +(process.env.BMULT || 0);
const budgetAt = w => Math.round(320 + 70 * (w - 1) * (1 + 0.045 * (w - 1)));

function coverage(S, G, x, y, range) {
  let c = 0;
  for (const L of G.map.lanes) if (!L.openWave) for (const p of L.pts) if ((p.x - x - 0.5) ** 2 + (p.y - y - 0.5) ** 2 <= range * range) c++;
  return c;
}
function spot(S, G, type, near) {
  const D = S.TOWERS[type]; let best = null, bs = -1;
  for (let y = 0; y < S.ROWS; y++) for (let x = 0; x < S.COLS; x++) {
    if (!S.canBuildAt(x, y)) continue;
    let sc;
    if (near) { sc = 0; for (const t of G.towers) if (t.type !== type && (t.cx - x - 0.5) ** 2 + (t.cy - y - 0.5) ** 2 <= (D.range || 2) ** 2) sc += 1; sc += coverage(S, G, x, y, 2) * 0.01; }
    else sc = coverage(S, G, x, y, Math.min(D.range, 4)) + coverage(S, G, x, y, 1.2) * 0.2;
    if (sc > bs) { bs = sc; best = { x, y }; }
  }
  return best;
}
// cost of one tower taken to level lv (spec at 4)
function costTo(S, type, lv) {
  let c = S.TOWERS[type].cost; for (let l = 2; l <= lv; l++) c += Math.round(S.TOWERS[type].cost * S.LV_COST[l]); return c;
}
function buildGroup(S, G, type, lv, spec, budget, near) {
  const per = costTo(S, type, lv); let n = 0;
  while (G.credits >= per && n < 40) {
    const p = spot(S, G, type, near); if (!p) break;
    const t = S.buildTower(type, p.x, p.y); if (!t) break;
    for (let l = 1; l < lv; l++) S.upgradeTower(t, l === 3 ? spec || 1 : 0);
    n++;
  }
  return n;
}
function runConfig(cfg, seed) {
  const S = load(); S.PROF = S.defaultProfile(); S.PROF.bestWave = 120;
  S.Hooks.onDraft = o => S.takeBoon(o[0]);
  const G = S.newRun({ seed: 7000 + seed * 101, chaos: 1, startWave: W, cols: 46 });
  G.CH = Object.assign({}, G.CH, { ev: 0, storm: 0 }); G.stormT = 1e9; G.cacheT = 1e9; G.tokens = 0;
  G.prep = null; S.prepareWave(W);
  const budget = Math.round(budgetAt(W) * (cfg.bmult || BMULT || 1));
  // the affix rolls on build/upgrade are random; average them out by seeding through the run rng (same per seed)
  G.credits = budget;
  if (cfg.carrier) { G.credits = Math.round(budget * (1 - cfg.share)); buildGroup(S, G, cfg.carrier, 3, 0); G.credits += Math.round(budget * cfg.share); buildGroup(S, G, cfg.type, cfg.lv, cfg.spec, 0, true); }
  else buildGroup(S, G, cfg.type, cfg.lv, cfg.spec, budget);
  const spent = budget - G.credits; G.credits = 0;
  const towers = G.towers.length;
  // fight three waves; track spawned and leaked HP
  const seen = new Map(); let spawnHP = 0, leakHP = 0, t = 0, wavesDone = 0;
  G.next = 0.1; const endWave = W + 2;
  while (t < 1200) {
    G.core.hp = G.core.max; G.credits = 0;
    S.simStep(1 / 30); t += 1 / 30;
    if (G.checkpoint) S.resumeCheckpoint();
    for (const e of G.enemies) if (!seen.has(e.id)) { seen.set(e.id, e); spawnHP += e.maxHp; }
    for (const [id, e] of seen) if (e.dead) { if (e.hp > 0 && !e.pirate) leakHP += Math.min(e.hp, e.maxHp); seen.delete(id); }
    if (G.wave >= endWave && G.spawningDone && !G.enemies.length) break;
    if (G.spawningDone && !G.enemies.length && G.next > 0.5) G.next = 0.5;
  }
  // anything still alive when time runs out counts as leaked (stops Gravity Well "winning" by stalling forever)
  for (const e of G.enemies) if (!e.dead && !e.pirate) leakHP += Math.min(e.hp, e.maxHp);
  const dmg = G.towers.reduce((a, t) => a + t.dmgDone, 0);
  return { prevented: spawnHP ? 1 - leakHP / spawnHP : 0, dpc: dmg / Math.max(1, spent), towers, spent, t: Math.round(t), waves: G.wave - W + 1, spawnHP: Math.round(spawnHP) };
}
const ATK = ['pulse', 'rail', 'cryo', 'missile', 'coil', 'flame', 'lens', 'emp', 'grav'];
const SUP = ['pylon', 'cryo', 'snare', 'coil', 'emp', 'grav'];
const cfgs = [];
for (const k of ATK) { cfgs.push({ id: k + ' L3', type: k, lv: 3 }); cfgs.push({ id: k + ' S1', type: k, lv: 4, spec: 1 }); cfgs.push({ id: k + ' S2', type: k, lv: 4, spec: 2 }); }
// support value: 70% of the budget in Pulse L3, 30% in the support tower (vs 100% Pulse)
cfgs.push({ id: 'pulse-only', type: 'pulse', lv: 3 });
for (const k of SUP) { cfgs.push({ id: 'pulse+' + k, carrier: 'pulse', share: 0.3, type: k, lv: 3 }); cfgs.push({ id: 'pulse+' + k + ' S1', carrier: 'pulse', share: 0.3, type: k, lv: 4, spec: 1 }); cfgs.push({ id: 'pulse+' + k + ' S2', carrier: 'pulse', share: 0.3, type: k, lv: 4, spec: 2 }); }
// calibration: find the budget multiplier at which Pulse L3 alone stops about 55% of the wave HP
if (process.env.CALIB) {
  let lo = 0.2, hi = 12;
  for (let i = 0; i < 9; i++) { const m = Math.sqrt(lo * hi); let pv = 0; for (let s2 = 0; s2 < SEEDS; s2++) pv += runConfig({ id: 'cal', type: 'pulse', lv: 3, bmult: m }, s2).prevented; pv /= SEEDS; if (pv > 0.55) hi = m; else lo = m; }
  console.log(JSON.stringify({ w: W, bmult: +Math.sqrt(lo * hi).toFixed(3) })); process.exit(0);
}
for (const cfg of cfgs) {
  if (FILTER && !cfg.id.startsWith(FILTER)) continue;
  const rs = []; for (let s = 0; s < SEEDS; s++) rs.push(runConfig(cfg, s));
  const avg = k => rs.reduce((a, r) => a + r[k], 0) / rs.length;
  console.log(JSON.stringify({ w: W, id: cfg.id, t: Math.round(avg('t')), waves: avg('waves'), hp: Math.round(avg('spawnHP')), prevented: +avg('prevented').toFixed(3), dpc: +avg('dpc').toFixed(2), towers: +avg('towers').toFixed(1), spent: Math.round(avg('spent')) }));
}
