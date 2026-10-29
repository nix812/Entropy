// ===================== ENTROPY — SIMULATION =====================
const Hooks = {
  sfx() {}, fx() {}, log() {}, toast() {}, onWave() {}, onDraft() {}, onGameOver() {},
  onLevel() {}, onUnlock() {}, onChange() {}, onSave() {}, onCheckpoint() {},
  bossIntro(e, B) { this.toast(B.odd ? 'BOSS?!' : 'BOSS', `${B.name} · ${B.tip || B.desc}`, '#ff4d6a'); },
};

// ---------------- Profile (meta progression) ----------------
function defaultProfile() {
  return {
    v: 1, webV: WEB_VER, xp: 0, alloc: ['start'], builds: [null, null, null, null, null], bestWave: 0, bestScore: 0,
    runs: 0, kills: 0, playTime: 0,
    settings: { sfx: 0.8, music: 0.45, soundtrack: 'ec', hud: 'lean', dmgNums: true, shake: true },
    seenHelp: false, seenVer: '', runSnap: null, lastSetup: { startWave: 1, chaos: 1 }, updatedAt: 0,
    codex: { combos: {}, bosses: {}, anomalies: {}, legendaries: {}, maelstroms: 0, bestRank: 0, bestName: '' },
    mastery: {}, loadout: ['strike', 'nova', 'stasis', 'overclock'], orbit: {},
    nova: 0, remnants: [], laws: [], stars: {}, hall: [],
  };
}
let PROF = defaultProfile();

const profLevel = () => levelFromXP(PROF.xp);
const starSpent = () => { let t = 0; for (const k in PROF.stars || {}) t += PROF.stars[k] || 0; return t; };
const pointsSpent = () => PROF.alloc.length - 1 + starSpent();
function regionDone(rid, A) { A = A || allocSet(); return REGION_NODES[rid].every(id => A.has(id)); }
const regionsDone = () => { const A = allocSet(); return REGION_IDS.filter(r => regionDone(r, A)); };
function starBuy(rid, n) {
  if (!regionDone(rid)) return 0;
  n = Math.max(0, Math.min(n, pointsFree())); if (!n) return 0;
  PROF.stars = PROF.stars || {}; PROF.stars[rid] = (PROF.stars[rid] || 0) + n;
  if (G && !G.over) recomputeAll(); Hooks.onChange('tree'); return n;
}
function starRefund(rid, n) {
  if (G && !G.over) return 0;
  const have = (PROF.stars && PROF.stars[rid]) || 0; n = Math.min(n, have); if (!n) return 0;
  PROF.stars[rid] = have - n; if (!PROF.stars[rid]) delete PROF.stars[rid];
  Hooks.onChange('tree'); return n;
}
const novaReady = () => !PROF.runSnap && profLevel().level >= novaLevelReq(PROF.nova || 0) && regionsDone().length >= 3;
function supernova(remnant, law) {
  if (!novaReady()) return false;
  if (remnant && !PROF.remnants.includes(remnant) && remnant[0] === 's' && regionDone(remnant)) PROF.remnants.push(remnant);
  if (law && LAWS.some(L => L.id === law) && !PROF.laws.includes(law)) PROF.laws.push(law);
  PROF.nova = (PROF.nova || 0) + 1;
  PROF.xp = 0; PROF.alloc = ['start']; PROF.stars = {};
  Hooks.onChange('tree');
  return true;
}
const pointsFree = () => profLevel().level - pointsSpent();
const towerUnlocked = id => TOWERS[id].unlock <= Math.max(1, PROF.bestWave);

function allocSet() { return new Set(PROF.alloc); }
function treePathTo(id) {
  const A = allocSet();
  if (A.has(id)) return [];
  const prev = {}, q = [];
  for (const a of A) { prev[a] = null; q.push(a); }
  while (q.length) {
    const c = q.shift();
    if (c === id) break;
    for (const nb of TREE.nodes[c].adj) if (!(nb in prev)) { prev[nb] = c; q.push(nb); }
  }
  if (!(id in prev)) return null;
  const path = []; let c = id;
  while (c && !A.has(c)) { path.unshift(c); c = prev[c]; }
  return path;
}
function treeOrphans(id) {
  // nodes that would be cut off (including id) if id is removed
  if (id === 'start') return null;
  const A = allocSet(); A.delete(id);
  const seen = new Set(['start']), q = ['start'];
  while (q.length) { const c = q.shift(); for (const nb of TREE.nodes[c].adj) if (A.has(nb) && !seen.has(nb)) { seen.add(nb); q.push(nb); } }
  const out = [id];
  for (const a of A) if (!seen.has(a)) out.push(a);
  return out;
}
function treeAllocate(id) {
  const path = treePathTo(id);
  if (!path || !path.length || path.length > pointsFree()) return false;
  const before = new Set(regionsDone());
  PROF.alloc.push(...path);
  if (G && !G.over) recomputeAll();
  for (const r of regionsDone()) if (!before.has(r)) { Hooks.toast('CONSTELLATION COMPLETE', `${REGION_NAME[r]} · Star Ranks unlocked`, '#ffe9b0', 1); Hooks.sfx('levelup'); }
  Hooks.onChange('tree');
  return true;
}
function treeRefund(id) {
  const orph = treeOrphans(id);
  if (!orph) return false;
  if (G && !G.over && !G.checkpoint) {
    if (G.tokens < orph.length) return false;
    G.tokens -= orph.length;
  }
  const rm = new Set(orph);
  PROF.alloc = PROF.alloc.filter(a => !rm.has(a));
  if (G && !G.over) recomputeAll();
  Hooks.onChange('tree');
  return true;
}
function pruneAlloc(list) {
  const want = new Set(list.filter(id => TREE.nodes[id])), seen = new Set(['start']), q = ['start'];
  while (q.length) { const c = q.shift(); for (const nb of TREE.nodes[c].adj) if (want.has(nb) && !seen.has(nb)) { seen.add(nb); q.push(nb); } }
  return ['start', ...list.filter(id => id !== 'start' && seen.has(id))];
}
// returns true when an older web layout was reset (points refunded)
function migrateWeb() {
  if (PROF.webV === WEB_VER) return false;
  const had = (PROF.alloc || []).length > 1;
  PROF.alloc = ['start']; PROF.webV = WEB_VER;
  return had;
}
function treeLoadBuild(slot) {
  const b = PROF.builds[slot];
  if (!b) return 'empty';
  const valid = pruneAlloc(b.alloc);
  if (valid.length - 1 > profLevel().level) return 'points';
  if (G && !G.over && !G.checkpoint) { if (G.tokens < 2) return 'tokens'; G.tokens -= 2; }
  PROF.alloc = valid.includes('start') ? valid.slice() : ['start', ...valid];
  if (G && !G.over) recomputeAll();
  Hooks.onChange('tree');
  return 'ok';
}

function masteryPick(id) { const v = PROF.mastery && PROF.mastery[id]; return v === undefined ? 0 : v; }
function loadoutList() { const L = (PROF.loadout || []).filter(k => ABIL_ORDER.includes(k)); return L.length ? L : ABIL_ORDER.slice(); }
const FX = k => (G && G.mods && G.mods.fx && G.mods.fx[k]) || 0;
function computeMods(alloc, runMods) {
  const m = {}, ks = {};
  const orb = { dmg: {}, rate: {}, status: {}, range: {}, reson: {}, vxp: {}, flux: {}, storm: {}, vol: {}, ent: {}, rift: {}, combo: {} };
  const all = new Set(alloc);
  for (const r of PROF.remnants || []) for (const id of remnantNodes(r)) all.add(id);
  for (const r in PROF.stars || {}) if (STARS[r] && regionDone(r, new Set(alloc))) { const S = STARS[r]; m[S.key] = (m[S.key] || 0) + starTotal(r, PROF.stars[r]); }
  for (const id of all) {
    const n = TREE.nodes[id]; if (!n) continue;
    if (n.sat !== undefined) {
      const S = ORBITS[n.orbit].sats[n.sat], el = SECTOR_EL[satSector(n)];
      if (el === 'E') for (const k in S.E) m[k] = (m[k] || 0) + S.E[k];
      else orb[S.k][el] = (orb[S.k][el] || 0) + S.v;
      continue;
    }
    for (const k in n.fx) m[k] = (m[k] || 0) + n.fx[k];
    if (n.ks) ks[n.ks] = 1;
    if (n.opts) { const o = n.opts[masteryPick(id)]; if (o) for (const k in o.fx) m[k] = (m[k] || 0) + o.fx[k]; }
  }
  if (runMods) for (const k in runMods) m[k] = (m[k] || 0) + runMods[k];
  const g = k => m[k] || 0;
  const P = g('P'), Tm = g('Tm'), F = g('F'), I = g('I');
  const M = {
    ks, attrs: { P, Tm, F, I },
    dmg: 1 + (g('dmg') + P * 0.5) / 100,
    el: { K: 1 + g('dmgK') / 100, T: 1 + g('dmgT') / 100, C: 1 + g('dmgC') / 100, A: 1 + g('dmgA') / 100, V: 1 + g('dmgV') / 100, N: 1 },
    rate: 1 + (g('rate') + Tm * 0.4) / 100, rateK: g('rateK') / 100, rateA: g('rateA') / 100,
    range: 1 + (g('range') + F * 0.35) / 100, rangeKR: g('rangeKR') / 100,
    critC: g('critC'), critM: g('critM') / 100,
    stMult: 1 + F * 0.005,
    burnChance: g('burnChance'), chillChance: g('chillChance'), shockChance: g('shockChance'), markChance: g('markChance'),
    burnDmg: 1 + g('burnDmg') / 100, burnDur: 1 + g('burnDur') / 100, chillPot: 1 + g('chillPot') / 100,
    freezeDur: g('freezeDur'), shockEff: 1 + g('shockEff') / 100, markMax: 5 + g('markMax'),
    splash: g('splash'), chain: g('chain'), pierceK: g('pierceK'),
    cost: Math.max(0.5, 1 - g('costRed') / 100), upg: Math.max(0.5, 1 - g('upgRed') / 100),
    credits: 1 + g('credits') / 100, startCredits: g('startCredits'),
    coreHP: 100 + g('coreHP') + I * 1.5, shield: 20 + g('shield') + I * 0.4, shieldRegen: 1 + g('shieldRegen') / 100,
    coreDmg: 1 + g('coreDmg') / 100, coreRate: 1 + g('coreRate') / 100, coreRange: g('coreRange'),
    abilCharge: Math.max(0.4, 1 - g('abilCharge') / 100), abilPower: 1 + g('abilPower') / 100, stasisDur: g('stasisDur'),
    stormFreq: 1 + g('stormFreq') / 100, stormPow: 1 + g('stormPow') / 100, affixLuck: g('affixLuck') / 100,
    shatter: 1 + g('shatter') / 100, overload: 1 + g('overload') / 100, overloadRad: 1 + g('overloadRad') / 100,
    superRad: 1 + g('superRad') / 100, collapse: 1 + g('collapse') / 100,
    armorPen: Math.min(1, g('armorPen') / 100), eliteDmg: g('eliteDmg') / 100, frozenVuln: g('frozenVuln') / 100,
    knock: g('knock') / 100, xp: 1 + g('xp') / 100, chainIgnite: g('chainIgnite') > 0, loneWolf: g('loneWolf') / 100,
    kBurn: g('kBurn'), chillVoid: g('chillVoid'),
  };
  M.fx = m; M.orb = orb;
  if (m.infernoCore) { M.burnDmg *= 2; M.burnDur *= 0.6; }
  if (m.loadout) M.abilPower += 0.25 * (ABIL_ORDER.length - loadoutList().length);
  if (ks.glass) { M.dmg *= 1.6; M.coreHP *= 0.6; M.shield *= 0.6; }
  if (ks.conflag) { M.burnDmg *= 2.5; M.el.T *= 1.5; }
  if (ks.overgrid) M.rate *= 1.4;
  if (ks.singularity) { for (const e of ELS) M.el[e] *= e === 'V' ? 2 : 0.7; }
  if (ks.abszero) M.el.T *= 0.5;
  if (ks.dimret) M.credits *= 1.5;
  if (ks.chaos) M.affixLuck += 1.5;
  if (ks.prismatic) M.dmg *= 0.9;
  if (ks.unbreakable) M.dmg *= 0.9;
  M.raw = m;
  return M;
}

// ---------------- Run state ----------------
let G = null;
const hpMult = w => (1 + 0.14 * (w - 1)) * Math.pow(1.078, w - 1) * Math.pow(1.0011, (w - 1) * (w - 1));
const crMult = w => 1.1 * (1 + 0.05 * (w - 1));
const tIdx = (x, y) => y * COLS + x;
const RESON_DMG = 0.08;
const towerLabel = t => t.name ? `${TOWERS[t.type].name} "${t.name}"` : TOWERS[t.type].name;

function rngInt(r, a, b) { return a + Math.floor(r() * (b - a + 1)); }
function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
function wpick(r, arr, wf) {
  let tot = 0; for (const a of arr) tot += wf(a);
  let x = r() * tot;
  for (const a of arr) { x -= wf(a); if (x <= 0) return a; }
  return arr[arr.length - 1];
}

// ---------- map ----------
function prepLane(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return { pts, cum, len: cum[cum.length - 1] };
}
function makeLane(tilePts, corePt) {
  const pts = tilePts.map(p => ({ x: p.x + 0.5, y: p.y + 0.5 }));
  const lane = prepLane(pts);
  lane.tiles = tilePts;
  lane.fly = prepLane([pts[0], { x: corePt.x + 0.5, y: corePt.y + 0.5 }]);
  return lane;
}
function lanePos(L, d, out) {
  if (d <= 0) { out.x = L.pts[0].x; out.y = L.pts[0].y; out.seg = 0; return out; }
  if (d >= L.len) { const p = L.pts[L.pts.length - 1]; out.x = p.x; out.y = p.y; out.seg = L.pts.length - 2; return out; }
  let s = out.seg || 0;
  if (s > L.pts.length - 2) s = L.pts.length - 2;
  while (s > 0 && L.cum[s] > d) s--;
  while (s < L.pts.length - 2 && L.cum[s + 1] < d) s++;
  const a = L.pts[s], b = L.pts[s + 1], segL = L.cum[s + 1] - L.cum[s] || 1;
  const t = (d - L.cum[s]) / segL;
  out.x = a.x + (b.x - a.x) * t; out.y = a.y + (b.y - a.y) * t; out.seg = s;
  return out;
}

function genMap(r) {
  let fallback = null;
  for (let attempt = 0; attempt < 80; attempt++) {
    const tiles = new Array(COLS * ROWS).fill(0);
    // the core lands anywhere on the field (v1.17); wormholes can open on every side of it
    const core = { x: rngInt(r, Math.round(COLS * 0.18), COLS - 6), y: rngInt(r, 3, ROWS - 4) };
    // the main path lives inside the starting sector and enters from the edge farther from the core;
    // u counts tiles in from that edge, so one serpentine works for either side
    const R = mapRegion(core, REGION0);
    const dir = core.x + 0.5 >= (R.x0 + R.x1) / 2 ? 1 : -1, X = u => dir > 0 ? R.x0 + u : R.x1 - 1 - u;
    const uc = dir > 0 ? core.x - R.x0 : R.x1 - 1 - core.x, span = uc - 2;
    let u = 0, y = rngInt(r, R.y0 + 2, R.y1 - 3);
    const pts = [{ x: X(0), y }];
    const put = () => { pts.push({ x: X(u), y }); };
    let up = y > (R.y0 + R.y1) / 2;
    while (true) {
      const remain = uc - 2 - u;
      if (remain <= 0) break;
      const run = Math.min(remain, rngInt(r, 3, 6));
      for (let i = 0; i < run; i++) { u++; put(); }
      if (uc - 2 - u <= 0) break;
      // serpentine: mostly sweep to the far edge so the whole field gets used
      let ny;
      if (r() < 0.7) ny = up ? rngInt(r, R.y0 + 1, R.y0 + 3) : rngInt(r, R.y1 - 4, R.y1 - 2);
      else { let guard = 0; do { ny = rngInt(r, R.y0 + 1, R.y1 - 2); guard++; } while (Math.abs(ny - y) < 4 && guard < 30); }
      if (Math.abs(ny - y) < 3) ny = up ? R.y0 + 1 : R.y1 - 2;
      up = ny > y;
      while (y !== ny) { y += Math.sign(ny - y); put(); }
    }
    while (y !== core.y) { y += Math.sign(core.y - y); put(); }
    while (u < uc) { u++; put(); }
    let minY = 99, maxY = -1; for (const p of pts) { minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    const okLen = pts.length >= Math.max(28, span * 2.05) && pts.length <= span * 3.4 + 8;
    const okSpan = minY <= R.y0 + 3 && maxY >= R.y1 - 4;
    if (!okLen || !okSpan) { if (!fallback && pts.length >= Math.max(24, span * 1.8)) fallback = 1; if (attempt < 79 || !fallback) continue; }
    for (const p of pts) tiles[tIdx(p.x, p.y)] = 1;
    tiles[tIdx(core.x, core.y)] = 4;
    // obstacles
    const nObs = rngInt(r, 6, 10) + Math.floor(COLS / 12);
    for (let i = 0; i < nObs; i++) {
      const ox = rngInt(r, 1, COLS - 5), oy = rngInt(r, 0, ROWS - 1), sz = rngInt(r, 1, 3);
      for (let k = 0; k < sz; k++) {
        const tx = ox + (k === 1 ? 1 : 0), ty = oy + (k === 2 ? 1 : 0);
        if (tx < COLS && ty < ROWS && tiles[tIdx(tx, ty)] === 0 && Math.abs(tx - core.x) + Math.abs(ty - core.y) > 2) tiles[tIdx(tx, ty)] = 2;
      }
    }
    const deco = []; // decorative ground pixels
    for (let i = 0; i < COLS * ROWS; i++) deco.push(Math.floor(r() * 1000));
    return { tiles, core, lanes: [makeLane(pts, core)], deco };
  }
  throw new Error('map gen failed');
}

// New lanes open from wormholes anywhere around the core (any direction, edge or interior),
// then either merge into an existing lane or burrow straight to the core.
function genExtraLane(r, openWave) {
  const map = G.map, core = map.core;
  const R = G.region; // already grown for this wormhole
  const starts = map.lanes.map(L => L.tiles[0]);
  const open = map.lanes.filter(L => !L.openWave);
  // favour directions around the core that no wormhole has used yet
  const used = map.lanes.map(L => Math.atan2(L.tiles[0].y - core.y, L.tiles[0].x - core.x));
  const angDiff = (p, q) => Math.abs(Math.atan2(Math.sin(p - q), Math.cos(p - q)));
  const cands = [];
  for (let k = 0; k < 36; k++) { const ang = (k / 36) * Math.PI * 2 + r() * 0.15; cands.push({ ang, sc: Math.min(...used.map(u => angDiff(ang, u)), Math.PI) + r() * 0.9 }); }
  cands.sort((p, q) => q.sc - p.sc);
  for (let attempt = 0; attempt < 120; attempt++) {
    const ang = cands[attempt % cands.length].ang;
    let maxR = 0; for (let d = 1; d < COLS + ROWS; d++) { const x = Math.round(core.x + Math.cos(ang) * d), y = Math.round(core.y + Math.sin(ang) * d); if (!inRegion(x, y, R)) break; maxR = d; }
    if (maxR < 4) continue;
    // wormholes open out toward the sector's new edge
    const rad = Math.max(4, Math.round(maxR * (0.75 + r() * 0.25)));
    const sx = Math.round(core.x + Math.cos(ang) * rad), sy = Math.round(core.y + Math.sin(ang) * rad);
    if (!inRegion(sx, sy, R)) continue;
    if (map.tiles[tIdx(sx, sy)] !== 0 || G.towerAt[tIdx(sx, sy)] || G.nodeSet.has(tIdx(sx, sy))) continue;
    if (Math.abs(sx - core.x) + Math.abs(sy - core.y) < 5) continue;
    if (starts.some(p => Math.abs(p.x - sx) + Math.abs(p.y - sy) < (attempt > 60 ? 3 : 5))) continue;
    // wormholes need a little clear space around them
    let crowd = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = sx + dx, y = sy + dy; if (inRegion(x, y, R) && map.tiles[tIdx(x, y)] !== 0) crowd++; }
    if (crowd > 3) continue;
    const direct = r() < 0.6;
    let target, host = null, ti = 0;
    if (direct) target = core;
    else {
      host = pick(r, open);
      const mt = host.tiles;
      ti = rngInt(r, Math.floor(mt.length * 0.25), Math.floor(mt.length * 0.85));
      target = mt[ti];
      if (Math.abs(target.x - sx) + Math.abs(target.y - sy) < 6) continue;
    }
    const N = COLS * ROWS, dist = new Float32Array(N).fill(1e9), prev = new Int32Array(N).fill(-1), done = new Uint8Array(N);
    const s0 = tIdx(sx, sy), goal = tIdx(target.x, target.y);
    dist[s0] = 0;
    const noise = new Float32Array(N); for (let i = 0; i < N; i++) noise[i] = r() * 0.9;
    // binary heap of [dist, idx]
    const hd = [], hi = [];
    const push = (d, i) => { hd.push(d); hi.push(i); let k = hd.length - 1; while (k) { const p = (k - 1) >> 1; if (hd[p] <= hd[k]) break; [hd[p], hd[k]] = [hd[k], hd[p]]; [hi[p], hi[k]] = [hi[k], hi[p]]; k = p; } };
    const pop = () => { const i = hi[0]; const ld = hd.pop(), li = hi.pop(); if (hd.length) { hd[0] = ld; hi[0] = li; let k = 0; for (;;) { const a = 2 * k + 1, b2 = a + 1; let m = k; if (a < hd.length && hd[a] < hd[m]) m = a; if (b2 < hd.length && hd[b2] < hd[m]) m = b2; if (m === k) break; [hd[m], hd[k]] = [hd[k], hd[m]]; [hi[m], hi[k]] = [hi[k], hi[m]]; k = m; } } return i; };
    push(0, s0);
    while (hd.length) {
      const u = pop();
      if (done[u]) continue;
      if (u === goal) break;
      done[u] = 1;
      const ux = u % COLS, uy = (u / COLS) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const vx = ux + dx, vy = uy + dy;
        if (!inRegion(vx, vy, R)) continue;
        const v = tIdx(vx, vy);
        const tv = map.tiles[v], crossing = tv === 1 || tv === 5;
        if (v !== goal && ((tv !== 0 && !crossing) || G.towerAt[v] || G.nodeSet.has(v))) continue;
        let c = 1 + noise[v] + (crossing && v !== goal ? 4 : 0);
        if (v !== goal) {
          let adjPath = 0;
          for (const [ex, ey] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const wx = vx + ex, wy = vy + ey;
            if (wx >= 0 && wy >= 0 && wx < COLS && wy < ROWS) { const t2 = map.tiles[tIdx(wx, wy)]; if ((t2 === 1 || t2 === 5) && tIdx(wx, wy) !== goal) adjPath++; }
          }
          c += adjPath * 3;
        }
        if (dist[u] + c < dist[v]) { dist[v] = dist[u] + c; prev[v] = u; push(dist[v], v); }
      }
    }
    if (prev[goal] < 0) continue;
    const route = []; let c = goal;
    while (c !== -1) { route.unshift({ x: c % COLS, y: (c / COLS) | 0 }); c = prev[c]; }
    if (route.length < (direct ? (attempt > 90 ? 7 : 11) : 5)) continue;
    const mark = openWave ? 5 : 1;
    for (let i = 0; i < route.length - 1; i++) { const k = tIdx(route[i].x, route[i].y); if (map.tiles[k] === 0) map.tiles[k] = mark; }
    const full = direct ? route : route.concat(host.tiles.slice(ti + 1));
    const lane = makeLane(full, core);
    lane.branch = route.length - (direct ? 1 : 0);
    lane.openWave = openWave || 0;
    map.lanes.push(lane);
    return lane;
  }
  return null;
}
const laneOpen = (L, w) => !L.openWave || w >= L.openWave;
// the playable sector for a given number of detected wormholes (runs saved before v1.15 use the full map)
// the sector grows around where the core started, even after the core is relocated
function regionAt(stage) { const a = G.anchor || G.map.core; return G.fullMap ? mapRegion(a, 1) : mapRegion(a, stageFrac(stage, G.laneWaves.length)); }
function growRegion(stage, quiet) {
  const R = regionAt(stage), P = G.region;
  G.region = R;
  if (!P || (R.x0 === P.x0 && R.y0 === P.y0 && R.x1 === P.x1 && R.y1 === P.y1)) return false;
  extendMain(R);
  G.mapRev = (G.mapRev || 0) + 1;
  if (!quiet) Hooks.log(`Sector expanded · ${R.x1 - R.x0}×${R.y1 - R.y0}`, '#b86cff');
  return true;
}
// ---------- Power Nodes: charged tiles. A tower on one is overcharged; the core on one even more so ----------
const NODE_TOWER = { dmg: 1.25, range: 1.15, aura: 1.25 }, NODE_CORE = { dmg: 1.5, rate: 1.2 };
const isNode = (x, y) => !!(G.nodeSet && G.nodeSet.has(tIdx(x, y)));
// ---- v3.0 power grid ----
function gridCap() { return Math.min(GRID.max, GRID.base + Math.floor(Math.max(1, G.wave || 1) / GRID.perWaves)) + (G.gridBonus || 0) + ((G.mods && G.mods.gridAdd) || 0); }
function canOvercharge(t) { const k = TOWERS[t.type].kind; return k !== 'eco' && k !== 'support' && k !== 'snare'; }
function towerPower(t) { return (isNode(t.x, t.y) ? 0 : 1) + (canOvercharge(t) ? t.oc || 0 : 0); }
function gridUsed() { let n = 0; for (const t of G.towers) n += towerPower(t); return n; }
function gridFree() { return gridCap() - gridUsed(); }
function setOvercharge(t, n) {
  n = clamp(n | 0, 0, OVERCHARGE.max);
  if (!canOvercharge(t)) return false;
  if (n - (t.oc || 0) > gridFree()) return false;
  t.oc = n; t.s = towerStats(t); recomputeAuras();
  Hooks.fx('upgrade', { x: t.cx, y: t.cy, col: '#59f0b4' }); Hooks.sfx(n ? 'upgrade' : 'ui', t);
  return true;
}
function setNodes(list) { G.nodes = list; G.nodeSet = new Set(list.map(q => tIdx(q.x, q.y))); }
// n new nodes inside R (and outside P, the previous sector, when growing), near a road where possible
function placeNodes(n, R, P) {
  const map = G.map, r = G.r, list = G.nodes.slice();
  const nearRoad = (x, y) => { for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const ax = x + dx, ay = y + dy; if (ax >= 0 && ay >= 0 && ax < COLS && ay < ROWS) { const t = map.tiles[tIdx(ax, ay)]; if (t === 1 || t === 5) return true; } } return false; };
  let placed = 0;
  for (let k = 0; k < 300 && placed < n; k++) {
    const x = rngInt(r, R.x0 + 1, R.x1 - 2), y = rngInt(r, R.y0 + 1, R.y1 - 2), i = tIdx(x, y);
    if ((P && inRegion(x, y, P)) || map.tiles[i] !== 0 || G.towerAt[i]) continue;
    if (Math.abs(x - map.core.x) + Math.abs(y - map.core.y) < 3) continue;
    if (list.some(q => Math.abs(q.x - x) + Math.abs(q.y - y) < 6)) continue;
    if (k < 200 && !nearRoad(x, y)) continue;
    list.push({ x, y }); placed++;
  }
  setNodes(list);
  if (placed) G.mapRev = (G.mapRev || 0) + 1;
  return placed;
}

