// Shared loader for headless tests
const fs = require('fs'), vm = require('vm');
function load() {
  const src = ['data.js', 'sim.js'].map(f => fs.readFileSync(__dirname + '/../src/' + f, 'utf8')).join('\n');
  const ctx = { console, Math, Set, Map, Object, Array, JSON, Float32Array, Int32Array, Uint8Array, module: {}, process: { env: { NOGA: process.env.NOGA || '' } } };
  vm.createContext(ctx);
  vm.runInContext(src + `
this.S = { get G(){return G}, set G(v){G=v}, get PROF(){return PROF}, set PROF(v){PROF=v},
  get COLS(){return COLS}, get ROWS(){return ROWS}, TREE, TOWERS, TOWER_ORDER, ENEMIES, BOSSES, ANOMALIES, LV_COST, TILE, EL, ELS,
  newRun, simStep, buildTower, upgradeTower, upgradeCost, towerCost, canBuildAt, treeAllocate, treePathTo, takeBoon,
  useAbility, Hooks, tIdx, profLevel, pointsFree, callEarly, resumeRun, snapshotRun, reactorCost, expandReactor, geneShares, potentialDps, sellTower, gridCap, gridFree, gridUsed, setOvercharge, geneCap, breedPlan, levelFromXP, towerStats, recomputeAll,
  recomputeAuras, spawnEnemy, makeLane, prepLane, lanePos, hpMult, crMult, takeAnomaly, stabilize, vetOffer, claimVet,
  prepareWave, hit, kill, spawnBoss, spawnThief, updatePirates, releaseOverdrive, odReady, updateLinks, updateLinkBeams, updateCaches, cpPending, claimCache, cacheAt, placeNodes, isNode, genMap, mulberry32, setCols, setRows, regionAt, planRelocation, applyRelocation, relocCandidates, canRelocate, relocCost, rerollCore, rollCoreAffix, coreStats, coreUpgrade, coreWeaponCost, coreRepairCost, rerollTower, snapshotNow, defaultProfile, computeMods, genExtraLane, stormAt, resumeCheckpoint, cashIn, cashRate, cpBonus, supernova, novaReady, starBuy, regionsDone, REGION_NODES, LAWS, pointsSpent };`, ctx);
  return ctx.S;
}
module.exports = { load };
