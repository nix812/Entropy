// A bot that plays like an attentive person. Usage: node smartbot.js runs points chaos startWave bestWave [keystone]
const { load } = require('./harness');
const S = load();
const [runs = 6, points = 0, chaos = 1, sw = 1, bw = 0, ks = ''] = process.argv.slice(2).map((v, i) => i < 5 ? +v : v);
function profile(seed) {
  const P = S.defaultProfile(); P.bestWave = bw; S.PROF = P;
  if (process.env.NOVA) { const [rm, lw] = process.env.NOVA.split(':'); P.remnants = rm ? rm.split(',') : []; P.laws = lw ? lw.split(',') : []; P.nova = Math.max(P.remnants.length, P.laws.length); }
  let xp = 0; for (let L = 0; L < points; L++) xp += 3000 + 250 * L + 3 * L * L;
  P.xp = xp + 1;
  let r = seed; const rnd = () => { r = (r * 1103515245 + 12345) % 2147483648; return r / 2147483648; };
  if (ks) { const n = S.TREE.list.find(n => n.ks === ks); if (n) S.treeAllocate(n.id); }
  let guard = 0;
  while (S.pointsFree() > 0 && guard++ < 800) {
    const cands = S.TREE.list.filter(n => !P.alloc.includes(n.id) && n.kind !== 'keystone');
    // prefer notables: pick the cheapest path to a random notable/mastery
    const goals = cands.filter(n => n.kind !== 'small');
    const g = goals[Math.floor(rnd() * goals.length)];
    const path = S.treePathTo(g.id);
    if (path && path.length <= S.pointsFree()) S.treeAllocate(g.id);
    else { const c = cands[Math.floor(rnd() * cands.length)]; const p2 = S.treePathTo(c.id); if (p2 && p2.length <= S.pointsFree() && p2.length < 3) S.treeAllocate(c.id); }
  }
}
const BASE_PLAN = ['pulse', 'cryo', 'rail', 'snare', 'pulse', 'missile', 'coil', 'flame', 'pylon', 'lens', 'forge', 'emp', 'grav', 'rail', 'missile', 'flame', 'coil', 'lens', 'cryo'];
// FORCE=type makes that tower half of every build (backbone test); the rest follows the usual mix
const PLAN = process.env.FORCE ? BASE_PLAN.flatMap(k => [process.env.FORCE, k]) : BASE_PLAN;
function coverage(G, x, y, range) {
  let c = 0;
  for (const L of G.map.lanes) for (let i = 0; i < L.pts.length; i++) { const p = L.pts[i]; if ((p.x - x - 0.5) ** 2 + (p.y - y - 0.5) ** 2 <= range * range) c += 1 + i / L.pts.length; }
  return c;
}
function bestSpot(G, type, near) {
  const D = S.TOWERS[type];
  let best = null, bs = -1;
  for (let y = 0; y < S.ROWS; y++) for (let x = 0; x < S.COLS; x++) {
    if (!S.canBuildAt(x, y)) continue;
    let sc;
    if (D.kind === 'eco') sc = 100 - Math.abs(x - 5) - Math.abs(y - 1);
    else if (D.kind === 'support' || D.kind === 'snare') { sc = 0; for (const t of G.towers) if ((t.cx - x - 0.5) ** 2 + (t.cy - y - 0.5) ** 2 <= 4) sc += t.lvl; }
    else sc = coverage(G, x, y, Math.min(D.range, 3.5));
    if (D.kind !== 'eco' && D.kind !== 'support' && D.kind !== 'snare') {
      // humans like mixing elements next to each other
      for (const t of G.towers) if ((t.cx - x - 0.5) ** 2 + (t.cy - y - 0.5) ** 2 <= 2.3 && t.s.el !== D.el) sc += 0.6;
    }
    if (sc > bs) { bs = sc; best = { x, y }; }
  }
  return best;
}
const agg = [];
const OFF = +(process.env.SEED || 0);
for (let run = OFF; run < OFF + runs; run++) {
  profile(4242 + run * 31);
  const met = { anoms: [], stab: 0, fills: 0, vetMax: 0, ascends: 0, maxCredits: 0, creditsAtWave: [], minCore: 1, conv: 0, mael: 0, storms: 0, bossTimes: {}, deathsByBoss: 0 };
  S.Hooks.onDraft = o => setImmediateQ(() => S.takeBoon(o[Math.floor(Math.random() * 3)]));
  S.Hooks.onEntropy = () => { met.fills++; };
  S.Hooks.log = (t) => { if (/CONVERGENCE/.test(t)) met.conv++; if (/MAELSTROM FORMS/.test(t)) met.mael++; if (/rolls in/.test(t)) met.storms++; };
  let q = []; const setImmediateQ = f => q.push(f);
  S.Hooks.sfx = () => {};
  const G = S.newRun({ seed: 1000 + run * 17, chaos, startWave: sw, cols: +(process.env.COLS || 39) });
  let t = 0, act = 0, pi = 0, lastWave = G.wave;
  while (!G.over && t < 3 * 3600) {
    S.simStep(1 / 30); t += 1 / 30; if (S.G.checkpoint) S.resumeCheckpoint();
    if (process.env.BOSSLOG) {
      if (!G.dbgBoss) G.dbgBoss = {};
      for (const e of G.enemies) if (e.boss && !e.gen && !e._t0) { e._t0 = t; e._w = G.wave; (G._bl || (G._bl = [])).push(e); }
      for (const e of G._bl || []) if (e.dead && !e._logged) { e._logged = 1; console.log(`BOSS w${e._w} ${e.boss} life=${(t - e._t0).toFixed(1)}s fire=${(G.time - (e._hit0 || G.time)).toFixed(1)}s road=${(e.d / e.L.len).toFixed(2)} ${e.hp > 0 ? "LEAKED" : "killed"} ph=${e.phase} hp=${Math.round(e.maxHp)} pw=${Math.round(G.power || 0)} ${Object.entries(G.dbgBoss).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => k + ':' + Math.round(v / e.maxHp * 100) + '%').join(' ')}`); G.dbgBoss = {}; }
    }
    while (q.length) q.shift()();
    met.minCore = Math.min(met.minCore, G.core.hp / G.core.max);
    if (G.wave !== lastWave) { lastWave = G.wave; met.creditsAtWave.push(G.credits);
      if (process.env.WAVELOG) console.log(`W${G.wave} core=${Math.round(G.core.hp)}/${Math.round(G.core.max)} cr=${Math.round(G.credits)} grid=${S.gridUsed()}/${S.gridCap()} leaks=${G.stats.leaks} genes=${(() => { const c = {}; let n = 0; for (const q of G.queue.concat(G.enemies)) if (q.genes) { n++; for (const g of q.genes) c[g] = (c[g] || 0) + 1; } return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + Math.round(v / n * 100)).join(","); })()} fly=${G.enemies.filter(e => e.fly).length}/${G.enemies.length} towers=${G.towers.map(t => t.type.slice(0, 4) + t.lvl).join(',')}`);
      if (process.env.TRACE && [10, 20, 30, 40, 60, 80, 100, 120].includes(G.wave)) {
        const dps = G.towers.reduce((a, t) => a + t.dps, 0);
        const top = G.towers.slice().sort((a, b) => b.dps - a.dps)[0];
        const waveHp = G.queue.reduce((a, q) => a + (q.type === 'boss' ? 30 * 40 * q.hpm : S.ENEMIES[q.type].hp * q.hpm * (q.elite ? 2.2 : 1)), 0);
        console.log(`w${G.wave} dps=${Math.round(dps)} waveHP=${Math.round(waveHp)} ratio=${(dps * 30 / waveHp).toFixed(2)} towers=${G.towers.length} credits=${Math.round(G.credits)} top=${top && top.type} L${top && top.lvl} A${top && top.asc} R${top && top.rank} sdmg=${top && Math.round(top.s.dmg)} buff=${top && top.buff.dmg.toFixed(2)} anoms=${G.anoms.join(',')} mods.dmg=${G.mods.dmg.toFixed(2)} grid=${S.gridUsed ? S.gridUsed() + '/' + S.gridCap() : '-'} genes=${(() => { const c = {}; let n = 0; for (const q of G.queue.concat(G.enemies)) if (q.genes) { n++; for (const g of q.genes) c[g] = (c[g] || 0) + 1; } return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + Math.round(v / n * 100)).join(' '); })()}`);
      } }
    if (t < act) continue;
    act = t + 0.8;
    // anomalies
    if (G.anomOffers) { if (Math.random() < 0.2 || !G.anomOffers.length) { S.stabilize(); met.stab++; } else { const id = G.anomOffers[Math.floor(Math.random() * G.anomOffers.length)]; S.takeAnomaly(id); met.anoms.push(id); } }
    // veterans
    for (const tw of G.towers) while (tw.pending > 0) { const o = S.vetOffer(tw); let bi = 0; o.forEach((a, i) => { if (a.tier > o[bi].tier) bi = i; }); S.claimVet(tw, bi); met.vetMax = Math.max(met.vetMax, tw.rank); }
    // abilities
    const alive = G.enemies.length;
    if (alive) {
      const lead = G.enemies.reduce((a, e) => (e.d / e.L.len > a.d / a.L.len ? e : a));
      if (G.charges.strike > 0 && (alive > 14 || G.bossAlive)) { const tg = G.bossAlive || lead; S.useAbility('strike', tg.x, tg.y); }
      if (G.charges.nova > 0 && alive > 25) S.useAbility('nova');
      if (G.charges.stasis > 0 && ((G.bossAlive && G.bossAlive.d / G.bossAlive.L.len > 0.6) || G.core.hp / G.core.max < 0.4)) S.useAbility('stasis');
      if (G.charges.overclock > 0 && G.bossAlive) S.useAbility('overclock');
    }
    // repair
    if (G.core.hp / G.core.max < 0.45 && G.credits > S.coreRepairCost()) S.coreUpgrade('repair');
    // call early if field is clear
    if (G.spawningDone && !alive && G.next > 3 && Math.random() < 0.5) S.callEarly();
    // spend
    let guard = 0;
    while (guard++ < 20) {
      const want = PLAN.filter(k => S.TOWERS[k].unlock <= Math.max(1, S.PROF.bestWave));
      let type = want[pi % want.length];
      if (type === 'forge' && G.wave > 35) { pi++; continue; }
      // v3.0: answer the swarm's dominant traits (set NOADAPT=1 for a bot that ignores them)
      if (!process.env.NOADAPT && G.prep && G.prep.genes) {
        const CT = { wings: ['pulse', 'rail', 'missile'], plating: ['rail', 'lens'], bulk: ['lens', 'rail'], shell: ['coil', 'emp'], brood: ['missile', 'flame', 'coil'], regen: ['flame', 'missile'], haste: ['cryo', 'grav', 'snare'], cloak: ['pylon'] };
        const top = Object.entries(G.prep.genes).filter(([g, v]) => v >= 0.3 && CT[g]).sort((a, b) => b[1] - a[1])[0];
        if (top && Math.random() < 0.5) { const c = CT[top[0]].filter(k => S.TOWERS[k].unlock <= Math.max(1, S.PROF.bestWave)); if (c.length) type = c[Math.floor(Math.random() * c.length)]; }
        // grid full and too few answers to the dominant trait: sell the weakest tower that isn't an answer, once per wave
        if (top && G.wave >= 15 && S.gridFree() < 1 && G._swapW !== G.wave) {
          const ans = CT[top[0]], have = G.towers.filter(tw => ans.includes(tw.type)).length;
          if (have < 2 + Math.floor(G.towers.length / 8)) {
            const victim = G.towers.filter(tw => !ans.includes(tw.type) && tw.s.kind !== 'eco' && tw.s.kind !== 'support' && tw.lvl <= 3 && !tw.asc).sort((a, b) => a.dps - b.dps)[0];
            if (victim) { S.sellTower(victim); G._swapW = G.wave; const c = ans.filter(k => S.TOWERS[k].unlock <= Math.max(1, S.PROF.bestWave)); if (c.length) type = c[0]; }
          }
        }
      }
      const targetCount = Math.min(40, 4 + Math.floor(G.wave * 0.55));
      const bc = S.towerCost(type);
      const ups = G.towers.filter(tw => tw.s.kind !== 'eco' || tw.lvl < 3).sort((a, b) => S.upgradeCost(a) - S.upgradeCost(b));
      const up = ups[0];
      const room = S.gridFree ? S.gridFree() : 99;
      if (G.towers.length < targetCount && room >= 1 && G.credits >= bc) {
        const sp = bestSpot(G, type); if (!sp) break;
        if (S.buildTower(type, sp.x, sp.y)) { pi++; continue; } else break;
      }
      if (up && G.credits >= S.upgradeCost(up) && (G.towers.length >= targetCount || room < 1 || S.upgradeCost(up) < bc * 0.7)) {
        if (up.lvl >= 5) met.ascends++;
        S.upgradeTower(up, 1 + Math.floor(Math.random() * 2)); continue;
      }
      if (G.credits > S.coreWeaponCost() * 2.5 && G.core.wLvl < 8) { S.coreUpgrade('weapon'); continue; }
      break;
    }
    met.maxCredits = Math.max(met.maxCredits, G.credits);
  }
  if (process.env.DUMP) for (const tw of G.towers) console.log('T', tw.type, 'L' + tw.lvl, 'A' + tw.asc, 'R' + tw.rank, 'inv', tw.invested, 'dmg', Math.round(tw.dmgDone), 'kills', tw.kills, 'at', tw.x, tw.y, tw.affixes.map(a => a.id + a.tier).join(','));
  const tot = Object.values(G.stats.dmgByEl).reduce((a, b) => a + b, 0) || 1;
  const byType = {};
  for (const tw of G.towers) byType[tw.type] = (byType[tw.type] || 0) + tw.dmgDone;
  const dmgAll = Object.values(byType).reduce((a, b) => a + b, 0) || 1;
  const bankMed = met.creditsAtWave.slice().sort((a, b) => a - b)[Math.floor(met.creditsAtWave.length / 2)] || 0;
  agg.push({ wave: G.wave, min: +(t / 60).toFixed(1), lvls: S.profLevel().level - points, killer: G.stats.lastLeak || '-', leaks: G.stats.leaks,
    fills: met.fills, anoms: met.anoms.length, vet: met.vetMax, asc: met.ascends, conv: met.conv, mael: met.mael, bank: Math.round(bankMed),
    combos: Object.values(G.stats.combos).reduce((a, b) => a + b, 0), towers: G.towers.length,
    eff: (() => { const inv = {}; for (const tw of G.towers) inv[tw.type] = (inv[tw.type] || 0) + tw.invested; const avg = dmgAll / Object.values(inv).reduce((a, b) => a + b, 0); return Object.keys(byType).filter(k => byType[k] > 0).map(k => k.slice(0, 4) + (byType[k] / inv[k] / avg).toFixed(1)).join(' '); })(),
    top: Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => k + ':' + Math.round(v / dmgAll * 100)).join(' '),
    el: Object.entries(G.stats.dmgByEl).map(([k, v]) => k + Math.round(v / tot * 100)).join(' ') });
}
console.log(`runs=${runs} points=${points} chaos=${chaos} start=${sw} best=${bw} ks=${ks || '-'}`);
console.table(agg);
const waves = agg.map(a => a.wave).sort((a, b) => a - b);
console.log('median wave', waves[Math.floor(waves.length / 2)], 'median min', agg.map(a => a.min).sort((a, b) => a - b)[Math.floor(agg.length / 2)]);