// ---------- Salvage caches: drop in during waves, tap to claim before they decay ----------
const CACHE_LIFE = 22;
const cacheAt = (x, y) => (G.caches || []).find(c => c.x === x && c.y === y);
const pirateSay = (kind, x, y, chance) => { if (G.r() < chance) Hooks.fx('say', { x, y: y - 0.6, t: pick(G.r, PIRATE_LINES[kind]) }); };
// drop ships: cosmetic fly-bys that release a crate as they pass over its tile
function updatePirates(dt) {
  if (!G.pirates) G.pirates = [];
  const R = G.region;
  for (const P of G.pirates) {
    P.x += P.vx * dt;
    if (!P.dropped && (P.vx > 0 ? P.x >= P.tx + 0.5 : P.x <= P.tx + 0.5)) {
      P.dropped = true;
      const c = { x: P.tx, y: P.ty, t: CACHE_LIFE, id: G.eid++, kind: P.kind };
      G.caches.push(c);
      Hooks.fx('cache', { x: c.x + 0.5, y: c.y + 0.5, kind: c.kind }); Hooks.sfx('blink');
      pirateSay(P.kind, P.x, P.y, P.kind === 'gold' ? 0.6 : 0.25);
    }
    if (P.x < R.x0 - 4 || P.x > R.x1 + 4) P.gone = true;
  }
  if (G.pirates.some(P => P.gone)) G.pirates = G.pirates.filter(P => !P.gone);
}
// an unclaimed crate about to decay sometimes draws a thief: a real flying enemy that heads for it, grabs it and leaves
function spawnThief(c) {
  const R = G.region, fromLeft = G.r() < 0.5, y0 = clamp(c.y + 0.5 + (G.r() - 0.5) * 6, R.y0 + 0.5, R.y1 - 0.5);
  const a = { x: fromLeft ? R.x0 - 1.5 : R.x1 + 1.5, y: y0 }, m = { x: c.x + 0.5, y: c.y + 0.5 }, z = { x: fromLeft ? R.x1 + 1.5 : R.x0 - 1.5, y: clamp(m.y + (G.r() - 0.5) * 8, R.y0 + 0.5, R.y1 - 0.5) };
  const L = prepLane([a, m, z]);
  const e = spawnEnemy('pirate', { L, hpm: hpMult(Math.max(1, G.wave)) * (G.CH.hp || 1) });
  e.pirate = { cache: c, grabD: L.cum[1], got: false };
  c.thief = e;
  Hooks.toast('PIRATES', 'A skiff is after your salvage. Shoot it down', '#ff4d6a');
  pirateSay('thief', a.x, a.y, 0.5);
  return e;
}
function updateCaches(dt) {
  if (!G.caches) G.caches = [];
  updatePirates(dt);
  for (const c of G.caches) {
    if (c.thief && !c.thief.dead) continue; // the loot waits for the thief
    c.t -= dt;
    if (c.t < 8 && !c.thiefRolled) { c.thiefRolled = true; if (G.wave >= 5 && G.r() < 0.25) spawnThief(c); }
  }
  if (G.caches.some(c => c.t <= 0)) G.caches = G.caches.filter(c => c.t > 0);
  if (G.wave < 3 || G.spawningDone) return;
  G.cacheT = (G.cacheT === undefined ? 20 : G.cacheT) - dt;
  if (G.wave % 10 === 0 && G.goldAt !== G.wave) G.cacheT = Math.min(G.cacheT, 4);
  if (G.cacheT > 0 || G.caches.length + G.pirates.filter(P => !P.dropped).length >= 2) return;
  G.cacheT = 30 + G.r() * 30;
  const R = G.region, core = G.map.core;
  for (let k = 0; k < 60; k++) {
    const x = rngInt(G.r, R.x0, R.x1 - 1), y = rngInt(G.r, R.y0, R.y1 - 1), i = tIdx(x, y);
    if (G.map.tiles[i] !== 0 || G.towerAt[i] || G.nodeSet.has(i) || cacheAt(x, y)) continue;
    if (Math.abs(x - core.x) + Math.abs(y - core.y) < 4) continue;
    // boss waves always bring one golden crate; from wave 10, some crates are cursed
    let kind = 'normal';
    if (G.wave % 10 === 0 && G.goldAt !== G.wave) { kind = 'gold'; G.goldAt = G.wave; }
    else if (G.wave >= 10 && G.r() < 0.22) kind = 'cursed';
    const fromLeft = G.r() < 0.5, spd = kind === 'gold' ? 14 : 18;
    G.pirates.push({ id: G.eid++, x: fromLeft ? R.x0 - 3 : R.x1 + 3, y: y + 0.5, vx: fromLeft ? spd : -spd, tx: x, ty: y, kind, dropped: false });
    if (kind === 'gold') Hooks.toast("CAPTAIN'S CHEST", 'The pirate flagship is dropping treasure. Grab it', '#ffd84a');
    return;
  }
}
function claimCache(c) {
  if (!c || !G.caches.includes(c)) return null;
  G.caches = G.caches.filter(o => o !== c);
  G.stats.crates = (G.stats.crates || 0) + 1;
  if (c.thief && !c.thief.dead) c.thief.pirate.cache = null; // beat the thief to it
  const w = Math.max(1, G.wave), roll = G.r() * 100, k2 = c.kind === 'cursed' ? 2 : 1;
  let msg;
  if (c.kind === 'gold') {
    if (G.r() < 0.5) { G.legendQueue++; msg = 'Your next tower rolls a Legendary affix'; }
    else { const v = Math.round((40 + 14 * w) * 3 * G.mods.credits), k = pick(G.r, ABIL_ORDER); G.credits += v; G.charges[k] = (G.charges[k] || 0) + 1; msg = `+${v} credits · +1 ${ABILITIES[k].name} charge`; }
  }
  else if (roll < 40) { const v = Math.round((40 + 14 * w) * G.mods.credits * k2); G.credits += v; msg = `+${v} credits`; }
  else if (roll < 60) { const k = pick(G.r, ABIL_ORDER); G.charges[k] = (G.charges[k] || 0) + k2; msg = `+${k2} ${ABILITIES[k] ? ABILITIES[k].name : k} charge${k2 > 1 ? 's' : ''}`; }
  else if (roll < 75) { addEntropy(12 * k2); msg = `+${12 * k2} Entropy`; }
  else if (roll < 90) { const v = Math.round(150 * w * k2); addScore(v); msg = `+${v} base score`; }
  else { G.tokens += k2; msg = `+${k2} Recalibration token${k2 > 1 ? 's' : ''}`; }
  if (c.kind === 'cursed') {
    // the price: an elite climbs out of a wormhole
    const lanes = G.map.lanes.filter(L => !L.openWave), types = Object.keys(ENEMIES).filter(k => ENEMIES[k].from <= w && k !== 'swarmer');
    const e = spawnEnemy(pick(G.r, types), { lane: pick(G.r, lanes), elite: 2 + Math.floor(w / 30), hpm: hpMult(w) * (G.CH.hp || 1) * 1.5 });
    e.stowaway = true;
    G.stats.cursed = (G.stats.cursed || 0) + 1;
    Hooks.fx('rift', { x: e.L.pts[0].x, y: e.L.pts[0].y });
    lanePos(e.L, 0, e); pirateSay('stow', e.x, e.y, 1);
    msg += ' · a stowaway pirate breaks loose';
  }
  Hooks.fx('cacheClaim', { x: c.x + 0.5, y: c.y + 0.5, kind: c.kind }); Hooks.sfx(c.kind === 'cursed' ? 'bosswarn' : 'cash');
  return msg;
}

// the main road reaches out to the sector's new edge, jogging a few rows on the way in.
// Enemies already walking keep their old lane object, so nobody jumps.
function extendMain(R) {
  const map = G.map, L0 = map.lanes[0], s = L0.tiles[0], r = G.r;
  // the main wormhole sits on a left or right sector edge; push it out to the new edge on that side
  const left = s.x - R.x0 <= R.x1 - 1 - s.x, edge = left ? R.x0 : R.x1 - 1, sg = left ? 1 : -1, gap = Math.abs(s.x - edge);
  if (!gap || (left ? s.x < edge : s.x > edge)) return;
  const free = (x, y) => inRegion(x, y, R) && (map.tiles[tIdx(x, y)] === 0 || map.tiles[tIdx(x, y)] === 2) && !G.towerAt[tIdx(x, y)] && !isNode(x, y);
  const route = (ny, jx) => {
    const pts = [];
    for (let x = edge; x !== jx + sg; x += sg) pts.push({ x, y: ny });
    for (let y = ny; y !== s.y;) { y += Math.sign(s.y - y); pts.push({ x: jx, y }); }
    for (let x = jx + sg; x !== s.x; x += sg) pts.push({ x, y: s.y });
    return pts.every(p => free(p.x, p.y)) ? pts : null;
  };
  let ext = null;
  if (gap >= 2) for (let k = 0; k < 10 && !ext; k++) {
    const ny = s.y + (r() < 0.5 ? -1 : 1) * rngInt(r, 3, 7);
    if (ny < R.y0 + 1 || ny > R.y1 - 2) continue;
    ext = route(ny, edge + sg * rngInt(r, 0, gap - 2));
  }
  if (!ext) ext = route(s.y, s.x - sg);
  if (!ext || !ext.length) return;
  for (const p of ext) map.tiles[tIdx(p.x, p.y)] = 1;
  map.lanes[0] = makeLane(ext.concat(L0.tiles), map.core);
}
function openLane(L) {
  if (!L.openWave) return;
  for (let i = 0; i < L.branch; i++) { const p = L.tiles[i], k = tIdx(p.x, p.y); if (G.map.tiles[k] === 5) G.map.tiles[k] = 1; }
  L.openWave = 0;
  G.mapRev = (G.mapRev || 0) + 1;
}

// ---------- run lifecycle ----------
function newRun(opts) {
  if (opts.cols) setCols(opts.cols);
  const seed = opts.seed || Math.floor(Math.random() * 1e9);
  const r = mulberry32(seed);
  const chaos = clamp(opts.chaos ?? 1, 0, 3);
  setRows(opts.rows || CHAOS_LEVELS[chaos].rows);
  G = {
    seed, r, chaos, CH: CHAOS_LEVELS[chaos], startWave: Math.max(1, opts.startWave || 1), cols: COLS,
    time: 0, speed: 1, paused: false, over: false,
    map: genMap(r), towers: [], towerAt: {}, enemies: [], projs: [], zones: [], storms: [],
    wave: 0, queue: [], spawnClock: 0, next: 18, spawningDone: true,
    credits: 0, score: 0, xpEarned: 0, kills: 0, lvlStart: profLevel().level,
    charges: { strike: 1, nova: 0, stasis: 0, overclock: 0 }, aimAbility: null,
    runMods: {}, mods: null, tokens: 2, legendQueue: 0, rerollDisc: false,
    nextMs: 0, msIdx: 0, ev: {}, evList: [], evT: {}, overclockT: 0, stasisT: 0,
    stormT: 50, lanesOpened: 0, laneWaves: CHAOS_LEVELS[chaos].lanes.slice(), laneWarn: null, rows: ROWS,
    rift: null, eid: 1, tid: 1, dmgLog: { combos: 0 }, unbreakUsed: -99, boonsTaken: [],
    core: null, dpsClock: 0, coreAngle: 0,
    checkpoint: 0, cpDue: 0, cpT: 0, entropy: 0, entWaveCombo: 0, anoms: [], anomOffers: null, af: {}, scoreMult: 1, stabilized: 0, flux: null, prep: null,
    stats: { dmgByEl: { K: 0, T: 0, C: 0, A: 0, V: 0 }, combos: {}, elites: 0, leaks: 0, bossKills: 0, peakDps: 0 },
  };
  PROF.codex = Object.assign(defaultProfile().codex, PROF.codex || {});
  G.laws = opts.daily ? [] : (PROF.laws || []).slice(); G.novaN = opts.daily ? 0 : PROF.nova || 0;
  G.af = computeAf([]); G.scoreMult = 1 + G.af.score;
  G.mods = computeMods(PROF.alloc, anomMods());
  const M = G.mods, sw = G.startWave;
  G.core = { x: G.map.core.x + 0.5, y: G.map.core.y + 0.5, hp: M.coreHP * G.af.coreHPx, max: M.coreHP * G.af.coreHPx, shield: M.shield, smax: M.shield,
    sinceHit: 99, wLvl: 1, sLvl: 1, el: 'K', cd: 0, angle: 0, kills: 0, affixes: [], rerolls: 0 };
  coreAffSum(G.core);
  G.anchor = { x: G.map.core.x, y: G.map.core.y }; G.relocUsed = 0;
  setNodes([]); G.caches = []; G.pirates = []; G.cacheT = 20;
  G.credits = Math.round(320 + M.startCredits + (sw > 1 ? 70 * (sw - 1) * (1 + 0.045 * (sw - 1)) : 0));
  G.wave = sw - 1;
  G.lanesOpened = 0;
  G.region = regionAt(0);
  placeNodes(3, G.region, null);
  while (G.laneWaves[G.lanesOpened] !== undefined && G.laneWaves[G.lanesOpened] <= sw) {
    const P0 = G.region, grew = growRegion(G.lanesOpened + 1, true);
    genExtraLane(r); G.lanesOpened++;
    if (grew) placeNodes(1, G.region, P0);
  }
  G.nextMs = Math.round(1500 * M.abilCharge * Math.pow(1.5, 0));
  if (sw > 1) { G.nextMs = Math.round(G.nextMs * Math.pow(1.4, Math.floor(sw / 4))); G.tokens += Math.floor(sw / 10); }
  G.next = sw > 1 ? 25 : 18;
  PROF.runs++;
  if (opts.daily) {
    G.daily = opts.daily.date; G.anoms = opts.daily.anoms.slice();
    if (G.anoms.includes('flux')) G.flux = { el: pick(r, ELS), t: 20 };
    recomputeAll(); G.core.hp = G.core.max; G.core.shield = G.core.smax;
  }
  prepareWave(G.wave + 1);
  Hooks.log(`Run started · Wave ${sw} · ${G.CH.name}`, '#59f0b4');
  return G;
}

function computeAf(ids) {
  const af = { coreHPx: 1, score: (G && G.laws ? G.laws.length * LAW_SCORE : 0) + (G && G.novaN ? G.novaN * NOVA_SCORE : 0) };
  for (const id of (G && G.laws) || []) { const L = LAWS.find(l => l.id === id); if (L) for (const k in L.af || {}) { if (k === 'coreHPx') af.coreHPx *= L.af[k]; else af[k] = (af[k] || 0) + L.af[k]; } }
  for (const id of ids) {
    const A = ANOMALIES.find(a => a.id === id); if (!A) continue;
    af.score += G.mods && G.mods.ks.singular ? 0.1 : 0.05;
    for (const k in A.af || {}) { if (k === 'coreHPx') af.coreHPx *= A.af[k]; else af[k] = (af[k] || 0) + A.af[k]; }
  }
  return af;
}
function anomMods() {
  const m = {};
  for (const id of G.anoms) { const A = ANOMALIES.find(a => a.id === id); if (A && A.m) for (const k in A.m) m[k] = (m[k] || 0) + A.m[k]; }
  for (const id of G.laws || []) { const L = LAWS.find(l => l.id === id); if (L && L.m) for (const k in L.m) m[k] = (m[k] || 0) + L.m[k]; }
  for (const k in G.runMods) m[k] = (m[k] || 0) + G.runMods[k];
  return m;
}
function recomputeAll() {
  if (!G) return;
  G.af = computeAf(G.anoms);
  G.scoreMult = 1 + G.af.score + 0.1 * G.stabilized;
  const M = G.mods = computeMods(PROF.alloc, anomMods());
  const c = G.core;
  if (!c.A) coreAffSum(c);
  const hpR = c.hp / c.max, shR = c.smax ? c.shield / c.smax : 1;
  c.max = M.coreHP * (1 + (c.hpBonus || 0) + (c.A.chp || 0) / 100) * G.af.coreHPx; c.hp = Math.max(1, Math.min(c.max, hpR * c.max));
  c.smax = G.af.noShield ? 0 : M.shield * (1 + 0.4 * (c.sLvl - 1)) * (1 + (c.A.cshield || 0) / 100); c.shield = Math.min(c.smax, shR * c.smax);
  for (const t of G.towers) t.s = towerStats(t);
  recomputeAuras();
}

// ---------- towers ----------
function towerCost(type) {
  const M = G.mods, D = TOWERS[type];
  let c = D.cost * M.cost * (1 + (G.af.costX || 0));
  if (M.ks.dimret) c *= 1 + 0.12 * G.towers.filter(t => t.type === type).length;
  return Math.round(c);
}
function upgradeCost(t) {
  const x = G.mods.upg * (1 + (G.af.upgX || 0));
  if (t.lvl >= MAX_LV) return Math.round(TOWERS[t.type].cost * 4 * Math.pow(2, t.asc || 0) * x); // ×2 per Ascension (v3.0 tested ×1.5 and ×1.75: both made the late game too easy) so credits stay useful under the power grid
  return Math.round(TOWERS[t.type].cost * LV_COST[t.lvl + 1] * x);
}
function rerollCost(t) {
  return Math.round(TOWERS[t.type].cost * 0.35 * (1 + t.rerolls * 0.5) * (G.rerollDisc ? 0.5 : 1));
}
const towerPool = type => TOWERS[type].kind === 'support' || TOWERS[type].kind === 'snare' ? 'pylon' : TOWERS[type].kind === 'eco' ? 'forge' : 'atk';
function rollTier(forceTier, luckBonus, minTier) {
  const r = G.r, luck = G.mods.affixLuck + (luckBonus || 0);
  let tier = forceTier;
  if (tier === 3 && G.mods.ks.celestial) tier = 2;
  if (tier === undefined) {
    const p = [0.6, 0.28 * (1 + luck * 0.4), 0.10 * (1 + luck * 0.7), 0.02 * (1 + luck)];
    for (let i = 0; i < (minTier || 0); i++) p[i] = 0;
    const tot = p[0] + p[1] + p[2] + p[3];
    let x = r() * tot; tier = minTier || 0;
    for (let i = 0; i < 4; i++) { if (!p[i]) continue; x -= p[i]; if (x <= 0) { tier = i; break; } }
    if (tier === 3 && G.mods.ks.celestial) tier = 2;
  }
  return tier;
}
function rollValue(A, tier) {
  if (A.fixed) return A.fixed[tier];
  const v = Math.round((A.lo + G.r() * (A.hi - A.lo)) * RAR_MULT[tier]);
  return A.div ? v / A.div : v;
}
// the core rolls from its own pool (defensive affixes) plus every attack affix
function rollCoreAffix(c) {
  const r = G.r;
  let tier = rollTier();
  if (tier === 3) {
    const opts = CORE_LEGS.filter(id => !c.affixes.some(a => a.id === id));
    if (opts.length) { const id = pick(r, opts); PROF.codex.legendaries[id] = 1; return { id, tier: 3, v: 0 }; }
    tier = 2;
  }
  const opts = AFFIXES.filter(A => CORE_AFFIX_W(A) > 0 && (A.min || 0) <= tier && (!A.fixed || A.fixed[tier] > 0));
  const A = wpick(r, opts, CORE_AFFIX_W);
  return { id: A.id, tier, v: rollValue(A, tier) };
}
function coreAffSum(c) {
  const A = {}, leg = {};
  for (const a of c.affixes || []) { if (a.tier === 3) leg[a.id] = 1; else A[a.id] = (A[a.id] || 0) + a.v; }
  c.A = A; c.leg = leg;
}
const coreRerollCost = () => Math.round(45 * (1 + 0.5 * (G.core.rerolls || 0)) * (G.rerollDisc ? 0.5 : 1));
function rerollCore() {
  const c = G.core, k = coreRerollCost();
  if (!c.affixes.length || G.credits < k) return false;
  G.credits -= k; c.rerolls = (c.rerolls || 0) + 1;
  const n = c.affixes.length; c.affixes = [];
  for (let i = 0; i < n; i++) c.affixes.push(rollCoreAffix(c));
  coreAffSum(c); recomputeAll();
  Hooks.sfx('reroll', {}); Hooks.fx('upgrade', { x: c.x, y: c.y, col: '#ff8a2a' });
  return true;
}
function rollAffix(t, forceTier, luckBonus, minTier, exclude) {
  const r = G.r;
  let tier = rollTier(forceTier, luckBonus, minTier);
  const pool = towerPool(t.type), ban = AFFIX_BAN[TOWERS[t.type].kind] || [];
  if (tier === 3) {
    const opts = LEGENDARIES.filter(L => L.pool === pool && !ban.includes(L.id) && !t.affixes.some(a => a.id === L.id) && !(exclude || []).includes(L.id));
    if (opts.length) return { id: pick(r, opts).id, tier: 3, v: 0 };
    tier = 2;
  }
  let opts = AFFIXES.filter(A => A.pool === pool && !ban.includes(A.id) && (A.min || 0) <= tier && (!A.fixed || A.fixed[tier] > 0));
  const fresh = opts.filter(A => !(exclude || []).includes(A.id));
  if (fresh.length) opts = fresh;
  const A = pick(r, opts);
  return { id: A.id, tier, v: rollValue(A, tier) };
}
function rollCurse(t) { return { id: pick(G.r, CURSES).id, tier: 4, v: 0 }; }
function affixText(a) {
  if (a.tier === 4) { const C = CURSES.find(c => c.id === a.id); return C ? C.t() : a.id; }
  if (a.tier === 3) { const L = LEGENDARIES.find(c => c.id === a.id); return L ? `${L.name}: ${L.t()}` : a.id; }
  const A = AFFIXES.find(c => c.id === a.id);
  return A ? A.t(a.v) : a.id;
}

