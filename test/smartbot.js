// A bot that plays like an attentive person. Usage: node smartbot.js runs points chaos startWave bestWave [keystone]
const { load } = require('./harness');
const S = load();
const [runs = 6, points = 0, chaos = 1, sw = 1, bw = 0, ks = ''] = process.argv.slice(2).map((v, i) => i < 5 ? +v : v);
function profile(seed) {
  const P = S.defaultProfile(); P.bestWave = bw; S.PROF = P;
  if (process.env.NOVA) { const [rm, lw] = process.env.NOVA.split(':'); P.remnants = rm ? rm.split(',') : []; P.laws = lw ? lw.split(',') : []; P.nova = Math.max(P.remnants.length, P.laws.length); }
  P.xp = S.xpToLevel(points) + 1; // v5.8: the curve lives in data.js (xpForLevel)
  let r = seed; const rnd = () => { r = (r * 1103515245 + 12345) % 2147483648; return r / 2147483648; };
  // v5.0 talents: pick trees in a seeded order (CAP=capstoneId puts its tree first and takes it; NOCAP=1 never takes one),
  // fill each tree top to bottom with random talents, take a Capstone when one opens and a slot is free, then the next tree
  const want = process.env.CAP || process.env.DOC || ks || '';
  const order = S.TALENTS.map(t => t.id).sort(() => rnd() - 0.5);
  if (want && S.TAL[want]) { const tr = S.TAL[want].tree; order.splice(order.indexOf(tr), 1); order.unshift(tr); }
  // v5.8 FIRE=id[,id] (or all): learn those Techniques first (opening their rows) and force the modes on every tower of that type
  for (const F of Object.values(S.TOWER_FIRE).flat()) if (FIRE_FORCE.includes('all') || FIRE_FORCE.includes(F.id)) {
    const T = S.TAL[F.need], tr = S.TALENTS.find(x => x.id === T.tree);
    for (let g = 0; g < 20 && S.talentBlock(T.id) === 'row'; g++) { const f = tr.rows.flat().find(x => !x.tech && x.row < T.row && !S.talentBlock(x.id)); if (!f) break; S.talentAdd(f.id); }
    S.talentAdd(T.id);
  }
  let guard = 0;
  for (const tid of order) {
    const tr = S.TALENTS.find(t => t.id === tid);
    while (S.pointsFree() > 0 && guard++ < 2000) {
      const open = tr.rows.flat().filter(t => !S.talentBlock(t.id));
      const caps = process.env.NOCAP ? [] : tr.caps.filter(c => !S.talentBlock(c.id));
      if (caps.length) { const c = want && caps.find(c => c.id === want) || (want ? null : caps[Math.floor(rnd() * caps.length)]); if (c) { S.talentAdd(c.id); continue; } }
      // 6.4 capstone tier: take the tree's new tower as soon as it opens (NOTOP=1 never does), and keep filling toward it
      const top = !process.env.NOTOP && tr.top;
      if (top && !S.talentBlock(top.id)) { S.talentAdd(top.id); continue; }
      if (!open.length) break;
      // stop a tree once its capstone is taken and only leftovers remain, 60% of the time (humans spread out)
      if (S.capsHeld().some(c => S.TAL[c].tree === tid) && !(top && !S.PROF.tal[top.id]) && rnd() < 0.6) break;
      S.talentAdd(open[Math.floor(rnd() * open.length)].id);
    }
  }
}
const FIRE_FORCE = (process.env.FIRE || '').split(',').filter(Boolean);
// v5.8 Techniques: pick a fire mode per tower like a person would (some of each type, answers to the swarm's genes)
function chooseFire(G, t) {
  const modes = (S.TOWER_FIRE[t.type] || []).filter(f => S.fireLearned(t.type, f.id));
  if (!modes.length) return;
  const F = modes[0], genes = (G.prep && G.prep.genes) || {}, same = G.towers.filter(o => o.type === t.type), i = same.indexOf(t);
  let want = '';
  if (FIRE_FORCE.length) want = FIRE_FORCE.includes('all') || FIRE_FORCE.includes(F.id) ? F.id : '';
  else if (process.env.NOFIRE) want = '';
  else switch (F.id) {
    case 'supp': want = i % 3 === 1 || (genes.haste || 0) >= 0.3 ? F.id : ''; break;
    case 'over': want = (genes.bulk || 0) >= 0.3 || i % 2 === 1 ? F.id : ''; break;
    case 'lance': want = i % 2 === 0 ? F.id : ''; break;
    case 'bunker': want = (genes.plating || 0) >= 0.3 || i % 2 === 1 ? F.id : ''; break;
    case 'fence': want = G.towers.some(o => o !== t && o.type === 'coil' && (o.cx - t.cx) ** 2 + (o.cy - t.cy) ** 2 <= 16) ? F.id : ''; break;
    case 'back': { let ring = 0, cone = 0; const r = t.s.range; for (const L of G.map.lanes) for (const p of L.pts) { const d = (p.x - t.cx) ** 2 + (p.y - t.cy) ** 2; if (d <= (r * 0.6 + 0.3) ** 2) ring++; if (d <= (r + 0.3) ** 2) cone++; } want = ring >= Math.max(4, cone * 0.7) ? F.id : ''; break; }
    case 'tether': want = i % 3 === 2 || (genes.haste || 0) >= 0.3 ? F.id : ''; break;
    case 'mines': want = i % 2 === 0 ? F.id : ''; break;
    case 'repulse': want = (genes.wings || 0) >= 0.3 ? F.id : ''; break;
  }
  if ((t.fire || '') !== want) S.setFireMode(t, want);
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
    else if (D.kind === 'aegis') { const d = Math.hypot(x + 0.5 - G.core.x, y + 0.5 - G.core.y); sc = d <= D.range ? 100 - d + coverage(G, x, y, D.range) * 0.1 : -1; } // 6.4: beside the core
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
// 5.8: sectors, jump doors, escalations and the Bounty Purse. SECTOR=id plays the whole run in that zone (pushes without a door),
// PUSH=1 never extracts (the 5.3-5.7 sweeps pushed at every bounty), EXTRACT=0 likewise
const SEC_PREF = { salvage: 3, demo: 3, drift: 2, hive: 2, tempest: 2, iron: 1, skies: 1, ghost: 1, choir: 1, oddball: 0 };
const TW_PREF = { learn: 3, storms: 3, affix: 2, worm: 2, rifts: 1, blitz: 1, carriers: 1, twin: 0 };
const best = (arr, f) => arr.reduce((a, x) => (f(x) + Math.random() * 0.5 > f(a) ? x : a), arr[0]);
function pickSector(ids) { if (process.env.SECTOR) return process.env.SECTOR; return S.PROF.bestWave < 10 ? S.SECTOR_START : best(ids, id => SEC_PREF[id] || 0); }
// a door: the riskier tiers when the defence is comfortable (core high, few recent leaks), the safest otherwise
function pickDoor(G, doors, met) {
  const calm = G.core.hp / G.core.max > 0.9 && met.recentMin > 0.85, shaky = met.recentMin < 0.6;
  const tier = process.env.TIER ? +process.env.TIER : shaky ? 0 : calm ? (Math.random() < 0.4 ? 2 : 1) : 1;
  if (process.env.SECTOR) { const k = doors.findIndex(d => d.tier === tier); return k < 0 ? 0 : k; }
  let bi = 0, bs = -9; doors.forEach((d, i) => { const sc = (SEC_PREF[d.sector] || 0) - Math.abs(d.tier - tier) * 2 + Math.random(); if (sc > bs) { bs = sc; bi = i; } });
  return bi;
}
// extract when the last stretch was a close call, or now and then once the purse has grown through a couple of pushes
function wantExtract(G, met) {
  if (process.env.PUSH || process.env.EXTRACT === '0') return false;
  if (met.recentMin < 0.4 || G.core.hp / G.core.max < 0.5) return true;
  return (G.pushes || 0) >= 2 && Math.random() < 0.25;
}
// v5.8 Ascension perks: a rough value per perk (damage that scales late scores high), plus noise so runs differ. NOPERK=1 takes card 0
const PERK_PRI = { burst: 3, apRounds: 3, bounce: 2, hollow: 2, rapid: 2.5, sights: 1.5, spin: 3, barrel: 3,
  // 6.4 capstone tier towers
  teeth: 2.5, run: 2, boomer: 3, serr: 1.5, wideS: 2, spin2: 2.5, grind: 2, third: 3, fuse: 2.5, volat: 3, blastR: 2, haze: 1.5, smoulder: 2.5, bellows: 2.5, storm: 2, cruc: 3,
  cellsP: 2, quickC: 2, reserve: 2.5, thick: 3, regrow: 2.5, bite: 2, shardW: 2, reachW: 1.5, pack: 3, barbs: 2, linkP: 3, shareP: 3, longT: 2, nullW: 1.5, reachT: 1.5, bond: 2,
  web: 3, fate: 3, guard: 3, pd: 2, watch: 2, salv: 1.5, patch: 2, qsight: 2, last: 3, flak: 2, luck: 2, edge: 2.5, hot: 2.5, dbl: 2.5, odds: 1.5, deal: 2.5, marked: 3, allin: 2.5,
  pierce: 2.5, overpress: 2.5, spotter: 1.5, deflect: 2, capBank: 3, coup: 2, bigGame: 2.5, barrelR: 1.5, slug: 2.5, liveWire: 1.5,
  iceBurst: 2, brittle: 3, deep: 2, flash: 2.5, ring: 2, comp: 2, perma: 2, fault: 2.5,
  tube: 3, seek: 1.5, warhead: 2, shrap: 2, thermite: 2, autoload: 2.5, pods: 3, gel: 2,
  chain: 2.5, amps: 2.5, loop: 1.5, super: 3, arc: 1.5, overcur: 2.5, taser: 1.5, crown: 3, hv: 3,
  spread: 2, nozzle: 2, tank: 2, accel: 2.5, slag: 3, updraft: 2.5, slowBurn: 2, ion: 1.5,
  fork: 3, hold: 2.5, focal: 1.5, quick: 2, brand: 1.5, linger: 1.5, well: 3, facet: 3, pen: 3, weld: 3, shaped: 3,
  longPulse: 2, scatter: 3, burstE: 2, eater: 1.5, breech: 2.5, ionE: 2, blackout: 2, shell4: 3,
  undertow: 2.5, anchor: 1.5, heavy: 2, crush: 2.5, radius: 2, steady: 2, darkMark: 1.5, eddy: 2,
  ampP: 3, mast: 2, grid: 1.5, sync: 2.5, bigNet: 3, barbs: 2, tar: 2, exposed: 2.5, overtime: 3, fee: 2, compound: 2, hazard: 2.5 };
function botPerk(tw) {
  const o = S.ascOffer(tw); if (!o) return;
  let bi = 0, bv = -1;
  if (!process.env.NOPERK) o.forEach((id, i) => { const v = (PERK_PRI[id] || 1) - 0.4 * S.perkStacks(tw, id) + Math.random() * 0.8; if (v > bv) { bv = v; bi = i; } });
  S.claimPerk(tw, bi);
}
// 6.4 Anomalies: generated cards are scored by what they give this build minus what they cost (an element part counts by
// that element's share of the attack towers, crit parts by the crit share, ability and storm parts at half), plus noise.
// Classic cards get a flat guess. A best score under -5 stabilizes. ANOMPICK=rand keeps the old random pick
const ANOM_HALF = { abilPower: 1, stormPow: 1, fill: 1 };
function anomVal(o, B) {
  if (typeof o === 'string') return 6 + Math.random() * 14;
  const part = ([id, x]) => { const P = S.ANOM_PART[id]; let v = P.sp ? P.p : x * P.p;
    if (P.el) v *= 2 * B.sh[P.el]; if (P.need === 'crit') v *= 2 * B.crit; else if (P.need) v *= 0.3 + 2 * B.sh[P.need]; if (ANOM_HALF[P.k]) v *= 0.5; return v; };
  return o.up.reduce((a, p) => a + part(p), 0) - o.dn.reduce((a, p) => a + part(p), 0) + (Math.random() - 0.5) * 12;
}
function botAnom(G) {
  const O = G.anomOffers;
  if (process.env.ANOMPICK === 'rand' || !S.anomBuild) return O[Math.floor(Math.random() * O.length)];
  const B = S.anomBuild(); let best = null, bv = -Infinity;
  for (const o of O) { const v = anomVal(o, B); if (v > bv) { bv = v; best = o; } }
  return bv < -5 ? null : best;
}
// 6.5 the probe (frV 5): buy upgrades with spare credits (Lance first), send the probe to the site worth the most per second
// that it can survive (guards' damage over the time it is exposed against 75% of its hull), chain sites while healthy, come home
// under 40% hull or with a full hold, rebuild when the bank allows. NOPROBE=1 never uses it (the probe stays docked)
const PR_UP = ['gun', 'hull', 'rig', 'eng', 'gun', 'hull', 'scan', 'rig', 'eng', 'gun', 'hull', 'scan', 'rig', 'eng', 'scan'];
function botProbe(G, met) {
  const P = G.probe; if (!P || process.env.NOPROBE) return;
  const m = met.pr || (met.pr = { sends: 0, ups: 0, builds: 0 });
  if (!P.alive) { if (!(P.rb > 0) && G.credits > S.prRebuildCost() * 2 && G.wave >= 4) { if (S.probeRebuild()) m.builds++; } return; }
  { let need = {}; for (const k of PR_UP) { need[k] = (need[k] || 0) + 1; if (P.lv[k] < need[k]) { const c = S.prUpCost(k); if (G.credits > c * (P.lv.gun ? 2.5 : 1.5) && G.wave >= 3) { if (S.probeUpgrade(k)) m.ups++; } break; } } }
  const st = S.prStats(), hp = P.hp / P.max, c = P.cargo, ws = 1 + Math.max(1, G.wave) / S.PROBE.wS, Gd = S.PROBE.guard;
  if (P.ret) return;
  if (!P.home && (hp < 0.4 || c.cr > S.prVal() * 4 || c.jp)) { S.probeRecall(); return; }
  if (!P.home && P.task) return; // busy
  if (P.home && hp < 0.85) return; // heal first
  let best = null, bv = 0;
  for (const s of G.sites) {
    if (s.done) continue;
    const d = Math.hypot(s.x - P.x, s.y - P.y), dh = Math.hypot(s.x - G.core.x, s.y - G.core.y), work = s.k === 'cloud' ? S.PROBE.cloudT / st.rig : s.k === 'rock' ? s.hp / (S.PROBE.mine * ws * st.rig) : S.PROBE.wreckT / st.rig;
    const t = (d + dh) / st.spd + work; if (t > s.t + dh / st.spd) continue;
    const gdps = s.g.reduce((a, g) => a + (g.k === 'drone' ? Gd.drone.dmg * ws / Gd.drone.cd : Gd.brute.dps * ws), 0), ghp = s.g.reduce((a, g) => a + g.hp, 0);
    const expo = st.dps > 0 ? Math.min(ghp / st.dps, work + 2 * Gd.aggro / st.spd) : work + 2 * Gd.aggro / st.spd;
    const dmg = gdps * expo * (st.dps > 0 ? 0.6 : 1) + (s.k === 'cloud' ? P.max * S.PROBE.cloudZap * work : 0);
    if (dmg > P.hp * 0.75) continue;
    const v = (s.val * (s.k === 'rock' ? (3 - (s.chunks || 0)) / 3 : 1 - s.prog) + (s.ent || 0) * 5 + s.jp * S.prVal() * 3) / t;
    if (v > bv) { bv = v; best = s; }
  }
  if (best) { if (S.probeGo(best.x, best.y)) m.sends++; }
  else if (!P.home) S.probeRecall();
}
const agg = [];
const OFF = +(process.env.SEED || 0);
for (let run = OFF; run < OFF + runs; run++) {
  profile(4242 + run * 31);
  const met = { anoms: [], stab: 0, fills: 0, vetMax: 0, ascends: 0, maxCredits: 0, creditsAtWave: [], minCore: 1, conv: 0, mael: 0, storms: 0, bossTimes: {}, deathsByBoss: 0 };
  S.Hooks.onDraft = o => setImmediateQ(() => { if (S.G.draft !== o) return; S.takeBoon(o[0] && o[0].twist ? best(o, x => TW_PREF[x.id] || 0) : o[Math.floor(Math.random() * o.length)]); });
  S.Hooks.onEntropy = () => { met.fills++; };
  S.Hooks.log = (t) => { if (/CONVERGENCE/.test(t)) met.conv++; if (/MAELSTROM FORMS/.test(t)) met.mael++; if (/rolls in/.test(t)) met.storms++; };
  let q = []; const setImmediateQ = f => q.push(f);
  S.Hooks.sfx = () => {};
  const FR = !!process.env.FR; // Frontier prototype (its own board size); the bot docks on its best tower and moves idle ones
  const CAPT = process.env.CAPT ? process.env.CAPT.split(',') : S.capTowersOwned ? S.capTowersOwned() : []; // 6.4: the capstone tier towers learned (CAPT=a,b forces them; Frontier runs only)
  const G = S.newRun(Object.assign({ seed: 1000 + run * 17, chaos, startWave: sw, sector: pickSector(S.sectorOffers(1000 + run * 17)), capT: CAPT }, FR ? { frontier: 1 } : { cols: +(process.env.COLS || 39) }));
  met.capT = G.capT ? G.capT.slice() : [];
  met.fr = { flights: 0, docks: 0, moves: 0, dockT: {}, airT: 0 };
  met.recentMin = 1; met.mins = []; met.doors = []; met.startSec = G.sector;
  let t = 0, act = 0, pi = 0, lastWave = G.wave;
  while (!G.over && t < 3 * 3600 && !(process.env.MAXW && G.wave >= +process.env.MAXW)) { // MAXW=n stops a run at Wave n (counts as n), so runaway runs don't stall a batch
    if (S.G.huntChoice) { const C = S.G.huntChoice; if (wantExtract(G, met)) { met.extracted = G.wave; S.huntExtract(); break; } if (C.doors && !process.env.SECTOR) { const i = pickDoor(G, C.doors, met); met.doors.push(C.doors[i].sector.slice(0, 4) + C.doors[i].tier); S.huntPush(i); } else S.huntPush(); }
    if (false) S.huntPush(); // v5.3: the bot never extracts, it plays on (a stalled choice would freeze the sim)
    S.simStep(1 / 30); t += 1 / 30; if (S.G.checkpoint) S.resumeCheckpoint();
    if (FR) { const d = S.frDockT(); if (d) met.fr.dockT[d.type] = (met.fr.dockT[d.type] || 0) + 1 / 30; else if (G.frFly) met.fr.airT += 1 / 30; else met.fr.dockT.plain = (met.fr.dockT.plain || 0) + 1 / 30; }
    if (process.env.BOSSLOG) {
      if (!G.dbgBoss) G.dbgBoss = {};
      for (const e of G.enemies) if (e.boss && !e.gen && !e._t0) { e._t0 = t; e._w = G.wave; e._pot = S.potentialDps(); e._pw0 = G.power; (G._bl || (G._bl = [])).push(e); }
      for (const e of G._bl || []) if (e.dead && !e._logged) { e._logged = 1; console.log(`BOSS w${e._w} ${e.boss} life=${(t - e._t0).toFixed(1)}s fire=${(G.time - (e._hit0 || G.time)).toFixed(1)}s road=${(e.d / e.L.len).toFixed(2)} ${e.hp > 0 ? "LEAKED" : "killed"} ph=${e.phase} hp=${Math.round(e.maxHp)} pw=${Math.round(G.power || 0)} pw0=${Math.round(e._pw0 || 0)} pot=${Math.round(e._pot || 0)} ${Object.entries(G.dbgBoss).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => k + ':' + Math.round(v / e.maxHp * 100) + '%').join(' ')}`); G.dbgBoss = {}; }
    }
    while (q.length) q.shift()();
    // TTK=1: track how far down the road each enemy gets before it dies (vaporized early vs a real threat)
    if (process.env.TTK) {
      const seen = G._ttkSeen || (G._ttkSeen = new Map()), now = new Set();
      for (const e of G.enemies) if (!e.dead && e.L && !e.pirate) { now.add(e.id); const r = seen.get(e.id); const fr = e.d / e.L.len; if (r) { r.fr = Math.max(r.fr, fr); } else seen.set(e.id, { type: e.boss ? 'boss' : e.type, el: e.elite && e.elite.length ? 1 : 0, w: G.wave, fr, t0: t }); }
      for (const [id, r] of seen) if (!now.has(id)) { (G._ttk || (G._ttk = [])).push({ type: r.type, el: r.el, w: r.w, fr: r.fr, life: t - r.t0 }); seen.delete(id); }
    }
    if (process.env.LEAKLOG) { // 6.6.1: leaks per wave by enemy type (G.leakWave, as the breach warning reads it)
      if (G.wave !== met.lwW) { if (met.lwS) console.log(`LEAK W${met.lwW} ${met.lwS}`); met.lwW = G.wave; met.lwS = ''; }
      if (G.leakWave && Object.keys(G.leakWave).length) met.lwS = JSON.stringify(G.leakWave) + ` core ${Math.round(G.core.hp)}/${Math.round(G.core.max)}`; }
    met.minCore = Math.min(met.minCore, G.core.hp / G.core.max);
    met.waveMin = Math.min(met.waveMin == null ? 1 : met.waveMin, G.core.hp / G.core.max);
    if (G.wave !== lastWave) { lastWave = G.wave; met.creditsAtWave.push(G.credits); met.mins.push(met.waveMin == null ? 1 : met.waveMin); met.waveMin = 1; met.recentMin = Math.min(...met.mins.slice(-10));
      if (process.env.XPLOG) console.log(`XP ${G.wave} ${Math.round(G.xpEarned)} ${Math.round(G.score)}`);
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
    if (G.anomOffers) { if (Math.random() < 0.2 || !G.anomOffers.length) { S.stabilize(); met.stab++; } else { const o = botAnom(G); if (!o) { S.stabilize(); met.stab++; } else { const id = o.id || o; S.takeAnomaly(id); met.anoms.push(id); } } }
    botProbe(G, met); // 6.5
    // v5.8 Techniques
    for (const tw of G.towers) chooseFire(G, tw);
    // veterans
    for (const tw of G.towers) if (tw.ascPend > 0) botPerk(tw);
    for (const tw of G.towers) while (tw.pending > 0) { const o = S.vetOffer(tw); let bi = 0; o.forEach((a, i) => { if (a.tier > o[bi].tier) bi = i; }); S.claimVet(tw, bi); met.vetMax = Math.max(met.vetMax, tw.rank); }
    // abilities
    const alive = G.enemies.length;
    if (alive) {
      const lead = G.enemies.reduce((a, e) => (e.d / e.L.len > a.d / a.L.len ? e : a));
      if (G.charges.strike > 0 && (alive > 14 || G.bossAlive)) { const tg = G.bossAlive || lead; S.useAbility('strike', tg.x, tg.y); }
      if (G.charges.nova > 0 && alive > 25) S.useAbility('nova');
      if (G.charges.stasis > 0 && ((G.bossAlive && G.bossAlive.d / G.bossAlive.L.len > 0.6) || G.core.hp / G.core.max < 0.4)) S.useAbility('stasis');
      if (G.charges.overclock > 0 && (G.bossAlive || alive > 30)) S.useAbility('overclock');
      if (G.charges.scan > 0 && !(G.scanT > 0) && (G.enemies.some(e => e.cloaked) || G.bossAlive || alive > 20)) S.useAbility('scan');
    }
    // Frontier: between waves, dock on the strongest attack tower (judged without its dock bonus) if the roads don't shrink much;
    // move towers that have sat idle for 2 waves to the best open spot (at most 2 a wave). NOFLY=1 / NOMOVE=1 turn either off
    if (FR && G.spawningDone && !process.env.NOFLY && S.frCanFly() && G.wave >= 3) {
      const cur = S.frDockT(), val = tw => tw.dps / (tw === cur ? S.frDockX() : 1), c = new Set(S.frCands());
      const cands = G.towers.filter(tw => tw !== cur && c.has(S.tIdx(tw.x, tw.y)) && !['support', 'eco', 'snare'].includes(tw.s.kind)).sort((a, b) => val(b) - val(a)).slice(0, 4);
      for (const tw of cands) { if (cur && val(tw) < val(cur) * 1.25) break; const P = S.frPlan(tw.x, tw.y); if (!P) continue; const sb = P.before.reduce((a, b) => a + b, 0), sa = P.after.reduce((a, b) => a + b, 0);
        if (sa < sb * 0.85) continue; if (S.frLiftOff(tw.x, tw.y)) { met.fr.flights++; met.fr.docks++; } break; }
    }
    if (FR && G.spawningDone && !process.env.NOMOVE && G._mvW !== G.wave) {
      G._mvW = G.wave; let n = 0;
      for (const tw of G.towers.slice()) { if (n >= 2) break; if (['support', 'eco', 'snare'].includes(tw.s.kind) || tw === S.frDockT() || G.wave - (tw.lastFireW || 0) < 2 || G.wave - (tw.builtW || 0) < 2) continue;
        const sp = bestSpot(G, tw.type); if (sp && S.frMoveTower(tw, sp.x, sp.y)) { n++; met.fr.moves++; tw.lastFireW = G.wave; } }
    }
    // v5.1 Command Uplink: a level every ~8 waves when there's spare cash (NOUPLINK=1 skips)
    // v5.1.3 Core Hull with idle money late (NOHULL=1 skips)
    if (!process.env.NOHULL && S.coreHullCost && G.wave >= 25 && (G.core.hLvl || 0) < 10 && G.credits > S.coreHullCost() * 4) S.coreUpgrade('hull');
    if (!process.env.NOUPLINK && S.coreUplinkCost && (G.core.uLvl || 0) < Math.min(9, Math.floor(G.wave / 7)) && G.credits > S.coreUplinkCost() * 2.5) S.coreUpgrade('uplink');
    // repair
    if (G.core.hp / G.core.max < 0.45 && G.credits > S.coreRepairCost()) S.coreUpgrade('repair');
    // call early if field is clear
    if (G.spawningDone && !alive && G.next > 3 && Math.random() < 0.5) S.callEarly();
    // spend
    let guard = 0;
    while (guard++ < 20) {
      // 6.4: a learned capstone tier tower joins the rotation after every third plan entry (two Aegis Stations at most)
      const want = PLAN.filter(k => S.TOWERS[k].unlock <= Math.max(1, S.PROF.bestWave)).flatMap((k, i) => i % 3 === 2 && met.capT.length ? [k, met.capT[((i / 3 | 0) + 6 * (pi / 25 | 0)) % met.capT.length]] : [k]); // each pass through the plan shifts which tier towers come up
      let type = want[pi % want.length];
      if (type === 'forge' && G.wave > 35) { pi++; continue; }
      if (type === 'aegis' && G.towers.filter(tw => tw.type === 'aegis').length >= 2) { pi++; continue; }
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
      // v4.0: a Strain Assault is announced. Selling is free, so swap the weakest non-answers for answers (NOADAPT/NOREFIT skip it)
      const AS = G.assault;
      if (!process.env.NOADAPT && !process.env.NOREFIT && AS && AS.state === 'warn' && G._refitW !== AS.w) {
        G._refitW = AS.w;
        const CT2 = { wings: ['pulse', 'rail', 'missile'], plating: ['rail', 'lens'], bulk: ['lens', 'rail'], shell: ['coil', 'emp'], brood: ['missile', 'flame', 'coil'], regen: ['flame', 'missile'], haste: ['cryo', 'grav', 'snare'], cloak: ['pylon'] };
        const ok = k => S.TOWERS[k].unlock <= Math.max(1, S.PROF.bestWave);
        let sold = 0;
        for (const g of AS.genes) {
          const ans = (CT2[g] || []).filter(ok); if (!ans.length) continue;
          const need = (g === 'cloak' ? 1 : 2 + Math.floor(G.towers.length / 10)) - G.towers.filter(tw => ans.includes(tw.type)).length;
          for (let i = 0; i < need && sold < 4; i++) {
            if (S.gridFree() < 1) { const v = G.towers.filter(tw => !Object.values(CT2).flat().filter(k => AS.genes.some(gg => (CT2[gg] || []).includes(k))).includes(tw.type) && tw.s.kind !== 'eco' && tw.s.kind !== 'support' && !tw.asc && tw.dps <= (G.towers.map(x => x.dps).sort((p, q) => p - q)[Math.floor(G.towers.length / 2)] || 0)).sort((a, b) => a.dps - b.dps)[0]; if (!v) break; S.sellTower(v); sold++; }
            const k = ans[i % ans.length], sp = bestSpot(G, k); if (!sp || G.credits < S.towerCost(k) || !S.buildTower(k, sp.x, sp.y)) break;
          }
        }
        // Ward: move damage off the warded element (sell its weakest towers, build another element's)
        if (AS.el && AS.genes.includes('ward')) {
          const offEl = { K: ['missile', 'coil', 'cryo'], T: ['rail', 'coil', 'lens'], C: ['rail', 'missile', 'coil'], A: ['rail', 'missile', 'lens'], V: ['rail', 'missile', 'coil'] }[AS.el].filter(ok);
          const medDps = G.towers.map(tw => tw.dps).sort((a, b) => a - b)[Math.floor(G.towers.length / 2)] || 0;
          const mine = G.towers.filter(tw => tw.dps <= medDps && !tw.asc && tw.s.kind !== 'support' && tw.s.kind !== 'eco').sort((a, b) => a.dps - b.dps);
          for (let i = 0; i < Math.min(3, Math.floor(mine.length / 3)) && sold < 6; i++) {
            S.sellTower(mine[i]); sold++;
            const k = offEl[i % offEl.length], sp = bestSpot(G, k); if (!sp || G.credits < S.towerCost(k) || !S.buildTower(k, sp.x, sp.y)) break;
            const nt = G.towers[G.towers.length - 1]; while (nt && G.credits > S.upgradeCost(nt) && nt.lvl < 4) S.upgradeTower(nt, 1);
          }
        }
        met.refits = (met.refits || 0) + sold;
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
      // v3.1: grid full and the cheapest upgrade costs more than a reactor expansion: expand
      if (room < 1 && G.towers.length < targetCount && G.credits >= S.reactorCost() && (!up || S.upgradeCost(up) > S.reactorCost())) { S.expandReactor(); met.reactor = (met.reactor || 0) + 1; continue; }
      if (up && G.credits >= S.upgradeCost(up) && (G.towers.length >= targetCount || room < 1 || S.upgradeCost(up) < bc * 0.7)) {
        if (up.lvl >= 5) met.ascends++;
        S.upgradeTower(up, 1 + Math.floor(Math.random() * 2)); if (up.ascPend > 0) botPerk(up); continue;
      }
      if (G.credits > S.coreWeaponCost() * 2.5 && G.core.wLvl < 8) { S.coreUpgrade('weapon'); continue; }
      break;
    }
    met.maxCredits = Math.max(met.maxCredits, G.credits);
  }
  if (process.env.TTK && G._ttk) {
    const band = w => w <= 10 ? '01-10' : w <= 25 ? '11-25' : w <= 45 ? '26-45' : w <= 65 ? '46-65' : '66+';
    const B = {};
    for (const r of G._ttk) { const k = band(r.w) + ' ' + (r.type === 'boss' ? 'boss' : r.el ? 'elite' : r.type); const o = B[k] || (B[k] = { n: 0, early: 0, mid: 0, late: 0, life: 0 }); o.n++; o.life += r.life; if (r.fr < 0.2) o.early++; else if (r.fr < 0.75) o.mid++; else o.late++; }
    for (const k of Object.keys(B).sort()) { const o = B[k]; if (o.n < 5) continue; console.log(`TTK ${k.padEnd(18)} n=${String(o.n).padStart(5)} died<20%: ${(o.early / o.n * 100).toFixed(0).padStart(3)}%  20-75%: ${(o.mid / o.n * 100).toFixed(0).padStart(3)}%  >75%/leak: ${(o.late / o.n * 100).toFixed(0).padStart(3)}%  avg life ${(o.life / o.n).toFixed(1)}s`); }
  }
  if (process.env.ASLOG) console.log('ASSAULTS w' + G.wave + ' ' + ((G.stats.assaults || {}).list || []).map(a => `W${a.w}:${a.leaked}/${a.n}${a.won ? "+" : "X"}x${a.hpx}[${(a.genes || []).join(',')}]`).join(' '));
  if (process.env.DUMP) for (const tw of G.towers) console.log('T', tw.type + (tw.fire ? '/' + tw.fire : ''), 'L' + tw.lvl, 'A' + tw.asc, 'R' + tw.rank, 'inv', tw.invested, 'dmg', Math.round(tw.dmgDone), 'kills', tw.kills, 'at', tw.x, tw.y, tw.affixes.map(a => a.id + a.tier).join(','));
  const tot = Object.values(G.stats.dmgByEl).reduce((a, b) => a + b, 0) || 1;
  const byType = {};
  for (const tw of G.towers) byType[tw.type] = (byType[tw.type] || 0) + tw.dmgDone;
  const dmgAll = Object.values(byType).reduce((a, b) => a + b, 0) || 1;
  const bankMed = met.creditsAtWave.slice().sort((a, b) => a - b)[Math.floor(met.creditsAtWave.length / 2)] || 0;
  agg.push({ wave: G.wave, min: +(t / 60).toFixed(1), lvls: S.profLevel().level - points, killer: G.stats.lastLeak || '-', leaks: G.stats.leaks,
    fills: met.fills, anoms: met.anoms.length, vet: met.vetMax, asc: met.ascends, conv: met.conv, mael: met.mael, bank: Math.round(bankMed),
    as: G.stats.assaults ? G.stats.assaults.won + '/' + (G.stats.assaults.won + G.stats.assaults.lost) : '-',
    combos: Object.values(G.stats.combos).reduce((a, b) => a + b, 0), towers: G.towers.length,
    eff: (() => { const inv = {}; for (const tw of G.towers) inv[tw.type] = (inv[tw.type] || 0) + tw.invested; const avg = dmgAll / Object.values(inv).reduce((a, b) => a + b, 0); return Object.keys(byType).filter(k => byType[k] > 0).map(k => k.slice(0, 4) + (byType[k] / inv[k] / avg).toFixed(1)).join(' '); })(),
    top: Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => k + ':' + Math.round(v / dmgAll * 100)).join(' '),
    el: Object.entries(G.stats.dmgByEl).map(([k, v]) => k + Math.round(v / tot * 100)).join(' '),
    capT: (met.capT || []).join('+') || '-', capx: met.capT && met.capT.length ? `stop${G.stats.aegis || 0} held${Math.round(G.stats.held || 0)}` : '-', sec: (met.startSec || '-').slice(0, 5) + (met.doors.length ? '>' + met.doors.join('>') : ''), ext: met.extracted || 0, tw: Object.keys(G.twists || {}).map(k => k.slice(0, 3)).join('+') || '-',
    xp57: Math.round((G.xpRaw || G.xpEarned) * (met.extracted ? 1.5 : 1)), paid: Math.round(G.xpEarned),
    share: Object.entries(byType).sort((a, b) => b[1] - a[1]).filter(([, v]) => v > 0).map(([k, v]) => k.slice(0, 4) + ':' + Math.round(v / dmgAll * 100)).join(' '),
    pr: G.probe ? `s${(G.stats.pr || {}).sites || 0} l${(G.stats.pr || {}).lost || 0} k${(G.stats.pr || {}).kills || 0} j${(G.stats.pr || {}).jp || 0} cr${(G.stats.pr || {}).cr || 0} u${(met.pr || {}).ups || 0}` : '-', });
  if (FR) { const D = met.fr.dockT, T = Object.values(D).reduce((a, b) => a + b, 0) + met.fr.airT || 1;
    console.log(`FRONTIER wave ${G.wave} min ${(t / 60).toFixed(1)} flights ${met.fr.flights} moves ${met.fr.moves} air ${Math.round(met.fr.airT / T * 100)}% core: ${Object.entries(D).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + Math.round(v / T * 100) + '%').join(', ')} killer ${G.stats.lastLeak || '-'}`); }
}
console.log(`runs=${runs} points=${points} chaos=${chaos} start=${sw} best=${bw} ks=${ks || '-'}`);
console.table(agg);
const waves = agg.map(a => a.wave).sort((a, b) => a - b);
console.log('median wave', waves[Math.floor(waves.length / 2)], 'median min', agg.map(a => a.min).sort((a, b) => a - b)[Math.floor(agg.length / 2)]);
