// Headless balance bot. Usage: node bot.js [points] [runs] [chaos] [startWave]
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../src/data.js', 'utf8') + '\n' + fs.readFileSync(__dirname + '/../src/sim.js', 'utf8');
const vm = require('vm');
const ctx = { console, Math, Set, Object, Array, JSON, Float32Array, Int32Array, Uint8Array, module: {} };
vm.createContext(ctx);
vm.runInContext(src + '\nthis.API={get G(){return G},get PROF(){return PROF},set PROF(v){PROF=v},TREE,TOWERS,TOWER_ORDER,newRun,simStep,buildTower,upgradeTower,upgradeCost,towerCost,canBuildAt,treeAllocate,treePathTo,takeBoon,useAbility,Hooks,COLS,ROWS,tIdx,profLevel,pointsFree,callEarly,resumeRun,levelFromXP};', ctx);
const A = ctx.API;
const points = +(process.argv[2] || 0), runs = +(process.argv[3] || 3), chaos = +(process.argv[4] || 1), sw = +(process.argv[5] || 1);
let combos = 0;
function setupProfile(seed) {
  const P = { v: 1, xp: 0, alloc: ['start'], builds: [null, null, null, null, null], bestWave: +(process.env.BW||0), bestScore: 0, runs: 0, kills: 0, playTime: 0, settings: {}, runSnap: null };
  A.PROF = P;
  // give enough xp for `points` levels
  let xp = 0; for (let L = 0; L < points; L++) xp += A.levelFromXP(0).need + 600 * L + 25 * L * L;
  P.xp = xp + 1;
  // allocate greedy random walk toward notables
  let r = seed;
  const rnd = () => { r = (r * 1103515245 + 12345) % 2147483648; return r / 2147483648; };
  let guard = 0;
  while (A.pointsFree() > 0 && guard++ < 500) {
    const ids = A.TREE.list.filter(n => !P.alloc.includes(n.id) && n.kind !== 'keystone').map(n => n.id);
    const id = ids[Math.floor(rnd() * ids.length)];
    const path = A.treePathTo(id);
    if (path && path.length <= A.pointsFree() && path.length < 6) A.treeAllocate(id);
  }
}
function buildSpots(G) {
  const spots = [];
  for (let y = 0; y < A.ROWS; y++) for (let x = 0; x < A.COLS; x++) {
    if (!A.canBuildAt(x, y)) continue;
    let cov = 0;
    for (const L of G.map.lanes) for (const p of L.pts) if ((p.x - x - 0.5) ** 2 + (p.y - y - 0.5) ** 2 <= 6.25) cov++;
    spots.push({ x, y, cov });
  }
  spots.sort((a, b) => b.cov - a.cov);
  return spots;
}
const results = [];
for (let run = 0; run < runs; run++) {
  setupProfile(1234 + run * 77);
  A.Hooks.onDraft = opts => setTimeout0(() => A.takeBoon(opts[0]));
  let pending = [];
  function setTimeout0(f) { pending.push(f); }
  A.Hooks.sfx = (n) => { if (n === 'combo') combos++; };
  const G = A.newRun({ seed: 9000 + run, chaos, startWave: sw });
  const dt = 1 / 30;
  let t = 0, nextAct = 0;
  const avail = A.TOWER_ORDER.filter(k => A.TOWERS[k].kind !== 'support' && A.TOWERS[k].kind !== 'eco');
  let bi = 0;
  while (!G.over && G.wave < 120 && t < 7200) {
    A.simStep(dt); t += dt;
    while (pending.length) pending.shift()();
    if (t >= nextAct) {
      nextAct = t + 1;
      for (const k in G.charges) if (G.charges[k] > 0 && G.enemies.length > 8) { const e = G.enemies[0]; A.useAbility(k, e.x, e.y); }
      // spend: upgrade cheapest or build
      let acted = true;
      while (acted) {
        acted = false;
        const cand = G.towers.filter(tw => tw.lvl < 5).sort((a, b) => A.upgradeCost(a) - A.upgradeCost(b));
        const spots = buildSpots(G);
        const type = avail.filter(k => A.TOWERS[k].unlock <= 40)[bi % avail.length];
        const bc = A.towerCost(type);
        const wantBuild = G.towers.length < 6 + G.wave * 0.5 && spots.length;
        if (wantBuild && G.credits >= bc) { A.buildTower(type, spots[0].x, spots[0].y); bi++; acted = true; }
        else if (cand.length && G.credits >= A.upgradeCost(cand[0]) && (!wantBuild || A.upgradeCost(cand[0]) < bc * 0.6)) { A.upgradeTower(cand[0], 1 + (cand[0].id % 2)); acted = true; }
      }
    }
  }
  results.push({ wave: G.wave, min: (t / 60).toFixed(1), score: Math.round(G.score), towers: G.towers.length, xp: Math.round(G.xpEarned), lvl: A.profLevel().level, lanes: G.map.lanes.length });
}
console.log(`points=${points} chaos=${chaos} start=${sw}`);
console.table(results);
console.log('combos', combos);