function canBuildAt(x, y) {
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS || (G.region && !inRegion(x, y, G.region))) return false;
  const i = tIdx(x, y);
  return G.map.tiles[i] === 0 && !G.towerAt[i];
}
// ---------- Snare Beacons: lure fliers off their straight line into a net ----------
function lure(e) {
  if (!e.fly || e.pirate || e.lured || e.dead || !G.snares || !G.snares.length) return;
  const cx = G.core.x, cy = G.core.y, dx = cx - e.x, dy = cy - e.y, L2 = dx * dx + dy * dy || 1;
  let best = null, bd = 1e9;
  for (const t of G.snares) {
    if ((t.caught || 0) >= t.s.catches || t.disabled > 0) continue;
    const u = ((t.cx - e.x) * dx + (t.cy - e.y) * dy) / L2;
    if (u < 0.02 || u > 0.98) continue;
    const px = e.x + dx * u, py = e.y + dy * u, d = Math.hypot(t.cx - px, t.cy - py);
    if (d <= t.s.range && d < bd) { bd = d; best = t; }
  }
  if (!best) return;
  best.caught = (best.caught || 0) + 1;
  e.L = prepLane([{ x: e.x, y: e.y }, { x: best.cx, y: best.cy }, { x: cx, y: cy }]); e.d = 0;
  e.lured = best.id; e.lureT = best;
  Hooks.fx('lure', { x1: best.cx, y1: best.cy, x2: e.x, y2: e.y });
}
function lureAll() { for (const e of G.enemies) lure(e); }
function buildTower(type, x, y) {
  if (!canBuildAt(x, y) || !towerUnlocked(type)) return null;
  if (!isNode(x, y) && gridFree() < 1) { Hooks.gridFull && Hooks.gridFull(); return null; }
  const cost = towerCost(type);
  if (G.credits < cost) return null;
  G.credits -= cost;
  const t = { id: G.tid++, type, x, y, cx: x + 0.5, cy: y + 0.5, lvl: 1, spec: 0, affixes: [], rerolls: 0, invested: cost,
    cd: 0.2, angle: -Math.PI / 2, kills: 0, dmgDone: 0, dps: 0, dpsAcc: 0, mode: 'first', disabled: 0, ramp: 0, rampTarget: null,
    olT: 0, buff: { dmg: 0, rate: 0, crit: 0 }, isolated: false, flash: 0, vxp: 0, rank: 0, pending: 0, offer: null, name: null, asc: 0, reson: 0, resonWith: [] };
  if (G.legendQueue > 0 && towerPool(type) !== 'eco') { G.legendQueue--; t.affixes.push(rollAffix(t, 3)); }
  else t.affixes.push(rollAffix(t));
  if (G.mods.ks.celestial && towerPool(type) !== 'eco') t.affixes.push(rollAffix(t));
  if (G.mods.ks.chaos) t.affixes.push(rollCurse(t));
  G.towers.push(t); G.towerAt[tIdx(x, y)] = t;
  t.s = towerStats(t);
  recomputeAuras();
  if (t.s.kind === 'snare') lureAll();
  Hooks.sfx('build', t);
  Hooks.fx('build', { x: t.cx, y: t.cy, col: EL[TOWERS[type].el].col });
  return t;
}
function upgradeTower(t, specIdx) {
  if (t.lvl === 3 && !specIdx) return false;
  const cost = upgradeCost(t);
  if (G.credits < cost) return false;
  G.credits -= cost; t.invested += cost;
  if (t.lvl >= MAX_LV) {
    t.asc = (t.asc || 0) + 1;
    Hooks.log(`${towerLabel(t)} Ascended to A${t.asc}`, '#ff8a2a');
  } else t.lvl++;
  if (t.lvl === 4 && !t.spec) t.spec = specIdx;
  t.affixes.push(rollAffix(t));
  if (G.mods.ks.celestial && towerPool(t.type) !== 'eco') t.affixes.push(rollAffix(t));
  t.s = towerStats(t);
  recomputeAuras();
  Hooks.sfx('upgrade', t);
  Hooks.fx('upgrade', { x: t.cx, y: t.cy, col: RARITY[t.affixes[t.affixes.length - 1].tier].col });
  return true;
}
function rerollTower(t) {
  const cost = rerollCost(t);
  if (G.credits < cost) return false;
  G.credits -= cost; t.rerolls++;
  t.affixes = t.affixes.map(a => a.tier === 4 ? a : null);
  const n = t.affixes.filter(a => a === null).length;
  t.affixes = t.affixes.filter(a => a);
  for (let i = 0; i < n; i++) t.affixes.push(rollAffix(t));
  t.s = towerStats(t);
  recomputeAuras();
  Hooks.sfx('reroll', t);
  Hooks.fx('upgrade', { x: t.cx, y: t.cy, col: '#ff8a2a' });
  return true;
}
function sellRefund(t) { return Math.round(t.invested * (G.checkpoint ? 1 : Math.max(G.af.scav ? 0.9 : 0.7, FX('sellPct') / 100))); }
function sellTower(t) {
  G.credits += sellRefund(t);
  G.towers = G.towers.filter(o => o !== t);
  delete G.towerAt[tIdx(t.x, t.y)];
  recomputeAuras();
  Hooks.sfx('sell', t);
  Hooks.fx('sell', { x: t.cx, y: t.cy });
}

function towerStats(t) {
  const D = TOWERS[t.type], M = G.mods, lv = t.lvl;
  const sp = t.spec ? D.specs[t.spec - 1].m : {};
  const s = { el: D.el, el0: D.el, kind: D.kind };
  if (M.ks.conflag && D.el !== 'N') s.el = 'T'; // damage turns Thermal, but Resonance still reads the tower's own element (el0)
  const A = {}, leg = {}, cur = {};
  for (const a of t.affixes) {
    if (a.tier === 3) leg[a.id] = 1;
    else if (a.tier === 4) cur[a.id] = 1;
    else A[a.id] = (A[a.id] || 0) + a.v;
  }
  s.leg = leg; s.cur = cur;
  const O = M.orb || {}, oe = k => (O[k] && O[k][s.el]) || 0;
  const fluxAny = O.flux && Object.keys(O.flux).length;
  s.dmg = (1 + (oe('dmg') + oe('flux')) / 100) * (fluxAny && !oe('flux') ? 0.92 : 1) * D.dmg * LV_DMG[lv] * Math.pow(1.3, t.asc || 0) * Math.pow(1.05, t.rank || 0) * (sp.dmgX || 1) * (1 + (A.dmg || 0) / 100) * (cur.cdmg ? 0.85 : 1) * M.dmg * M.el[s.el];
  let rate = D.rate * (sp.rateX || 1) * (1 + (A.rate || 0) / 100) * (cur.crate ? 0.85 : 1) * M.rate;
  if (s.el === 'K') rate *= 1 + M.rateK;
  if (s.el === 'A') rate *= 1 + M.rateA;
  s.rate = rate * (1 + oe('rate') / 100);
  let range = (D.range + (sp.rangeAdd || 0)) * (1 + 0.05 * (lv - 1) + 0.03 * (t.asc || 0));
  if (D.kind === 'support' || D.kind === 'snare') range *= (1 + (A.prange || 0) / 100) * M.range;
  else {
    range *= (1 + (A.range || 0) / 100) * (cur.crange ? 0.85 : 1) * M.range;
    if (t.type === 'pulse' || t.type === 'rail') range *= 1 + M.rangeKR;
  }
  s.range = range * (D.kind === 'support' || D.kind === 'snare' ? 1 : 1 + oe('range') / 100);
  s.critC = (D.crit || 0) + (sp.critC || 0) + (A.critC || 0) + M.critC;
  s.critM = 1.5 + (A.critM || 0) / 100 + M.critM;
  if (s.el === 'K') { s.critC += FX('critCK'); s.critM += FX('critMK') / 100; }
  s.pierce = (D.pierce || 0) + (sp.pierce || 0) + (A.pierce || 0) + (s.el === 'K' ? M.pierceK : 0);
  s.chain = D.chain ? D.chain + (sp.chain || 0) + (A.chain || 0) + M.chain : (A.chain || 0);
  s.splash = D.splash ? D.splash + (sp.splash || 0) + (A.splash || 0) + M.splash : (A.splash || 0);
  s.multi = (sp.multi || 0) + (A.multi || 0) + (s.el === 'A' ? FX('multiA') : 0);
  const st = D.st || {}, sm = M.stMult;
  const ost = oe('status') / 100;
  if (s.el === 'K') s.critC += oe('status');
  s.burn = clamp(((st.burn || 0) + (s.el === 'T' ? ost : 0) + ((A.burn || 0) + M.burnChance + (s.el === 'K' ? M.kBurn : 0)) / 100 + (M.ks.conflag ? 0.35 : 0)) * sm, 0, 1);
  s.chill = clamp(((st.chill || 0) + (s.el0 === 'C' ? ost : 0) + ((A.chill || 0) + M.chillChance) / 100) * sm, 0, 1);
  if (M.ks.conflag) { s.burn = clamp(s.burn + s.chill, 0, 1); s.chill = 0; } // Conflagration: Chill becomes Burn
  s.shock = clamp(((st.shock || 0) + (s.el === 'A' ? ost : 0) + (sp.addShock || 0) + ((A.shock || 0) + M.shockChance) / 100) * sm, 0, 1);
  s.mark = clamp(((st.mark || 0) + (s.el === 'V' ? ost : 0) + (sp.addMark || 0) + ((A.mark || 0) + M.markChance) / 100) * sm, 0, 1);
  s.chillPot = (sp.chillPot || 1) * M.chillPot;
  s.freezeBonus = (sp.freezeBonus || 0) + M.freezeDur;
  s.shockX = sp.shockX || 1; s.burnX = sp.burnX || 1;
  s.stun = sp.stun || 0; s.stunDur = sp.stunDur || D.stunDur || 0;
  s.rampMax = sp.rampMax || D.rampMax || 1; s.beams = (sp.beams || 1) + (D.kind === 'beam' ? s.multi : 0);
  s.pull = (D.pull || 0) * (sp.pullX || 1); s.shells = (sp.shells || 1) + (D.kind === 'mortar' ? s.multi : 0); s.cluster = sp.cluster || 0; s.napalm = !!sp.napalm;
  s.shred = !!sp.shred; s.shatterField = sp.shatterField || 0;
  s.exec = A.exec || 0; s.bounty = (A.bounty || 0) / 100; s.boss = (A.boss || 0) / 100 + M.eliteDmg; s.slowd = (A.slowd || 0) / 100;
  s.pspd = D.pspd || 10;
  if (D.kind === 'support') {
    const aura = (1 + (A.aura || 0) / 100) * (leg.nexus ? 1.5 : 1), lm = 1 + 0.2 * (lv - 1) + 0.1 * (t.asc || 0);
    s.buffDmg = Math.min(0.75, (D.buffDmg + (sp.buffDmg || 0)) * lm * aura / 100);
    s.buffRate = Math.min(0.5, D.buffRate * lm * aura / 100);
    s.buffCrit = Math.min(30, (sp.buffCrit || 0) * aura);
    if (leg.nexus) s.range += 1;
  }
  if (D.kind === 'snare') {
    const aura = (1 + (A.aura || 0) / 100) * (leg.nexus ? 1.5 : 1);
    s.catches = Math.round((D.catches + (sp.catches || 0)) * (1 + 0.5 * (lv - 1) + 0.25 * (t.asc || 0)) * aura);
    s.netR = D.net * (1 + 0.1 * (lv - 1));
    s.netSlow = Math.min(0.85, (sp.netSlow || D.netSlow) * Math.sqrt(aura));
    s.hold = (sp.hold || D.hold) * (1 + 0.15 * (lv - 1));
    if (leg.nexus) s.range += 1;
  }
  s.node = isNode(t.x, t.y);
  if (s.node) {
    s.dmg *= NODE_TOWER.dmg; s.range *= NODE_TOWER.range;
    if (D.kind === 'support') { s.buffDmg = Math.min(0.9, s.buffDmg * NODE_TOWER.aura); s.buffRate = Math.min(0.6, s.buffRate * NODE_TOWER.aura); }
    if (D.kind === 'snare') s.catches = Math.round(s.catches * NODE_TOWER.aura);
  }
  if (D.kind === 'eco') {
    s.income = D.income * (1 + 0.5 * (lv - 1)) * (sp.incomeX || 1) * (1 + (A.yield || 0) / 100) * (leg.midas ? 2 : 1) * (s.node ? NODE_TOWER.aura : 1);
    s.fbounty = (A.fbounty || 0) / 100; s.bountyAura = sp.bounty || 0; s.interest = leg.midas ? 0.01 : 0;
    s.range = s.bountyAura ? 3 : 0;
  }
  s.ground = !!D.ground;
  const oc = canOvercharge(t) ? (t.oc || 0) : 0;
  if (oc) { s.dmg *= 1 + OVERCHARGE.dmg * oc; s.rate *= 1 + OVERCHARGE.rate * oc; }
  return s;
}
function recomputeAuras() {
  for (const t of G.towers) { t.buff = { dmg: 0, rate: 0, crit: 0 }; t.isolated = true; t.reson = 0; t.resonWith = []; }
  for (const t of G.towers) {
    const els = new Set();
    for (const o of G.towers) {
      if (o === t) continue;
      const d2 = dist2(t.cx, t.cy, o.cx, o.cy);
      if (d2 <= 1.5 * 1.5 + 0.01) {
        t.isolated = false;
        { const te = t.s.el0 || t.s.el, oe = o.s.el0 || o.s.el; if (te !== 'N' && oe !== 'N' && oe !== te && !els.has(oe)) { els.add(oe); t.resonWith.push(o); } }
      }
      if (o.s.kind === 'support' && d2 <= o.s.range * o.s.range) {
        t.buff.dmg = Math.max(t.buff.dmg, o.s.buffDmg); t.buff.rate = Math.max(t.buff.rate, o.s.buffRate); t.buff.crit = Math.max(t.buff.crit, o.s.buffCrit);
      }
    }
    t.reson = Math.min(4, els.size + ((G.mods.orb && G.mods.orb.reson[t.s.el]) || 0));
    t.buff.dmg += RESON_DMG * t.reson;
  }
  G.pylons = G.towers.filter(t => t.s.kind === 'support');
  G.forges = G.towers.filter(t => t.s.kind === 'eco');
  G.snares = G.towers.filter(t => t.s.kind === 'snare');
  updateLinks();
}
// ---------- Node Links: combat towers on Power Nodes within LINK_MAX tiles share a beam ----------
const LINK_MAX = 9, LINK_DMG = 0.1, LINK_BEAM = 0.5;
function updateLinks() {
  G.links = [];
  const on = G.towers.filter(t => t.s.node && !['support', 'eco', 'snare'].includes(t.s.kind));
  for (const t of G.towers) t.linkedTo = null;
  for (let i = 0; i < on.length; i++) for (let j = i + 1; j < on.length; j++) {
    const a = on[i], b = on[j];
    if (dist2(a.cx, a.cy, b.cx, b.cy) > LINK_MAX * LINK_MAX) continue;
    G.links.push([a, b]);
    for (const [t, o] of [[a, b], [b, a]]) { if (!t.linkedTo) { t.linkedTo = o; t.buff.dmg += LINK_DMG; } }
  }
}
function updateLinkBeams(dt) {
  for (const [a, b] of G.links || []) {
    if (a.disabled > 0 || b.disabled > 0) continue;
    const dps = LINK_BEAM * (a.s.dmg * a.s.rate + b.s.dmg * b.s.rate) / 2;
    const dx = b.cx - a.cx, dy = b.cy - a.cy, L2 = dx * dx + dy * dy || 1;
    for (const e of G.enemies) {
      if (e.dead) continue;
      const u = clamp(((e.x - a.cx) * dx + (e.y - a.cy) * dy) / L2, 0, 1);
      if (dist2(e.x, e.y, a.cx + dx * u, a.cy + dy * u) > 0.3) continue;
      hit(e, dps * dt, u < 0.5 ? a.s.el : b.s.el, u < 0.5 ? a : b, { noStatus: 1, dot: 1 });
    }
  }
}

// ---------- Core Overdrive: once per run, from Wave OD_WAVE, the core wipes every non-boss enemy on the map ----------
const OD_WAVE = 35, OD_BOSS = 0.2;
const odReady = () => !!(G && !G.over && !G.odUsed && G.wave >= OD_WAVE);
function odAnnounce() { if (G.wave >= OD_WAVE && !G.odUsed && !G.odToldAt) { G.odToldAt = G.wave; Hooks.toast('OVERDRIVE ONLINE', 'Tap the core: one board clear this run', '#59f0b4'); Hooks.sfx('milestone'); } }
function releaseOverdrive() {
  if (G.over) return 'over';
  if (G.odUsed) return 'used';
  if (G.wave < OD_WAVE) return 'locked';
  if (!G.enemies.some(e => !e.dead && !e.boss)) return 'empty';
  G.odUsed = G.wave;
  const c = G.core;
  let n = 0;
  // several passes: splitters and split elites leave children behind
  for (let pass = 0; pass < 6; pass++) {
    const tg = G.enemies.filter(e => !e.dead && !e.boss);
    if (!tg.length) break;
    for (const e of tg) { if (e.dead) continue; Hooks.fx('spark', { x: e.x, y: e.y, col: PAL_CORE }); kill(e, null, { abil: 1 }); n++; }
  }
  // bosses ride it out: they lose a chunk of their remaining HP but never die to it
  for (const e of G.enemies) if (!e.dead && e.boss) { e.hp = Math.max(1, e.hp * (1 - OD_BOSS)); e.st.stun = Math.max(e.st.stun || 0, 0.6); }
  G.stats.odKills = n;
  Hooks.fx('overdrive', { x: c.x, y: c.y, r: Math.hypot(COLS, ROWS) }); Hooks.sfx('nova'); Hooks.fx('shake', { v: 10 });
  Hooks.log(`Overdrive · ${n} enemies erased`, '#59f0b4');
  return 'ok';
}
const PAL_CORE = '#59f0b4';

// ---------- storms ----------
function stormAt(x, y) {
  const res = { K: 1, T: 1, C: 1, A: 1, V: 1, range: 1, slow: 0, vuln: 0, haste: 0, mael: false };
  if (!G.storms.length) return res;
  const pow = G.mods.stormPow;
  for (const s of G.storms) {
    if (dist2(x, y, s.x, s.y) > s.r * s.r) continue;
    res.inStorm = true;
    if (s.mael) {
      for (const e of ELS) res[e] *= 1 + 0.75 * pow;
      res.haste += 0.3; res.mael = true;
      continue;
    }
    const amp = (s.types.length > 1 ? 1.25 : 1) * pow;
    for (const ty of s.types) {
      const S = STORMS[ty];
      res[S.el] *= 1 + 0.4 * amp;
      if (ty === 'cryo') res.slow += 0.15 * amp;
      if (ty === 'void') res.vuln += 0.1 * amp;
      if (ty === 'static') res.range *= 0.85;
    }
  }
  return res;
}
function spawnStorm(types, x, y, vx, vy) {
  const s = { id: G.eid++, types, x, y, vx, vy, r: 3 + G.r() * 1.2, life: 30 + G.r() * 15, age: 0, mael: false, spawnT: 0, rot: 0 };
  G.storms.push(s);
  const nm = stormName(s);
  Hooks.log(`${nm} incoming`, STORMS[types[0]].col);
  Hooks.sfx('storm', s);
  return s;
}
function stormName(s) {
  if (s.mael) return 'Maelstrom';
  if (s.types.length === 1) return STORMS[s.types[0]].name;
  if (s.types.length === 2) return COMBO_STORMS[s.types.slice().sort().join('+')] || 'Convergence';
  return 'Convergence';
}
function updateStorms(dt) {
  const M = G.mods;
  if (G.wave >= 6 || G.storms.length) {
    G.stormT -= dt;
    if (G.stormT <= 0 && G.wave >= 6 && G.storms.length >= 3 + (G.af.magnet ? 1 : 0)) G.stormT = 5;
    if (G.stormT <= 0 && G.wave >= 6) {
      G.stormT = (32 + G.r() * 28) / (M.stormFreq * G.CH.storm * (1 + Math.min(G.wave, 60) / 40) * (G.af.magnet ? 3 : 1));
      const ob = G.mods.orb ? G.mods.orb.storm : {}, SK = { K: 'static', T: 'solar', C: 'cryo', A: 'ion', V: 'void' };
      const wts = STORM_KEYS.map(k => Object.keys(ob).some(el => SK[el] === k) ? 3 : 1);
      let rr = G.r() * wts.reduce((a, b) => a + b, 0), ty = STORM_KEYS[0];
      for (let i = 0; i < STORM_KEYS.length; i++) { rr -= wts[i]; if (rr <= 0) { ty = STORM_KEYS[i]; break; } }
      const edge = G.r() < 0.5, Rg = G.region;
      const x = edge ? Rg.x0 - 2 : rngInt(G.r, Rg.x0 + 4, Rg.x1 - 8), y = edge ? rngInt(G.r, Rg.y0 + 2, Rg.y1 - 3) : (G.r() < 0.5 ? Rg.y0 - 2 : Rg.y1 + 2);
      const tx = rngInt(G.r, Rg.x0 + 6, Rg.x1 - 6), ty2 = rngInt(G.r, Rg.y0 + 3, Rg.y1 - 4);
      const d = Math.hypot(tx - x, ty2 - y), sp = 0.35 + G.r() * 0.25;
      spawnStorm([ty], x, y, (tx - x) / d * sp, (ty2 - y) / d * sp);
    }
  }
  for (const s of G.storms) {
    s.age += dt; s.rot += dt * (s.mael ? 2.4 : 0.8);
    if (s.mael) {
      const cx = (G.region.x0 + G.region.x1) / 2, cy = (G.region.y0 + G.region.y1) / 2;
      s.x += (cx - s.x) * dt * 0.15; s.y += (cy - s.y) * dt * 0.15;
      s.spawnT -= dt;
      if (s.spawnT <= 0) {
        s.spawnT = 4;
        for (let k = 0; k < 2; k++) spawnEnemy('voidling', { fromPt: { x: s.x + (G.r() - 0.5) * 2, y: s.y + (G.r() - 0.5) * 2 } });
      }
    } else {
      s.x += s.vx * dt; s.y += s.vy * dt;
      s.vx += (G.r() - 0.5) * dt * 0.1; s.vy += (G.r() - 0.5) * dt * 0.1;
      // storms are drawn to each other (convergence) and, with Storm Magnet, to your towers
      for (const o of G.storms) if (o !== s && !o.dead) {
        const dx = o.x - s.x, dy = o.y - s.y, d = Math.hypot(dx, dy) || 1;
        if (d < 12) { s.vx += dx / d * 0.05 * dt; s.vy += dy / d * 0.05 * dt; }
      }
      if (G.af.magnet && G.towers.length) {
        const tg = G.towers[(s.id * 7) % G.towers.length];
        const dx = tg.cx - s.x, dy = tg.cy - s.y, d = Math.hypot(dx, dy) || 1;
        s.vx += dx / d * 0.08 * dt; s.vy += dy / d * 0.08 * dt;
      }
      const sp = Math.hypot(s.vx, s.vy);
      if (sp > 0.7) { s.vx *= 0.7 / sp; s.vy *= 0.7 / sp; }
    }
  }
  // convergence
  for (let i = 0; i < G.storms.length; i++) for (let j = i + 1; j < G.storms.length; j++) {
    const a = G.storms[i], b = G.storms[j];
    if (a.dead || b.dead || a.mael || b.mael) continue;
    if (dist2(a.x, a.y, b.x, b.y) < Math.pow((a.r + b.r) * 0.45, 2)) {
      a.dead = b.dead = true;
      const types = [...new Set(a.types.concat(b.types))];
      const hasMael = G.storms.some(s => s.mael && !s.dead);
      const n = { id: G.eid++, types, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, vx: (a.vx + b.vx) / 2, vy: (a.vy + b.vy) / 2,
        r: Math.max(a.r, b.r) + 0.7, life: 32, age: 0, mael: false, spawnT: 2, rot: 0 };
      if (!hasMael && G.time - (G.lastMael || -999) > 90 && (types.length >= 3 || (G.wave >= 25 && G.r() < 0.4))) {
        G.lastMael = G.time;
        n.mael = true; n.r = 5.2; n.life = 30; n.types = STORM_KEYS.slice();
        Hooks.log('Maelstrom formed', '#ff4d6a');
        addEntropy(8); PROF.codex.maelstroms = (PROF.codex.maelstroms || 0) + 1;
        Hooks.toast('MAELSTROM', '+75% Damage inside · Collapses in 30s', '#ff4d6a');
        Hooks.sfx('maelstrom');
      } else {
        Hooks.log(`Storms merged: ${stormName(n)}`, '#ffe14d');
        addEntropy(4);
        Hooks.toast('STORMS MERGED', stormName(n), '#ffe14d');
        Hooks.sfx('converge');
      }
      G.storms.push(n);
    }
  }
  for (const s of G.storms) {
    if (s.dead) continue;
    const Rg = G.region, out = s.x < Rg.x0 - 6 || s.y < Rg.y0 - 6 || s.x > Rg.x1 + 6 || s.y > Rg.y1 + 6;
    if (s.age > s.life || (out && s.age > 8)) {
      s.dead = true;
      if (s.mael) {
        Hooks.sfx('implode'); Hooks.fx('implode', { x: s.x, y: s.y, r: s.r });
        Hooks.log('Maelstrom collapsed', '#ff4d6a');
        for (const e of G.enemies) {
          if (e.dead || dist2(e.x, e.y, s.x, s.y) > s.r * s.r) continue;
          hit(e, e.maxHp * (e.boss ? 0.08 : 0.25), 'V', null, { noStatus: 1, abil: 1 });
        }
      }
    }
  }
  G.storms = G.storms.filter(s => !s.dead);
}

