// Shared loader for headless tests
const fs = require('fs'), vm = require('vm');
function load() {
  const src = ['data.js', 'sim.js'].map(f => fs.readFileSync(__dirname + '/../src/' + f, 'utf8')).join('\n');
  const ctx = { console, Math, Set, Map, Object, Array, JSON, Float32Array, Int32Array, Uint8Array, module: {}, process: { env: Object.assign({}, process.env) } };
  vm.createContext(ctx);
  vm.runInContext(src + `
this.S = { get G(){return G}, set G(v){G=v}, get PROF(){return PROF}, set PROF(v){PROF=v},
  get COLS(){return COLS}, get ROWS(){return ROWS}, TALENTS, TAL, TOWERS, TOWER_ORDER, ENEMIES, BOSSES, ANOMALIES, LV_COST, TILE, EL, ELS,
  newRun, simStep, buildTower, upgradeTower, upgradeCost, towerCost, canBuildAt, talentAdd, talentBlock, talentRemove, talentCanRemove, talentReset, treePts, capsHeld, activeCaps, capSlots, takeBoon,
  useAbility, Hooks, tIdx, profLevel, pointsFree, callEarly, resumeRun, snapshotRun, reactorCost, expandReactor, geneShares, potentialDps, sellTower, gridCap, gridFree, gridUsed, setOvercharge, geneCap, breedPlan, levelFromXP, towerStats, recomputeAll, warTier, ocMax, ocFree, coreStats, get DOCTRINES(){return DOCTRINES}, towerStats, readDefence, planAssault, resolveAssault, idleWaves, topTower, sellRefund,
  recomputeAuras, spawnEnemy, makeLane, prepLane, lanePos, hpMult, crMult, takeAnomaly, stabilize, vetOffer, claimVet,
  prepareWave, hit, kill, spawnBoss, spawnThief, updatePirates, releaseOverdrive, odReady, updateLinks, updateLinkBeams, updateCaches, cpPending, claimCache, cacheAt, placeNodes, startWave, marketEnsure, marketBuy, marketPlaceNode, planWanted, claimBounty, bossFire, isNode, genMap, mulberry32, setCols, setRows, regionAt, planRelocation, applyRelocation, relocCandidates, canRelocate, relocCost, rerollCore, rollCoreAffix, coreStats, coreUpgrade, coreWeaponCost, coreRepairCost, coreUplinkCost, coreHullCost, genWave, abilCdMax, abilOnline, abilSlots, updateAbils, leak, tidyCaps, rerollTower, snapshotNow, defaultProfile, computeMods, genExtraLane, stormAt, resumeCheckpoint, cashIn, cashRate, cpBonus, supernova, novaReady, LAWS, pointsSpent, treeSaveBuild, treeLoadBuild, migrateWeb, act, replayRun, runHash, huntExtract, huntPush, SIM_STEP, runKiller, nemesisArrive, nemesisName, dailySpec, HUNT, get TAL_EDIT(){return TAL_EDIT}, set TAL_EDIT(v){TAL_EDIT=v}, pointsSpent, talLevel, huntRun, towerUnlocked, vetOffer, cacheAt, rollEvents,
  SECTORS, SECTOR_BY, SECTOR_START, sectorOffers, DOOR_TIERS, PURSE, TWISTS, TWIST_FROM, HOOK_VER, enterSector, twistOffers, takeTwist, hpMult0, hookFx, sectorWanted, genWave,
  TOWER_FIRE, setFireMode, fireDef, fireLearned, xpForLevel, xpForLevelV5, xpToLevel, CAP_RENAMED, WEB_VER, TCAP, TROW, rowNeed, slotsNow, towerConditions, huntBuildProf, talentLines };`, ctx);
  return ctx.S;
}
module.exports = { load };