// ---------- waves ----------
function rollEvents(w) {
  const ev = {}, list = [];
  if (w < 5) return { ev, list };
  const maxN = 1 + Math.floor(w / 18);
  let chance = Math.min(0.85, (0.28 + w * 0.012) * G.CH.ev);
  for (let i = 0; i < maxN; i++) {
    if (G.r() > chance) break;
    const opts = EVENTS.filter(E => E.from <= w && !ev[E.id]);
    if (!opts.length) break;
    const E = wpick(G.r, opts, e => e.w);
    ev[E.id] = 1; list.push(E);
    chance *= 0.6;
  }
  return { ev, list };
}
function prepareWave(w) {
  // build the next wave during the countdown so the player can see it coming
  // a wormhole appears two waves before its lane opens
  if (G.laneWaves[G.lanesOpened] === w + 1) {
    const P0 = G.region, grew = growRegion(G.lanesOpened + 1);
    const L = genExtraLane(G.r, w + 1);
    G.lanesOpened++;
    if (grew && placeNodes(1, G.region, P0)) Hooks.log('New Power Node in the expanded sector', '#6ae2ff');
    if (L) {
      G.mapRev = (G.mapRev || 0) + 1;
      Hooks.toast('WORMHOLE DETECTED', `${grew ? 'Sector expanding · ' : ''}Lane opens at Wave ${w + 1}`, '#b86cff');
      Hooks.log(`Wormhole detected · opens at Wave ${w + 1}`, '#b86cff');
      Hooks.fx('wormhole', { lane: L });
      Hooks.sfx('lane');
    }
  }
  for (const L of G.map.lanes) if (L.openWave && L.openWave === w) {
    openLane(L);
    G.cpDue = w;
    Hooks.toast('WORMHOLE OPEN', `Enemies arrive through it in Wave ${w}`, '#ff4d6a');
    Hooks.log('Wormhole open · new lane active', '#ff4d6a');
    Hooks.fx('lane', { lane: L });
    Hooks.sfx('lane');
  }
  const E = rollEvents(w);
  const g = genWave(w, E.ev);
  const counts = {}, genes = {}; let elites = 0, fly = 0, boss = null, ng = 0;
  for (const q of g.queue) {
    if (q.type === 'boss') { boss = BOSSES.find(b => b.id === q.boss); continue; }
    if (q.genes) { ng++; for (const x of q.genes) genes[x] = (genes[x] || 0) + 1; if (q.genes.includes('wings')) fly++; }
    counts[q.type] = (counts[q.type] || 0) + 1;
    if (q.elite) elites++;
    if (ENEMIES[q.type].fly) fly++;
  }
  for (const k in genes) { genes[k] = ng ? genes[k] / ng : 0; if (genes[k] > ((G.stats.peakGene || {}).v || 0)) G.stats.peakGene = { g: k, v: genes[k], w }; }
  G.prep = { w, ev: E.ev, list: E.list, queue: g.queue, rift: g.rift, counts, elites, fly, boss, total: g.queue.length, genes };
  // announce a trait when it takes hold (35%+), again only after it has faded below 20%
  const told = G.geneTold || (G.geneTold = {});
  for (const k of GENE_IDS) {
    const sh = genes[k] || 0;
    if (sh >= 0.35 && !told[k]) { told[k] = 1; Hooks.toast('SWARM EVOLVES', `${GENES[k].name} ${Math.round(sh * 100)}% · counter: ${GENES[k].counter}`, GENES[k].col); Hooks.log(`Evolution: ${GENES[k].name} ${Math.round(sh * 100)}%`, GENES[k].col); }
    else if (sh < 0.2 && told[k]) told[k] = 0;
  }
}
// ===================== v3.0: THE EVOLVING SWARM =====================
// A small genetic algorithm. Every ordinary enemy carries a genome (up to geneCap genes). When it dies or leaks we record how far
// it got compared with the average for its species (its advantage). Each wave is bred from last generation's best genomes
// (softmax on advantage, crossover, mutation) plus 25% random immigrants, so the swarm drifts towards whatever your defence
// handles worst, and drifts away again when you answer it. Fitness halves every wave so it tracks the current defence.
function geneCap(w) { return w < 8 ? 0 : w < 22 ? 1 : w < 45 ? 2 : 3; }
function geneKey(genes, el) { const g = genes.slice().sort(); return g.join('+') + (g.includes('ward') ? '|' + el : ''); }
function parseGenes(k) { const [a, el] = k.split('|'); return { genes: a ? a.split('+') : [], el: el || null }; }
function geneOk(type, g, w) { const D = ENEMIES[type]; if (GENES[g].from && (w || G.wave || 1) < GENES[g].from) return false; return !(g === 'wings' && D.fly) && !(g === 'cloak' && D.cloak) && !(g === 'brood' && (type === 'swarmer' || type === 'splitter')) && !(g === 'plating' && D.armor); }
function breedPlan(w) {
  const F = G.geneFit || (G.geneFit = {}), par = [];
  for (const k in F) { const v = F[k]; if (v.n >= 1.5) par.push({ k, adv: v.s / v.n }); }
  par.sort((a, b) => b.adv - a.adv);
  const top = (typeof process !== 'undefined' && process.env && process.env.NOGA) ? [] : par.slice(0, 10); // NOGA: genes stay random (balance tests)
  // selection pressure ramps up: close to random early (you can't diversify yet), full strength from Wave 30
  const press = 4 * clamp((w - 8) / 22, 0.1, 1);
  for (const p of top) p.wt = Math.exp(p.adv * press);
  // the next generation starts here: halve old evidence
  for (const k in F) { F[k].s *= 0.5; F[k].n *= 0.5; if (F[k].n < 0.25) delete F[k]; }
  return { w, cap: geneCap(w), parents: top, tot: top.reduce((a, p) => a + p.wt, 0), imm: 0.3 + 0.4 * clamp((30 - w) / 22, 0, 1) };
}
function breedOne(plan, type, r) {
  if (!plan.cap) return null;
  let genes = [], el = pick(r, ELS);
  if (!plan.parents.length || r() < plan.imm) { // immigrant
    const n = Math.floor(r() * (plan.cap + 1));
    for (let i = 0; i < 6 && genes.length < n; i++) { const g = pick(r, GENE_IDS); if (!genes.includes(g)) genes.push(g); }
  } else {
    const roul = () => { let x = r() * plan.tot; for (const p of plan.parents) if ((x -= p.wt) <= 0) return p; return plan.parents[0]; };
    const A = parseGenes(roul().k), B = parseGenes(roul().k);
    for (const g of new Set(A.genes.concat(B.genes))) if (r() < (A.genes.includes(g) && B.genes.includes(g) ? 0.95 : 0.55)) genes.push(g);
    el = A.el || B.el || el;
    if (r() < 0.12) { const g = pick(r, GENE_IDS); if (!genes.includes(g)) genes.push(g); }
    if (genes.length && r() < 0.08) genes.splice(Math.floor(r() * genes.length), 1);
    if (r() < 0.1) el = pick(r, ELS);
  }
  genes = genes.filter(g => geneOk(type, g, plan.w));
  while (genes.length > plan.cap) genes.splice(Math.floor(r() * genes.length), 1);
  return { genes, el };
}
function geneRecord(e, leaked) {
  if (e.gkey === undefined) return;
  const prog = leaked ? 1.5 : clamp(e.d / (e.L.len || 1), 0, 1);
  const X = G.geneExp || (G.geneExp = {});
  const exp = X[e.type] === undefined ? prog : X[e.type];
  X[e.type] = exp * 0.97 + prog * 0.03;
  const F = G.geneFit || (G.geneFit = {}), v = F[e.gkey] || (F[e.gkey] = { s: 0, n: 0 });
  v.s += prog - exp; v.n += 1;
  e.gkey = undefined;
}
function genWave(w, ev) {
  const r = G.r, isBoss = w % 10 === 0, af = G.af || {};
  let count = Math.round(Math.min(65, 6 + w * 1.15) * (isBoss ? 0.6 : 1) * (1 + (af.countX || 0)) * (G.CH.count || 1));
  let hpm = hpMult(w) * (1 + (af.hpx || 0)) * (G.CH.hp || 1);
  if (ev.swarm) { count *= 2; hpm *= 0.55; }
  const types = Object.keys(ENEMIES).filter(k => ENEMIES[k].from <= w);
  let eliteP = clamp((w - 4) * 0.012, 0, 0.45) * G.CH.elite + (ev.elite ? 0.5 : 0) + (af.elite || 0);
  const affN = 1 + (w >= 25) + (w >= 50) + (w >= 80);
  const interval = Math.max(0.3, 0.8 - w * 0.008);
  const q = []; let t = 0;
  const plan = breedPlan(w);
  const lanes = G.map.lanes.filter(L => laneOpen(L, w));
  let rift = null;
  if (ev.breach) {
    const main = lanes[0];
    const startI = Math.floor(main.tiles.length * (0.35 + r() * 0.25));
    rift = makeLane(main.tiles.slice(startI), G.map.core);
    rift.rift = true;
  }
  const laneFor = () => {
    if (rift && r() < 0.3) return rift;
    if (lanes.length === 1) return lanes[0];
    return r() < 0.4 ? lanes[0] : pick(r, lanes);
  };
  let n = 0;
  while (n < count) {
    const type = wpick(r, types, k => ENEMIES[k].w * (k === 'flyer' && af.flyers ? 1 + af.flyers : 1));
    const lane = laneFor();
    const grp = ENEMIES[type].group || 1;
    for (let g = 0; g < grp; g++) {
      const el = r() < eliteP && type !== 'swarmer' ? affN : 0;
      const gm = breedOne(plan, type, r);
      q.push({ t, type, lane, hpm, elite: el, genes: gm ? gm.genes : null, gel: gm ? gm.el : null });
      t += grp > 1 ? 0.18 : interval;
    }
    n += grp > 1 ? 2 : 1;
    if (isBoss && n >= Math.floor(count / 2) && !q.some(e => e.boss)) {
      const B = nextBoss(w, r);
      t += 1.5;
      let bl = laneFor(); if (bl === rift || B.fly) bl = lanes[0];
      q.push({ t, type: 'boss', boss: B.id, lane: bl, hpm, elite: w >= 40 ? Math.floor(w / 40) : 0 });
      t += 2;
    }
  }
  return { queue: q, rift };
}
function startWave() {
  snapshotRun(G.wave + 1);
  G.wave++;
  const w = G.wave;
  if (!G.prep || G.prep.w !== w) prepareWave(w);
  const P = G.prep; G.prep = null;
  G.ev = P.ev; G.evList = P.list; G.evT = { emp: 5, meteor: 1.2, phase: 4 };
  for (const E of G.evList) Hooks.log(`${E.name}: ${E.desc}`, E.good ? '#59f0b4' : '#ff4d6a');
  G.rift = P.rift;
  if (G.rift) Hooks.fx('rift', { x: G.rift.pts[0].x, y: G.rift.pts[0].y });
  G.laneWarn = null;
  for (const L of G.map.lanes) if (L.openWave) { const d = L.openWave - w; if (d >= 1 && (!G.laneWarn || d < G.laneWarn)) G.laneWarn = d; }
  G.queue = P.queue;
  G.spawnClock = 0; G.spawningDone = false;
  G.next = 0; G.entWaveCombo = 0; G.leaksAtStart = G.stats.leaks;
  for (const t of G.snares || []) t.caught = 0;
  lureAll();
  if (FX('shieldWave') || (G.core.leg && G.core.leg.bulwark)) G.core.shield = G.core.smax;
  odAnnounce();
  if (G.core.A && G.core.A.cregen && !G.af.lastStand) G.core.hp = Math.min(G.core.max, G.core.hp + G.core.max * G.core.A.cregen / 100);
  // anomaly upkeep
  if (G.af.coreDrain) G.core.hp = Math.max(1, G.core.hp - G.core.max * G.af.coreDrain);
  if (G.af.mutagen && G.towers.length) {
    const t = pick(G.r, G.towers);
    if (w % 3 === 0) { t.affixes.push(rollCurse(t)); Hooks.log(`Mutagen: Curse on ${towerLabel(t)}`, '#ff4d6a'); }
    else { t.affixes.push(rollAffix(t)); Hooks.log(`Mutagen: new affix on ${towerLabel(t)}`, '#59f0b4'); }
    t.s = towerStats(t); recomputeAuras();
    Hooks.fx('upgrade', { x: t.cx, y: t.cy, col: w % 3 === 0 ? '#ff4d6a' : '#59f0b4' });
  }
  if (w > PROF.bestWave) {
    const before = PROF.bestWave;
    PROF.bestWave = w;
    for (const k of TOWER_ORDER) if (TOWERS[k].unlock > Math.max(1, before) && TOWERS[k].unlock <= w) {
      Hooks.toast('UNLOCKED', TOWERS[k].name, '#59f0b4');
      Hooks.onUnlock(k);
    }
  }
  // forge income
  for (const f of G.forges || []) {
    let inc = f.s.income + (f.s.interest ? Math.min(G.credits * f.s.interest, 40 + w * 5) : 0);
    inc *= G.mods.credits * (G.ev.gold ? 2 : 1);
    G.credits += Math.round(inc);
    Hooks.fx('coin', { x: f.cx, y: f.cy, v: Math.round(inc) });
  }
  if (w % 10 === 0) Hooks.sfx('bosswarn');
  Hooks.sfx('wave', w);
  Hooks.onWave(w);
}
// Resuming fast pays: the bonus drains over 45 real seconds spent at the checkpoint.
const CP_WINDOW = 45;
function cpBonus() {
  const w = G.checkpoint || G.wave + 1, f = Math.max(0, 1 - (G.cpT || 0) / CP_WINDOW);
  return { f, cr: Math.round((40 + w * 10) * G.mods.credits * f), sc: Math.round(w * 150 * f) };
}
function resumeCheckpoint() {
  if (!G.checkpoint) return null;
  const B = cpBonus();
  G.credits += B.cr; if (B.sc) addScore(B.sc);
  G.checkpoint = 0; G.cpT = 0; G.next = Math.max(G.next, 3);
  Hooks.sfx('call');
  return B;
}
// Cash-in: convert credits straight into score. The rate climbs with the wave, so late cash-ins pay more and cost more.
const cashRate = () => 3 * (1 + 0.1 * G.wave);
function cashIn(amount) {
  amount = Math.floor(Math.min(amount, G.credits));
  if (amount <= 0 || G.over) return 0;
  G.credits -= amount;
  const before = G.score;
  addScore(amount * cashRate());
  G.stats.cashed = (G.stats.cashed || 0) + amount;
  Hooks.sfx('cash'); Hooks.fx('cash', {}); Hooks.log(`Cashed in ${fmt(amount)} credits`, '#ffb03a');
  return G.score - before;
}
// a checkpoint is due after this wave: it waits for the field to clear first
const cpPending = () => !!(G.cpDue && G.cpDue === G.wave + 1 && !G.checkpoint);
function callEarly() {
  if (G.checkpoint || cpPending()) return 0;
  if (!G.spawningDone || G.next <= 0.5) return 0;
  const secs = Math.ceil(G.next);
  const bonus = Math.round(secs * (2 + G.wave * 0.6) * G.mods.credits);
  G.credits += bonus;
  addScore(secs * (5 + G.wave * 2));
  G.next = 0;
  Hooks.sfx('call');
  return bonus;
}
function updateWaves(dt) {
  if (G.spawningDone) {
    if (G.checkpoint) return;
    if (G.cpDue && G.cpDue === G.wave + 1) {
      // hold until the last wave's enemies are gone (capped, so a stuck enemy can never stall the run)
      if (G.enemies.some(e => !e.dead) && (G.cpWait = (G.cpWait || 0) + dt) < 180) return;
      G.cpWait = 0; G.caches = []; G.pirates = [];
      G.checkpoint = G.cpDue; G.cpDue = 0; G.cpT = 0;
      Hooks.log(`Checkpoint · Wormhole opens in Wave ${G.checkpoint}`, '#59f0b4');
      Hooks.sfx('milestone'); Hooks.onCheckpoint(G.checkpoint);
      return;
    }
    G.next -= dt;
    if (G.next <= 0) startWave();
    return;
  }
  G.spawnClock += dt;
  while (G.queue.length && G.queue[0].t <= G.spawnClock) {
    const q = G.queue.shift();
    if (q.type === 'boss') spawnBoss(q);
    else spawnEnemy(q.type, q);
  }
  if (!G.queue.length) {
    G.spawningDone = true;
    G.next = G.af.timeDebt ? 5 : 10;
    const bonus = Math.round((20 + G.wave * 4) * G.mods.credits * (G.ev.gold ? 2 : 1));
    G.credits += bonus;
    if (FX('interest')) { const it = Math.min(300, Math.floor(G.credits * FX('interest') / 100)); if (it > 0) { G.credits += it; Hooks.log(`Interest +${it} credits`, '#ffb03a'); } }
    if (FX('fieldRepair') && G.stats.leaks === (G.leaksAtStart || 0) && !G.af.lastStand) G.core.hp = Math.min(G.core.max, G.core.hp + G.core.max * FX('fieldRepair') / 100);
    addScore(G.wave * 50);
    addEntropy(12);
    prepareWave(G.wave + 1);
  }
}

// ---------- entropy & anomalies ----------
const entropyNeed = () => 100 * (1 + 0.3 * (G.anoms.length + G.stabilized));
function addEntropy(v) {
  if (!G || G.over || G.anomOffers) return;
  // the gauge shows percent of the current threshold; each draw raises the threshold
  G.entropy = Math.min(100, G.entropy + 100 * v / entropyNeed() * (G.af.fill ? 2 : 1) * (G.mods.ks.singular ? 2 : 1) * Math.sqrt(G.CH.ev));
  if (G.entropy >= 100) {
    const pool = ANOMALIES.filter(a => !G.anoms.includes(a.id));
    const offers = [];
    while (offers.length < 3 && pool.length) offers.push(pool.splice(Math.floor(G.r() * pool.length), 1)[0].id);
    G.anomOffers = offers;
    Hooks.toast('ENTROPY FULL', 'Tap the gauge to draw an Anomaly', '#b86cff');
    Hooks.sfx('converge');
    Hooks.onEntropy && Hooks.onEntropy();
  }
}
function takeAnomaly(id) {
  if (!G.anomOffers || !G.anomOffers.includes(id)) return false;
  const A = ANOMALIES.find(a => a.id === id);
  G.anoms.push(id); G.anomOffers = null; G.entropy = 0;
  PROF.codex.anomalies[id] = (PROF.codex.anomalies[id] || 0) + 1;
  if (A.special === 'legendAll') for (const t of G.towers) if (towerPool(t.type) !== 'eco') t.affixes.push(rollAffix(t, 3));
  if (A.af && A.af.flux) G.flux = { el: pick(G.r, ELS), t: 20 };
  recomputeAll();
  Hooks.log(`Anomaly: ${A.name}`, '#b86cff');
  Hooks.sfx('maelstrom');
  return true;
}
function stabilize() {
  if (!G.anomOffers || G.mods.ks.singular) return false;
  G.anomOffers = null; G.entropy = 0; G.stabilized++; G.tokens++;
  recomputeAll();
  Hooks.log(`Stabilized · Score ×${G.scoreMult.toFixed(2)}`, '#59f0b4');
  Hooks.sfx('unbreak');
  return true;
}

// ---------- veterans ----------
function grantVxp(t, v) {
  if (!t || t.vxp === undefined) return;
  const vb = G.mods.orb && G.mods.orb.vxp[t.s.el]; if (vb) v *= 1 + vb / 100;
  t.vxp += v;
  const had = t.pending, r0 = t.rank;
  while (t.vxp >= vetThreshold(t.rank + 1)) {
    t.rank++; t.pending++;
    if (!t.name) {
      const used = new Set(G.towers.map(o => o.name).filter(Boolean));
      const opts = VET_NAMES.filter(n => !used.has(n));
      t.name = pick(G.r, opts.length ? opts : VET_NAMES);
    }
    t.s = towerStats(t);
    if (t.rank > (PROF.codex.bestRank || 0)) { PROF.codex.bestRank = t.rank; PROF.codex.bestName = towerLabel(t); }
  }
  if (t.rank > r0) {
    if (!had) Hooks.toast(`VETERAN ${roman(t.rank)}`, `${t.name} · Tap to choose a mutation`, '#ffe14d');
    Hooks.fx('upgrade', { x: t.cx, y: t.cy, col: '#ffe14d' });
    Hooks.sfx('milestone');
  }
}
function vetOffer(t) {
  if (!t.pending) return null;
  if (!t.offer) {
    const minTier = t.rank >= 5 ? 2 : t.rank >= 3 ? 1 : 0;
    const o = [];
    for (let i = 0; i < 3; i++) o.push(rollAffix(t, undefined, 0.3 * t.rank, minTier, o.map(a => a.id)));
    t.offer = o;
  }
  return t.offer;
}
function claimVet(t, i) {
  const o = vetOffer(t);
  if (!o || !o[i]) return false;
  t.affixes.push(o[i]);
  if (o[i].tier === 3) PROF.codex.legendaries[o[i].id] = 1;
  t.pending--; t.offer = null;
  t.s = towerStats(t); recomputeAuras();
  Hooks.sfx('upgrade', t);
  Hooks.fx('upgrade', { x: t.cx, y: t.cy, col: RARITY[o[i].tier].col });
  return true;
}

// ---------- enemies ----------
function spawnEnemy(type, q) {
  q = q || {};
  const D = ENEMIES[type], w = Math.max(1, G.wave);
  let lane = q.lane || G.map.lanes[0];
  const genes = q.genes || null;
  const fly = !!D.fly || !!(genes && genes.includes('wings') && lane.fly);
  let L = q.L || (fly ? lane.fly : lane);
  if (q.fromPt) {
    L = prepLane([{ x: q.fromPt.x, y: q.fromPt.y }, { x: G.core.x, y: G.core.y }]);
  }
  const hpm = q.hpm || hpMult(w);
  let hp = D.hp * hpm;
  if (genes) for (const g of genes) hp *= GENES[g].hp || 1;
  const e = { id: G.eid++, type, L, d: q.d || 0, seg: 0, x: 0, y: 0, hp, maxHp: hp, shield: 0, spd: D.spd, fly,
    armor: D.armor || 0, armorAll: 0, res: Object.assign({}, D.res || {}), size: type === 'tank' ? 0.42 : type === 'swarmer' ? 0.22 : 0.32,
    cr: D.cr * crMult(w), leak: D.leak, score: Math.round(D.cr * 10 * (1 + 0.1 * w)),
    st: { burn: null, chill: 0, chillT: 0, chillPot: 1, frozen: 0, freezeImm: 0, shock: 0, shockEff: 1, mark: 0, markT: 0, stun: 0 },
    cloak: D.cloak ? 1 : 0, cloakT: 2 + Math.random() * 2, cloaked: false, elite: [], dead: false, ovlCD: 0, supCD: 0,
    timer: 0, timer2: 0, hitFlash: 0, slow: 0, wob: Math.random() * 6 };
  if (genes) {
    e.genes = genes; e.gkey = geneKey(genes, q.gel);
    for (const g of genes) {
      if (GENES[g].spd) e.spd *= GENES[g].spd;
      if (g === 'plating') e.armor = Math.min(0.7, e.armor + 0.4);
      if (g === 'bulk') e.size *= 1.2;
      if (g === 'brood') e.brood = 1;
      if (g === 'shell') e.shield = e.maxHp * 0.5;
      if (g === 'regen') e.regenG = 0.025;
      if (g === 'ward') { e.wardEl = q.gel || 'K'; e.res[e.wardEl] = (e.res[e.wardEl] || 0) + (G.mods.ks.conflag && e.wardEl === 'T' ? 0.25 : 0.5); }
      if (g === 'cloak') e.cloak = 1;
    }
  } else if (geneCap(w) > 0 && !q.fromPt && !q.L && D.from < 999) e.gkey = '';
  if (q.elite) {
    const pool = ELITE_AFFIXES.slice();
    for (let i = 0; i < q.elite && pool.length; i++) {
      const a = pool.splice(Math.floor(G.r() * pool.length), 1)[0];
      e.elite.push(a.id);
    }
    e.maxHp *= 2.2; e.hp = e.maxHp; e.cr *= 3; e.score *= 3; e.leak = Math.round(e.leak * 1.5);
    if (e.elite.includes('shielded')) e.shield = e.maxHp * 0.4;
    if (e.elite.includes('hasted')) e.spd *= 1.4;
    if (e.elite.includes('jugg')) { e.maxHp *= 1.3; e.hp = e.maxHp; }
    if (e.elite.includes('resist')) { const el = pick(G.r, ELS); e.res[el] = (e.res[el] || 0) + 0.5; e.resistEl = el; }
  }
  lanePos(e.L, e.d, e);
  G.enemies.push(e);
  if (fly) lure(e);
  if (e.elite.length) Hooks.fx('elite', { x: e.x, y: e.y });
  return e;
}
// v2.2 boss health: the larger of a fixed curve and the defence's recent peak damage output (G.power) times
// BOSS_SECS(w). The fixed curve keeps bosses meaningful for weak builds; the power part stops strong builds melting them.
const BOSS_HPX = [[10, 2], [20, 3], [40, 3], [60, 2]];
const bossHpX = w => { const P = BOSS_HPX; if (w <= P[0][0]) return P[0][1]; for (let i = 1; i < P.length; i++) if (w <= P[i][0]) { const [a, va] = P[i - 1], [b, vb] = P[i]; return va + (vb - va) * (w - a) / (b - a); } return P[P.length - 1][1]; };
const BOSS_SECS = w => 18 + 10 * Math.min(1, Math.max(0, (w - 10) / 30));
const BOSS_PHASES = [0.66, 0.33];
// v2.3: every boss wave is a weighted draw from the bosses unlocked by that wave. Never-seen bosses weigh most,
// and a boss gets likelier the longer it's been away; the last two can't repeat.
const BOSS_FROM = { behemoth: 10, queen: 10, wraith: 15, overmind: 20, titan: 30, cat: 10, gloop: 10, duck: 10, whale: 20, fsm: 20 };
function bossFrom(B) { return B.from || BOSS_FROM[B.id] || 10; }
function nextBoss(w, r) {
  const H = G.bossHist || (G.bossHist = {}), recent = G.bossRecent || (G.bossRecent = []);
  let ok = BOSSES.filter(B => bossFrom(B) <= Math.max(10, w) && (!G.af.oddAll || B.odd));
  if (ok.length > 3) ok = ok.filter(B => !recent.includes(B.id));
  const wt = ok.map(B => H[B.id] === undefined ? 4 : Math.min(4, 0.5 + (w - H[B.id]) / 20));
  let x = r() * wt.reduce((a, b) => a + b, 0), k = 0;
  while (k < ok.length - 1 && (x -= wt[k]) > 0) k++;
  const B = ok[k]; H[B.id] = w; recent.push(B.id); if (recent.length > 2) recent.shift();
  return B;
}
function spawnBoss(q) {
  const B = BOSSES.find(b => b.id === q.boss), w = G.wave;
  const lane = q.lane, gen = q.gen || 0;
  const L = q.L || (B.fly ? lane.fly : lane);
  const base = 30 * B.hp * q.hpm * bossHpX(w) * (1 + Math.floor((w - 1) / 50) * 0.5);
  const hp = q.hpAbs || Math.max(base, (G.power || 0) * BOSS_SECS(w) * (B.hp / 38)) * (1 + ((G.af && G.af.bossHP) || 0));
  const e = { id: G.eid++, type: 'boss', boss: B.id, bossName: gen ? (gen === 1 ? 'Gloop Jr.' : 'Glooplet') : B.name, gen, L, d: q.d || 0, seg: 0, x: 0, y: 0, hp, maxHp: hp, shield: 0, spd: B.spd, fly: !!B.fly,
    armor: B.armor || 0, armorAll: B.armorAll || 0, res: {}, size: 0.8, cr: 60 * crMult(w), leak: Math.round(35 + w * 1.5),
    score: Math.round(1500 * (1 + 0.1 * w)),
    st: { burn: null, chill: 0, chillT: 0, chillPot: 1, frozen: 0, freezeImm: 0, shock: 0, shockEff: 1, mark: 0, markT: 0, stun: 0 },
    cloak: 0, cloakT: 0, cloaked: false, elite: [], dead: false, ovlCD: 0, supCD: 0, timer: 3, timer2: 0, hitFlash: 0, slow: 0, wob: 0, plates: 2, phase: 0, phaseT: 0 };
  if (B.odd && G.af && G.af.oddAll) e.cr *= 3;
  if (gen) { e.cr *= 0.4; e.score = Math.round(e.score * 0.3); e.leak = Math.round(e.leak * 0.5); e.size = gen === 1 ? 0.6 : 0.45; e.spd *= 1 + gen * 0.3; e.timer = 1.5; }
  if (B.id === 'cat') e.timer2 = 9;
  if (B.id === 'worm') { e.gut = []; e.timer = 6; }
  if (B.id === 'auditor') { e.audited = 0; e.timer2 = 4; }
  if (B.id === 'snail') { e.lastHit = G.time; e.armorAll = 0.2; }
  if (q.elite) {
    const pool = ELITE_AFFIXES.filter(a => a.id !== 'split');
    for (let i = 0; i < q.elite; i++) e.elite.push(pool.splice(Math.floor(G.r() * pool.length), 1)[0].id);
    if (e.elite.includes('shielded')) e.shield = e.maxHp * 0.3;
    if (e.elite.includes('hasted')) e.spd *= 1.3;
  }
  lanePos(e.L, e.d, e);
  G.enemies.push(e);
  if (!G.bossAlive || G.bossAlive.dead) G.bossAlive = e;
  if (e.fly) lure(e);
  if (gen) return e;
  const ttl = B.titles ? B.titles[Math.floor(G.r() * B.titles.length)] : null;
  if (ttl) { e.bossTitle = ttl; Hooks.fx('say', { x: e.x, y: e.y, t: B.id === 'cat' ? 'mrrp.' : B.id === 'duck' ? 'QUACK' : B.id === 'whale' ? 'HELLOOOO' : B.id === 'fsm' ? 'ramen.' : 'blorp' }); }
  Hooks.bossIntro(e, B);
  if (ttl) Hooks.log(`${B.name}, ${ttl}: ${B.desc}`, '#ff4d6a');
  Hooks.log(`${B.name} incoming`, '#ff4d6a');
  Hooks.sfx('boss');
  return e;
}
function enemySlow(e) {
  let s = 0;
  if (e.st.chill > 0) s += e.st.chill * 0.08 * e.st.chillPot;
  s += e.fieldSlow || 0;
  if (G.mods.ks.conflag && e.st.burn) s += 0.25; // Conflagration: burning enemies are scorched (25% slow)
  if (e.st.chill > 0) s += FX('glacial') / 100;
  if (e.kSlowT > 0) s += FX('kSlow') / 100;
  if (FX('markSlow') && e.st.mark >= G.mods.markMax) s += FX('markSlow') / 100;
  if (e.elite.includes('jugg')) s *= 0.3;
  if (e.boss) s *= 0.5;
  return Math.min(0.75, s);
}
function updateEnemies(dt) {
  const ev = G.ev, M = G.mods;
  // gravity fields
  for (const e of G.enemies) e.fieldSlow = 0;
  for (const t of G.towers) {
    if (t.s.kind !== 'grav' || t.disabled > 0) continue;
    const r2 = t.s.range * t.s.range;
    for (const e of G.enemies) if (!e.fly && dist2(e.x, e.y, t.cx, t.cy) <= r2) e.fieldSlow = Math.max(e.fieldSlow, 0.3);
  }
  for (const e of G.enemies) {
    if (e.dead) continue;
    const st = e.st;
    e.hitFlash = Math.max(0, e.hitFlash - dt);
    e.ovlCD -= dt; e.supCD -= dt;
    // statuses
    if (st.burn) {
      st.burn.t -= dt;
      hit(e, st.burn.dps * dt, 'T', st.burn.src, { dot: 1, noStatus: 1 });
      if (st.burn.t <= 0) st.burn = null;
      if (e.dead) continue;
    }
    if (st.chill > 0) { st.chillT -= dt; if (st.chillT <= 0) { st.chill = Math.max(0, st.chill - 1); st.chillT = FX('chillSlowDecay') ? 3 : 1; } }
    if (e.kSlowT > 0) e.kSlowT -= dt;
    if (st.burn && FX('burnSpread')) { e.spreadT = (e.spreadT || 1) - dt; if (e.spreadT <= 0) { e.spreadT = 1; let best = null, bd = 1; for (const o2 of G.enemies) if (!o2.dead && o2 !== e && !o2.st.burn) { const d = dist2(o2.x, o2.y, e.x, e.y); if (d < bd) { bd = d; best = o2; } } if (best) best.st.burn = { dps: st.burn.dps * 0.8, t: 3 * M.burnDur, src: st.burn.src }; } }
    if (st.frozen > 0) st.frozen -= dt;
    if (st.freezeImm > 0) st.freezeImm -= dt;
    if (st.shock > 0) st.shock -= dt;
    if (st.mark > 0 && !FX('markPerma')) { st.markT -= dt; if (st.markT <= 0) { st.mark = Math.max(0, st.mark - 1); st.markT = 1.2; } }
    if (st.stun > 0) st.stun -= dt;
    if (e.shatterT > 0) e.shatterT -= dt;
    // regen
    let regen = 0;
    if (e.elite.includes('regen')) regen += 0.02;
    if (ev.regen) regen += 0.015;
    if (G.af.regen) regen += G.af.regen;
    if (e.regenG) regen += e.regenG;
    if (st.burn) regen = 0; // Burn stops healing
    if (regen && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * regen * dt);
    // cloak
    if (e.cloak) {
      e.cloakT -= dt;
      if (e.cloakT <= 0) { e.cloaked = !e.cloaked; e.cloakT = e.cloaked ? 2 : 3.5; }
    }
    if (e.boss === 'wraith' && e.cloakT > 0) { e.cloakT -= dt; if (e.cloakT <= 0) e.cloaked = false; }
    // behaviors
    e.timer -= dt;
    if (e.type === 'medic' && e.timer <= 0) {
      e.timer = 1;
      for (const o of G.enemies) if (!o.dead && o !== e && dist2(o.x, o.y, e.x, e.y) < 2.25) o.hp = Math.min(o.maxHp, o.hp + o.maxHp * (o.boss ? 0.005 : 0.04));
      Hooks.fx('heal', { x: e.x, y: e.y });
    }
    if (e.type === 'shielder' && e.timer <= 0) {
      e.timer = 5;
      for (const o of G.enemies) if (!o.dead && o !== e && dist2(o.x, o.y, e.x, e.y) < 2.25) o.shield = Math.max(o.shield, o.maxHp * (o.boss ? 0.04 : 0.25));
      Hooks.fx('shieldpulse', { x: e.x, y: e.y });
    }
    if (e.elite.includes('blink') && e.timer <= 0 && !e.boss) { e.timer = 5; e.d += 1.5; Hooks.fx('blink', { x: e.x, y: e.y }); }
    if (e.boss) bossBehavior(e, dt);
    if (ev.phase) { e.timer2 -= dt; if (e.timer2 <= 0) { e.timer2 = 4; if (G.r() < 0.3 && !e.boss) { e.d += 1; Hooks.fx('blink', { x: e.x, y: e.y }); } } }
    // movement
    const sw = stormAt(e.x, e.y);
    e.stormVuln = sw.vuln;
    let netK = 1;
    if (e.lureT) {
      const t = e.lureT;
      if (G.towerAt[tIdx(t.x, t.y)] !== t) e.lureT = null;
      else if (dist2(e.x, e.y, t.cx, t.cy) <= t.s.netR * t.s.netR) {
        if (!e.netted) { e.netted = 1; e.netHold = t.s.hold * (e.boss ? 0.3 : 1); Hooks.fx('net', { x: e.x, y: e.y }); }
        netK = 1 - t.s.netSlow * (e.boss ? 0.4 : 1);
      }
    }
    if (e.netHold > 0) e.netHold -= dt;
    if (st.stun > 0 || st.frozen > 0 || G.stasisT > 0 || e.napT > 0 || e.netHold > 0 || e.burrowT > 0) { /* held */ }
    else {
      let spd = e.spd * (1 - Math.max(enemySlow(e), Math.min(0.75, sw.slow)));
      if (ev.surge) spd *= 1.35;
      spd *= 1 + sw.haste + (G.af.haste || 0) + (sw.inStorm ? 0.12 + (G.af.magnet ? 0.2 : 0) : 0);
      if (G.af.groundSlow && !e.fly) spd *= 1 - G.af.groundSlow;
      spd *= netK;
      if (G.slime && G.slime.length && e.boss !== 'snail') for (const p of G.slime) if (p.L === e.L && Math.abs(p.d - e.d) < 0.4) { spd *= 1.4; break; }
      e.slow = 1 - spd / e.spd;
      e.d += spd * dt;
    }
    if (e.d < 0) e.d = 0;
    lanePos(e.L, e.d, e);
    if (e.pirate) {
      const P = e.pirate;
      if (!P.got && e.d >= P.grabD - 0.05) {
        P.got = true;
        if (P.cache && G.caches.includes(P.cache)) { G.caches = G.caches.filter(o => o !== P.cache); Hooks.toast('LOOT STOLEN', 'Shoot the skiff down to get it back', '#ff4d6a'); Hooks.fx('cacheClaim', { x: e.x, y: e.y, kind: 'cursed' }); pirateSay('thief', e.x, e.y, 0.6); }
        else P.cache = null;
      }
      if (e.d >= e.L.len - 0.05) { e.dead = true; if (P.got && P.cache) Hooks.log('Pirates escaped with the salvage', '#ff4d6a'); }
      continue;
    }
    if (e.d >= e.L.len - 0.05) leak(e);
  }
  if (G.stasisT > 0) G.stasisT -= dt;
  if (G.slime && G.slime.length) { for (const p of G.slime) p.t -= dt; G.slime = G.slime.filter(p => p.t > 0); }
  G.enemies = G.enemies.filter(e => !e.dead);
  if (G.bossAlive && G.bossAlive.dead) G.bossAlive = null;
  // reveal cloak near pylons
  if (G.pylons && G.pylons.length) for (const e of G.enemies) if (e.cloaked) for (const p of G.pylons) if (dist2(e.x, e.y, p.cx, p.cy) <= p.s.range * p.s.range) { e.revealed = 0.3; break; }
  for (const e of G.enemies) if (e.revealed > 0) e.revealed -= dt;
}
const PHASE_LINES = { behemoth: ['RRRAAARGH', 'THE GROUND SHAKES'], queen: ['RISE, MY BROOD', 'SKREEEEE'], wraith: ['you cannot hold me', 'between, beyond'],
  overmind: ['YOUR MACHINES ARE MINE', 'SILENCE.'], titan: ['*CRACK*', 'UNSTOPPABLE'], cat: ['HSSSS', '*zoomies*'], whale: ['OOOOOOOOO', 'the deep remembers'],
  duck: ['QUAAAACK', 'QUACK QUACK QUACK'], fsm: ["R'AMEN!!", 'EXTRA SAUCE'], worm: ['*SLURP*', 'MORE. MORE.'],
  auditor: ['THIS IS AN AUDIT', 'YOU OWE BACK TAXES'], snail: ['...', 'i am still coming'] };
function bossPhase(e) {
  const th = BOSS_PHASES[e.phase];
  e.phase++;
  e.hp = Math.max(e.hp, e.maxHp * th - 1); // no blowing through a phase in one volley
  e.phaseT = 2.5; e.spd *= 1.15; e.timer = 0; e.empowered = 1;
  if (e.boss === 'titan') e.timer2 = 0;
  const L = PHASE_LINES[e.boss] || ['ENOUGH'];
  Hooks.fx('bossPhase', { x: e.x, y: e.y, boss: e.boss, phase: e.phase });
  Hooks.fx('say', { x: e.x, y: e.y - 0.6, t: L[Math.min(L.length - 1, e.phase - 1)] });
  Hooks.fx('shake', { v: 8 }); Hooks.sfx('boss');
  Hooks.toast(e.phase === 1 ? 'PHASE II' : 'FINAL PHASE', `${e.bossName} unleashes ${BOSS_POWER[e.boss] || 'its power'}`, '#ff4d6a', true);
  Hooks.log(`${e.bossName} enters ${e.phase === 1 ? 'phase II' : 'its final phase'}`, '#ff4d6a');
}
// Wormhole Worm: resurfaces further along (sometimes on another lane) and swallows towers near where it comes up;
// now and then (always in a frenzy) it hunts your strongest tower anywhere. Killing it spits them all back out.
function swallowTower(e, t) {
  G.towers = G.towers.filter(o => o !== t); delete G.towerAt[tIdx(t.x, t.y)];
  t.disabled = 0; e.gut.push(t); recomputeAuras();
  Hooks.fx('swallow', { x1: t.cx, y1: t.cy, x2: e.x, y2: e.y }); Hooks.sfx('crack');
}
function wormSurface(e) {
  const frac = Math.min(0.75, e.d / e.L.len + 0.04 + G.r() * 0.05); // never pops up right on top of the core
  const lanes = G.map.lanes.filter(L => !L.openWave);
  if (lanes.length > 1 && G.r() < 0.35) e.L = pick(G.r, lanes);
  e.d = Math.max(e.d, frac * e.L.len); lanePos(e.L, e.d, e);
  Hooks.fx('burrow', { x: e.x, y: e.y }); Hooks.fx('shake', { v: 5 });
  const n = e.frenzy ? 2 : 1;
  const near = G.towers.filter(t => dist2(t.cx, t.cy, e.x, e.y) <= 3.2 * 3.2).sort((a, b) => dist2(a.cx, a.cy, e.x, e.y) - dist2(b.cx, b.cy, e.x, e.y));
  const got = near.slice(0, n);
  if ((e.frenzy || G.r() < 0.15) && G.towers.length > 3) { // the hunt: your best tower, wherever it is
    const best = G.towers.filter(t => !got.includes(t)).sort((a, b) => b.dmgDone - a.dmgDone)[0];
    if (best) { got.push(best); Hooks.toast('THE WORM HUNTS', `It swallowed ${best.name || TOWERS[best.type].name}. Kill it to get it back`, '#c46cff', true); }
  }
  for (const t of got) swallowTower(e, t);
  if (got.length) { Hooks.fx('say', { x: e.x, y: e.y - 0.6, t: ['*CHOMP*', 'nom.', '*gulp*', 'crunchy'][Math.floor(G.r() * 4)] }); Hooks.log(`Wormhole Worm swallowed ${got.length > 1 ? got.length + ' towers' : 'a tower'}`, '#c46cff'); }
  e.frenzy = 0;
}
function wormRelease(e) { // put swallowed towers back where they stood (or the nearest free tile)
  let back = 0;
  for (const t of e.gut || []) {
    let spot = canBuildAt(t.x, t.y) ? [t.x, t.y] : null;
    for (let r = 1; r <= 3 && !spot; r++) for (let dy = -r; dy <= r && !spot; dy++) for (let dx = -r; dx <= r && !spot; dx++) if (canBuildAt(t.x + dx, t.y + dy)) spot = [t.x + dx, t.y + dy];
    if (!spot) continue;
    t.x = spot[0]; t.y = spot[1]; t.cx = t.x + 0.5; t.cy = t.y + 0.5; t.disabled = 1;
    G.towers.push(t); G.towerAt[tIdx(t.x, t.y)] = t; back++;
    Hooks.fx('swallow', { x1: e.x, y1: e.y, x2: t.cx, y2: t.cy, back: 1 });
  }
  e.gut = [];
  if (back) { recomputeAuras(); Hooks.toast('SPAT OUT', `${back} swallowed tower${back > 1 ? 's' : ''} returned`, '#59f0b4', true); }
}
function bossBehavior(e, dt) {
  if (e.phaseT > 0) e.phaseT -= dt;
  if (e.boss === 'worm' && e.burrowT > 0) { e.burrowT -= dt; if (e.burrowT <= 0) wormSurface(e); return; }
  if (e.boss === 'auditor') { // drains credits every second; refunded with interest when he dies
    e.drainT = (e.drainT || 0) + dt;
    if (e.drainT >= 1) { e.drainT = 0; const take = Math.min(G.credits, Math.round(G.credits * 0.03 + 4 + G.wave * 1.5)); if (take > 0) { G.credits -= take; e.audited += take; Hooks.fx('num', { x: e.x, y: e.y - 0.5, v: take, combo: 'TAXED', col: '#ffb03a' }); } }
  }
  if (e.boss === 'snail') {
    if (G.time - e.lastHit > 2) { const cap = e.maxHp * (e.phase ? BOSS_PHASES[e.phase - 1] : 1); if (e.hp < cap) { e.hp = Math.min(cap, e.hp + e.maxHp * 0.012 * dt); if ((G.time * 2 | 0) % 4 === 0 && G.r() < dt * 2) Hooks.fx('heal', { x: e.x, y: e.y }); } }
    e.slimeT = (e.slimeT || 0) - dt;
    if (e.slimeT <= 0) { e.slimeT = 0.4; (G.slime || (G.slime = [])).push({ L: e.L, d: e.d, x: e.x, y: e.y, t: 10 }); }
  }
  if (e.timer > 0) return;
  const big = e.empowered ? 1 : 0; e.empowered = 0;
  switch (e.boss) {
    case 'behemoth': e.timer = 7.5; if (!e.fly) for (let i = 0; i < (big ? 8 : 3); i++) { const m = spawnEnemy('swarmer', { L: e.L, d: Math.max(0, e.d - 0.25 * i) }); if (big) m.hp = m.maxHp *= 1.5; }
      if (big) { Hooks.fx('boom', { x: e.x, y: e.y, r: 2.5, col: '#ff7b39', big: 1 }); for (const t of G.towers) if (dist2(t.cx, t.cy, e.x, e.y) <= 2.5 * 2.5) t.disabled = Math.max(t.disabled, 1.5); }
      break;
    case 'queen': e.timer = 7; for (let i = 0; i < (big ? 7 : 2); i++) spawnEnemy('flyer', { fromPt: { x: e.x + (big ? Math.cos(i) * 0.6 : 0), y: e.y + (big ? Math.sin(i) * 0.6 : 0) } }); break;
    case 'wraith': e.timer = 6; e.d += big ? 4.5 : 2; e.cloaked = true; e.cloakT = big ? 3 : 1.5; Hooks.fx('blink', { x: e.x, y: e.y }); Hooks.sfx('blink'); break;
    case 'overmind': { e.timer = 7; const r = big ? 4.2 : 2.5;
      for (const t of G.towers) if (dist2(t.cx, t.cy, e.x, e.y) <= r * r) t.disabled = Math.max(t.disabled, big ? 4 : 2.5);
      Hooks.fx('emp', { x: e.x, y: e.y, r }); Hooks.sfx('emp'); break; }
    case 'titan': e.timer = 1;
      if (big) { Hooks.fx('boom', { x: e.x, y: e.y, r: 3, col: '#a4aac4', big: 1 }); for (const t of G.towers) if (dist2(t.cx, t.cy, e.x, e.y) <= 9) t.disabled = Math.max(t.disabled, 2.5); Hooks.sfx('crack'); }
      if (e.plates === 2 && e.hp < e.maxHp * 0.66) { e.plates = 1; e.armorAll = 0.25; Hooks.fx('plates', { x: e.x, y: e.y }); Hooks.log('Titan armor cracked', '#ff7b39'); Hooks.sfx('crack'); }
      if (e.plates === 1 && e.hp < e.maxHp * 0.33) { e.plates = 0; e.armorAll = 0; Hooks.fx('plates', { x: e.x, y: e.y }); Hooks.log('Titan armor broken', '#ff7b39'); Hooks.sfx('crack'); }
      break;
    case 'cat': {
      e.timer = 1;
      if (e.napT > 0) { e.napT -= 1; if (e.napT <= 0) { e.armorAll = 0; Hooks.fx('say', { x: e.x, y: e.y, t: '*stretch*' }); } else Hooks.fx('say', { x: e.x, y: e.y, t: 'z' + 'z'.repeat(3 - Math.ceil(e.napT)) + 'Z' }); break; }
      e.timer2 -= 1;
      if (e.timer2 <= 0) { e.timer2 = 12; e.napT = 3; e.armorAll = 0.6; Hooks.fx('say', { x: e.x, y: e.y, t: 'zzz' }); Hooks.log('Mr. Whiskers is napping. Do not disturb.', '#ff9a3c'); break; }
      if (big) { // the zoomies: swats every tower nearby
        for (const t of G.towers) if (dist2(t.cx, t.cy, e.x, e.y) <= 3.5 * 3.5) { t.disabled = Math.max(t.disabled, 3); Hooks.fx('emp', { x: t.cx, y: t.cy, r: 0.7 }); }
        e.d += 1.5; Hooks.sfx('meow'); break;
      }
      if (e.timer2 % 5 === 0) {
        let best = null, bd = 2.5 * 2.5;
        for (const t of G.towers) { const d = dist2(t.cx, t.cy, e.x, e.y); if (d <= bd) { bd = d; best = t; } }
        if (best) { best.disabled = Math.max(best.disabled, 3); Hooks.fx('emp', { x: best.cx, y: best.cy, r: 0.7 }); Hooks.fx('say', { x: e.x, y: e.y, t: '*swat*' }); Hooks.log('Mr. Whiskers knocked a tower off the table', '#ff9a3c'); Hooks.sfx('meow'); }
      }
      break;
    }
    case 'gloop': e.timer = 4 + G.r() * 3; if (!e.gen || G.r() < 0.3) Hooks.fx('say', { x: e.x, y: e.y, t: ['blorp', 'glorp', 'bloop', '*squelch*'][Math.floor(G.r() * 4)] }); Hooks.sfx('blorp'); break;
    case 'whale': e.timer = 6;
      for (const o of G.enemies) if (!o.dead && dist2(o.x, o.y, e.x, e.y) < (big ? 25 : 9)) o.hp = Math.min(o.maxHp, o.hp + o.maxHp * (o.boss ? (big ? 0.04 : 0.02) : big ? 0.3 : 0.1));
      Hooks.fx('song', { x: e.x, y: e.y, r: 3 }); Hooks.sfx('whale'); Hooks.fx('say', { x: e.x, y: e.y, t: ['OOOooOOO', 'MMMmmMMM', 'WOOOooo'][Math.floor(G.r() * 3)] }); break;
    case 'duck': e.timer = 4;
      e.d += big ? 3 : 0.8;
      for (const t of G.towers) if (dist2(t.cx, t.cy, e.x, e.y) <= (big ? 12 : 4)) t.disabled = Math.max(t.disabled, big ? 2.5 : 1.2);
      Hooks.fx('emp', { x: e.x, y: e.y, r: 2 }); Hooks.fx('say', { x: e.x, y: e.y, t: 'QUACK' }); Hooks.sfx('quack'); break;
    case 'worm': // dive into a wormhole; wormSurface handles the bite
      e.timer = big ? 3 : 10; e.burrowT = big ? 0.8 : 1; e.frenzy = big ? 1 : 0;
      Hooks.fx('burrow', { x: e.x, y: e.y }); Hooks.fx('say', { x: e.x, y: e.y - 0.6, t: big ? '*SLURP*' : '*burrows*' }); Hooks.sfx('blink'); break;
    case 'auditor': {
      e.timer = 9;
      if (big) { const take = Math.round(G.credits * 0.15); G.credits -= take; e.audited += take; Hooks.fx('num', { x: e.x, y: e.y - 0.5, v: take, combo: 'FULL AUDIT', col: '#ffb03a' }); }
      // freeze the biggest earners "pending review": Credit Forges first, then the top damage dealers
      const pool = G.towers.filter(t => t.disabled <= 0).sort((a, b) => ((b.s.kind === 'eco') - (a.s.kind === 'eco')) || b.dmgDone - a.dmgDone).slice(0, big ? 3 : 1);
      for (const t of pool) { t.disabled = Math.max(t.disabled, 5); Hooks.fx('audit', { x1: e.x, y1: e.y, x2: t.cx, y2: t.cy }); }
      if (pool.length) { Hooks.fx('say', { x: e.x, y: e.y - 0.6, t: ['Pending review.', 'Receipts?', 'Interesting...', 'Denied.'][Math.floor(G.r() * 4)] }); Hooks.log(`The Auditor froze ${pool.length > 1 ? pool.length + ' towers' : 'a tower'} pending review`, '#ffb03a'); }
      break;
    }
    case 'snail':
      e.timer = 6;
      if (big) { e.hp = Math.min(e.maxHp * BOSS_PHASES[e.phase - 1], e.hp + e.maxHp * 0.08); for (let k = 1; k <= 12; k++) (G.slime || (G.slime = [])).push({ L: e.L, d: Math.max(0, e.d - k * 0.5), ...lanePos(e.L, Math.max(0, e.d - k * 0.5), {}), t: 12 }); Hooks.fx('heal', { x: e.x, y: e.y }); }
      Hooks.fx('say', { x: e.x, y: e.y - 0.6, t: ['...', '.....', 'soon.', '*schlorp*'][Math.floor(G.r() * 4)] }); break;
    case 'fsm': {
      e.timer = 6; e.timer2 = (e.timer2 || 0) + 1;
      const near = G.towers.filter(t => dist2(t.cx, t.cy, e.x, e.y) <= 9).sort((a, b) => dist2(a.cx, a.cy, e.x, e.y) - dist2(b.cx, b.cy, e.x, e.y)).slice(0, big ? 7 : 3);
      for (const t of near) { t.disabled = Math.max(t.disabled, 2.5); Hooks.fx('noodle', { x1: e.x, y1: e.y, x2: t.cx, y2: t.cy }); }
      if (near.length) { Hooks.fx('say', { x: e.x, y: e.y, t: "R'AMEN" }); Hooks.log('Touched by His Noodly Appendage', '#f2d27a'); }
      if (e.timer2 % 2 === 0 || big) { for (let i = 0; i < (big ? 6 : 3); i++) { const m = spawnEnemy('flyer', { fromPt: { x: e.x + (i - 1) * 0.4, y: e.y } }); m.meat = 1; } Hooks.fx('say', { x: e.x, y: e.y + 0.6, t: 'meatballs!' }); }
      break;
    }
  }
  // swarmers spawned from behemoth should follow its lane: fix lane positions
}
function leak(e) {
  e.dead = true;
  geneRecord(e, true);
  G.stats.leaks++;
  G.stats.lastLeak = e.boss ? e.bossName : ENEMIES[e.type] ? ENEMIES[e.type].name : e.type;
  const c = G.core, w = G.wave;
  let dmg = e.leak * (1 + 0.03 * w);
  // a boss that reaches the core breaches it: a fixed share of the core, so it always hurts and is never a free pass
  if (e.boss) dmg = e.gen ? c.max * (e.gen === 1 ? 0.12 : 0.06) : c.max * (0.35 + 0.1 * (e.phase || 0));
  if (e.boss === 'worm' && e.gut && e.gut.length) { Hooks.toast('DIGESTED', `${e.gut.length} swallowed tower${e.gut.length > 1 ? 's are' : ' is'} gone for good`, '#ff4d6a', true); e.gut = []; }
  if (e.boss === 'auditor' && e.audited > 0) { Hooks.log(`The Auditor left with ${Math.round(e.audited)} of your credits`, '#ff4d6a'); e.audited = 0; }
  if (e.shield > 0 && e.boss) dmg *= 1.2;
  if (c.A && c.A.cguard) dmg *= 1 - Math.min(0.6, c.A.cguard / 100);
  if (c.leg && c.leg.retribution && G.time - (c.retT || -99) > 1.5) {
    c.retT = G.time;
    const k = coreStats().dmg * 4;
    for (const o of G.enemies) if (!o.dead && o !== e && dist2(o.x, o.y, c.x, c.y) <= 6.25) hit(o, k, c.s ? c.s.el : 'K', c, { noStatus: 1 });
    Hooks.fx('boom', { x: c.x, y: c.y, r: 2.5, col: '#59f0b4', big: 1 });
  }
  c.sinceHit = 0;
  const abs = Math.min(c.shield, dmg); c.shield -= abs; dmg -= abs;
  c.hp -= dmg;
  Hooks.fx('leak', { x: c.x, y: c.y, boss: !!e.boss });
  Hooks.sfx(e.boss ? 'bigleak' : 'leak');
  if (e.boss) Hooks.log(`${e.bossName} reached the core`, '#ff4d6a');
  if (c.hp <= 0) {
    if (G.mods.ks.unbreakable && G.wave - G.unbreakUsed >= 10) {
      G.unbreakUsed = G.wave; c.hp = c.max * 0.5;
      Hooks.toast('UNBREAKABLE', 'Lethal hit prevented', '#59f0b4');
      Hooks.sfx('unbreak');
    } else gameOver();
  }
}

// ---------- damage ----------
function hit(e, dmg, el, src, o) {
  if (e.dead || dmg <= 0 || e.burrowT > 0) return 0;
  if (e.boss) e.lastHit = G.time;
  o = o || {};
  const M = G.mods, st = e.st;
  let mult = 1;
  const res = e.res[el] || 0;
  mult *= 1 - res;
  // Plating (v3.0): blunts every hit except piercing fire: Rail, Void Lens beams, damage over time and abilities
  if (e.armor && !(o.dot || o.abil || (src && src.s && (src.s.kind === 'rail' || src.s.kind === 'beam' || src.s.shred)))) mult *= 1 - clamp(e.armor * (1 - M.armorPen), 0, 0.7);
  if (e.armorAll) mult *= 1 - e.armorAll;
  if (st.shock > 0) mult *= 1 + 0.15 * st.shockEff;
  if (e.netted && e.fly && e.lureT && dist2(e.x, e.y, e.lureT.cx, e.lureT.cy) <= Math.pow((e.lureT.s && e.lureT.s.netR) || 1.3, 2)) mult *= 1.2;
  if (st.mark > 0) mult *= 1 + 0.05 * st.mark;
  if (st.frozen > 0) mult *= 1 + M.frozenVuln;
  if (M.ks.abszero && st.chill > 0) mult *= 1.5;
  if (e.stormVuln) mult *= 1 + e.stormVuln;
  if (el === 'K' && e.shatterT > 0) mult *= 1 + e.shatterV;
  if (st.burn && FX('burnVuln')) mult *= 1 + FX('burnVuln') / 100;
  if (el === 'V' && st.mark > 0 && FX('markVoid')) mult *= 1 + FX('markVoid') * st.mark / 100;
  if (src && src.s && !o.dot && G.mods.orb && G.mods.orb.vol[src.s.el] && G.r() < G.mods.orb.vol[src.s.el] / 100) { mult *= 4; o.crit = true; }
  if (el === 'K' && FX('shredStack') && (e.boss || e.elite.length) && !o.dot) { mult *= 1 + (e.shredV || 0); e.shredV = Math.min(0.3, (e.shredV || 0) + FX('shredStack') / 100); }
  if (el === 'K' && st.burn && FX('burnCrit') && !o.crit && !o.dot && src && src.s) { mult *= src.s.critM; o.crit = true; }
  if (src && src.s) {
    if ((e.boss || e.elite.length) && src.s.boss) mult *= 1 + src.s.boss;
    if (src.s.slowd && e.slow > 0.05) mult *= 1 + src.s.slowd;
    if (src.isolated && M.loneWolf) mult *= 1 + M.loneWolf;
  }
  if (e.phaseT > 0) mult *= 0.1; // phase shift: a boss shrugs off most damage for a moment
  let amt = dmg * mult;
  if (e.shield > 0) {
    const sk = el === 'A' ? 2.5 : 1; // Arc tears through shields
    const a = Math.min(e.shield, amt * sk); e.shield -= a; amt -= a / sk;
    if (amt <= 0) { e.hitFlash = 0.08; if (src && src.dmgDone !== undefined) { src.dmgDone += a; src.dpsAcc += a; } return a; }
  }
  const dealt = Math.min(e.hp, amt);
  if (G.dbgBoss && e.boss) { if (!e._hit0) e._hit0 = G.time; const k = o.combo || (o.abil ? 'ability' : o.dot ? 'dot' : src && src.type ? src.type : src === G.core ? 'core' : 'other'); G.dbgBoss[k] = (G.dbgBoss[k] || 0) + dealt; }
  e.hp -= amt;
  if (e.boss && !e.gen && e.boss !== 'gloop' && e.phase < BOSS_PHASES.length && e.hp < e.maxHp * BOSS_PHASES[e.phase]) bossPhase(e);
  if (G.stats.dmgByEl[el] !== undefined) G.stats.dmgByEl[el] += dealt;
  if (src && src.dmgDone !== undefined) { src.dmgDone += dealt; src.dpsAcc += dealt; }
  if (!o.dot) e.hitFlash = 0.08;
  if (!o.dot && (o.crit || o.combo || o.abil || dmg * mult > e.maxHp * 0.25)) Hooks.fx('num', { x: e.x, y: e.y, v: amt, crit: o.crit, combo: o.combo, col: EL[el] ? EL[el].col : '#fff' });
  if (e.hp <= 0) { kill(e, src, o); return dealt; }
  if (el === 'K' && src && src.s && FX('kSlow')) e.kSlowT = 1;
  if (src && src.s && src.s.exec && !e.boss && e.hp / e.maxHp < src.s.exec / 100) { Hooks.fx('num', { x: e.x, y: e.y, v: e.hp, combo: 'EXECUTE', col: '#ff4d6a' }); e.hp = 0; kill(e, src, o); return dealt; }
  if (!o.noStatus && src && src.s) {
    if (el === 'K' && o.crit && FX('critSplash')) for (const o2 of G.enemies) if (!o2.dead && o2 !== e && dist2(o2.x, o2.y, e.x, e.y) <= 1) hit(o2, dmg * FX('critSplash') / 100, 'K', src, { noStatus: 1 });
    applyStatuses(e, dmg, el, src, o);
  }
  return dealt;
}
function combo(e, name, col) {
  G.dmgLog.combos++;
  G.stats.combos[name] = (G.stats.combos[name] || 0) + 1;
  if (!PROF.codex.combos[name]) Hooks.toast('NEW COMBO · ' + name, COMBO_DESC[name] || '', col);
  PROF.codex.combos[name] = (PROF.codex.combos[name] || 0) + 1;
  if (G.entWaveCombo < 4) { G.entWaveCombo += 0.05; addEntropy(0.05); }
  Hooks.fx('combo', { x: e.x, y: e.y, name, col });
  Hooks.sfx('combo', name);
}
function applyStatuses(e, dmg, el, src, o) {
  const M = G.mods, s = src.s, st = e.st, r = G.r;
  const jugg = e.elite.includes('jugg');
  // combos first
  const cmb = 1 + ((M.orb && M.orb.combo[el]) || 0) / 100;
  if (el === 'K' && st.frozen > 0) {
    combo(e, 'SHATTER', '#6ae2ff');
    if (FX('coldSnap')) for (const o2 of G.enemies) if (!o2.dead && o2 !== e && !o2.boss && o2.st.frozen <= 0 && dist2(o2.x, o2.y, e.x, e.y) <= 1) { o2.st.frozen = 0.8; Hooks.fx('freeze', { x: o2.x, y: o2.y }); }
    hit(e, dmg * 1.0 * M.shatter * cmb, 'C', src, { noStatus: 1, combo: 'SHATTER' }); if (e.dead) return;
  }
  if (el === 'T' && st.chill >= 3) { st.chill = 0; combo(e, 'THERMAL SHOCK', '#ff7b39'); hit(e, dmg * 1.5 * cmb, 'T', src, { noStatus: 1, combo: 'THERMAL SHOCK' }); if (e.dead) return; }
  // Conflagration has no Chill, so heat builds instead: every 3rd Thermal hit on a burning enemy flashes a Thermal Shock
  if (el === 'T' && M.ks.conflag && st.burn) { e.heat = (e.heat || 0) + 1; if (e.heat >= 3) { e.heat = 0; combo(e, 'THERMAL SHOCK', '#ff7b39'); hit(e, dmg * 1.5 * cmb, 'T', src, { noStatus: 1, combo: 'THERMAL SHOCK' }); if (e.dead) return; } }
  if (((el === 'T' && st.shock > 0) || (el === 'A' && st.burn)) && e.ovlCD <= 0) {
    e.ovlCD = FX('ovlFree') ? 0 : 1; st.shock = 0;
    const rad = 1 * M.overloadRad, d = (dmg * 0.6 + 10 * Math.sqrt(hpMult(G.wave))) * M.overload * cmb;
    combo(e, 'OVERLOAD', '#ffb03a');
    Hooks.fx('boom', { x: e.x, y: e.y, r: rad, col: '#ffb03a' });
    for (const o2 of G.enemies) if (!o2.dead && dist2(o2.x, o2.y, e.x, e.y) <= rad * rad) { hit(o2, d, 'A', src, { noStatus: 1 }); if (FX('ovlBurn') && !o2.dead && !o2.st.burn) o2.st.burn = { dps: d * 0.25 * M.burnDmg, t: 3 * M.burnDur, src }; }
    if (e.dead) return;
  }
  if (el === 'A' && st.chill > 0 && e.supCD <= 0) {
    e.supCD = 1;
    const rad = 1.2 * M.superRad;
    let n = 0;
    for (const o2 of G.enemies) if (!o2.dead && o2 !== e && dist2(o2.x, o2.y, e.x, e.y) <= rad * rad) { o2.st.shock = FX('shockLong') ? 6 : 3; o2.st.shockEff = Math.max(o2.st.shockEff, M.shockEff); if (FX('superChill') && !o2.elite.includes('jugg')) { o2.st.chill = Math.min(5, o2.st.chill + 1); o2.st.chillT = 2.5; } n++; }
    if (n) { combo(e, 'SUPERCONDUCT', '#9ff2ff'); Hooks.fx('arcs', { x: e.x, y: e.y, r: rad }); }
  }
  if (el === 'V' && st.mark >= M.markMax && (st.burn || st.chill > 0 || st.shock > 0)) {
    st.mark = 0;
    const rad = FX('blackHole') ? 3 : 1.5;
    if (FX('voidSiphon')) addEntropy(1);
    combo(e, 'COLLAPSE', '#b86cff');
    Hooks.fx('implode', { x: e.x, y: e.y, r: rad });
    for (const o2 of G.enemies) if (!o2.dead && dist2(o2.x, o2.y, e.x, e.y) <= rad * rad) {
      // the max-HP part made bosses melt whatever their health (Lens marks fast enough to Collapse every second); bosses take a sliver
      hit(o2, (dmg * 2 * M.collapse + o2.maxHp * (o2.boss ? 0.004 : 0.03)) * cmb, 'V', src, { noStatus: 1 });
      if (!o2.boss && !o2.elite.includes('jugg')) o2.d = Math.max(0, o2.d - (FX('blackHole') ? 1 : 0.5));
    }
    if (e.dead) return;
  }
  // statuses
  let burnP = s.burn, chillP = s.chill, shockP = s.shock, markP = s.mark;
  const forced = (M.ks.prismatic || s.leg.prism || G.af.prism) ? pick(r, M.ks.conflag ? ['burn', 'shock', 'mark'] : ['burn', 'chill', 'shock', 'mark']) : null;
  if (forced === 'burn') burnP = 1; if (forced === 'chill') chillP = 1; if (forced === 'shock') shockP = 1; if (forced === 'mark') markP = 1;
  if (burnP > 0 && r() < burnP) {
    const dps = dmg * 0.35 * s.burnX * M.burnDmg * (s.kind === 'cone' ? 1.5 : 1);
    if (!st.burn || st.burn.dps < dps) st.burn = { dps, t: 3 * M.burnDur, src };
    else st.burn.t = 3 * M.burnDur;
  }
  if (chillP > 0 && r() < chillP && !jugg) {
    st.chill = Math.min(5, st.chill + (s.kind === 'pulse' ? 2 : 1)); st.chillT = 2.5; st.chillPot = Math.max(st.chillPot, s.chillPot);
    if (el === 'C' && FX('chillSplash') && !o.splashed) for (const o2 of G.enemies) if (!o2.dead && o2 !== e && !o2.elite.includes('jugg') && dist2(o2.x, o2.y, e.x, e.y) <= 1) { o2.st.chill = Math.min(5, o2.st.chill + 1); o2.st.chillT = 2.5; o2.st.chillPot = Math.max(o2.st.chillPot, s.chillPot); }
    if (s.shatterField) { e.shatterT = 2; e.shatterV = s.shatterField; }
    if (st.chill >= (FX('freezeAt') ? 4 : 5) && st.freezeImm <= 0) {
      st.frozen = (1 + s.freezeBonus) * (e.boss ? 0.4 : 1); st.freezeImm = st.frozen + 2.5 * (1 - FX('freezeImmRed') / 100); st.chill = 0;
      Hooks.fx('freeze', { x: e.x, y: e.y }); Hooks.sfx('freeze');
    }
  }
  if (shockP > 0 && r() < shockP) {
    st.shock = FX('shockLong') ? 6 : 3; st.shockEff = Math.max(st.shockEff, s.shockX * M.shockEff);
    if (s.stun && r() < s.stun && !jugg) st.stun = Math.max(st.stun, e.boss ? 0.2 : 0.6);
  }
  if (markP > 0 && r() < markP) { st.mark = Math.min(M.markMax, st.mark + 1); st.markT = 4; }
  if (M.chillVoid && st.chill > 0 && r() < M.chillVoid / 100) { st.mark = Math.min(M.markMax, st.mark + 1); st.markT = 4; }
  if (M.knock && r() < M.knock && !jugg) { e.d = Math.max(0, e.d - (e.boss ? 0.15 : 0.5)); if (FX('knockMark')) { st.mark = Math.min(M.markMax, st.mark + 2); st.markT = 4; } }
  if (s.stunDur && s.kind === 'mortar' && !jugg) st.stun = Math.max(st.stun, s.stunDur * (e.boss ? 0.3 : 1));
}
function addScore(v) {
  v = v * G.CH.score * (G.scoreMult || 1);
  G.score += v;
  const xp = v * 0.1 * G.mods.xp * (1 + NOVA_XP * (G.novaN || 0));
  G.xpEarned += xp;
  const before = profLevel().level;
  PROF.xp += xp;
  const after = profLevel().level;
  if (after > before) { Hooks.onLevel(after, after - before); Hooks.sfx('levelup'); }
  if (G.score >= G.nextMs) milestone();
}
function milestone() {
  const k = pick(G.r, FX('loadout') ? loadoutList() : ABIL_ORDER);
  G.charges[k]++;
  const B = pick(G.r, MILESTONE_BUFFS);
  G.runMods[B.k] = (G.runMods[B.k] || 0) + B.v;
  G.msIdx++;
  G.nextMs = Math.round(G.nextMs * 1.5 + 600 * G.mods.abilCharge);
  recomputeAll();
  Hooks.toast('MILESTONE', `+1 ${ABILITIES[k].name} · ${B.t}`, '#ffe14d');
  Hooks.sfx('milestone');
}
function kill(e, src, o) {
  if (e.dead) return;
  e.dead = true; e.hp = 0;
  geneRecord(e, false);
  if (e.brood) { // Brood: bursts into mites
    const mh = e.maxHp * 0.12 / ENEMIES.swarmer.hp;
    for (let i = 0; i < 3; i++) { const m = spawnEnemy('swarmer', { L: e.L, d: Math.max(0, e.d - i * 0.2), hpm: mh }); m.fly = e.fly; m.mite = 1; m.cr *= 0.3; m.score = Math.round(m.score * 0.3); }
    Hooks.fx('brood', { x: e.x, y: e.y });
  }
  if (e.pirate) {
    const P = e.pirate, bounty = Math.round((25 + 6 * G.wave) * G.mods.credits);
    G.credits += bounty;
    let msg = `+${bounty} bounty`;
    if (P.cache) { if (!G.caches.includes(P.cache)) G.caches.push(P.cache); const m = claimCache(P.cache); if (m) msg += ' · ' + m; }
    Hooks.toast('PIRATE DOWN', msg, '#ffe14d');
    G.stats.pirates = (G.stats.pirates || 0) + 1;
  }
  const M = G.mods;
  let cm = M.credits * (G.CH.cr || 1) * (G.ev.gold ? 2 : 1) * (e.elite.length && G.af.eliteCr ? 2 : 1);
  if (src && src.s && src.s.bounty) cm *= 1 + src.s.bounty;
  for (const f of G.forges || []) {
    if (f.s.fbounty) cm *= 1 + f.s.fbounty;
    if (f.s.bountyAura && dist2(f.cx, f.cy, e.x, e.y) <= 9) cm *= 1 + f.s.bountyAura;
  }
  const cr = Math.max(1, Math.round(e.cr * cm)) + (FX('salvage') ? Math.floor(G.wave / 10) : 0);
  G.credits += cr;
  G.kills++; PROF.kills++;
  addScore(e.score);
  if (src) { src.kills = (src.kills || 0) + 1; grantVxp(src, e.boss ? 30 : e.elite.length ? 3 : 1); }
  if (e.elite.length) { G.stats.elites++; if (G.entWaveCombo < 6) { G.entWaveCombo += 0.25; addEntropy(0.25); } }
  if (G.af.boom && depth0(o) < 2) {
    for (const o2 of G.enemies) if (!o2.dead && dist2(o2.x, o2.y, e.x, e.y) <= 1) hit(o2, e.maxHp * G.af.boom * (o2.boss ? 0.3 : 1), 'T', null, { noStatus: 1, depth: depth0(o) + 1 });
    Hooks.fx('boom', { x: e.x, y: e.y, r: 1, col: '#ff7b39' });
  }
  Hooks.fx('death', { x: e.x, y: e.y, type: e.type, boss: e.boss || false, gen: e.gen || 0, elite: e.elite.length > 0, cr });
  Hooks.sfx(e.boss && !e.gen ? (e.boss === 'gloop' ? 'blorp' : 'bossdie') : e.gen ? 'blorp' : 'die', e);
  const depth = (o && o.depth) || 0;
  if (src && src.s && src.s.leg.detonator && depth < 2) {
    Hooks.fx('boom', { x: e.x, y: e.y, r: 1, col: '#ff8a2a' });
    for (const o2 of G.enemies) if (!o2.dead && dist2(o2.x, o2.y, e.x, e.y) <= 1) hit(o2, e.maxHp * 0.4, src.s.el, src, { noStatus: 1, depth: depth + 1 });
  }
  if (depth < 2) {
    if (e.st.burn && FX('burnBoom')) { Hooks.fx('boom', { x: e.x, y: e.y, r: 1, col: '#ff7b39' }); for (const o2 of G.enemies) if (!o2.dead && dist2(o2.x, o2.y, e.x, e.y) <= 1) hit(o2, e.maxHp * FX('burnBoom') / 100 * (o2.boss ? 0.3 : 1), 'T', null, { noStatus: 1, depth: depth + 1 }); }
    if (e.st.shock > 0 && FX('shockBurst')) { Hooks.fx('arcs', { x: e.x, y: e.y, r: 1 }); for (const o2 of G.enemies) if (!o2.dead && dist2(o2.x, o2.y, e.x, e.y) <= 1) hit(o2, e.maxHp * FX('shockBurst') / 100 * (o2.boss ? 0.3 : 1), 'A', null, { noStatus: 1, depth: depth + 1 }); }
    if (e.st.frozen > 0 && FX('iceShards')) { Hooks.fx('freeze', { x: e.x, y: e.y }); for (const o2 of G.enemies) if (!o2.dead && !o2.elite.includes('jugg') && dist2(o2.x, o2.y, e.x, e.y) <= 1.44) { o2.st.chill = Math.min(5, o2.st.chill + 2); o2.st.chillT = 2.5; } }
  }
  if (src && src.s && M.orb && M.orb.ent[src.s.el]) addEntropy(0.08);
  if (src && src.s && src.s.el === 'T' && FX('napalmKill') && G.zones.length < 40) G.zones.push({ k: 'napalm', x: e.x, y: e.y, r: 0.7, t: 2, dps: Math.max(4, e.maxHp * 0.06), src, el: 'T' });
  if (M.chainIgnite && e.st.burn) {
    for (const o2 of G.enemies) if (!o2.dead && dist2(o2.x, o2.y, e.x, e.y) <= 1.44) {
      if (!o2.st.burn || o2.st.burn.dps < e.st.burn.dps) o2.st.burn = { dps: e.st.burn.dps, t: 3 * M.burnDur, src: e.st.burn.src };
    }
  }
  if (src && src.s && src.s.leg.siphon) G.core.hp = Math.min(G.core.max, G.core.hp + G.core.max * 0.005);
  if (e.boss === 'gloop' && (e.gen || 0) < 2) {
    for (let i = 0; i < 2; i++) spawnBoss({ boss: 'gloop', L: e.L, d: Math.max(0, e.d - i * 0.5), gen: (e.gen || 0) + 1, hpAbs: e.maxHp * 0.35, hpm: 1 });
    Hooks.fx('say', { x: e.x, y: e.y, t: e.gen ? 'bloop!' : 'ow. but also: two of me' });
  }
  if (e.type === 'splitter') for (let i = 0; i < 3; i++) spawnEnemy('swarmer', { L: e.L, d: Math.max(0, e.d - i * 0.25) });
  if (e.elite.includes('split') && !e.boss) for (let i = 0; i < 2; i++) {
    const c = spawnEnemy(e.type, { L: e.L, d: Math.max(0, e.d - i * 0.3) }); c.maxHp = c.hp = e.maxHp * 0.3;
  }
  if (e.elite.includes('volatile')) {
    for (const t of G.towers) if (dist2(t.cx, t.cy, e.x, e.y) <= 1.44) t.disabled = Math.max(t.disabled, 2);
    Hooks.fx('emp', { x: e.x, y: e.y, r: 1.2 });
  }
  // Gloop's offspring are part of one boss: the reward comes when the last of the family dies
  if (e.boss === 'worm' && e.gut && e.gut.length) wormRelease(e);
  if (e.boss === 'auditor' && e.audited > 0) { const back = Math.round(e.audited * 1.25); G.credits += back; Hooks.toast('TAX REFUND', `+${back} credits, with 25% interest`, '#59f0b4', true); Hooks.fx('num', { x: e.x, y: e.y - 0.5, v: back, combo: 'REFUND', col: '#59f0b4' }); e.audited = 0; }
  const bossDown = e.boss && (e.boss !== 'gloop' || ((e.gen || 0) >= 2 && !G.enemies.some(o => o !== e && !o.dead && o.boss === 'gloop')));
  if (bossDown) {
    G.tokens++; G.stats.bossKills++; addEntropy(15);
    PROF.codex.bosses[e.boss] = (PROF.codex.bosses[e.boss] || 0) + 1;
    Hooks.log(`${e.gen ? 'Gloop' : e.bossName} defeated · +1 Recalibration token`, '#59f0b4');
    if (!G.draft) { // one boon pick at a time
      const opts = []; const pool = BOONS.slice();
      for (let i = 0; i < 3; i++) opts.push(pool.splice(Math.floor(G.r() * pool.length), 1)[0]);
      G.draft = opts;
      Hooks.onDraft(opts);
    }
  }
}
const depth0 = o => (o && o.depth) || 0;
function takeBoon(b) {
  G.boonsTaken.push(b.id);
  if (b.m) for (const k in b.m) G.runMods[k] = (G.runMods[k] || 0) + b.m[k];
  switch (b.special) {
    case 'core': G.core.hpBonus = (G.core.hpBonus || 0) + 0.25; break;
    case 'tokens': G.tokens += 2; G.charges[pick(G.r, ABIL_ORDER)]++; break;
    case 'legend': G.legendQueue += 3; break;
    case 'mutate': for (const t of G.towers) t.affixes.push(rollAffix(t)); break;
    case 'reroll': G.rerollDisc = true; break;
    case 'cash': G.credits += 25 * G.wave; break;
    case 'grid': G.gridBonus = (G.gridBonus || 0) + 2; break;
  }
  G.draft = null;
  recomputeAll();
  if (b.special === 'core') G.core.hp = G.core.max;
}

// ---------- tower combat ----------
function enemyTargetable(e) { return !e.dead && !(e.burrowT > 0) && (!e.cloaked || e.revealed > 0); }
function findTargets(t, range, n, exclude) {
  const r2 = range * range, out = [];
  const cand = [];
  const ground = t.s && t.s.ground;
  for (const e of G.enemies) {
    if (!enemyTargetable(e) || (exclude && exclude.has(e)) || (ground && e.fly)) continue;
    const rr = range + (e.boss ? 0.5 : 0);
    if (dist2(e.x, e.y, t.cx, t.cy) <= rr * rr) cand.push(e);
  }
  if (!cand.length) return out;
  const mode = t.mode;
  const key = mode === 'first' ? e => -(e.d / e.L.len) - (e.L.len - e.d < 6 ? 1 : 0)
    : mode === 'last' ? e => e.d / e.L.len
    : mode === 'strong' ? e => -e.hp
    : e => dist2(e.x, e.y, t.cx, t.cy);
  cand.sort((a, b) => key(a) - key(b));
  for (let i = 0; i < Math.min(n, cand.length); i++) out.push(cand[i]);
  return out;
}
function rollCrit(t) {
  if (t.s.el === 'K' && FX('fifthCrit')) { t.shotN = (t.shotN || 0) + 1; if (t.shotN % 5 === 0) return true; }
  const c = t.s.critC + t.buff.crit;
  return G.r() * 100 < c;
}
function towerDmg(t, sw) {
  let d = t.s.dmg * (1 + t.buff.dmg) * sw[t.s.el];
  if (t.s.leg.entropic) d *= 0.4 + G.r() * 2.6;
  if (G.flux) d *= t.s.el === G.flux.el ? 2 : 0.85;
  if (G.af.lastStand && G.core.hp < G.core.max * 0.5) d *= 1.6;
  const rt = G.mods.orb && G.mods.orb.rift[t.s.el]; if (rt && G.anoms.length) d *= 1 + rt * G.anoms.length / 100;
  return d;
}
function atkDmg(t, sw, crit) { return towerDmg(t, sw) * (crit ? t.s.critM : 1 - (G.af.noncrit || 0)) * (t.capMult || 1); }
function ricochet(t, from, dmg, el) {
  if (!t.s.leg.ricochet) return;
  const hitSet = new Set([from]);
  let cur = from;
  for (let i = 0; i < 3; i++) {
    let best = null, bd = 4;
    for (const e of G.enemies) if (enemyTargetable(e) && !hitSet.has(e)) { const d = dist2(e.x, e.y, cur.x, cur.y); if (d < bd) { bd = d; best = e; } }
    if (!best) break;
    Hooks.fx('zap', { x1: cur.x, y1: cur.y, x2: best.x, y2: best.y, col: '#ff8a2a' });
    hitSet.add(best); hit(best, dmg * 0.6, el, t); cur = best;
  }
}
function updateTowers(dt) {
  const M = G.mods, ev = G.ev;
  G.dpsClock += dt;
  const dpsTick = G.dpsClock >= 1;
  if (dpsTick) {
    G.dpsClock = 0;
    // the defence's recent peak damage output, held between waves and fading slowly (half-life about 2 min): bosses size themselves to it
    let tot = 0; for (const t of G.towers) tot += t.dps;
    G.power = Math.max(tot, (G.power || 0) * 0.995);
  }
  // EMP storm event
  if (ev.emp) { G.evT.emp -= dt; if (G.evT.emp <= 0) { G.evT.emp = 5; const att = G.towers.filter(t => t.s.kind !== 'eco'); for (let i = 0; i < 2 && att.length; i++) { const t = att.splice(Math.floor(G.r() * att.length), 1)[0]; t.disabled = 3; Hooks.fx('emp', { x: t.cx, y: t.cy, r: 0.8 }); } Hooks.sfx('emp'); } }
  if (G.overclockT > 0) G.overclockT -= dt;
  if (G.flux) { G.flux.t -= dt; if (G.flux.t <= 0) { const o = ELS.filter(e => e !== G.flux.el); G.flux = { el: pick(G.r, o), t: 20 }; Hooks.log(`Flux: ${EL[G.flux.el].name} deals ×2`, EL[G.flux.el].col); } }
  let burning = 0;
  if (FX('heatSink')) for (const e of G.enemies) if (!e.dead && e.st.burn) burning++;
  if (FX('thunder') && G.enemies.length) {
    G.thunderT = (G.thunderT === undefined ? 6 : G.thunderT) - dt;
    if (G.thunderT <= 0) {
      G.thunderT = 6;
      let best = null; for (const e of G.enemies) if (enemyTargetable(e) && (!best || e.hp > best.hp)) best = e;
      if (best) { Hooks.fx('rail', { x1: best.x, y1: -1, x2: best.x, y2: best.y, col: '#ffe14d', crit: 1 }); Hooks.sfx('zap'); hit(best, 14 * hpMult(Math.max(1, G.wave)) * M.dmg * M.el.A, 'A', null, { abil: 1 }); if (!best.dead) { best.st.shock = FX('shockLong') ? 6 : 3; best.st.shockEff = Math.max(best.st.shockEff, M.shockEff); } }
    }
  }
  for (const t of G.towers) {
    if (dpsTick) { t.dps = t.dps * 0.6 + t.dpsAcc * 0.4; t.dpsAcc = 0; }
    t.flash = Math.max(0, t.flash - dt);
    const s = t.s;
    if (s.kind === 'support' || s.kind === 'eco' || s.kind === 'snare') continue;
    if (t.disabled > 0) { t.disabled -= dt; t.ramp = 0; t.beamTargets = null; continue; }
    const sw = stormAt(t.cx, t.cy);
    let range = s.range * sw.range * (ev.blackout ? 0.8 : 1);
    let rate = s.rate * (1 + t.buff.rate) * (ev.overcharge ? 1.3 : 1) * (G.overclockT > 0 ? 2 : 1);
    if (s.leg.overloop) { t.olT = (t.olT + dt) % 8; if (t.olT < 3) rate *= 2.5; }
    if (burning && s.el === 'T') rate *= 1 + Math.min(0.4, 0.02 * burning);
    if (s.el === 'A' && FX('capacitor')) t.capT = (t.capT || 0) + dt;
    t.effRange = range;
    t.cd -= dt * rate;
    if (s.kind === 'beam') { beamUpdate(t, dt, range, sw); continue; }
    if (t.cd > 0) continue;
    t.capMult = s.el === 'A' && FX('capacitor') && t.capT >= 4 ? 3 : 1;
    const fired = towerAttack(t, range, sw);
    if (fired && t.capMult > 1) { t.capT = 0; Hooks.fx('arcs', { x: t.cx, y: t.cy, r: 0.8 }); }
    t.capMult = 1;
    if (fired) {
      t.cd += 1;
      if (t.cd < -1) t.cd = 0;
      t.flash = 0.08;
      if ((s.leg.echo && G.r() < 0.3) || (G.af.echo && G.r() < G.af.echo)) towerAttack(t, range, sw);
      if ((M.ks.overgrid && G.r() < 0.03) || (s.cur.jam && G.r() < 0.05) || (G.af.jam && G.r() < G.af.jam)) { t.disabled = M.ks.overgrid ? 1.5 : 1; Hooks.fx('jam', { x: t.cx, y: t.cy }); }
    } else if (t.cd < 0) t.cd = 0;
  }
}
function towerAttack(t, range, sw) {
  const s = t.s;
  if (s.cur.unstable && G.r() < 0.1) { const tg = findTargets(t, range, 1); if (tg.length) { Hooks.fx('fizzle', { x: t.cx, y: t.cy }); return true; } return false; }
  switch (s.kind) {
    case 'bullet': {
      const tg = findTargets(t, range, 1 + s.multi);
      if (!tg.length) return false;
      for (const e of tg) {
        t.angle = Math.atan2(e.y - t.cy, e.x - t.cx);
        const crit = rollCrit(t);
        G.projs.push({ k: 'bullet', x: t.cx, y: t.cy, e, spd: s.pspd, dmg: atkDmg(t, sw, crit), crit, el: s.el, src: t,
          bounces: s.pierce + s.chain, hitSet: new Set(), splash: s.splash, life: 2 });
      }
      Hooks.sfx('shot', t);
      return true;
    }
    case 'rail': {
      const tg = findTargets(t, range, 1 + s.multi);
      if (!tg.length) return false;
      for (const e0 of tg) {
      const ang = Math.atan2(e0.y - t.cy, e0.x - t.cx); t.angle = ang;
      const dx = Math.cos(ang), dy = Math.sin(ang);
      const len = range + 1;
      const hits = [];
      for (const e of G.enemies) {
        if (!enemyTargetable(e)) continue;
        const px = e.x - t.cx, py = e.y - t.cy;
        const along = px * dx + py * dy;
        if (along < 0 || along > len) continue;
        const perp = Math.abs(px * dy - py * dx);
        if (perp < 0.35 + (e.boss ? 0.4 : 0)) hits.push([along, e]);
      }
      hits.sort((a, b) => a[0] - b[0]);
      const crit = rollCrit(t);
      const dmg = atkDmg(t, sw, crit);
      const n = Math.min(hits.length, 1 + s.pierce);
      for (let i = 0; i < n; i++) { hit(hits[i][1], dmg, s.el, t, { crit }); }
      if (n) ricochet(t, hits[0][1], dmg, s.el);
      Hooks.fx('rail', { x1: t.cx, y1: t.cy, x2: t.cx + dx * len, y2: t.cy + dy * len, col: EL[s.el].col, crit });
      }
      Hooks.sfx('rail', t);
      return true;
    }
    case 'pulse': {
      const r2 = range * range;
      const tg = G.enemies.filter(e => enemyTargetable(e) && dist2(e.x, e.y, t.cx, t.cy) <= r2);
      if (!tg.length) return false;
      const crit = rollCrit(t);
      const dmg = atkDmg(t, sw, crit);
      for (const e of tg) hit(e, dmg, s.el, t, { crit });
      Hooks.fx('pulse', { x: t.cx, y: t.cy, r: range, col: EL[s.el].col });
      Hooks.sfx('pulse', t);
      return true;
    }
    case 'missile': {
      const tg = findTargets(t, range, 1 + s.multi);
      if (!tg.length) return false;
      for (const e of tg) {
        t.angle = Math.atan2(e.y - t.cy, e.x - t.cx);
        const crit = rollCrit(t);
        G.projs.push({ k: 'missile', x: t.cx, y: t.cy, vx: Math.cos(t.angle + (G.r() - 0.5)) * 2, vy: Math.sin(t.angle + (G.r() - 0.5)) * 2,
          e, tx: e.x, ty: e.y, spd: s.pspd, dmg: atkDmg(t, sw, crit), crit, el: s.el, src: t, splash: s.splash, life: 4 });
      }
      Hooks.sfx('missile', t);
      return true;
    }
    case 'chain': {
      const tg = findTargets(t, range, 1 + s.multi);
      if (!tg.length) return false;
      for (const e0 of tg) {
        t.angle = Math.atan2(e0.y - t.cy, e0.x - t.cx);
        const crit = rollCrit(t);
        let dmg = atkDmg(t, sw, crit);
        const hitSet = new Set([e0]);
        const pts = [{ x: t.cx, y: t.cy }, { x: e0.x, y: e0.y }];
        hit(e0, dmg, s.el, t, { crit });
        let cur = e0;
        for (let j = 0; j < s.chain; j++) {
          let best = null, bd = 1.7 * 1.7;
          for (const e of G.enemies) if (enemyTargetable(e) && !hitSet.has(e)) { const d = dist2(e.x, e.y, cur.x, cur.y); if (d < bd) { bd = d; best = e; } }
          if (!best) break;
          if (!FX('chainKeep')) dmg *= 0.85; hitSet.add(best); pts.push({ x: best.x, y: best.y });
          hit(best, dmg, s.el, t); cur = best;
        }
        ricochet(t, e0, dmg, s.el);
        Hooks.fx('chain', { pts, col: EL[s.el].col });
      }
      Hooks.sfx('zap', t);
      return true;
    }
    case 'cone': {
      const tg = findTargets(t, range, 1);
      if (!tg.length) return false;
      const e0 = tg[0];
      const ang = Math.atan2(e0.y - t.cy, e0.x - t.cx); t.angle = ang;
      const crit = rollCrit(t);
      const dmg = atkDmg(t, sw, crit);
      const r2 = (range + 0.3) * (range + 0.3);
      for (const e of G.enemies) {
        if (!enemyTargetable(e) || e.fly) continue; // flames can't reach fliers
        if (dist2(e.x, e.y, t.cx, t.cy) > r2) continue;
        let da = Math.atan2(e.y - t.cy, e.x - t.cx) - ang;
        while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
        if (Math.abs(da) < 0.55) hit(e, dmg, s.el, t, { crit });
      }
      Hooks.fx('flame', { x: t.cx, y: t.cy, ang, range, col: EL[s.el].col });
      Hooks.sfx('flame', t);
      return true;
    }
    case 'mortar': {
      const tg = findTargets(t, range, s.shells);
      if (!tg.length) return false;
      for (let i = 0; i < s.shells; i++) {
        const e = tg[i % tg.length];
        t.angle = Math.atan2(e.y - t.cy, e.x - t.cx);
        const crit = rollCrit(t);
        const tx = e.x + (i ? (G.r() - 0.5) * 1.2 : 0), ty = e.y + (i ? (G.r() - 0.5) * 1.2 : 0);
        const fl = Math.hypot(tx - t.cx, ty - t.cy) / s.pspd + 0.3;
        G.projs.push({ k: 'mortar', x: t.cx, y: t.cy, sx: t.cx, sy: t.cy, tx, ty, t: 0, fl, dmg: atkDmg(t, sw, crit), crit, el: s.el, src: t, splash: s.splash });
      }
      Hooks.sfx('mortar', t);
      return true;
    }
    case 'grav': {
      const r2 = range * range;
      const tg = G.enemies.filter(e => enemyTargetable(e) && !e.fly && dist2(e.x, e.y, t.cx, t.cy) <= r2);
      if (!tg.length) return false;
      const dmg = towerDmg(t, sw);
      for (const e of tg) {
        if (!e.elite.includes('jugg')) { e.pullN = (e.pullN || 0) + 1; e.d = Math.max(0, e.d - s.pull * (e.boss ? 0.3 : 1) * Math.max(0.3, 1 - 0.15 * (e.pullN - 1))); }
        hit(e, dmg, s.el, t);
      }
      Hooks.fx('grav', { x: t.cx, y: t.cy, r: range });
      Hooks.sfx('grav', t);
      return true;
    }
  }
  return false;
}
function beamUpdate(t, dt, range, sw) {
  const s = t.s;
  // keep targets if still valid
  let tg = (t.beamTargets || []).filter(e => enemyTargetable(e) && dist2(e.x, e.y, t.cx, t.cy) <= range * range);
  if (tg.length < s.beams) {
    const extra = findTargets(t, range, s.beams, new Set(tg));
    for (const e of extra) if (tg.length < s.beams) tg.push(e);
  }
  if (!tg.length) { t.beamTargets = null; t.ramp = 0; t.cd = Math.max(t.cd, 0); return; }
  if (!t.beamTargets || t.beamTargets[0] !== tg[0]) { if (!(t.s.el === 'V' && FX('rampKeep'))) t.ramp = 0; }
  t.beamTargets = tg;
  t.ramp = Math.min(4, t.ramp + dt);
  t.angle = Math.atan2(tg[0].y - t.cy, tg[0].x - t.cx);
  while (t.cd <= 0) {
    t.cd += 1;
    const mult = 1 + (s.rampMax - 1) * (t.ramp / 4);
    for (const e of tg) { const crit = rollCrit(t); hit(e, atkDmg(t, sw, crit) * mult, s.el, t, { crit }); }
  }
}

function updateProjs(dt) {
  for (const p of G.projs) {
    if (p.dead) continue;
    if (p.k === 'bullet') {
      p.life -= dt;
      if (!p.e || p.e.dead) {
        // retarget nearby
        let best = null, bd = 2.25;
        for (const e of G.enemies) if (enemyTargetable(e) && !p.hitSet.has(e)) { const d = dist2(e.x, e.y, p.x, p.y); if (d < bd) { bd = d; best = e; } }
        if (!best) { p.dead = true; continue; }
        p.e = best;
      }
      const dx = p.e.x - p.x, dy = p.e.y - p.y, d = Math.hypot(dx, dy), stepv = p.spd * dt;
      if (d <= stepv + 0.15) {
        p.x = p.e.x; p.y = p.e.y;
        const e = p.e;
        p.hitSet.add(e);
        hit(e, p.dmg, p.el, p.src, { crit: p.crit });
        if (p.splash) { for (const o of G.enemies) if (!o.dead && o !== e && dist2(o.x, o.y, p.x, p.y) <= p.splash * p.splash) hit(o, p.dmg * 0.5, p.el, p.src, { noStatus: 1 }); Hooks.fx('boom', { x: p.x, y: p.y, r: p.splash, col: EL[p.el].col }); }
        ricochet(p.src, e, p.dmg, p.el);
        if (G.af.fractal && !p.shard) shards(p, e);
        Hooks.fx('spark', { x: p.x, y: p.y, col: EL[p.el].col });
        if (p.bounces > 0) {
          p.bounces--; if (!(p.el === 'K' && FX('pierceKeep'))) p.dmg *= 0.7;
          let best = null, bd = 2.6;
          for (const o of G.enemies) if (enemyTargetable(o) && !p.hitSet.has(o)) { const dd = dist2(o.x, o.y, p.x, p.y); if (dd < bd) { bd = dd; best = o; } }
          if (best) { p.e = best; continue; }
        }
        p.dead = true;
      } else { p.x += dx / d * stepv; p.y += dy / d * stepv; }
      if (p.life <= 0) p.dead = true;
    } else if (p.k === 'missile') {
      p.life -= dt;
      if (p.e && !p.e.dead) { p.tx = p.e.x; p.ty = p.e.y; }
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
      p.vx += dx / (d || 1) * p.spd * 3 * dt; p.vy += dy / (d || 1) * p.spd * 3 * dt;
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > p.spd) { p.vx = p.vx / sp * p.spd; p.vy = p.vy / sp * p.spd; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (d < 0.25 || p.life <= 0) { explode(p); p.dead = true; }
    } else if (p.k === 'mortar') {
      p.t += dt;
      const k = Math.min(1, p.t / p.fl);
      p.x = lerp(p.sx, p.tx, k); p.y = lerp(p.sy, p.ty, k); p.h = Math.sin(k * Math.PI) * 1.5;
      if (k >= 1) { explode(p); p.dead = true; }
    } else if (p.k === 'bomblet') {
      p.t -= dt;
      if (p.t <= 0) { explode(p); p.dead = true; }
    }
  }
  G.projs = G.projs.filter(p => !p.dead);
  if (G.projs.length > 500) G.projs.splice(0, G.projs.length - 500);
}
function shards(p, from) {
  const near = G.enemies.filter(o => enemyTargetable(o) && o !== from && dist2(o.x, o.y, p.x, p.y) < 4).sort((a, b) => dist2(a.x, a.y, p.x, p.y) - dist2(b.x, b.y, p.x, p.y)).slice(0, 2);
  for (const o of near) G.projs.push({ k: 'bullet', x: p.x, y: p.y, e: o, spd: 12, dmg: p.dmg * 0.4, crit: false, el: p.el, src: p.src, bounces: 0, hitSet: new Set([from]), splash: 0, life: 1, shard: 1 });
}
function explode(p) {
  const r = p.splash || 0.6, src = p.src, s = src.s;
  if (G.af.fractal && p.k === 'missile') shards(p, null);
  Hooks.fx('boom', { x: p.x, y: p.y, r, col: EL[p.el].col });
  Hooks.sfx('boom', p);
  for (const e of G.enemies) if (!e.dead && dist2(e.x, e.y, p.x, p.y) <= (r + e.size) * (r + e.size)) {
    if (p.k === 'mortar' && e.shield > 0) e.shield *= 0.5; // EMP strips shields
    hit(e, p.dmg, p.el, src, { crit: p.crit });
  }
  if (p.k === 'missile' && s.cluster) for (let i = 0; i < s.cluster; i++) {
    G.projs.push({ k: 'bomblet', x: p.x + (G.r() - 0.5) * 1.6, y: p.y + (G.r() - 0.5) * 1.6, t: 0.25 + i * 0.12, dmg: p.dmg * 0.45, el: p.el, src, splash: 0.6, crit: false });
  }
  if (p.k === 'missile' && s.napalm) G.zones.push({ k: 'napalm', x: p.x, y: p.y, r: 0.85, t: 3, dps: p.dmg * 0.5, src, el: 'T' });
  if (p.k === 'mortar' && s.stunDur) Hooks.fx('emp', { x: p.x, y: p.y, r });
}
function updateZones(dt) {
  for (const z of G.zones) {
    z.t -= dt;
    for (const e of G.enemies) if (!e.dead && !(e.fly && z.k === 'napalm') && dist2(e.x, e.y, z.x, z.y) <= z.r * z.r) {
      hit(e, z.dps * dt, z.el, z.src, { dot: 1, noStatus: 1 });
      if (!e.dead && !e.st.burn) e.st.burn = { dps: z.dps * 0.4 * G.mods.burnDmg, t: 1.5, src: z.src };
    }
  }
  G.zones = G.zones.filter(z => z.t > 0);
  // meteor event
  if (G.ev.meteor) {
    G.evT.meteor -= dt;
    if (G.evT.meteor <= 0 && G.enemies.length) {
      G.evT.meteor = 1.2;
      const tgt = pick(G.r, G.enemies);
      const x = tgt.x + (G.r() - 0.5), y = tgt.y + (G.r() - 0.5);
      Hooks.fx('meteor', { x, y });
      setTimeoutSim(0.5, () => {
        Hooks.fx('boom', { x, y, r: 1, col: '#ff7b39' }); Hooks.sfx('boom', {});
        for (const e of G.enemies) if (!e.dead && dist2(e.x, e.y, x, y) <= 1) hit(e, 35 * hpMult(G.wave), 'T', null, { noStatus: 1, abil: 1 });
      });
    }
  }
}
function setTimeoutSim(delay, fn) { (G.timers || (G.timers = [])).push({ t: delay, fn }); }
function updateTimers(dt) {
  if (!G.timers || !G.timers.length) return;
  const due = [];
  for (const tm of G.timers) { tm.t -= dt; if (tm.t <= 0) due.push(tm); }
  G.timers = G.timers.filter(tm => tm.t > 0);
  for (const tm of due) tm.fn();
}

// ---------- core ----------
const CORE_EL_STATUS = { K: {}, T: { burn: 0.5 }, C: { chill: 1 }, A: { shock: 0.5 }, V: { mark: 0.5 } };
function coreStats() {
  const M = G.mods, c = G.core;
  if (!c.A) coreAffSum(c);
  const A = c.A, p = k => (A[k] || 0) / 100, nd = isNode(G.map.core.x, G.map.core.y);
  const el = M.ks.conflag ? 'T' : c.el;
  const st = CORE_EL_STATUS[el];
  return {
    el, kind: 'core', dmg: CORE_GUN.dmg * Math.pow(CORE_GUN.growth, c.wLvl - 1) * M.coreDmg * M.dmg * M.el[el] * (1 + p('dmg')) * (nd ? NODE_CORE.dmg : 1), rate: CORE_GUN.rate * M.coreRate * M.rate * (1 + p('rate')) * (nd ? NODE_CORE.rate : 1),
    range: (CORE_GUN.range + M.coreRange + CORE_GUN.rangeLv * (c.wLvl - 1)) * (1 + p('range')), critC: M.critC + (A.critC || 0), critM: 1.5 + M.critM + p('critM'),
    burn: clamp((st.burn || 0) + p('burn'), 0, 1), chill: M.ks.conflag ? 0 : clamp((st.chill || 0) + p('chill'), 0, 1), shock: clamp((st.shock || 0) + p('shock'), 0, 1), mark: clamp((st.mark || 0) + p('mark'), 0, 1),
    chillPot: M.chillPot, freezeBonus: M.freezeDur, shockX: 1, burnX: 1, stun: 0, stunDur: 0, leg: c.leg, cur: {}, boss: M.eliteDmg + p('boss') + (c.wLvl >= 8 ? 0.25 : 0), slowd: p('slowd'), exec: A.exec || 0, bounty: p('bounty'),
    pierce: A.pierce || 0, chain: A.chain || 0, splash: CORE_GUN.splash + (c.wLvl >= 8 ? 0.6 : 0) + (A.splash || 0), multi: (A.multi || 0) + (c.wLvl >= 4 ? 1 : 0),
    node: nd,
  };
}
const coreWeaponCost = () => Math.round(120 * Math.pow(1.75, G.core.wLvl - 1));
const coreShieldCost = () => Math.round(100 * Math.pow(1.65, G.core.sLvl - 1));
const coreRepairCost = () => Math.round(40 + 14 * G.wave);
function coreUpgrade(kind) {
  const c = G.core;
  let rolled = null;
  if (kind === 'weapon') { const k = coreWeaponCost(); if (c.wLvl >= 12 || G.credits < k) return false; G.credits -= k; c.wLvl++; rolled = rollCoreAffix(c); }
  else if (kind === 'shield') { const k = coreShieldCost(); if (c.sLvl >= 10 || G.credits < k) return false; G.credits -= k; c.sLvl++; rolled = rollCoreAffix(c); }
  else if (kind === 'repair') { const k = coreRepairCost(); if (G.af.lastStand || c.hp >= c.max || G.credits < k) return false; G.credits -= k; c.hp = Math.min(c.max, c.hp + c.max * 0.35); }
  if (rolled) { c.affixes.push(rolled); coreAffSum(c); recomputeAll(); if (kind === 'shield') c.shield = c.smax; }
  Hooks.sfx('upgrade', {});
  Hooks.fx('upgrade', { x: c.x, y: c.y, col: rolled ? RARITY[rolled.tier].col : '#59f0b4' });
  return rolled || true;
}
function updateCore(dt) {
  const c = G.core;
  c.sinceHit += dt;
  if (c.sinceHit > 4 && c.shield < c.smax) c.shield = Math.min(c.smax, c.shield + c.smax * 0.12 * G.mods.shieldRegen * (1 + ((c.A && c.A.crecharge) || 0) / 100) * dt);
  const s = coreStats();
  c.s = s; c.isolated = false; c.buff = { dmg: 0, rate: 0, crit: 0 }; c.dmgDone = c.dmgDone || 0; c.dpsAcc = c.dpsAcc || 0;
  c.cd -= dt * s.rate * (G.overclockT > 0 ? 2 : 1);
  if (c.cd > 0) return;
  // last line of defence: shells go to whatever is closest to reaching the core along its route, anywhere in range
  const r2 = s.range * s.range, near = [];
  for (const e of G.enemies) if (enemyTargetable(e)) { const d = dist2(e.x, e.y, c.x, c.y); if (d < r2) near.push([e.fly || !e.L ? Math.sqrt(d) : e.L.len - e.d, e]); }
  if (!near.length) { c.cd = 0; return; }
  c.cd += 1;
  near.sort((a, b) => a[0] - b[0]);
  c.volley = (c.volley || 0) + 1;
  if (c.wLvl >= 12 && c.volley % 5 === 0) {
    let tough = null; for (const [, e] of near) if (!tough || e.hp > tough.hp) tough = e;
    const x = tough.x, y = tough.y, dmg = s.dmg * 3;
    Hooks.fx('strike', { x, y });
    setTimeoutSim(0.6, () => { Hooks.fx('boom', { x, y, r: 1.5, col: '#e6fff6', big: 1 }); Hooks.sfx('strike'); for (const o of G.enemies) if (!o.dead && dist2(o.x, o.y, x, y) <= 2.25) hit(o, dmg, s.el, c, { abil: 1 }); });
  }
  const sw = stormAt(c.x, c.y), volleys = s.leg.echo && G.r() < 0.3 ? 2 : 1;
  c.angle = Math.atan2(near[0][1].y - c.y, near[0][1].x - c.x);
  for (let v = 0; v < volleys; v++) for (const [, e] of near.slice(0, 1 + s.multi)) {
    const crit = G.r() * 100 < s.critC;
    G.projs.push({ k: 'bullet', x: c.x, y: c.y, e, spd: 16, dmg: s.dmg * sw[s.el] * (crit ? s.critM : 1), crit, el: s.el, src: c, bounces: s.pierce + s.chain, hitSet: new Set(), splash: s.splash, life: 3, shell: 1 });
  }
  Hooks.sfx('coreshot', {});
}

// ---------- core relocation (wormhole checkpoints only, with the field empty) ----------
const relocCost = () => (G.relocUsed || 0) > 0 ? RELOCATE_COST : 0;
const canRelocate = () => !!(G && !G.over && G.checkpoint && !G.enemies.length);
function relocCandidates() {
  const R = G.region, c = G.map.core, out = [], starts = G.map.lanes.map(L => L.tiles[0]);
  for (let y = R.y0 + 1; y < R.y1 - 1; y++) for (let x = R.x0 + 1; x < R.x1 - 1; x++) {
    if ((x - c.x) * (x - c.x) + (y - c.y) * (y - c.y) > RELOCATE_RADIUS * RELOCATE_RADIUS || (x === c.x && y === c.y)) continue;
    const i = tIdx(x, y), t = G.map.tiles[i];
    if (t === 2 || G.towerAt[i]) continue;
    if (starts.some(p => Math.abs(p.x - x) + Math.abs(p.y - y) < 6)) continue;
    out.push(i);
  }
  return out;
}
// Dijkstra over the sector. step(u, v) gives the cost of entering v, or -1 when blocked.
function pathfind(s0, goal, step) {
  const N = COLS * ROWS, dist = new Float32Array(N).fill(1e9), prev = new Int32Array(N).fill(-1), done = new Uint8Array(N);
  const hd = [], hi = [];
  const push = (d, i) => { hd.push(d); hi.push(i); let k = hd.length - 1; while (k) { const p = (k - 1) >> 1; if (hd[p] <= hd[k]) break; [hd[p], hd[k]] = [hd[k], hd[p]]; [hi[p], hi[k]] = [hi[k], hi[p]]; k = p; } };
  const pop = () => { const i = hi[0]; const ld = hd.pop(), li = hi.pop(); if (hd.length) { hd[0] = ld; hi[0] = li; let k = 0; for (;;) { const a = 2 * k + 1, b2 = a + 1; let m = k; if (a < hd.length && hd[a] < hd[m]) m = a; if (b2 < hd.length && hd[b2] < hd[m]) m = b2; if (m === k) break; [hd[m], hd[k]] = [hd[k], hd[m]]; [hi[m], hi[k]] = [hi[k], hi[m]]; k = m; } } return i; };
  dist[s0] = 0; push(0, s0);
  while (hd.length) {
    const u = pop();
    if (done[u]) continue;
    if (u === goal) break;
    done[u] = 1;
    const ux = u % COLS, uy = (u / COLS) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const vx = ux + dx, vy = uy + dy;
      if (!inRegion(vx, vy, G.region)) continue;
      const v = tIdx(vx, vy), c = step(u, v);
      if (c < 0) continue;
      if (dist[u] + c < dist[v]) { dist[v] = dist[u] + c; prev[v] = u; push(dist[v], v); }
    }
  }
  if (goal !== s0 && prev[goal] < 0) return null;
  const route = []; for (let c = goal; c !== -1; c = prev[c]) route.unshift(c);
  return route;
}
// Re-plot every lane to a new core spot, reusing existing road where it can and going around towers.
function planRelocation(nx, ny) {
  if (!canRelocate() || !relocCandidates().includes(tIdx(nx, ny))) return null;
  const map = G.map, N = COLS * ROWS, goal = tIdx(nx, ny);
  const road = new Uint8Array(N), fresh = new Uint8Array(N), own = new Uint8Array(N);
  for (const L of map.lanes) for (const p of L.tiles) road[tIdx(p.x, p.y)] = 1;
  const near = v => { const x = v % COLS, y = (v / COLS) | 0; let n = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const w = tIdx(x + dx, y + dy); if (inRegion(x + dx, y + dy, G.region) && (road[w] || fresh[w])) n++; } return n; };
  // a lane keeps to its own road (so winding routes stay winding) and leaves it only for the new stretch;
  // other lanes' roads can be crossed but are no shortcut; later lanes merge into earlier new stretches
  const step = (u, v) => {
    const t = map.tiles[v];
    if (v !== goal && (t === 2 || G.towerAt[v] || G.nodeSet.has(v))) return -1;
    if (own[v]) return 0.08;
    if (fresh[v]) return 0.5;
    if (road[v]) return 1.2;
    return 1 + 1.2 * near(v);
  };
  const routes = [];
  for (const L of map.lanes) {
    own.fill(0); for (const p of L.tiles) own[tIdx(p.x, p.y)] = 1;
    const p0 = L.tiles[0], route = pathfind(tIdx(p0.x, p0.y), goal, step);
    if (!route || route.length < 6) return null;
    for (const i of route) fresh[i] = 1;
    routes.push(route);
  }
  const len = L => L.length, before = map.lanes.map(L => L.tiles.length), after = routes.map(len);
  return { x: nx, y: ny, routes, before, after, cost: relocCost() };
}
function applyRelocation(plan) {
  if (!plan || !canRelocate()) return false;
  const cost = relocCost();
  if (G.credits < cost) return false;
  G.credits -= cost; G.relocUsed = (G.relocUsed || 0) + 1;
  const map = G.map, old = map.lanes;
  for (let i = 0; i < map.tiles.length; i++) { const t = map.tiles[i]; if (t === 1 || t === 4 || t === 5) map.tiles[i] = 0; }
  map.core = { x: plan.x, y: plan.y };
  map.lanes = old.map((L, k) => {
    const tiles = plan.routes[k].map(i => ({ x: i % COLS, y: (i / COLS) | 0 }));
    const N = makeLane(tiles, map.core);
    if (L.openWave) { N.openWave = L.openWave; N.branch = tiles.length; }
    return N;
  });
  for (const L of map.lanes) if (!L.openWave) for (const p of L.tiles) map.tiles[tIdx(p.x, p.y)] = 1;
  for (const L of map.lanes) if (L.openWave) for (const p of L.tiles) { const i = tIdx(p.x, p.y); if (map.tiles[i] === 0) map.tiles[i] = 5; }
  map.tiles[tIdx(plan.x, plan.y)] = 4;
  G.core.x = plan.x + 0.5; G.core.y = plan.y + 0.5;
  // queued spawns point at lane objects: move them onto the new lanes
  const remap = L => { const k = old.indexOf(L); return k >= 0 ? map.lanes[k] : L; };
  if (G.prep) {
    let rift = null;
    if (G.prep.rift) { const m = map.lanes[0]; rift = makeLane(m.tiles.slice(Math.floor(m.tiles.length * 0.45)), map.core); rift.rift = true; }
    for (const q of G.prep.queue) q.lane = q.lane && q.lane.rift ? (rift || map.lanes[0]) : remap(q.lane);
    G.prep.rift = rift;
  }
  for (const q of G.queue) q.lane = remap(q.lane);
  G.mapRev = (G.mapRev || 0) + 1;
  Hooks.log(`Core relocated${cost ? ` · −${cost} credits` : ' · free'}`, '#59f0b4');
  Hooks.fx('upgrade', { x: G.core.x, y: G.core.y, col: '#59f0b4' });
  Hooks.sfx('lane');
  return true;
}

// ---------- abilities ----------
function useAbility(k, x, y) {
  if (!G.charges[k] || G.charges[k] <= 0) return false;
  const M = G.mods, w = Math.max(1, G.wave);
  G.charges[k]--;
  switch (k) {
    case 'strike':
      Hooks.fx('strike', { x, y });
      Hooks.sfx('strikecharge');
      setTimeoutSim(0.6, () => {
        Hooks.fx('boom', { x, y, r: 1.7, col: '#ffe9b0', big: 1 }); Hooks.sfx('strike'); Hooks.fx('shake', { v: 6 });
        for (const e of G.enemies) if (!e.dead && dist2(e.x, e.y, x, y) <= 1.7 * 1.7) hit(e, 30 * hpMult(w) * 4.5 * M.abilPower, 'K', null, { noStatus: 1, abil: 1 });
      });
      break;
    case 'nova':
      Hooks.fx('nova', {}); Hooks.sfx('nova'); Hooks.fx('shake', { v: 4 });
      for (const e of G.enemies.slice()) if (!e.dead) hit(e, e.hp * (e.boss ? 0.1 : 0.35) * M.abilPower + 6 * hpMult(w), 'V', null, { noStatus: 1, abil: 1 });
      break;
    case 'stasis':
      G.stasisT = (4 + M.stasisDur) * Math.min(1.5, M.abilPower);
      Hooks.fx('stasis', {}); Hooks.sfx('stasis');
      break;
    case 'overclock':
      G.overclockT = 8 * Math.min(1.5, M.abilPower);
      Hooks.fx('overclock', {}); Hooks.sfx('overclock');
      break;
  }
  Hooks.log(`${ABILITIES[k].name} activated`, '#ffe14d');
  return true;
}

// ---------- main step ----------
function simStep(dt) {
  if (!G || G.over || G.paused || G.draft) return;
  G.time += dt;
  updateWaves(dt);
  updateStorms(dt);
  updateEnemies(dt);
  if (G.over) return;
  updateTowers(dt);
  updateCore(dt);
  updateProjs(dt);
  updateZones(dt);
  updateTimers(dt);
  updateLinkBeams(dt);
  updateCaches(dt);
}

function gameOver() {
  if (G.over) return;
  G.over = true;
  if (G.score > PROF.bestScore) PROF.bestScore = Math.round(G.score);
  if (G.daily) {
    const d = PROF.daily && PROF.daily.date === G.daily ? PROF.daily : { date: G.daily, best: 0, score: 0, tries: 0 };
    d.tries++; if (G.wave > d.best) d.best = G.wave; if (G.score > d.score) d.score = Math.round(G.score);
    PROF.daily = d;
  }
  PROF.playTime += G.time;
  PROF.runSnap = null;
  Hooks.sfx('gameover');
  Hooks.onGameOver();
}
function abandonRun() {
  if (!G || G.over) return;
  gameOver();
}

// ---------- snapshots (resume after the app is closed) ----------
function snapshotRun(waveNum) {
  if (!G || G.over) return;
  const gut = []; let owed = 0; for (const e of G.enemies) if (!e.dead) { if (e.gut) for (const t of e.gut) if (!G.towerAt[tIdx(t.x, t.y)]) gut.push(t); if (e.audited) owed += e.audited; }
  const tw = G.towers.concat(gut).map(t => ({ type: t.type, x: t.x, y: t.y, lvl: t.lvl, spec: t.spec, affixes: t.affixes, rerolls: t.rerolls, invested: t.invested, kills: t.kills, dmgDone: Math.round(t.dmgDone), mode: t.mode,
    vxp: t.vxp, rank: t.rank, pending: t.pending, name: t.name, asc: t.asc, oc: t.oc || 0 }));
  PROF.runSnap = {
    seed: G.seed, cols: G.cols, rows: ROWS, grow: G.fullMap ? 0 : 1, chaos: G.chaos, startWave: G.startWave, wave: waveNum || G.wave + 1, credits: Math.round(G.credits + owed), score: Math.round(G.score),
    xpEarned: Math.round(G.xpEarned), kills: G.kills, time: Math.round(G.time), tiles: G.map.tiles.slice(), lanes: G.map.lanes.map(l => l.tiles), laneMeta: G.map.lanes.map(l => [l.openWave || 0, l.branch || 0]),
    core: { hp: G.core.hp, wLvl: G.core.wLvl, sLvl: G.core.sLvl, el: G.core.el, hpBonus: G.core.hpBonus || 0, affixes: G.core.affixes, rerolls: G.core.rerolls || 0 }, towers: tw, odUsed: G.odUsed || 0, odToldAt: G.odToldAt || 0,
    anchor: G.anchor, relocUsed: G.relocUsed || 0, nodes: G.nodes, power: G.power || 0, gridBonus: G.gridBonus || 0, bossHist: G.bossHist || {}, bossRecent: G.bossRecent || [], geneFit: G.geneFit || {}, geneExp: G.geneExp || {}, geneTold: G.geneTold || {},
    charges: Object.assign({}, G.charges), runMods: Object.assign({}, G.runMods), tokens: G.tokens, legendQueue: G.legendQueue,
    rerollDisc: G.rerollDisc, nextMs: G.nextMs, lanesOpened: G.lanesOpened, unbreakUsed: G.unbreakUsed, cpDue: G.cpDue || 0, boonsTaken: G.boonsTaken,
    daily: G.daily || null, entropy: G.entropy, anoms: G.anoms.slice(), anomOffers: G.anomOffers, stabilized: G.stabilized, stats: G.stats, flux: G.flux,
  };
  Hooks.onSave();
}
function snapshotNow() { if (G && !G.over) snapshotRun(G.spawningDone ? G.wave + 1 : G.wave); }
function resumeRun(S) {
  const r = mulberry32((S.seed ^ (S.wave * 7919)) >>> 0);
  newRun({ seed: S.seed, chaos: S.chaos, startWave: S.startWave, cols: S.cols || 32, rows: S.rows || 15 });
  PROF.runs--; // newRun counted it; a resume is the same run
  G.r = r;
  G.map.tiles = S.tiles.slice();
  // the core is wherever the saved tiles put it (map generation can differ between versions)
  const ci = S.tiles.indexOf(4);
  if (ci >= 0) { G.map.core = { x: ci % COLS, y: (ci / COLS) | 0 }; G.core.x = G.map.core.x + 0.5; G.core.y = G.map.core.y + 0.5; }
  G.fullMap = !S.grow;
  G.anchor = S.anchor || { x: G.map.core.x, y: G.map.core.y }; G.relocUsed = S.relocUsed || 0; G.power = S.power || 0; G.gridBonus = S.gridBonus || 0; G.bossHist = Object.assign({}, S.bossHist || {}); G.bossRecent = (S.bossRecent || []).slice(); G.geneFit = JSON.parse(JSON.stringify(S.geneFit || {})); G.geneExp = Object.assign({}, S.geneExp || {}); G.geneTold = Object.assign({}, S.geneTold || {});
  setNodes((S.nodes || []).slice()); G.caches = []; G.pirates = [];
  G.map.lanes = S.lanes.map((tp, i) => { const L = makeLane(tp, G.map.core); const m = (S.laneMeta || [])[i]; if (m) { L.openWave = m[0]; L.branch = m[1]; } return L; });
  G.towers = []; G.towerAt = {};
  G.runMods = Object.assign({}, S.runMods); G.mods = computeMods(PROF.alloc, G.runMods);
  for (const T of S.towers) {
    const t = { id: G.tid++, type: T.type, x: T.x, y: T.y, cx: T.x + 0.5, cy: T.y + 0.5, lvl: T.lvl, spec: T.spec, affixes: T.affixes, rerolls: T.rerolls,
      invested: T.invested, cd: 0.3, angle: -Math.PI / 2, kills: T.kills, dmgDone: T.dmgDone, dps: 0, dpsAcc: 0, mode: T.mode || 'first', disabled: 0,
      ramp: 0, olT: 0, buff: { dmg: 0, rate: 0, crit: 0 }, isolated: false, flash: 0,
      vxp: T.vxp || 0, rank: T.rank || 0, pending: T.pending || 0, offer: null, name: T.name || null, asc: T.asc || 0, reson: 0, resonWith: [], oc: T.oc || 0 };
    G.towers.push(t); G.towerAt[tIdx(t.x, t.y)] = t;
  }
  Object.assign(G, { wave: S.wave - 1, credits: S.credits, score: S.score, xpEarned: S.xpEarned, kills: S.kills, time: S.time,
    charges: Object.assign({}, S.charges), tokens: S.tokens, legendQueue: S.legendQueue, rerollDisc: S.rerollDisc, nextMs: S.nextMs,
    lanesOpened: S.lanesOpened, cpDue: S.cpDue || 0, unbreakUsed: S.unbreakUsed, boonsTaken: S.boonsTaken || [], next: 12,
    entropy: S.entropy || 0, anoms: (S.anoms || []).slice(), anomOffers: S.anomOffers || null, stabilized: S.stabilized || 0, flux: S.flux || null });
  if (S.stats) G.stats = S.stats;
  G.region = regionAt(G.lanesOpened);
  G.daily = S.daily || null;
  G.core.wLvl = S.core.wLvl; G.core.sLvl = S.core.sLvl; G.core.el = S.core.el; G.core.hpBonus = S.core.hpBonus;
  G.core.affixes = (S.core.affixes || []).slice(); G.core.rerolls = S.core.rerolls || 0; G.odUsed = S.odUsed || 0; G.odToldAt = S.odToldAt || 0; coreAffSum(G.core);
  recomputeAll();
  G.core.hp = Math.min(G.core.max, S.core.hp); G.core.shield = G.core.smax;
  prepareWave(S.wave);
  Hooks.log(`Run resumed · Wave ${S.wave}`, '#59f0b4');
  return G;
}

if (typeof module !== 'undefined') module.exports = { };
