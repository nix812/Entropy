// ===================== ENTROPY — DATA =====================
'use strict';
const VERSION = '6.5.1';
// interface scale: >1 on tablets so the phone-sized UI grows with the screen
let UIS = 1;
// Rows are set per run by the Chaos level; the width adapts to the screen so there is no letterboxing.
let COLS = 36;
let ROWS = 26; const TILE = 24;
let BW = COLS * TILE, BH = ROWS * TILE;
function setRows(n) { ROWS = n; BH = ROWS * TILE; }
function setCols(n) { COLS = Math.max(38, Math.min(76, Math.round(n))); BW = COLS * TILE; }
// Expanding sector: a run starts on this fraction of the full map (around the core) and grows
// one step each time a wormhole is detected, reaching the full map with the last scheduled wormhole.
const REGION0 = 0.6;
const stageFrac = (stage, n) => n ? REGION0 + (1 - REGION0) * Math.max(0, Math.min(1, stage / n)) : 1;
function mapRegion(core, f) {
  if (f >= 0.999) return { x0: 0, y0: 0, x1: COLS, y1: ROWS };
  const cx = core.x + 0.5, cy = core.y + 0.5;
  return { x0: Math.max(0, Math.round(cx * (1 - f))), y0: Math.max(0, Math.round(cy * (1 - f))),
    x1: Math.min(COLS, Math.round(cx + (COLS - cx) * f)), y1: Math.min(ROWS, Math.round(cy + (ROWS - cy) * f)) };
}
const inRegion = (x, y, R) => x >= R.x0 && y >= R.y0 && x < R.x1 && y < R.y1;

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
const fmt = n => {
  n = Math.round(n);
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1e4) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
};

// ---------- Elements ----------
const EL = {
  K: { name: 'Kinetic', col: '#efe6cf' },
  T: { name: 'Thermal', col: '#ff7b39' },
  C: { name: 'Cryo', col: '#6ae2ff' },
  A: { name: 'Arc', col: '#ffe14d' },
  V: { name: 'Void', col: '#b86cff' },
  N: { name: 'Support', col: '#59f0b4' },
};
const ELS = ['K', 'T', 'C', 'A', 'V'];

// ---------- Towers ----------
// rate = attacks/sec, range in tiles, dmg per hit at L1
const TOWERS = {
  pulse: { name: 'Pulse Blaster', el: 'K', cost: 60, dmg: 10, rate: 2.4, range: 2.6, kind: 'bullet', pspd: 16, unlock: 1,
    blurb: 'Rapid single-target fire.',
    specs: [{ name: 'Gatling Array', desc: '×2.2 Attack Speed, ×0.85 Damage', m: { rateX: 2.2, dmgX: 0.85 } },
            { name: 'Twin Cannons', desc: 'Fires at 2 targets. ×1.25 Damage', m: { multi: 1, dmgX: 1.25 } }] },
  rail: { name: 'Rail Lance', el: 'K', cost: 110, dmg: 50, rate: 0.5, range: 4.6, kind: 'rail', pierce: 2, crit: 10, unlock: 1,
    blurb: 'Long-range piercing shot.',
    specs: [{ name: 'Gauss Spire', desc: '×1.8 Damage, +15% Crit Chance', m: { dmgX: 1.8, critC: 15 } },
            { name: 'Splinter Rail', desc: '+4 Pierce, ×1.5 Damage', m: { pierce: 4, shred: 1, dmgX: 1.5 } }] },
  cryo: { name: 'Cryo Emitter', el: 'C', cost: 75, dmg: 7.5, rate: 1.15, range: 2.5, kind: 'pulse', st: { chill: 1 }, unlock: 1,
    blurb: 'Pulse that Chills nearby enemies.',
    specs: [{ name: 'Glacier Core', desc: '×1.5 Chill strength. Freeze lasts 0.6s longer', m: { chillPot: 1.5, freezeBonus: 0.6 } },
            { name: 'Shatter Field', desc: 'Chilled enemies in range take +60% Kinetic Damage', m: { shatterField: 0.6 } }] },
  missile: { name: 'Swarm Missile', el: 'T', cost: 120, dmg: 35, rate: 0.75, range: 3.6, kind: 'missile', pspd: 6, splash: 0.9, st: { burn: 0.5 }, unlock: 5,
    blurb: 'Homing missiles. Splash and Burn.',
    specs: [{ name: 'Cluster Pods', desc: 'Missiles split into 3 bomblets', m: { cluster: 3 } },
            { name: 'Napalm Payload', desc: 'Impacts leave burning ground', m: { napalm: 1 } }] },
  pylon: { name: 'Relay Pylon', el: 'N', cost: 100, dmg: 0, rate: 0, range: 2.6, kind: 'support', buffDmg: 18, buffRate: 12, unlock: 8,
    blurb: 'Boosts nearby towers. Reveals cloaked.',
    specs: [{ name: 'Amplifier', desc: '+20% Damage boost', m: { buffDmg: 20 } },
            { name: 'Uplink', desc: '+1 Range. Also boosts Crit Chance by 12%', m: { rangeAdd: 1, buffCrit: 12 } }] },
  snare: { name: 'Snare Beacon', el: 'N', cost: 75, dmg: 0, rate: 0, range: 3.5, kind: 'snare', net: 1.3, netSlow: 0.5, hold: 0.8, catches: 8, unlock: 4,
    blurb: 'Lures fliers off course into a slowing net. Netted fliers take +20% damage.',
    specs: [{ name: 'Tangle Web', desc: 'Caught fliers are held 2s. Net slows 70%', m: { hold: 2, netSlow: 0.7 } },
            { name: 'Long Lure', desc: '+2 lure range, +6 catches per wave', m: { rangeAdd: 2, catches: 6 } }] },
  coil: { name: 'Arc Coil', el: 'A', cost: 100, dmg: 24, rate: 0.95, range: 2.8, kind: 'chain', chain: 3, st: { shock: 0.5 }, unlock: 10,
    blurb: 'Chain lightning. Applies Shock.',
    specs: [{ name: 'Tesla Crown', desc: '+3 Chain, ×1.35 Damage', m: { chain: 3, dmgX: 1.35 } },
            { name: 'Overvolt', desc: '×1.7 Damage, ×2 Shock effect, 12% chance to Stun', m: { dmgX: 1.7, shockX: 2, stun: 0.12 } }] }, // v5.4: the specs added no damage, so Coils fell behind at LV 5
  forge: { name: 'Credit Forge', el: 'N', cost: 150, dmg: 0, rate: 0, range: 0, kind: 'eco', income: 30, unlock: 12,
    blurb: 'Produces credits each wave.',
    specs: [{ name: 'Refinery', desc: '×2.2 Income', m: { incomeX: 2.2 } },
            { name: 'Bounty Net', desc: '+30% kill credits within 3 tiles', m: { bounty: 0.3 } }] },
  flame: { ground: 1, name: 'Flame Projector', el: 'T', cost: 90, dmg: 6.5, rate: 8, range: 2.1, kind: 'cone', st: { burn: 1 }, unlock: 15,
    blurb: 'Short-range cone. Applies Burn.',
    specs: [{ name: 'Inferno', desc: '×2 Burn damage', m: { burnX: 2 } },
            { name: 'Plasma Torch', desc: '+0.5 Range. Also applies Shock', m: { rangeAdd: 0.5, addShock: 0.35 } }] },
  lens: { name: 'Void Lens', el: 'V', cost: 150, dmg: 1.7, rate: 10, range: 3.2, kind: 'beam', rampMax: 2.8, // v5.4 trim: was 3.2 (4 Lenses did 71% of Nic's Wave 88 run). v5.0 trim: was 1.85 dmg, ×3.5 ramp (5 Lenses did 89% of Nic's Wave 87 run)
    st: { mark: 0.15 }, unlock: 20,
    // 5.8 rules (G.ascV >= 2): it hits 10 times a second, so every per-hit Mark chance (talents, affixes, Brand, Prism) counted ten
    // times over and the Lens set off nearly every Collapse (60-73% of all damage in long bot runs). markX scales its Mark chances,
    // collX the Collapses it sets off. Old recordings keep 1 and 1.
    // rampX scales the ramp bonus (×2.8 → ×2.26, Event Horizon ×4.3 → ×3.3, Prism ×2.5 → ×2.05): late enemies live long enough that a Lens sat at full ramp
    markX: 0.35, collX: 0.35, rampX: 0.7,
    blurb: 'Ramping beam. Applies Mark.',
    specs: [{ name: 'Event Horizon', desc: 'Ramps up to ×3.3 damage', m: { rampMax: 4.3 } }, // descs show the 5.8 ramp (rampX)
            { name: 'Prism Split', desc: 'Splits into 3 beams. Ramps up to ×2', m: { beams: 3, rampMax: 2.5 } }] },
  emp: { name: 'EMP Mortar', el: 'A', cost: 130, dmg: 40, rate: 0.38, range: 4.2, kind: 'mortar', pspd: 4, splash: 1.2, stunDur: 0.6, unlock: 25,
    blurb: 'Lobbed shells that Stun an area.',
    specs: [{ name: 'Blackout Shell', desc: '1.2s Stun, +0.3 Splash, ×1.4 Damage', m: { stunDur: 1.2, splash: 0.3, dmgX: 1.4 } },
            { name: 'Ion Barrage', desc: 'Fires 3 shells per volley', m: { shells: 3 } }] },
  grav: { ground: 1, name: 'Gravity Well', el: 'V', cost: 140, dmg: 30, rate: 0.35, range: 2.6, kind: 'grav', pull: 0.7, unlock: 30,
    blurb: 'Pulls enemies back along the path.',
    specs: [{ name: 'Singularity', desc: '×3 Damage. Pulses apply Mark', m: { dmgX: 3, addMark: 1 } },
            { name: 'Tidal Lock', desc: '×2 pull distance', m: { pullX: 2 } }] },
  // 6.4 capstone tier towers (tower64): capT = the tree whose capstone tier node unlocks the tower for a run (newRun opts.capT → G.capT).
  // unlock 999 keeps them out of the wave unlocks, the Stolen Blueprint and the base build menu. Rules: docs/notes/tower64.md
  saw: { ground: 1, name: 'Buzzsaw', el: 'K', cost: 140, dmg: 38, rate: 0.55, range: 3, kind: 'saw', capT: 'K', unlock: 999, sawLen: 6, sawSpd: 6, sawR: 0.55, // first bot pass: 1-8% of damage at 30 dmg, 0.5/s, 5 tiles
    blurb: 'Throws a blade onto the road. It runs back up the road and cuts every ground enemy once. Ignores Plating.',
    specs: [{ name: 'Grinder', desc: 'Blades run 40% slower and 40% wider. ×1.4 Damage', m: { sawSpdX: 0.6, sawRX: 1.4, dmgX: 1.4 } },
            { name: 'Twin Saw', desc: 'Throws 2 blades at 2 targets. ×1.1 Damage', m: { multi: 1, dmgX: 1.1 } }] },
  flashover: { name: 'Flashover', el: 'T', cost: 130, dmg: 22, rate: 0.4, range: 2.6, kind: 'det', capT: 'T', unlock: 999, detX: 2.5, detR: 1,
    blurb: 'Pulses fire. Burning enemies in range explode for their remaining Burn. The rest catch fire.',
    specs: [{ name: 'Chain Reaction', desc: 'Explosions set enemies within 1.5 tiles on fire', m: { detSpread: 1.5 } },
            { name: 'Furnace', desc: '×1.8 explosion damage. +0.5 Range', m: { detXm: 1.8, rangeAdd: 0.5 } }] },
  surge: { name: 'Surge Spire', el: 'A', cost: 130, dmg: 24, rate: 1.2, range: 3, kind: 'surge', chain: 3, st: { shock: 0.4 }, capT: 'A', unlock: 999, cells: 10, // first bot pass: under 1% of damage at 16 dmg, chain 2, idle-only charge
    blurb: 'Chain lightning. Stores charge while idle and from its kills, then fires 4× as fast until the charge is gone.',
    specs: [{ name: 'Deep Cell', desc: 'Stores 20 charges. ×1.2 Damage', m: { cells: 10, dmgX: 1.2 } },
            { name: 'Forked Surge', desc: '+2 Chain. ×1.25 Damage', m: { chain: 2, dmgX: 1.25 } }] },
  rime: { ground: 1, name: 'Rimewall', el: 'C', cost: 140, dmg: 6, rate: 0.15, range: 2.4, kind: 'wall', st: { chill: 1 }, capT: 'C', unlock: 999, hold: 10, // bot pass: wall 8, regrow 8 s held only 0-270 enemy-seconds a run
    blurb: 'Raises an ice wall on the road. Ground enemies stop at it and Chill until it breaks.',
    specs: [{ name: 'Pack Ice', desc: '×2 wall strength. Regrows 25% faster', m: { holdX: 2, rateX: 1.25 } },
            { name: 'Rime Spikes', desc: '×3 Damage to held enemies. They take +25% Kinetic Damage', m: { dmgX: 3, spikes: 0.25 } }] },
  tangle: { name: 'Entangler', el: 'V', cost: 140, dmg: 10, rate: 0.5, range: 3.2, kind: 'tether', st: { mark: 1 }, capT: 'V', unlock: 999, links: 3, share: 0.3, linkT: 4, // share is split among the other links. Bot passes with a full copy to each: 81% of one 96-point run at 35%, up to 45% (25× damage per credit) at 22%
    blurb: 'Links 3 enemies. 30% of each hit one of them takes is shared out to the others.',
    specs: [{ name: 'Wide Web', desc: 'Links 5 enemies. Shares 35%', m: { links: 2, share: 0.05 } },
            { name: 'Shared Fate', desc: 'Shares 45%. Linked enemies are 20% slower', m: { share: 0.15, tslow: 0.2 } }] },
  aegis: { name: 'Gatekeeper', el: 'N', cost: 150, dmg: 12, rate: 1.2, range: 3, kind: 'aegis', capT: 'E', unlock: 999, guards: 2, pspd: 14,
    blurb: 'Guards the core. Stops 2 leaks per wave while the core is in range. Shoots what comes close.',
    specs: [{ name: 'Bulkhead', desc: '+2 leaks stopped per wave', m: { guards: 2 } },
            { name: 'Interceptor', desc: '×2.5 Damage. +1 Range', m: { dmgX: 2.5, rangeAdd: 1 } }] },
  joker: { name: 'Wildcard', el: 'N', cost: 120, dmg: 20, rate: 0.9, range: 3.2, kind: 'joker', capT: 'X', unlock: 999, pspd: 12, jack: 10,
    blurb: 'Every shot rolls a random element and attack. Every 10th shot is a Jackpot.',
    specs: [{ name: 'Loaded Dice', desc: 'Its rolled status always lands. ×1.2 Damage', m: { sure: 1, dmgX: 1.2 } },
            { name: 'High Roller', desc: 'A Jackpot every 5th shot', m: { jackEvery: 5 } }] },
};
// 6.4: the capstone tier towers, in tree order (TALENTS[i].top unlocks CAP_TOWERS[i])
const CAP_TOWERS = ['saw', 'flashover', 'surge', 'rime', 'tangle', 'aegis', 'joker'];
const TOWER_ORDER = ['pulse', 'rail', 'cryo', 'snare', 'missile', 'pylon', 'coil', 'forge', 'flame', 'lens', 'emp', 'grav'].concat(CAP_TOWERS);
const LV_DMG = [0, 1, 1.65, 2.6, 4.1, 6.4];
const LV_COST = [0, 1, 0.8, 1.2, 2.0, 3.0];
const MAX_LV = 5;
// v4.8 one level number: LV 1-5, then each Ascension adds a level (LV 5 + A3 = LV 8). Colour tiers in bands of 3, white to red.
const LV_TIERS = [{ max: 3, name: 'Common', col: '#ecebe4' }, { max: 6, name: 'Uncommon', col: '#3ee06a' }, { max: 9, name: 'Rare', col: '#4aa3ff' },
  { max: 12, name: 'Epic', col: '#b86cff' }, { max: 15, name: 'Legendary', col: '#ff8a2a' }, { max: Infinity, name: 'Mythic', col: '#ff3048' }];
const towerLevel = t => (t.lvl || 1) + (t.asc || 0);
const lvTier = n => LV_TIERS.find(x => n <= x.max);
// ---------- Ascension perks: each Ascend offers 1 of 3 perks for that tower (4 at Mastery 4) and ×ASC_DMG Damage ----------
// Runs recorded before perks (recOpts.v set, no ascV) keep the old ×1.3 and no perks, so they replay exactly.
const ASC_V = 2, ASC_DMG = 1.15, ASC_DMG_OLD = 1.3;
// Ascend price per tower in perk runs: the Lens ramp already scales with late-game HP, so its Ascends cost more (bots: 66% of damage at 60 points without this)
const ASC_COST = { lens: 1.5 };
// per-tower Ascend damage in perk runs (balance pass: the Lens kept 50%+ of the damage at 96 points with ×1.15; old recordings keep ×1.3)
const ASC_DMG_T = { lens: 1.08 };
// v: cumulative value per stack (the last entry is the cap; one entry = one-time). spec: only offered with that specialization.
// The sim reads t.s.pkv[id] (the summed value); d(inc) describes the next pick.
const PERKS = {
  pulse: [
    { id: 'burst', name: 'Burst Fire', v: [1], d: () => 'Every 5th shot: 3 rounds' },
    { id: 'apRounds', name: 'AP Rounds', v: [1], d: () => 'Ignores Plating' },
    { id: 'bounce', name: 'Ricochet Rounds', v: [1, 2], d: v => `+${v} bounce${v > 1 ? 's' : ''} per round` },
    { id: 'hollow', name: 'Hollow Point', v: [25, 40], d: v => `+${v}% Damage below half HP` },
    { id: 'rapid', name: 'Rapid Cycle', v: [12, 22, 31, 39, 46], d: v => `+${v}% Attack Speed` },
    { id: 'sights', name: 'Hair Trigger', v: [8, 14], d: v => `+${v}% Crit Chance` },
    { id: 'spin', name: 'Spin-Up', spec: 1, v: [40], d: () => 'Speeds up while firing, to +40%' },
    { id: 'barrel', name: 'Third Barrel', spec: 2, v: [1], d: () => '+1 target' },
  ],
  rail: [
    { id: 'pierce', name: 'Long Bore', v: [2, 3], d: v => `+${v} Pierce` },
    { id: 'overpress', name: 'Overpressure', v: [12, 22, 31, 39, 46], d: v => `+${v}% Damage` },
    { id: 'spotter', name: 'Spotter', v: [1], d: () => 'Crits Mark all hit (2 stacks)' },
    { id: 'deflect', name: 'Deflection', v: [1], d: () => 'Ricochets once for 60%' },
    { id: 'capBank', name: 'Capacitor Bank', v: [1], d: () => 'Every 3rd shot: ×2.5 Damage' },
    { id: 'coup', name: 'Coup de Grace', v: [10, 15], d: (v, tot) => `Executes non-bosses under ${tot || v}%` },
    { id: 'bigGame', name: 'Big Game', v: [25, 40], d: v => `+${v}% Damage to bosses, elites` },
    { id: 'barrelR', name: 'Long Barrel', v: [0.8, 1.3], d: v => `+${v} Range` },
    { id: 'slug', name: 'Tungsten Slug', spec: 1, v: [50], d: () => '+50% Crit Damage' },
    { id: 'liveWire', name: 'Live Wire', spec: 2, v: [1], d: () => 'Shocks every enemy hit' },
  ],
  cryo: [
    { id: 'iceBurst', name: 'Ice Burst', v: [8], d: () => 'Frozen kills burst (8% HP)' },
    { id: 'brittle', name: 'Brittle', v: [15, 25], d: v => `Its Frozen take +${v}% Damage` },
    { id: 'deep', name: 'Deep Freeze', v: [0.4, 0.7], d: v => `Freeze lasts +${v} s` },
    { id: 'flash', name: 'Flash Chill', v: [1], d: () => '+1 Chill per pulse' },
    { id: 'ring', name: 'Wide Ring', v: [0.5, 0.8], d: v => `+${v} Range` },
    { id: 'comp', name: 'Compressor', v: [15, 25, 32], d: v => `+${v}% pulse rate` },
    { id: 'perma', name: 'Permafrost', spec: 1, v: [40], d: () => 'Refreeze 40% sooner' },
    { id: 'fault', name: 'Fault Lines', spec: 2, v: [0.3], d: () => '+30% Shatter Field' },
  ],
  missile: [
    { id: 'tube', name: 'Extra Tube', v: [1, 2], d: v => `+${v} half-power missile${v > 1 ? 's' : ''}` },
    { id: 'pen', name: 'Penetrator', v: [1], d: () => 'Ignores Plating' },
    { id: 'seek', name: 'Smart Seekers', v: [1], d: () => 'Missiles retarget' },
    { id: 'warhead', name: 'Heavy Warhead', v: [0.4, 0.7], d: v => `+${v} Splash` },
    { id: 'shrap', name: 'Shrapnel', v: [1], d: () => 'Blasts throw 3 shards (25%)' },
    { id: 'thermite', name: 'Thermite', v: [40, 70], d: v => `+${v}% Burn damage` },
    { id: 'autoload', name: 'Autoloader', v: [15, 27, 37, 45, 52], d: v => `+${v}% fire rate` },
    { id: 'pods', name: 'Bigger Pods', spec: 1, v: [2], d: () => '+2 bomblets' },
    { id: 'gel', name: 'Sticky Gel', spec: 2, v: [1], d: () => 'Fire pools +2 s, 30% wider' },
  ],
  coil: [
    { id: 'chain', name: 'Extra Coil', v: [1, 2, 3], d: v => `+${v} Chain` },
    { id: 'amps', name: 'Amperage', v: [12, 22, 31, 39, 46], d: v => `+${v}% Damage` },
    { id: 'weld', name: 'Arc Weld', v: [1], d: () => 'Ignores Plating' },
    { id: 'loop', name: 'Feedback Loop', v: [1], d: () => 'Last arc hits the first again' },
    { id: 'super', name: 'Superconductor', v: [1], d: () => 'No damage lost per jump' },
    { id: 'arc', name: 'Long Arc', v: [40, 65], d: v => `Arcs reach ${v}% farther` },
    { id: 'overcur', name: 'Overcurrent', v: [20, 32], d: v => `+${v}% Damage to Shocked` },
    { id: 'taser', name: 'Taser', v: [8, 14], d: v => `+${v}% Stun chance` },
    { id: 'crown', name: 'Crown Jewel', spec: 1, v: [2], d: () => '+2 Chain' },
    { id: 'hv', name: 'High Voltage', spec: 2, v: [30], d: () => '+30% Damage' },
  ],
  flame: [
    { id: 'spread', name: 'Spreading Fire', v: [1], d: () => 'Burn spreads on death' },
    { id: 'nozzle', name: 'Wide Nozzle', v: [30, 50], d: v => `Cone ${v}% wider` },
    { id: 'tank', name: 'Pressure Tank', v: [0.4, 0.7], d: v => `+${v} Range` },
    { id: 'accel', name: 'Accelerant', v: [15, 28, 39, 48, 56], d: v => `+${v}% Damage` },
    { id: 'slag', name: 'Slag', v: [1], d: () => 'Ignores Plating' },
    { id: 'updraft', name: 'Updraft', v: [1], d: () => 'Hits fliers' },
    { id: 'slowBurn', name: 'Slow Burn', spec: 1, v: [2], d: () => 'Burn lasts +2 s' },
    { id: 'ion', name: 'Ion Torch', spec: 2, v: [0.25], d: () => '+25% Shock chance' },
  ],
  lens: [
    { id: 'fork', name: 'Fork', v: [30], d: () => 'Forks to a 2nd target (30%)' },
    { id: 'hold', name: 'Persistence', v: [1], d: () => 'Keeps half its ramp on retarget' },
    { id: 'focal', name: 'Focal Length', v: [1, 1.6], d: v => `+${v} Range` },
    { id: 'quick', name: 'Quick Focus', v: [40, 65], d: v => `Ramps ${v}% faster` },
    { id: 'brand', name: 'Brand', v: [0.15, 0.25], d: v => `+${Math.round(v * 100 * TOWERS.lens.markX)}% Mark chance` }, // perks are 5.8 rules only, so the Lens's markX always applies
    { id: 'linger', name: 'Afterglow', v: [2, 3], d: v => `Its Marks last +${v} s` },
    { id: 'well', name: 'Deep Well', spec: 1, v: [0.3], d: () => '+0.3 max ramp' },
    { id: 'facet', name: 'Fourth Facet', spec: 2, v: [1], d: () => '+1 beam' },
  ],
  emp: [
    { id: 'longPulse', name: 'Long Pulse', v: [0.3, 0.5], d: v => `Stun lasts +${v} s` },
    { id: 'scatter', name: 'Scatter Shell', v: [1], d: () => 'Shells split in 3 (20%)' },
    { id: 'burstE', name: 'Wide Burst', v: [0.4, 0.7], d: v => `+${v} Splash` },
    { id: 'shaped', name: 'Shaped Charge', v: [1], d: () => 'Ignores Plating' },
    { id: 'eater', name: 'Shield Eater', v: [1], d: () => 'Strips shields fully' },
    { id: 'breech', name: 'Fast Breech', v: [15, 27, 37, 45, 52], d: v => `+${v}% fire rate` },
    { id: 'ionE', name: 'Ion Charge', v: [0.6], d: () => 'Hits Shock' },
    { id: 'blackout', name: 'Lights Out', spec: 1, v: [1], d: () => 'Bosses Stunned twice as long' },
    { id: 'shell4', name: 'Fourth Shell', spec: 2, v: [1], d: () => '+1 shell per volley' },
  ],
  grav: [
    { id: 'undertow', name: 'Undertow', v: [30], d: () => 'Pulled enemies 30% slower' },
    { id: 'anchor', name: 'Sky Anchor', v: [1], d: () => 'Pulls fliers too' },
    { id: 'heavy', name: 'Heavy Core', v: [25, 40], d: v => `+${v}% pull` },
    { id: 'crush', name: 'Crush Depth', v: [40], d: () => '+40% Damage' },
    { id: 'radius', name: 'Event Radius', v: [0.4, 0.7], d: v => `+${v} Range` },
    { id: 'steady', name: 'Steady Pull', v: [1], d: () => 'Repeat pulls stay stronger' },
    { id: 'darkMark', name: 'Dark Mark', spec: 1, v: [1], d: () => '+1 Mark per pulse' },
    { id: 'eddy', name: 'Eddy', spec: 2, v: [1], d: () => 'Pulled enemies are Chilled' },
  ],
  pylon: [
    { id: 'ampP', name: 'Amplifier Coil', v: [6, 10], d: v => `+${v}% Damage boost` },
    { id: 'mast', name: 'Relay Mast', v: [0.6, 1], d: v => `+${v} Range` },
    { id: 'grid', name: 'Targeting Grid', v: [8, 14], d: v => `+${v}% Crit boost` },
    { id: 'sync', name: 'Clock Sync', v: [5, 8], d: v => `+${v}% Speed boost` },
  ],
  snare: [
    { id: 'bigNet', name: 'Bigger Net', v: [4, 7, 9], d: v => `+${v} catches per wave` },
    { id: 'barbs', name: 'Barbs', v: [0.5, 0.8], d: v => `Hold +${v} s` },
    { id: 'tar', name: 'Tar', v: [0.1, 0.15], d: v => `+${Math.round(v * 100)}% net slow` },
    { id: 'exposed', name: 'Exposed', v: [15, 25], d: v => `Netted take +${v}% Damage` },
  ],
  // 6.4 capstone tier towers. Ids that existing code already reads (amps, chain, super, taser, overcur, crown, brittle) work as they do elsewhere
  saw: [
    { id: 'teeth', name: 'Sharper Teeth', v: [12, 22, 31, 39, 46], d: v => `+${v}% Damage` },
    { id: 'run', name: 'Long Run', v: [1.5, 2.5], d: v => `Blades run +${v} tiles` },
    { id: 'boomer', name: 'Boomerang', v: [1], d: () => 'Blades run back once' },
    { id: 'serr', name: 'Serrated', v: [8, 14], d: v => `+${v}% Crit Chance` },
    { id: 'wideS', name: 'Wide Blade', v: [30, 50], d: v => `Blades ${v}% wider` },
    { id: 'spin2', name: 'Overspin', v: [15, 27, 37], d: v => `+${v}% throw rate` },
    { id: 'grind', name: 'Grind', spec: 1, v: [1], d: () => 'Blades stop 1 s at the end of their run' },
    { id: 'third', name: 'Third Blade', spec: 2, v: [1], d: () => '+1 blade' },
  ],
  flashover: [
    { id: 'fuse', name: 'Short Fuse', v: [12, 22, 31, 39, 46], d: v => `+${v}% Damage` },
    { id: 'volat', name: 'Volatile', v: [40, 70], d: v => `+${v}% explosion damage` },
    { id: 'blastR', name: 'Blast Radius', v: [0.4, 0.7], d: v => `+${v} explosion radius` },
    { id: 'haze', name: 'Heat Haze', v: [0.4, 0.7], d: v => `+${v} Range` },
    { id: 'smoulder', name: 'Smoulder', v: [1], d: () => 'Burn stays after an explosion, at half strength' },
    { id: 'bellows', name: 'Bellows', v: [15, 27, 37], d: v => `+${v}% pulse rate` },
    { id: 'storm', name: 'Firestorm', spec: 1, v: [0.5], d: () => '+0.5 spread radius' },
    { id: 'cruc', name: 'Crucible', spec: 2, v: [30], d: () => '+30% explosion damage' },
  ],
  surge: [
    { id: 'amps', name: 'Amperage', v: [12, 22, 31, 39, 46], d: v => `+${v}% Damage` },
    { id: 'cellsP', name: 'Spare Cells', v: [4, 7], d: v => `Stores +${v} charges` },
    { id: 'quickC', name: 'Fast Charge', v: [40, 65], d: v => `Charges ${v}% faster` },
    { id: 'chain', name: 'Extra Arc', v: [1, 2], d: v => `+${v} Chain` },
    { id: 'super', name: 'Superconductor', v: [1], d: () => 'No damage lost per jump' },
    { id: 'taser', name: 'Taser', v: [8, 14], d: v => `+${v}% Stun chance` },
    { id: 'overcur', name: 'Overcurrent', v: [20, 32], d: v => `+${v}% Damage to Shocked` },
    { id: 'reserve', name: 'Reserve Cell', spec: 1, v: [10], d: () => '+10 charges' },
    { id: 'crown', name: 'Fork Storm', spec: 2, v: [2], d: () => '+2 Chain' },
  ],
  rime: [
    { id: 'thick', name: 'Thick Ice', v: [25, 45, 60], d: v => `+${v}% wall strength` },
    { id: 'regrow', name: 'Quick Freeze', v: [15, 27, 37], d: v => `Regrows ${v}% faster` },
    { id: 'bite', name: 'Frostbite', v: [30, 55], d: v => `+${v}% Damage` },
    { id: 'shardW', name: 'Ice Shards', v: [1], d: () => 'A broken wall hits enemies within 1.5 tiles for ×4 Damage' },
    { id: 'reachW', name: 'Long Reach', v: [0.5, 0.8], d: v => `+${v} Range` },
    { id: 'brittle', name: 'Brittle', v: [15, 25], d: v => `Its Frozen take +${v}% Damage` },
    { id: 'pack', name: 'Glacier Pack', spec: 1, v: [50], d: () => '+50% wall strength' },
    { id: 'barbs', name: 'Ice Barbs', spec: 2, v: [0.15], d: () => 'Held enemies take +15% more Kinetic Damage' },
  ],
  tangle: [
    { id: 'linkP', name: 'Extra Strand', v: [1, 2], d: v => `+${v} link${v > 1 ? 's' : ''}` },
    { id: 'shareP', name: 'Resonant Link', v: [3, 6, 8], d: v => `Shares +${v}%` },
    { id: 'longT', name: 'Long Link', v: [2, 3], d: v => `Links last +${v} s` },
    { id: 'nullW', name: 'Null Weight', v: [12, 22, 31, 39, 46], d: v => `+${v}% Damage` },
    { id: 'reachT', name: 'Far Reach', v: [0.5, 0.8], d: v => `+${v} Range` },
    { id: 'bond', name: 'Dark Bond', v: [1], d: () => 'Linked enemies gain 1 Mark per second' },
    { id: 'web', name: 'Spider Web', spec: 1, v: [1], d: () => '+1 link' },
    { id: 'fate', name: 'Doom Bond', spec: 2, v: [6], d: () => 'Shares +6%' },
  ],
  aegis: [
    { id: 'guard', name: 'Extra Guard', v: [1, 2], d: v => `+${v} leak${v > 1 ? 's' : ''} stopped per wave` },
    { id: 'pd', name: 'Point Defense', v: [15, 27, 37], d: v => `+${v}% Damage` },
    { id: 'watch', name: 'Wide Watch', v: [0.6, 1], d: v => `+${v} Range` },
    { id: 'salv', name: 'Salvage Rights', v: [1], d: () => 'Stopped leaks pay double credits' },
    { id: 'patch', name: 'Patch Job', v: [2, 3], d: v => `Each stop repairs ${v}% core HP` },
    { id: 'qsight', name: 'Quick Sights', v: [15, 27], d: v => `+${v}% Attack Speed` },
    { id: 'last', name: 'Last Wall', spec: 1, v: [1], d: () => '+1 leak stopped per wave' },
    { id: 'flak', name: 'Flak Rounds', spec: 2, v: [1], d: () => 'Shots burst for 50% in 0.8 tiles' },
  ],
  joker: [
    { id: 'luck', name: 'Lucky Streak', v: [10, 18, 25], d: v => `+${v}% status chance` },
    { id: 'edge', name: 'House Edge', v: [12, 22, 31, 39, 46], d: v => `+${v}% Damage` },
    { id: 'hot', name: 'Hot Table', v: [2, 3], d: v => `Jackpot ${v} shots sooner` },
    { id: 'dbl', name: 'Double Down', v: [10, 18], d: v => `${v}% chance to fire twice` },
    { id: 'odds', name: 'Long Odds', v: [0.5, 0.8], d: v => `+${v} Range` },
    { id: 'deal', name: 'Fast Deal', v: [15, 27, 37], d: v => `+${v}% Attack Speed` },
    { id: 'marked', name: 'Marked Cards', spec: 1, v: [25], d: () => '+25% Damage' },
    { id: 'allin', name: 'All In', spec: 2, v: [1], d: () => 'Jackpots deal ×3 instead of ×2' },
  ],
  forge: [
    { id: 'overtime', name: 'Overtime', v: [20, 35, 45], d: v => `+${v}% income` },
    { id: 'fee', name: "Finder's Fee", v: [4, 7], d: v => `+${v}% kill credits` },
    { id: 'compound', name: 'Compound', v: [0.5], d: () => '0.5% interest per wave' },
    { id: 'hazard', name: 'Hazard Pay', v: [1], d: () => 'Boss waves pay double' },
  ],
};
// the next pick's value: the step from the current stack to the next (one-time perks pass their only value)
const perkInc = (P, n) => +(P.v[n] - (n ? P.v[n - 1] : 0)).toFixed(2);
const perkText = (P, n) => P.d(perkInc(P, n || 0), P.v[n || 0]);
const perkTotal = (P, n) => { const v = P.v[Math.min(n, P.v.length) - 1]; return P.d(v, v); }; // what n stacks add up to
// ---------- Tower Mastery (PROF.mastery = { v: 2, xp: { type: xp } }), earned at game over ----------
// xp: totals for ranks 1–5. Rank 2 small stat, rank 3 turret trim, rank 4 a fourth perk choice, rank 5 the tower's legendary joins its rolls.
const MASTERY = { xp: [0, 60, 180, 400, 750, 1250], perWave: 2.5, topW: 0.5, minShare: 0.01, stat: 0.05, offer4: 4,
  rewards: ['Mastery badge on the build card', '+5% Damage (support towers: +5% strength)', 'Gold trim on the tower', 'Ascend offers 4 perks instead of 3', 'Its own legendary affix can roll'] };

// ---------- Affixes ----------
const RARITY = [
  { name: 'Common', col: '#c9c6bc' },
  { name: 'Magic', col: '#5ea9ff' },
  { name: 'Rare', col: '#ffd84a' },
  { name: 'Legendary', col: '#ff8a2a' },
  { name: 'Curse', col: '#ff4d6a' },
];
const RAR_MULT = [1, 1.7, 2.6];
// pool: 'atk' attacking towers, 'pylon', 'forge'
const AFFIXES = [
  { id: 'dmg', pool: 'atk', lo: 10, hi: 15, t: v => `+${v}% Damage` },
  { id: 'rate', pool: 'atk', lo: 8, hi: 12, t: v => `+${v}% Attack Speed` },
  { id: 'range', pool: 'atk', lo: 6, hi: 10, t: v => `+${v}% Range` },
  { id: 'critC', pool: 'atk', lo: 4, hi: 6, t: v => `+${v}% Crit Chance` },
  { id: 'critM', pool: 'atk', lo: 20, hi: 30, t: v => `+${v}% Crit Damage` },
  { id: 'burn', pool: 'atk', lo: 15, hi: 20, t: v => `${v}% chance to Burn` },
  { id: 'chill', pool: 'atk', lo: 15, hi: 20, t: v => `${v}% chance to Chill` },
  { id: 'shock', pool: 'atk', lo: 15, hi: 20, t: v => `${v}% chance to Shock` },
  { id: 'mark', pool: 'atk', lo: 15, hi: 20, t: v => `${v}% chance to Mark` },
  { id: 'bounty', pool: 'atk', lo: 10, hi: 15, t: v => `+${v}% kill credits` },
  { id: 'boss', pool: 'atk', lo: 15, hi: 25, t: v => `+${v}% Damage to Elites and Bosses` },
  { id: 'slowd', pool: 'atk', lo: 20, hi: 30, t: v => `+${v}% Damage to slowed enemies` },
  { id: 'pierce', pool: 'atk', min: 1, fixed: [0, 1, 2], t: v => `+${v} Pierce` },
  { id: 'chain', pool: 'atk', min: 1, fixed: [0, 1, 2], t: v => `+${v} Chain` },
  { id: 'splash', pool: 'atk', min: 1, lo: 3, hi: 4, div: 10, t: v => `+${v} Splash radius` },
  { id: 'exec', pool: 'atk', min: 1, lo: 5, hi: 8, t: v => `Executes enemies below ${v}% HP (not Bosses)` },
  { id: 'multi', pool: 'atk', min: 2, fixed: [0, 0, 1], t: v => `+${v} target` },
  { id: 'aura', pool: 'pylon', lo: 8, hi: 12, t: v => `+${v}% Boost strength` },
  { id: 'prange', pool: 'pylon', lo: 10, hi: 15, t: v => `+${v}% Range` },
  { id: 'yield', pool: 'forge', lo: 15, hi: 25, t: v => `+${v}% Income` },
  { id: 'fbounty', pool: 'forge', lo: 5, hi: 10, t: v => `+${v}% credits from all kills` },
  // core-only (the core also rolls every attack-tower affix)
  { id: 'chp', pool: 'core', lo: 6, hi: 10, t: v => `+${v}% Core max HP` },
  { id: 'cshield', pool: 'core', lo: 10, hi: 15, t: v => `+${v}% Shield` },
  { id: 'crecharge', pool: 'core', lo: 15, hi: 25, t: v => `+${v}% Shield recharge speed` },
  { id: 'cregen', pool: 'core', lo: 2, hi: 3, t: v => `Repairs ${v}% hull at the start of each wave` },
  { id: 'cguard', pool: 'core', lo: 5, hi: 8, t: v => `−${v}% damage from leaks` },
];
// the core's affix pool: core-only affixes are 3× as likely as the shared attack affixes
const CORE_AFFIX_W = A => A.pool === 'core' ? 3 : A.pool === 'atk' ? 1 : 0;
const LEGENDARIES = [
  { id: 'detonator', pool: 'atk', name: 'Detonator', t: () => 'Kills explode for 40% of the enemy\'s max HP' },
  { id: 'ricochet', pool: 'atk', name: 'Ricochet Matrix', t: () => 'Hits bounce to 3 more enemies for 60% damage' },
  { id: 'overloop', pool: 'atk', name: 'Overclock Loop', t: () => 'Every 8s: +150% Attack Speed for 3s' },
  { id: 'prism', pool: 'atk', name: 'Prism Core', t: () => 'Hits apply a random status' },
  { id: 'echo', pool: 'atk', name: 'Echo Chamber', t: () => '30% chance to attack twice' },
  { id: 'siphon', pool: 'atk', name: 'Siphon', t: () => 'Kills restore 0.5% core HP' },
  { id: 'entropic', pool: 'atk', name: 'Entropic Rounds', t: () => 'Hits deal a random ×0.4 to ×3 damage' },
  { id: 'nexus', pool: 'pylon', name: 'Nexus', t: () => '×1.5 Boost strength, +1 Range' },
  { id: 'midas', pool: 'forge', name: 'Midas Press', t: () => '×2 Income. Earns 1% interest on banked credits' },
  // Mastery 5: each tower's own legendary joins that tower's rolls. Built from perk effects (pkv adds to the perk values)
  { id: 'mPulse', pool: 'atk', tower: 'pulse', name: 'Storm of Lead', pkv: { bounce: 2, rapid: 15 }, t: () => 'Rounds bounce to 2 more enemies. +15% Attack Speed' },
  { id: 'mRail', pool: 'atk', tower: 'rail', name: 'Railstorm', pkv: { deflect: 1, pierce: 2 }, t: () => 'Shots ricochet once for 60%. +2 Pierce' },
  { id: 'mCryo', pool: 'atk', tower: 'cryo', name: 'Absolute Ring', pkv: { brittle: 20, flash: 1 }, t: () => 'Frozen enemies take +20% Damage. Each pulse adds 1 more Chill stack' },
  { id: 'mMissile', pool: 'atk', tower: 'missile', name: 'Hydra', pkv: { tube: 2, seek: 1 }, t: () => '+2 half-power missiles. Missiles find a new target if theirs dies' },
  { id: 'mCoil', pool: 'atk', tower: 'coil', name: 'Storm Crown', pkv: { chain: 2, loop: 1 }, t: () => '+2 Chain. The last arc jumps back to the first target' },
  { id: 'mFlame', pool: 'atk', tower: 'flame', name: "Dragon's Breath", pkv: { updraft: 1, spread: 1, accel: 30 }, t: () => 'Flames reach fliers. Burn spreads on death. +30% Damage' },
  { id: 'mLens', pool: 'atk', tower: 'lens', name: 'Twin Singularity', pkv: { fork: 50, hold: 1 }, t: () => 'Beam forks to a 2nd target for 50%. Keeps half its ramp when switching target' },
  { id: 'mEmp', pool: 'atk', tower: 'emp', name: 'Cascade', pkv: { scatter: 1, longPulse: 0.3 }, t: () => 'Shells split into 3 bomblets. Stun lasts 0.3 s longer' },
  { id: 'mGrav', pool: 'atk', tower: 'grav', name: 'Abyss', pkv: { anchor: 1, undertow: 30 }, t: () => 'Wells drag fliers. Pulled enemies are slowed 30%' },
  { id: 'mPylon', pool: 'pylon', tower: 'pylon', name: 'Overmind', pkv: { ampP: 10, mast: 1 }, t: () => '+10% Damage boost. +1 Range' },
  { id: 'mSnare', pool: 'pylon', tower: 'snare', name: 'Kraken Net', pkv: { bigNet: 8, exposed: 20 }, t: () => '+8 catches per wave. Netted fliers take +20% more damage' },
  { id: 'mForge', pool: 'forge', tower: 'forge', name: 'Golden Goose', pkv: { overtime: 50, compound: 0.5 }, t: () => '+50% income. Earns 0.5% interest on banked credits each wave' },
  // 6.4 capstone tier towers (Mastery 5)
  { id: 'mSaw', pool: 'atk', tower: 'saw', name: 'Sawmill', pkv: { boomer: 1, run: 2 }, t: () => 'Blades run back once. Blades run +2 tiles' },
  { id: 'mFlash', pool: 'atk', tower: 'flashover', name: 'Napalm Heart', pkv: { smoulder: 1, blastR: 0.5 }, t: () => 'Burn stays after an explosion, at half strength. +0.5 explosion radius' },
  { id: 'mSurge', pool: 'atk', tower: 'surge', name: 'Thunderhead', pkv: { cellsP: 8, chain: 1 }, t: () => 'Stores +8 charges. +1 Chain' },
  { id: 'mRime', pool: 'atk', tower: 'rime', name: 'Glacier Heart', pkv: { thick: 60, shardW: 1 }, t: () => '+60% wall strength. A broken wall hits enemies within 1.5 tiles for ×4 Damage' },
  { id: 'mTangle', pool: 'atk', tower: 'tangle', name: "Cat's Cradle", pkv: { linkP: 2, shareP: 8 }, t: () => '+2 links. Shares +8%' },
  { id: 'mAegis', pool: 'atk', tower: 'aegis', name: 'Last Line', pkv: { guard: 2, salv: 1 }, t: () => '+2 leaks stopped per wave. Stopped leaks pay double credits' },
  { id: 'mJoker', pool: 'atk', tower: 'joker', name: 'Royal Flush', pkv: { hot: 4, dbl: 15 }, t: () => 'Jackpot 4 shots sooner. 15% chance to fire twice' },
  { id: 'bulwark', pool: 'core', name: 'Bulwark Matrix', t: () => 'Shield fully recharges at the start of each wave' },
  { id: 'retribution', pool: 'core', name: 'Retribution', t: () => 'When an enemy reaches the core, it blasts everything within 2.5 tiles for 4× core damage' },
];
// legendaries the core can roll: its own plus the attack ones that work off any shooter
const CORE_LEGS = ['bulwark', 'retribution', 'detonator', 'siphon', 'ricochet', 'prism', 'echo'];
// Core relocation at wormhole checkpoints: first move each run is free, then a fixed price
const RELOCATE_COST = 800, RELOCATE_RADIUS = 10;
// Frontier (newRun({ frontier: 1 }) → G.fr; every new run since 6.1, Daily Hunts and Training included): a bigger, slower map, a core
// that lifts off, docks on a tower and links to the towers around it, and towers that can move. Every tunable lives here
// (docs/notes/frontier.md, frontier-baseline.md). Runs without the flag (older recordings and snapshots) keep the Classic rules.
// FR_VER: Frontier rule changes after the lab prototype (1). 2: re-routed enemies keep their place in line for targeting (L.pre)
// 3 (6.2): Power Nodes stay out of wormhole no-build zones (frNodeFix); support towers grow with the attack towers they serve (supGrow)
const FR_VER = 5;
const FRONTIER = {
  rowsX: 1.38, rowsMax: 40, aspect: 16 / 9,      // board: Classic rows × 1.38 (Normal 26 → 36), width 16:9 of that (Normal 64 × 36)
  spd: 0.6, count: 0.6, hp: 1.75, bossHp: 1.3,   // enemies 60% speed; 60% as many per wave, each 1.75× HP (wave HP ×1.05); bosses 1.3× HP
  gap: 13,                                         // seconds between waves (as Classic: slower walks already stretch the run)
  w: { tank: 2.5, splitter: 1.6, carrier: 2, reflector: 1.5, shielder: 1.3, medic: 1.3, swarmer: 0.4, drone: 0.6 }, // heavier rosters
  flySpd: 3, flyMin: 1, cd: 3,                     // flight 3 tiles/s (at least 1 s); lift-off cooldown in waves after landing
  cdUplink: 4,                                     // every 4 Uplink levels: −1 wave of cooldown (never below 1)
  dockDmg: 2, dockRange: 1, dockBat: 0.2,          // a docked tower: ×2 damage, +1 range, +20% damage per Battery level above 1
  links: 3, linkR: 4, linkUplink: 3,               // links: 3 towers within 4 tiles (+1 per 3 Uplink levels)
  linkDmg: 0.1, linkRate: 0.1, linkCore: 0.05,     // linked towers +10% damage and rate; the core +5% damage per link
  moveT: 4, moveFee: 0.1,                          // moving a tower: 4 s offline, 10% of what it cost
  wormBuild: 6,                                    // no towers within 6 tiles of a wormhole (open or opening), so the swarm is seen before it's shot
  wormGap: 10, minRoad: 10,                        // landing spots stay 10 tiles (Manhattan) from every wormhole; no road shorter than 10
};
const frRows = chaos => Math.min(FRONTIER.rowsMax, Math.round(CHAOS_LEVELS[chaos].rows * FRONTIER.rowsX));
const frCols = rows => Math.round(rows * FRONTIER.aspect);
// "What's New" sheet, shown once per version to returning players (and from Settings)
const WHATS_NEW = { ver: '6.5.1', title: 'Last Gradient 6.5 · Deep Field', items: [
  ['Boss themes', 'All 13 bosses have their own theme song. A kill plays a victory sting, then your song comes back. Studio › Listen lists the themes you have beaten.'],
  ['More music', 'Every genre now has 4 styles. Each new song picks its own drums, bass, lead, tempo and key. Your saved tracks sound exactly as before.'],
  ['Zones look different', 'Each of the 10 zones has its own ground, roads and weather. A banner names the zone when you enter it.'],
  ['New cards every draw', 'Entropy cards are now built fresh each draw: 1 boon and 1 cost. They come as Common, Rare or Exotic, and lean toward the towers you field. The 21 old cards still appear.'],
  ['Capstone tier', 'Each talent tree has a new gold tile under its Capstones. It opens at 16 points in that tree and costs 1 point. It takes no Capstone slot.'],
  ['7 new towers', 'Buzzsaw, Flashover, Surge Spire, Rimewall, Entangler, Gatekeeper and Wildcard. Each Capstone tier tile unlocks one. Daily Hunts keep the original 12 towers.'],
  ['The probe', 'Every run starts with a free probe at the core. Tap Probe, then tap any spot to send it. Tap the core to call it home.'],
  ['Loot sites', 'Wreckage, gas clouds and asteroids appear from Wave 2. Some have guards. Loot counts only when the probe docks.'],
  ['Probe upgrades', 'Lance, Armour, Engine, Rig and Scanner, 3 levels each. A lost probe drops its cargo. Rebuilding costs credits and takes 40 s.'],
  ['Fog of war', 'You see what your core, towers and probe see. Bosses, wave previews and edge arrows always show through the fog.'],
  ['Black Hole', 'From Wave 10, a Black Hole can sit on a road for 30 s. It slows enemies by up to 50%. Towers 2.5 to 6 tiles away fire 40% faster. Closer towers fire 50% slower.'],
  ['Lighter on battery', 'The game does less work behind menus and on the top bar. Nothing looks different.'],
]};
// 6.5 the probe (FR_VER 5, G.frV >= 5; docs/notes/probe65.md). A small ship the player sends anywhere on the map (tap it, tap a
// spot). Loot sites spawn in the outer map: wreckage (a quick grab), gas clouds (harvest while inside, static hurts), asteroids
// (mined in 3 chunks, they drift). Some have neutral guards. Loot rides home in the cargo hold and banks at the core; a lost probe
// drops its cargo as a wreck and costs credits and time to rebuild. Probe and guards both grow with the wave (wS); guards a bit faster.
const PROBE = {
  wS: 15,                                         // wave scale: 1 + wave / 15 (Wave 15 = ×2, Wave 60 = ×5)
  hp: 80, spd: 2.0, vis: 5, dps: 14, fireT: 0.5,  // base hull (× wave scale), tiles/s, vision tiles, lance damage per second (× wave scale), seconds per shot
  regen: 0.08, repair: 0.0005,                    // docked: +8% of its hull per second; repairs the core +0.05% of max hull per second
  up: { // 3 levels each; the value at levels 0..3. Price: cost[lv] × (1 + wave / 30)
    hull: { name: 'Armour', v: [1, 1.6, 2.4, 3.5] },     // hull ×
    eng:  { name: 'Engine', v: [2.0, 2.6, 3.2, 4.0] },   // tiles per second
    gun:  { name: 'Lance', v: [0, 1, 1.9, 3.2], r: [0, 2.8, 3.2, 3.6] }, // damage × (0: no weapon), range in tiles
    rig:  { name: 'Rig', v: [1, 1.5, 2, 3] },            // harvest and mining speed ×
    scan: { name: 'Scanner', v: [5, 7, 9, 12], loot: 0.1 }, // vision tiles; +10% loot per level
  },
  upOrder: ['gun', 'hull', 'eng', 'rig', 'scan'],
  cost: [150, 400, 900],
  rb0: 120, rbW: 12, rbLv: 0.15, rbT: 40,         // rebuild: (120 + 12 × wave) × (1 + 15% per upgrade level), then 40 s in the yard
  home: 0.3,                                      // within 0.3 tiles of its dock beside the core: docked, cargo banks
  site: { from: 2, first: 25, gap: [22, 36], max: 2, maxW: 15, maxCap: 4, minCore: 12, roadGap: 2, apart: 6, out: 0.75 }, // spawns from Wave 2: one every 22–36 s while under 2 (+1 per 15 waves, max 4); 12+ tiles from the core, 2+ from roads, 6+ apart; 75% outside the sector when it can
  life: { wreck: 120, cloud: 110, rock: 140, lost: 90 }, // seconds before a site fades
  wreckT: 2.5, cloudT: 12, cloudR: 1.6, cloudZap: 0.015, rockHp: 40, mine: 6, rockR: 1.7, rockDrift: 0.12, // work: salvage time, harvest time and radius, static 1.5% hull/s, rock HP and mining damage per second (× wave scale), mining reach, drift tiles/s
  loot: { wreck: 0.4, cloud: 0.3, rock: 0.4, ramp: [0.35, 30], rich: 2.5, guard: 0.1, brute: 0.2, cloudEnt: 15, charge: 0.35, crystal: 0.2 }, // × crate value (crateCr), ×(0.35 + wave/30, max 1) early
  jack: { base: 0.02, guard: 0.02, rich: 0.1 }, // jackpot chance per finished site: a boon pick or a full Entropy gauge
  richFrom: 8, rich: 0.12,                        // from Wave 8, 12% of sites are rich (×2.5 loot, +1 guard)
  guard: { from: 3, p0: 0.3, pW: 80, pMax: 0.75, nW: 20, nMax: 4, bruteFrom: 15, bruteP: 0.3, aggro: 4, leash: 5.5, heal: 0.2, calm: 5,
    drone: { hp: 40, dmg: 6, cd: 1.2, r: 3.5, orbit: 1.3 },  // HP × wS^1.2, damage per shot × wS
    brute: { hp: 130, dps: 15, spd: 1.7, r: 0.7 } },         // HP × wS^1.2, melee damage per second × wS
};
// Space pirates deliver the salvage. Lines are rare and varied so they stay funny.
// v5.2 the skiffs have captains: a name on the hull, a flight path you can see and a jingle when they come
const PIRATE_CAPTAINS = ['Captain Rustbeard', 'Black Static', 'Mad Mags Vortex', 'One-Eye Orrin', 'Calico Jett', 'Nebula Nell', 'Scurvy Quasar', 'Red Ronin Rook', 'Dread Pixel Pete', 'Salty Sal Saturn'];
const PIRATE_LINES = {
  normal: ['Yarr!', 'Special delivery', "That's not ours", 'Tell no one', 'Insurance fraud!', 'Fell off a freighter', 'No refunds', 'Arr, butterfingers', 'Keep the change', 'Dropping the evidence', 'This never happened', 'Free sample!', 'Mind the paint', 'Totally legal cargo', 'Ye saw nothing', 'Express shipping'],
  cursed: ['Heh heh heh', 'Totally safe', 'Open it. Go on.', 'Do NOT shake', "Don't mind the noises", 'Our gift to you'],
  gold: ["Cap'n's orders", "Hide it from the Cap'n", 'Treasure!', 'X marks the spot', 'Mutiny pays'],
  thief: ['Finders keepers', "I'll take that", 'Yoink', 'Salvage rights!', 'Mine now', 'Thank ye kindly'],
  stow: ['Arr!', 'Surprise!', 'Ahoy, core!', 'Stowaway!'],
};
// ---------- v4.4 Most Wanted: every run names one boss, a mutation for it and a bounty, announced at the start ----------
const WANTED_MODS = [
  { id: 'colossal', name: 'Colossal', desc: '×1.6 health, half again as big, 20% slower', hp: 1.6, spd: 0.8, size: 1.5 },
  { id: 'twins', name: 'Twin', desc: 'Two of them, each at 60% health, 3 s apart', hp: 0.6, twins: 1 },
  { id: 'hasted', name: 'Hasted', desc: '35% faster, 25% less health', hp: 0.75, spd: 1.35 },
  { id: 'armored', name: 'Armored', desc: 'Takes 30% less damage from everything', hp: 0.9, armorAll: 0.3 },
  { id: 'spectral', name: 'Spectral', desc: 'Cloaks for 2 s every 7 s', cloak: 1 },
  { id: 'loaded', name: 'Loaded', desc: 'Double bounty, and it drops a Captain\'s Chest where it dies', hp: 1.1, loaded: 1 },
];
const WANTED_FOR = { behemoth: 'property damage', queen: 'an unlicensed breeding programme', wraith: 'trespassing (repeatedly)', overmind: 'identity theft', titan: 'being a wall',
  cat: 'knocking things off tables', gloop: 'loitering', whale: 'singing without a permit', duck: 'disturbing the peace', fsm: 'impersonating a deity', worm: 'eating public property', auditor: 'tax evasion (ironic)', snail: 'speeding (allegedly)' };
const WANTED = { creditsPerWave: 60 };
// ---------- v5.3 The Hunt ----------
// Every bounty claimed is a chance to cash out (Extract: the run ends as a win, +50% XP) or push on (score ×1.25 per bounty pushed
// past, and a new bounty 20 waves on). The strain or boss that ends a run comes back next run as your Nemesis.
// Daily Hunt: one seed, bounty and Nemesis for everyone, every tower open and a fixed talent budget so the ladder measures play.
const HUNT = { every: 20, pushScore: 0.25, extractXp: 0.5, pts: 40 };
// ---------- 5.8 The Hook: sector contracts, jump doors, the Bounty Purse and late escalations ----------
// HOOK_VER: the rules a run was started under (G.hk). Recordings made before 5.8 replay with hk 0: no sector, no purse, old boons, old HP curve.
const HOOK_VER = 1;
// Bounty Purse: `safe` of all XP banks as you earn it, the rest goes in the purse. A claimed bounty grows it ×bounty, a push ×(door tier).
// Extract banks the whole purse; a fallen core banks `death` of it.
const PURSE = { safe: 0.6, death: 0.3, bounty: 1.5 };
// jump door risk: purse multiplier on the push, and what the next 20 waves cost (enemy HP, elites) and pay (score and XP)
const DOOR_TIERS = [
  { id: 'steady', name: 'Steady', col: '#59f0b4', mult: 1.25, af: {}, desc: 'No extra danger' },
  { id: 'hot', name: 'Hot', col: '#ffb03a', mult: 1.4, af: { hpx: 0.12, score: 0.1 }, desc: '+12% enemy HP · +10% score' },
  { id: 'deadly', name: 'Deadly', col: '#ff4d6a', mult: 1.6, af: { hpx: 0.25, elite: 0.06, score: 0.25 }, desc: '+25% enemy HP, more Elites · +25% score' },
];
// Sectors: a run's contract, then a new one through each jump door. lean: enemy weights in genWave (headline picks lean the same way),
// storm: the weather that rolls in most, ev: event weights, boss/mod: the sector's Most Wanted, m/af: the perk and the drawback
const SECTORS = [
  { id: 'drift', name: 'Quiet Drift', col: '#6ae2ff', pitch: 'Few enemies and mild storms. A good zone to learn in.',
    lean: { drone: 1.6, tank: 0.6, flyer: 0.7 }, storm: 'cryo', ev: { gold: 2, meteor: 2, overcharge: 1.5 }, boss: 'behemoth', mod: 'colossal',
    up: '+10% Credits', down: '−10% score', m: { credits: 10 }, af: { score: -0.1 } },
  { id: 'hive', name: 'The Hive', col: '#ff9ad5', pitch: 'Brood nests on every lane. Swarmers come by the hundred.',
    lean: { swarmer: 3, splitter: 3, drone: 0.6 }, storm: 'solar', ev: { swarm: 3, breach: 1.5 }, boss: 'queen', mod: 'twins',
    up: '+1 Chain, +15% Thermal Damage', down: '+10% enemy speed', m: { chain: 1, dmgT: 15 }, af: { haste: 0.1 } },
  { id: 'iron', name: 'Iron Reach', col: '#c8ccd8', pitch: 'Juggernauts and Aegis walls push slowly down the road.',
    lean: { tank: 2.5, shielder: 2.5, reflector: 1.5, swarmer: 0.6 }, storm: 'static', ev: { elite: 1.5, regen: 1.5 }, boss: 'titan', mod: 'armored',
    up: '+15% armour piercing', down: '+6% enemy HP', m: { armorPen: 15 }, af: { hpx: 0.06 } },
  { id: 'skies', name: 'Open Skies', col: '#7fb4ff', pitch: 'No roads up here. Skimmers and Carriers fly straight in.',
    lean: { flyer: 2.2, carrier: 2.5, tank: 0.6, sapper: 0.6 }, storm: 'ion', ev: { phase: 1.5, surge: 1.5 }, boss: 'whale', mod: 'spectral',
    up: '+20% Arc Damage, +8% Range', down: '+10% tower cost', m: { dmgA: 20, range: 8 }, af: { costX: 0.1 } },
  { id: 'ghost', name: 'Ghost Lanes', col: '#b86cff', pitch: 'Phantoms cloak in and out. Bring a Relay Pylon to reveal them.',
    lean: { phantom: 3, medic: 1.5, leech: 2 }, storm: 'void', ev: { blackout: 2, phase: 2, hole: 2.5 }, boss: 'wraith', mod: 'spectral',
    up: '+25% Void Damage', down: '−10% Range', m: { dmgV: 25, range: -10 } },
  { id: 'salvage', name: 'Salvage Belt', col: '#e0a458', pitch: 'Rich wrecks and pirate traffic. Leeches steal your banked credits.',
    lean: { leech: 3, sapper: 2, drone: 1.3 }, storm: 'static', ev: { gold: 3, emp: 1.5 }, boss: 'auditor', mod: 'loaded',
    up: '+25% Credits', down: '+15% upgrade cost', m: { credits: 25 }, af: { upgX: 0.15 } },
  { id: 'tempest', name: 'Tempest Front', col: '#ffe14d', pitch: 'Storms come one after another. Skimmers and Carriers come with them.',
    lean: { flyer: 1.5, carrier: 1.5 }, storm: null, ev: { surge: 1.5, overcharge: 2 }, boss: 'fsm', mod: 'hasted',
    up: 'Storms twice as often, 40% stronger', down: '+10% enemy speed', m: { stormFreq: 100, stormPow: 40 }, af: { haste: 0.1 } },
  { id: 'demo', name: 'Demolition Row', col: '#ff7b39', pitch: 'Sappers knock your towers out. Splitters burst into Swarmers.',
    lean: { sapper: 4, splitter: 1.5, reflector: 1.5 }, storm: 'cryo', ev: { emp: 2, elite: 1.5 }, boss: 'overmind', mod: 'hasted',
    up: '+10% Attack Speed', down: 'More Elites', m: { rate: 10 }, af: { elite: 0.08 } },
  { id: 'choir', name: 'Green Choir', col: '#8ee35a', pitch: 'Menders heal and enemies regrow. Anything you leave alive heals back.',
    lean: { medic: 4, shielder: 1.5 }, storm: 'solar', ev: { regen: 3 }, boss: 'snail', mod: 'colossal',
    up: '+15% Thermal Damage, Burn +30%', down: 'Enemies regenerate 0.5% HP per second', m: { dmgT: 15, burnDmg: 30 }, af: { regen: 0.005 } },
  { id: 'oddball', name: 'The Odd Belt', col: '#ff4d6a', pitch: 'The strange bosses live here. Expect the cat.',
    lean: {}, storm: 'void', ev: { meteor: 2, phase: 1.5, hole: 2 }, boss: 'cat', mod: 'loaded',
    up: 'Oddball bosses drop 3× credits', down: 'Every boss wave brings an oddball', af: { oddAll: 1 } },
];
const SECTOR_BY = Object.fromEntries(SECTORS.map(s => [s.id, s]));
const SECTOR_START = 'drift'; // a fresh profile's first runs: no contract to choose
// the 3 contracts the setup screen offers, from the setup's own seed (never G.r)
function sectorOffers(seed) {
  const r = mulberry32(((seed || 1) ^ 0x5ec7095) >>> 0), pool = SECTORS.slice(), out = [];
  while (out.length < 3) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0].id);
  return out;
}
// Escalations: from Wave 50 each boss wave offers 1 of 2. They stack, and each adds `score` to the score and XP multiplier
const TWISTS = [
  { id: 'twin', name: 'Twin Bosses', desc: 'Every boss arrives with a twin. Each has 65% health', max: 1, score: 0.2 },
  { id: 'rifts', name: 'Torn Space', desc: 'Every wave opens a Rift: some enemies start halfway down the road', max: 1, score: 0.15, af: { rifts: 1 } },
  { id: 'affix', name: 'Elite Plating', desc: 'Elites carry one more affix', max: 2, score: 0.12, af: { affN: 1 } },
  { id: 'storms', name: 'Hostile Weather', desc: 'Enemies inside storms move 25% faster. Storms come 50% more often', max: 1, score: 0.12, m: { stormFreq: 50 }, af: { stormHaste: 0.25 } },
  { id: 'learn', name: 'Quick Study', desc: 'The swarm learns twice as fast', max: 1, score: 0.12, af: { learn: 1 } },
  { id: 'carriers', name: 'Carrier Fleet', desc: 'Carriers headline every wave', max: 1, score: 0.15, af: { carrierHead: 1 } },
  { id: 'blitz', name: 'Blitz', desc: 'Enemies spawn 25% faster and move 6% faster', max: 2, score: 0.15, af: { gap: 0.25, haste: 0.06 } },
  { id: 'worm', name: 'New Wormhole', desc: 'A new wormhole opens in 2 waves', max: 2, score: 0.15 },
];
const TWIST_FROM = 50;
const TWIN_HP = 0.65;
// ---------- 5.8 Training: the guided first run ----------
// newRun({ tut: TUT.v }) plays a fixed map (tutMap), seed and wave script, one idea per wave. Everything here is sim data: the run
// never reads the profile for it, so a recording replays exactly. The coach (ui.js Coach) only watches and pauses.
// waves: groups of [enemy, count, gap s, hp ×, extra]; hp × multiplies the normal hpMult(w). extra.genes/gel give scripted genes
// (gel 'top' = the element doing most of your damage); extra.share = the fraction of the group that carries them
const TUT = {
  v: 1, seed: 52801, rows: 22, credits: 100, coreHp: 150, reward: 800,
  CH: { name: 'Training', ev: 0, storm: 0, elite: 0, score: 1, hp: 1, rows: 22, lanes: [99], evo: { start: 5, press: 0, first: 999, every: 999, desc: '' } },
  grid: [2, 2, 3, 3, 3, 4, 4, 4, 5, 5],   // power capacity by G.wave (index), so the grid fills up once and the upgrade lesson follows
  towers: ['pulse', 'rail', 'cryo'],     // what the coach offers in the build menu
  boss: { id: 'behemoth', mod: 'colossal', hp: 1500 }, // fixed health (×1.6 Colossal), so the fight is the same for everyone
  charge: { 5: 'strike' },               // a Strike charge waiting at the start of these waves
  grant: { 5: 260, 7: 160 },             // supply drops (credits) as the wave before ends: the core upgrades and the spec are always affordable
  waves: [
    [['drone', 6, 1.8, 0.9]],
    [['drone', 5, 1.5, 1], ['swarmer', 6, 0.3, 1]],
    [['drone', 7, 1.2, 1], ['swarmer', 8, 0.3, 1]],
    [['drone', 4, 1.2, 1], ['tank', 3, 2.6, 0.9], ['drone', 3, 1.2, 1]],
    [['drone', 3, 1.2, 1], ['swarmer', 18, 0.14, 1.1]],
    [['drone', 10, 1.0, 1.05, { genes: ['ward'], gel: 'top', share: 0.6 }], ['swarmer', 6, 0.3, 1, { genes: ['haste'], share: 0.5 }]],
    [['drone', 8, 0.9, 1, { genes: ['ward'], gel: 'top', share: 0.5 }], ['tank', 2, 2.4, 0.9], ['swarmer', 8, 0.25, 1]],
    [['swarmer', 8, 0.25, 1], ['drone', 10, 0.8, 1, { genes: ['ward'], gel: 'top', share: 0.4 }], ['tank', 3, 2.2, 0.9]],
    [['drone', 4, 1.2, 0.9], ['boss', 1, 3, 1], ['drone', 4, 1.6, 0.9]],
  ],
  // 6.1 Frontier Training (newRun({ tut, frontier: 1 }), every Training and lesson since 6.1): a bigger board (16:9, the same on every
  // screen) and a wave script with fewer, tougher units (they walk at 60% speed and each pays 1/0.6 of a Classic kill)
  fr: { rows: 26, grant: { 4: 120, 5: 260, 7: 160 }, vetAt: 5, // (an extra drop as Wave 3 ends: the Rail Lance and the Move fee are always affordable;
    // fewer kills per wave, so the busiest tower is made a Veteran as Wave 4 ends if none is yet: the Ready step)
    waves: [
      [['drone', 5, 2.2, 1.3]],
      [['drone', 3, 2.2, 1.4], ['swarmer', 8, 0.45, 1.2]],
      [['drone', 4, 1.9, 1.5], ['swarmer', 10, 0.4, 1.3]],
      [['drone', 4, 1.6, 1.4], ['tank', 2, 3.6, 1.4], ['drone', 4, 1.6, 1.4]],
      [['drone', 2, 1.8, 1.6], ['swarmer', 11, 0.24, 1.6]],
      [['drone', 6, 1.6, 1.6, { genes: ['ward'], gel: 'top', share: 0.6 }], ['swarmer', 4, 0.5, 1.6, { genes: ['haste'], share: 0.5 }]],
      [['drone', 5, 1.5, 1.6, { genes: ['ward'], gel: 'top', share: 0.5 }], ['tank', 2, 3.4, 1.4], ['swarmer', 5, 0.4, 1.6]],
      [['swarmer', 5, 0.4, 1.6], ['drone', 6, 1.3, 1.6, { genes: ['ward'], gel: 'top', share: 0.4 }], ['tank', 2, 3.2, 1.5]],
      [['drone', 3, 1.8, 1.4], ['boss', 1, 3, 1], ['drone', 3, 2.4, 1.4]],
    ] },
};
// ---------- 5.8 Field Manual: the lessons ----------
// One entry per lesson. what / when / todo are the manual page (and the intro cards' Learn more); real is the line a lesson ends on.
// run: a short scenario on the Training map (newRun({ tut, lesson: id })), TUT's fields overridden: start (first wave), credits,
// grid (power: a number or one per wave), towers (the build menu), waves (TUT format), abil (abilities online), build (a fixed
// talent build), boss, pre (presets: towers, abil, cache, vet, storm, entropy, lane, assault, tokens; see tutPreset).
// tour: 1 = a walk through the hangar's own screens instead of a run. The coach steps live in ui.js (Coach PLANS, same id).
// need(): hide a lesson until its system exists (the Ascend perks branch adds PERKS).
const LESSONS = [
  { id: 'towers', title: 'Towers and elements', blurb: 'What each tower is for, and why element matters.',
    what: 'Every tower has an element: Kinetic, Thermal, Cryo, Arc or Void. Enemies resist some and are weak to others.', when: 'Every build. The Threat Board says what the next wave is weak to.', todo: 'Read the role line on each card. Build the counter the Threat Board names. Mix elements.',
    real: 'In a run: check the Threat Board between waves and build the counter it names.',
    run: { credits: 380, grid: 6, towers: ['pulse', 'rail', 'cryo', 'missile', 'coil', 'flame'], waves: [[['flyer', 7, 1.3, 0.9], ['drone', 4, 1.2, 0.8]], [['swarmer', 16, 0.2, 1], ['drone', 4, 1, 0.8]]] } },
  { id: 'upgrades', title: 'Upgrades, specs and selling', blurb: 'Make a tower stronger, pick its branch, sell what sits idle.',
    what: 'Tap a built tower to open its panel. Upgrade raises its level: more damage and a random bonus (an affix). At LV 3 you pick one of two specs for good. LV 5 is the top; after it, Ascend for a perk.', when: 'When power is full, or a tower already sits in the right spot.', todo: 'Upgrade the tower doing the most work. The arrow over a tower means you can afford its best upgrade. Sell towers that stay idle.',
    real: 'In a run: follow the arrow. When power is full, upgrade instead of building.',
    run: { credits: 1400, grid: 5, towers: ['pulse', 'rail', 'cryo'], pre: [['towers', [['pulse', 3], ['rail', 5, 1], ['cryo', 1]]]], waves: [[['drone', 8, 1, 1.2], ['tank', 2, 2, 1]]] } },
  { id: 'power', title: 'Power, reactor and core', blurb: 'The power grid, expanding it, and upgrading the core.',
    what: 'Each tower draws 1 power. Capacity grows by 1 every 3 waves; the reactor adds more for credits. The core has its own upgrades: Battery (its gun, and a docked tower), Shield, Hull and Uplink.', when: 'When the ⚡ readout is full and you still have credits.', todo: 'Upgrade towers first. Expand the reactor when you have credits to spare. Hull makes the core sturdier, Uplink recharges abilities faster.',
    real: 'In a run: a full grid means upgrade. Spare credits late go into the reactor and the core’s Hull.',
    run: { credits: 1600, grid: 3, towers: ['pulse', 'rail', 'cryo'], pre: [['towers', [['pulse', 2], ['rail', 1], ['cryo', 1]]]], waves: [[['drone', 10, 1, 1.2]]] } },
  { id: 'lift', title: 'Lift Off and docking', blurb: 'Fly the core, dock it on a tower, link and move towers.',
    what: 'Your core can fly. Tap Lift Off, pick a landing spot and read the preview. Land on an attack tower to dock it: the core fires that tower’s weapon at ×2 damage and +1 range. The landed core links its 3 nearest attack towers within 4 tiles (+10% damage and rate each). Any tower can Move from its panel.', when: 'Whenever the swarm shifts: a new road, a strain warded against your main element, a boss on the way. After a landing, Lift Off recharges for 3 waves.', todo: 'Dock on the tower that answers the next wave. Read the road line in the preview: a shorter road means enemies arrive sooner. Move stranded towers instead of selling them.',
    real: 'In a run: dock where the next wave hurts most, then move towers into link reach.',
    run: { credits: 260, grid: 6, towers: ['pulse', 'rail', 'cryo'], pre: [['road', [['rail', 3, 0.78, 1], ['pulse', 2, 0.66], ['pulse', 2, 0.42]]]], waves: [[['drone', 6, 1.6, 1.4], ['tank', 2, 3.2, 1.2]]] } },
  { id: 'overcharge', title: 'Overcharge', blurb: 'Put spare power into one tower.',
    what: 'Overcharge spends spare power on a tower: +35% damage per step, 1 power per step.', when: 'When you have power left over and one tower doing most of the work.', todo: 'Open the tower panel and tap +1, +2 or +3. Tap the ⚡ readout to Overcharge your top tower in one go.',
    real: 'In a run: never leave power unused. Overcharge your best tower.',
    run: { credits: 300, grid: 5, towers: ['pulse', 'rail', 'cryo'], pre: [['towers', [['rail', 2], ['pulse', 1]]]], waves: [[['drone', 10, 0.9, 1.4], ['tank', 2, 2, 1]]] } },
  { id: 'abilities', title: 'Abilities and charges', blurb: 'Strike, Stasis, Frenzy, Nova and Scan.',
    what: 'Five abilities on the left rail, each on its own cooldown. Strike hits an area, Stasis freezes everything, Frenzy speeds up your towers, Nova damages every enemy, Scan reveals cloaked enemies and marks the biggest threat.', when: 'On a dense pack, a boss, or a wave that is leaking.', todo: 'Use them: a full charge slot wastes its timer. Crates and bosses add extra charges that stack.',
    real: 'In a run: spend charges on the waves that leak; they come back.',
    run: { start: 12, credits: 200, grid: 6, towers: ['pulse', 'rail', 'cryo'], abil: ['strike', 'nova', 'stasis', 'overclock', 'scan'], pre: [['towers', [['pulse', 3], ['rail', 3], ['cryo', 2]]], ['abil', ['strike', 'nova', 'stasis', 'overclock', 'scan'], 1]],
      waves: [[['swarmer', 16, 0.15, 0.8], ['phantom', 4, 1.4, 0.8], ['drone', 8, 0.7, 0.8]]] } },
  { id: 'swarm', title: 'The swarm adapts', blurb: 'Genes, the Threat Board, Arms Race and DNA.',
    what: 'The swarm breeds against your defence. Enemies that get furthest pass on their genes (Plating, Shell, Ward, Haste…). Marks on each enemy show its genes.', when: 'From Wave 8 on Normal. The Threat Board shows what it is breeding and why.', todo: 'Open the Threat Board between waves. When a gene climbs, build its counter. Mixing elements keeps it guessing.',
    real: 'In a run: when the Threat chip pulses, open it and answer the top gene.',
    run: { start: 10, credits: 500, grid: 6, towers: ['pulse', 'rail', 'cryo', 'missile', 'coil'], pre: [['towers', [['pulse', 3], ['pulse', 2], ['rail', 2]]]],
      waves: [[['drone', 12, 0.8, 0.8, { genes: ['plating'], share: 0.6 }], ['swarmer', 8, 0.25, 0.8, { genes: ['haste'], share: 0.5 }]], [['drone', 12, 0.8, 0.8, { genes: ['plating'], share: 0.7 }], ['tank', 2, 2, 0.6]]] } },
  { id: 'hunt', title: 'Bounties and the purse', blurb: 'Most Wanted, the Bounty Purse, Extract or jump.',
    what: 'Each run posts a Most Wanted boss. Killing it claims the bounty. Some of your XP rides in the Bounty Purse: Extract banks all of it and ends the run as a win; a jump door pushes into a new zone for a bigger purse. Fall later and you keep 30%.', when: 'Every 20 waves.', todo: 'Bank when the run feels shaky. Jump when your defence is strong: Steady, Hot and Deadly doors multiply the purse more.',
    real: 'In a run: extract when your last waves were close calls; jump when they were easy.',
    run: { start: 18, credits: 300, grid: 7, towers: ['pulse', 'rail', 'cryo'], boss: { id: 'behemoth', mod: 'hasted', hp: 4000, w: 2 }, pre: [['towers', [['rail', 4, 1], ['pulse', 4, 1], ['pulse', 3], ['cryo', 3]]]],
      waves: [[['drone', 10, 0.8, 0.5]], [['drone', 4, 1, 0.5], ['boss', 1, 3, 1]]] } },
  { id: 'salvage', title: 'Crates and salvage', blurb: 'Loot on the map, and the pirates who want it.',
    what: 'Drop ships leave crates on the map: credits, ability charges or tokens. They decay. Golden crates pay big; cursed ones bite.', when: 'From Wave 3, between and during waves.', todo: 'Tap a crate to claim it. A tower next to a crate collects it for you. Shoot down pirate skiffs before they fly off with one.',
    real: 'In a run: tap crates as they land, or build next to where they drop.',
    run: { credits: 200, grid: 4, towers: ['pulse', 'rail', 'cryo'], pre: [['towers', [['pulse', 2]]], ['cache']], waves: [[['drone', 6, 1.2, 1]]] } },
  { id: 'veterans', title: 'Veterans, affixes, resonance', blurb: 'Towers that earn ranks, and where to put them.',
    what: 'Towers that fight earn veteran ranks; each rank offers a mutation. Affixes are the bonuses a tower rolls on upgrades. Towers of different elements side by side resonate: +8% damage each.', when: 'Whenever the Ready button shows a count; whenever you place a tower.', todo: 'Tap Ready: it walks you through every waiting tower (a gold star marks each). Pick a mutation. Build mixed elements next to each other.',
    real: 'In a run: clear veteran picks between waves; pair Kinetic with Cryo or Arc side by side.',
    run: { credits: 300, grid: 5, towers: ['pulse', 'rail', 'cryo'], pre: [['towers', [['pulse', 2], ['cryo', 1]]], ['vet', 0]], waves: [[['drone', 8, 1, 1]]] } },
  { id: 'support', title: 'Pylon and Forge', blurb: 'Towers that never shoot.',
    what: 'The Relay Pylon boosts damage and attack speed of towers in its range and reveals cloaked enemies. The Credit Forge pays credits every wave.', when: 'Pylon: when towers are clustered. Forge: early in a long run.', todo: 'Build a Pylon in the middle of a cluster. Build Forges early; they pay for themselves in a few waves.',
    real: 'In a run: one Pylon per tower cluster; Forges before Wave 20.',
    run: { start: 12, credits: 500, grid: 6, towers: ['pulse', 'rail', 'cryo', 'pylon', 'forge'], pre: [['towers', [['pulse', 3], ['rail', 3]]]], waves: [[['drone', 10, 0.8, 0.6], ['phantom', 3, 1.5, 0.6]]] } },
  { id: 'storms', title: 'Storms and anomalies', blurb: 'Weather that boosts an element, and the Entropy gauge.',
    what: 'Storms drift across the map and boost one element: towers of that element inside fight harder. Kills fill the Entropy gauge; when it is full you draw an Anomaly, a permanent twist with an upside and a downside.', when: 'Storms from Wave 6. Anomalies whenever the gauge fills.', todo: 'Tap a storm chip to see what it boosts. Tap the full gauge and pick the Anomaly that suits your build, or Stabilize for score.',
    real: 'In a run: build into storms of your element; draw Anomalies that match your towers.',
    run: { start: 8, credits: 300, grid: 5, towers: ['pulse', 'rail', 'cryo', 'missile'], pre: [['towers', [['missile', 2], ['pulse', 2]]], ['storm', 'solar'], ['entropy', 100]], waves: [[['drone', 10, 0.9, 0.7]]] } },
  { id: 'wormholes', title: 'Wormholes and checkpoints', blurb: 'New roads, a bigger map, a breather.',
    what: 'Every so often a wormhole opens a new road and the map grows. Nothing can be built within 6 tiles of a wormhole. The wave before it lands is a checkpoint: full refunds and a free respec until you resume.', when: 'At set waves (Normal: 15, 28, 42…).', todo: 'At a checkpoint, move towers (or sell and rebuild) to cover the new road, then tap Next. Resuming fast pays a bonus.',
    real: 'In a run: at a checkpoint, move towers to cover both roads before you resume.',
    run: { credits: 400, grid: 6, towers: ['pulse', 'rail', 'cryo'], pre: [['towers', [['pulse', 2], ['pulse', 1]]], ['lane', 1]], waves: [[['drone', 6, 1.2, 1]], [['drone', 10, 0.9, 1]]] } },
  { id: 'assault', title: 'Strain Assaults', blurb: 'The swarm commits a whole wave to beat you.',
    what: 'Every few waves the swarm reads your defence and sends one strain built to beat it. It is announced a wave ahead, and selling is free (a refit) until it lands. Hold it and it breaks: +1 power and a bounty.', when: 'Normal: from Wave 14, every 8 waves.', todo: 'When the Threat chip turns red, open it, read the strain’s genes, and swap towers for their counters while selling is free.',
    real: 'In a run: red Threat chip means refit now, while selling is free.',
    run: { start: 14, credits: 600, grid: 7, towers: ['pulse', 'rail', 'cryo', 'missile', 'coil'], pre: [['towers', [['pulse', 3], ['pulse', 3], ['rail', 2]]], ['assault']], waves: [[['drone', 14, 0.6, 0.45], ['swarmer', 6, 0.3, 0.5]], [['drone', 6, 1, 0.4]]] } },
  { id: 'bosses', title: 'Bosses, boons and Nemesis', blurb: 'Every tenth wave, and what it pays.',
    what: 'A boss lands every 10 waves. It has phases and powers, and if it reaches the core the run ends. Killing one pays a boon: one of three permanent bonuses. A boss or strain that ends your run becomes your Nemesis and comes back next run.', when: 'Wave 10, 20, 30…', todo: 'Save Strike and Stasis for bosses. Plated bosses need Rail, Lens or Burn. Pick the boon that fits your build.',
    real: 'In a run: hold your abilities for the boss wave.',
    run: { start: 10, credits: 300, grid: 6, towers: ['pulse', 'rail', 'cryo'], abil: ['strike', 'stasis'], boss: { id: 'queen', hp: 2600 }, pre: [['towers', [['rail', 3], ['pulse', 3], ['pulse', 2], ['cryo', 2]]], ['abil', ['strike', 'stasis'], 1]], waves: [[['drone', 4, 1, 0.6], ['boss', 1, 3, 1]]] } },
  { id: 'market', title: 'Black Market and Cash In', blurb: 'What to do with banked credits.',
    what: 'From Wave 10 the Score button opens the Exchange: the Black Market sells three items (restocked after boss waves), and Cash In turns credits into score.', when: 'When credits pile up and the grid is full.', todo: 'Check the Market after each boss wave. Cash In only what you can’t spend on towers.',
    real: 'In a run: spend on towers first, the Market second, Cash In last.',
    run: { start: 12, credits: 2500, grid: 6, towers: ['pulse', 'rail', 'cryo'], pre: [['towers', [['pulse', 3], ['rail', 2]]]], waves: [[['drone', 8, 1, 0.6]]] } },
  { id: 'techniques', title: 'Techniques', blurb: 'Alternate fire modes from your talents.',
    what: 'A Technique is an alternate fire mode for one tower type, learned with a one-point talent. Each tower then has a Fire row: Standard or the Technique. It is a different job, not an upgrade.', when: 'After you learn one in Talents.', todo: 'Open a tower and switch its Fire mode. Mix: one Suppressor slows the pack, the Standard Pulses finish it.',
    real: 'In a run: switch one tower of a type to its Technique when the wave calls for that job.',
    need: () => typeof TOWER_FIRE !== 'undefined',
    run: { credits: 300, grid: 5, towers: ['pulse', 'rail', 'cryo'], build: { tal: { kSupp: 1 }, caps: [], remnants: [], lvl: 1 }, pre: [['towers', [['pulse', 2], ['pulse', 2]]]], waves: [[['drone', 8, 0.8, 1.2], ['swarmer', 8, 0.25, 1]]] } },
  { id: 'mastery', title: 'Ascend perks and Mastery', blurb: 'Past LV 5, and what each tower earns across runs.',
    what: 'Past LV 5 a tower Ascends: ×1.15 damage and a choice of three perks that change how it works (a forking beam, ricochets, shattering freezes). Every tower type also has a Mastery: 5 ranks earned across runs from its share of the damage.', when: 'Late in a run, when your best towers are maxed. Mastery: after every run.', todo: 'Ascend the tower doing the most work and pick the perk that fixes its weakness. Try different towers: Mastery pays most for towers that are not your top one.',
    real: 'In a run: pick a perk the moment the Ascend lands; between runs, check Mastery in the Archive.',
    need: () => typeof PERKS !== 'undefined',
    run: { start: 12, credits: 2600, grid: 5, towers: ['pulse', 'rail', 'cryo'], pre: [['towers', [['rail', 5, 1], ['pulse', 3]]]], waves: [[['drone', 10, 0.8, 0.8], ['tank', 2, 2, 0.8]]] } },
  { id: 'daily', title: 'Daily Hunt', blurb: 'One map, one build, everyone.', tour: 1,
    what: 'Every day has one Daily Hunt: the same map, zone, bounty and Nemesis for everyone, with a fixed talent build you set up for it. Your first run of the day is ranked.', when: 'Once a day, from the hangar.', todo: 'Spend the Hunt build’s points first, then start the ranked run. Watch the ranked run or share its code afterwards.',
    real: 'Every day: set the Hunt build, then play your ranked run.' },
  { id: 'meta', title: 'Talents and progression', blurb: 'XP, levels, Talents, Capstones, Supernova, the Archive.',
    what: 'Runs pay XP (from score and the Bounty Purse). Each level is a talent point. Seven trees: rows open every 3 points, a Capstone at 12 changes how you play. Supernova resets your talents for a permanent bonus. The Archive keeps what you have met.', when: 'Between runs.', todo: 'Spend points after each run. Go deep in one tree for its Capstone. Check the Archive’s Swarm Collection.',
    real: 'Between runs: spend your points, then pick a zone and go.', tour: 1 },
];
const LESSON_BY = Object.fromEntries(LESSONS.map(L => [L.id, L]));
const lessonsOpen = () => LESSONS.filter(L => !L.stub && (!L.need || L.need()));
const NEMESIS_CRIME = ['the fall of your last core','breaking and entering (your core)', 'gloating', 'returning to the scene of the crime', 'holding a grudge'];

// ---------- v4.4 Red Alert: a boss within this many tiles of the core puts the core on Last Stand (shells hit it much harder) ----------
const RED_ALERT = { tiles: 8, coreDmg: 2.5, coreRate: 1.6 };
const BOSS_HOLD = 45; // seconds the next wave's countdown runs slow while a boss is still on the field
// ---------- v4.4 The Black Market: a pirate trader with 3 items in stock, restocked after every boss wave ----------
// Prices scale with the wave, so late-run credits (Nic banks 25–60k) have somewhere to go. Each item sells once per stock.
const MARKET = { slots: 3, refresh: 10, price: (base, w) => Math.round(base * (1 + 0.11 * Math.max(1, w))) };
const MARKET_ITEMS = [
  { id: 'schematic', name: 'Forbidden Schematic', desc: 'Your next 2 towers roll a Legendary affix', base: 240, col: '#ff8a2a' },
  { id: 'blueprint', name: 'Stolen Blueprint', desc: 'Unlocks your next locked tower for this run', base: 170, col: '#6ae2ff' },
  { id: 'bribe', name: 'Boss Bribe', desc: 'The next boss arrives at 70% health. Even the Auditor takes bribes', base: 260, col: '#ffd84a' },
  { id: 'beacon', name: 'Node Beacon', desc: 'Tap an empty tile: it becomes a Power Node', base: 480, col: '#6ae2ff', max: 2 },
  { id: 'crate', name: 'Ability Crate', desc: '+1 charge of every ability', base: 150, col: '#ffe14d' },
  { id: 'tokens', name: 'Recalibration Kit', desc: '+2 Recalibration tokens', base: 80, col: '#59f0b4' },
  { id: 'starmap', name: 'Fake Star Map', desc: 'The swarm forgets what it learned: evolution starts over and the next Strain Assault is pushed back 3 waves', base: 220, col: '#b86cff' },
  { id: 'mutagen', name: 'Mutagen Vial', desc: 'Every tower gains a random affix', base: 300, col: '#ff9ad5' },
  { id: 'medal', name: 'Battle Medal', desc: 'Your top-damage tower gains a Veteran rank', base: 190, col: '#ffe14d' },
  { id: 'recharge', name: 'Spare Nuke', desc: 'Rearms the Nuke after you have used it', base: 900, col: '#59f0b4' },
];
const MARKET_LINES = ['No refunds. Ever.', 'Fell off a freighter', "Don't ask where it's from", 'Cash only. Space cash', 'You never bought this', 'Warranty void in all galaxies', 'Pleasure doing crimes with you', 'Restocked after the boss', 'Prices go up. Always up', 'Tell your friends. Not the authorities'];
// Core Battery (v1.20): a long-range support gun. Weak per shot early; the expensive late levels make it a real weapon.
const CORE_GUN = { dmg: 12, growth: 1.5, rate: 0.8, range: 16, rangeLv: 1.4, splash: 0.6, maxLv: 12 };
const CORE_MODULES = [
  { lv: 4, id: 'twin', name: 'Twin Battery', desc: 'Fires a second shell at the next target' },
  { lv: 8, id: 'siege', name: 'Siege Shells', desc: '+0.6 blast radius, +25% damage to elites and bosses' },
  { lv: 12, id: 'orbital', name: 'Orbital Uplink', desc: 'Every 5th volley calls a strike on the toughest enemy in range' },
];
const CURSES = [
  { id: 'cdmg', t: () => '−15% Damage' },
  { id: 'crate', t: () => '−15% Attack Speed' },
  { id: 'crange', t: () => '−15% Range' },
  { id: 'jam', t: () => '5% chance to jam for 1s' },
  { id: 'unstable', t: () => '10% of attacks misfire' },
];

// ---------- Enemies ----------
// v5.1 Know Your Enemy: every enemy says what it does (desc) and what beats it (beat). Four late enemies arrive from Wave 18,
// each announced the wave before it lands
const ENEMIES = {
  drone:    { name: 'Drone', hp: 30, spd: 1.15, cr: 4, leak: 4, from: 1, w: 10, desc: 'Basic ground unit', beat: 'Anything. They add up in numbers' },
  swarmer:  { name: 'Swarmer', hp: 11, spd: 1.8, cr: 2, leak: 2, from: 2, w: 7, group: 4, desc: 'Fast and fragile. Arrives in groups', beat: 'Splash: Swarm Missile, Flamethrower, Arc Coil' },
  tank:     { name: 'Juggernaut', hp: 150, spd: 0.6, cr: 12, leak: 12, from: 3, w: 4, armor: 0.35, desc: 'Slow and heavily Plated: only piercing fire (Rail, Void Lens, Burn) gets through fully', beat: 'Rail Lance, Void Lens or Burn' },
  flyer:    { name: 'Skimmer', hp: 38, spd: 1.2, cr: 6, leak: 6, from: 4, w: 5, fly: 1, res: { A: -0.25 }, desc: 'Flies straight at the core. Weak to Arc', beat: 'Arc, Pulse, Rail. Flame and Gravity can\'t reach it' },
  splitter: { name: 'Splitter', hp: 80, spd: 0.85, cr: 8, leak: 8, from: 6, w: 4, desc: 'Splits into 3 Swarmers on death', beat: 'Splash to clean up the Swarmers it bursts into' },
  phantom:  { name: 'Phantom', hp: 52, spd: 1.25, cr: 8, leak: 6, from: 7, w: 4, cloak: 1, res: { V: -0.3 }, desc: 'Cloaks periodically: towers can\'t target it while it flickers out. Weak to Void', beat: 'Relay Pylon or Sensor Sweep to reveal it; Void hits it hard' },
  medic:    { name: 'Mender', hp: 70, spd: 0.95, cr: 10, leak: 8, from: 9, w: 3, desc: 'Heals nearby enemies every second (green beams)', beat: 'Kill it first: Rail or Strike. Burn stops all healing' },
  shielder: { name: 'Aegis', hp: 90, spd: 0.85, cr: 10, leak: 10, from: 12, w: 3, res: { K: 0.2 }, desc: 'Shields nearby enemies (blue rings). Resists Kinetic', beat: 'Arc tears shields at 3×' },
  reflector: { name: 'Reflector', hp: 120, spd: 0.85, cr: 13, leak: 10, from: 18, w: 3, refl: 0.75, desc: 'Mirrored hull: Pulse bolts, Void Lens beams and Arc chains glance off it (−75%)', beat: 'Rail Lance, Swarm Missile, Flamethrower, EMP Mortar' },
  carrier:  { name: 'Carrier', hp: 280, spd: 0.5, cr: 34, leak: 16, from: 22, w: 1.4, fly: 1, drops: 1, desc: 'A flying mothership. Drops a pair of Drones every few seconds until it falls', beat: 'Burst anti-air (Rail, Missile, Pulse) before it unloads' },
  sapper:   { name: 'Sapper', hp: 70, spd: 1.05, cr: 11, leak: 6, from: 26, w: 2.5, sap: 1, desc: 'Plants a charge on a tower it passes: that tower is knocked out for 4s', beat: 'Kill it at range (Rail, Missile, the core) or slow it before it reaches your line' },
  leech:    { name: 'Leech', hp: 55, spd: 1.35, cr: 8, leak: 2, from: 30, w: 2.5, leech: 1, desc: 'Steals credits if it reaches the core, more the more you have banked', beat: 'Anything that kills it before the core. Spend what you bank' },
  pirate: { name: 'Pirate Skiff', hp: 70, spd: 1.5, cr: 10, leak: 0, from: 9999, w: 0, fly: 1, desc: 'Swoops in to steal unclaimed salvage. Shoot it down to recover the loot. Never attacks the core', beat: 'Anti-air before it escapes' },
  voidling: { name: 'Voidling', hp: 25, spd: 1.6, cr: 1, leak: 4, from: 999, w: 0, fly: 1, desc: 'Flies. Spawned by a Maelstrom', beat: 'Arc and anti-air' },
};
// v5.1: the drone a Carrier drops (a flying Drone, smaller)
const CARRIER = { every: 4.5, n: 2, hp: 0.1 };
const SAPPER = { range: 1.6, dur: 4, cd: 7 };
const LEECH = { share: 0.1, cap: w => 60 + 18 * w };
// what each boss's empowered ability does at a phase change (shown in the phase toast and the intro card)
const BOSS_POWER = { behemoth: 'a quake and a swarm', queen: 'a skimmer storm', wraith: 'a long phase-jump', overmind: 'a massive EMP',
  titan: 'a shattering stomp', cat: 'the zoomies', whale: 'a healing chorus', duck: 'a mega-quack', fsm: 'every noodle at once',
  worm: 'a feeding frenzy', auditor: 'a full audit', snail: 'a second wind' };
// ---------- v3.0: the power grid ----------
// Every tower draws 1 power (towers on Power Nodes draw none). Capacity grows with the wave. Spare power can Overcharge a tower.
const GRID = { base: 8, perWaves: 3, max: 46 };
const OVERCHARGE = { max: 3, dmg: 0.35, rate: 0.15 };
// ---------- v3.0: the evolving swarm ----------
// Ordinary enemies carry genes. Each gene is a trade: an edge for some HP or speed. Waves are bred from the genomes that got
// furthest last time, so the swarm drifts towards whatever your defence handles worst. Every gene has a counter tower.
const GENES = {
  plating: { name: 'Plating', col: '#c8ccd8', hp: 0.75, desc: 'Blunts all but piercing fire', counter: 'Rail, Void Lens, Burn' },
  wings:   { name: 'Wings', col: '#9ad8ff', hp: 0.4, spd: 0.65, from: 16, desc: 'Flies over ground defences', counter: 'anti-air (not Flame or Gravity)' },
  haste:   { name: 'Haste', col: '#ffe14d', hp: 0.7, spd: 1.4, desc: '+40% speed', counter: 'Cryo, Gravity, EMP, Snare' },
  bulk:    { name: 'Bulk', col: '#ff7b39', hp: 1.4, spd: 0.75, desc: '+40% HP, slower', counter: 'Void Lens, Rail' },
  brood:   { name: 'Brood', col: '#ff9ad5', hp: 0.7, desc: 'Bursts into 3 mites', counter: 'Missile, Flame, Coil' },
  shell:   { name: 'Shell', col: '#7fd4ff', hp: 0.65, desc: 'Shield worth 60% of HP. It recharges when left alone, unless Arc has hit it in the last 3s', counter: 'Arc Coil, EMP' },
  regen:   { name: 'Regrowth', col: '#59f0b4', hp: 0.75, desc: 'Heals 2.5%/s unless Burning', counter: 'Flame, Missile' },
  ward:    { name: 'Ward', col: '#d6a6ff', hp: 0.85, desc: '50% resist to one element', counter: 'any other element' },
  cloak:   { name: 'Cloak', col: '#b86cff', hp: 0.75, from: 12, desc: 'Cloaks on and off', counter: 'Relay Pylon' },
};
const GENE_IDS = Object.keys(GENES);
// Swarm Codex: every evolved strain gets a name
const GENE_ADJ = { plating: 'Plated', wings: 'Winged', haste: 'Zippy', bulk: 'Chonky', brood: 'Broody', shell: 'Bubbled', regen: 'Unkillable', cloak: 'Sneaky' };
const WARD_ADJ = { K: 'Bulletproof', T: 'Fireproof', C: 'Frostproof', A: 'Insulated', V: 'Grounded' };
const SPECIES_NICK = { drone: 'Drone', swarmer: 'Gremlin', tank: 'Juggernaut', flyer: 'Skimmer', splitter: 'Splitter', phantom: 'Phantom', medic: 'Mender', shielder: 'Aegis' };
const STRAIN_COMBO = { 'haste+wings': 'Zoomwing', 'bulk+plating': 'Fortress', 'brood+bulk': 'Momma', 'cloak+haste': 'Ninja', 'regen+shell': 'Immortal-ish', 'plating+wings': 'Gunship',
  'brood+wings': 'Swarmcarrier', 'cloak+wings': 'Ghostbird', 'bulk+regen': 'Troll', 'haste+shell': 'Bumper Car', 'brood+cloak': 'Surprise Party', 'bulk+haste': 'Freight Train' };
function strainName(type, genes, el) {
  const g = genes.slice().sort(), sp = SPECIES_NICK[type] || (ENEMIES[type] ? ENEMIES[type].name : type);
  for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) { const c = STRAIN_COMBO[g[i] + '+' + g[j]]; if (c) { const rest = g.filter((x, k) => k !== i && k !== j).map(x => x === 'ward' ? WARD_ADJ[el] || 'Warded' : GENE_ADJ[x]); return (rest.length ? rest.join(' ') + ' ' : '') + c + ' ' + sp; } }
  return g.map(x => x === 'ward' ? WARD_ADJ[el] || 'Warded' : GENE_ADJ[x]).join(' ') + ' ' + sp;
}
// v5.8 the visible swarm. A gene's share of the next wave reaches tiers (I 20%, II 35%, III 50%). Each tier gained in a run is
// logged (recap timeline), announced between waves and shown on the Threat Board's Arms Race strip.
const GENE_TIERS = [0.2, 0.35, 0.5];
const geneTier = v => v >= GENE_TIERS[2] ? 3 : v >= GENE_TIERS[1] ? 2 : v >= GENE_TIERS[0] ? 1 : 0;
// what each gene exploits in a defence, in a few words (Arms Race strip)
const GENE_VS = { plating: 'fire that can\'t pierce', wings: 'ground-only towers', haste: 'a lack of slows', bulk: 'light damage', brood: 'single-target fire',
  shell: 'a lack of Arc', regen: 'a lack of Burn', ward: 'one-element builds', cloak: 'a lack of Relay Pylons' };
// a Strain Assault's family colour (the outline on every unit of that assault), from its genes
const STRAIN_COLS = ['#ff4d6a', '#ff8a3d', '#e05cff', '#4dffd2', '#ffd24d', '#7a8cff', '#ff5cb0', '#9dff4d'];
function strainCol(genes) { let h = 7; for (const ch of (genes || []).slice().sort().join('+')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return STRAIN_COLS[h % STRAIN_COLS.length]; }
// Swarm Collection (Archive): every species that can evolve × every gene it can carry × the genome size it was seen in
// (I alone, II in a pair, III in a triple or more), plus the named pairs of STRAIN_COMBO. Finite, so it can be completed.
const COLL_SPECIES = Object.keys(ENEMIES).filter(k => ENEMIES[k].from < 999);
// v4.4: hp is also the fight-time budget (boss HP = firepower × seconds × hp/38). Fast bosses reach the core in ~40 s (duck, wraith) against ~95 s for
// Behemoth, so their hp is set lower to keep the required fire density about the same (hp / road seconds ≈ 0.4 for most).
const BOSSES = [
  { id: 'behemoth', name: 'Behemoth', hp: 40, spd: 0.45, armor: 0.3, size: 2, desc: 'Spawns Swarmers' },
  { id: 'queen', name: 'Hive Queen', hp: 30, spd: 0.6, fly: 1, size: 2, desc: 'Flies. Spawns Skimmers' },
  { id: 'wraith', name: 'Phase Wraith', hp: 22, spd: 0.7, size: 2, desc: 'Teleports forward and cloaks' },
  { id: 'overmind', name: 'Overmind', hp: 36, spd: 0.5, size: 2, desc: 'Disables nearby towers' },
  { id: 'titan', name: 'Titan', hp: 52, spd: 0.4, armorAll: 0.5, size: 2, desc: 'Armor breaks at 66% and 33% HP' },
  // oddballs: random stand-ins on boss waves
  { id: 'cat', odd: 1, tip: 'Shreds towers, naps', name: 'Leia', hp: 38, spd: 0.55, size: 2, desc: 'Shreds nearby towers offline like they\'re the couch. Naps mid-lane, and takes far less damage while asleep',
    titles: ['Destroyer of Couches', 'Shredder of Upholstery', 'Knocker of Things Off Tables', 'Sits On Your Keyboard', 'Not Sorry', 'Who Is A Good Girl (Not Her)'] }, // 6.0.2: Nic's cat Leia (was Mr. Whiskers)
  { id: 'gloop', odd: 1, tip: 'Splits when popped', name: 'Gloop', hp: 42, spd: 0.5, size: 2, desc: 'Splits into two smaller Gloops on death. Twice',
    titles: ['The Unbothered', 'Lord of the Leftovers', 'It Came From The Fridge', 'Mostly Water'] },
  { id: 'whale', odd: 1, tip: 'Flies, heals allies', name: 'Space Whale', hp: 58, spd: 0.32, fly: 1, size: 2, desc: 'Flies. Its song heals every enemy nearby',
    titles: ['Singer of the Deep Void', 'Big Blue', 'Krill Enthusiast', 'Just Passing Through'] },
  { id: 'duck', odd: 1, tip: 'Hops, startles towers', name: 'Quackzilla', hp: 17, spd: 0.85, size: 2, desc: 'Fast. Every quack hops it forward and startles towers nearby',
    titles: ['Bath Time Is Over', 'The Rubber Reckoning', 'Squeaks When Hit', 'Unsinkable'] },
  { id: 'fsm', odd: 1, tip: 'Flies, seizes towers', name: 'Flying Spaghetti Monster', hp: 40, spd: 0.5, fly: 1, size: 2, desc: 'Flies. Noodly appendages seize towers. Drops meatballs',
    titles: ['His Noodly Appendage', 'Al Dente', 'Touched By Marinara', 'Pastafarian Prophecy'] },
  { id: 'worm', odd: 1, from: 15, tip: 'Burrows, swallows towers', name: 'Wormhole Worm', hp: 26, spd: 0.45, size: 2, desc: 'Burrows through wormholes and resurfaces further down the road, swallowing towers. Sometimes it hunts your best one. Kill it to get them back',
    titles: ['Eater of Turrets', 'Long Boi', 'The Hungry Hyperspace', 'Has Too Many Legs'] },
  { id: 'auditor', odd: 1, from: 10, tip: 'Drains credits', name: 'The Auditor', hp: 30, spd: 0.55, size: 2, desc: 'Drains your credits while alive and freezes your best towers pending review. Kill him for a full refund, plus interest',
    titles: ['Department of Intergalactic Revenue', 'Your Receipts, Please', 'Itemized Deductions', 'Form 1040-Z'] },
  { id: 'snail', odd: 1, from: 25, tip: 'Slow, tough, heals', name: 'The Immortal Snail', hp: 70, spd: 0.16, size: 2, desc: 'Barely moves. Barely dies. Heals whenever you stop shooting, and its slime trail speeds up everything behind it',
    titles: ['It Is Coming', 'Patience Incarnate', 'One Touch And You Die', 'Inevitable, Eventually'] },
];
const ELITE_AFFIXES = [
  { id: 'shielded', name: 'Shielded', col: '#7fd4ff' , desc: 'Starts with a shield worth 40% of max HP' },
  { id: 'hasted', name: 'Hasted', col: '#ffe14d' , desc: '+40% speed' },
  { id: 'regen', name: 'Regenerating', col: '#59f0b4' , desc: 'Regenerates 2% HP per second' },
  { id: 'blink', name: 'Teleporting', col: '#b86cff' , desc: 'Teleports forward every 5s' },
  { id: 'split', name: 'Splitting', col: '#ff9ad5' , desc: 'Splits into 2 copies with 30% HP on death' },
  { id: 'jugg', name: 'Unstoppable', col: '#ff7b39' , desc: '+30% HP. Slows and Stuns are 70% weaker' },
  { id: 'volatile', name: 'Volatile', col: '#ff4d6a' , desc: 'Disables nearby towers for 2s on death' },
  { id: 'resist', name: 'Resistant', col: '#efe6cf' , desc: '+50% resistance to one element' },
];

// ---------- Storms (weather) ----------
const STORMS = {
  ion:    { name: 'Ion Storm', el: 'A', col: '#ffe14d', desc: '+40% Arc Damage' },
  solar:  { name: 'Solar Flare', el: 'T', col: '#ff7b39', desc: '+40% Thermal Damage' },
  cryo:   { name: 'Cryo Front', el: 'C', col: '#6ae2ff', desc: '+40% Cryo Damage. Slows enemies' },
  void:   { name: 'Void Tide', el: 'V', col: '#b86cff', desc: '+40% Void Damage. Enemies take +10% damage' },
  static: { name: 'Static Haze', el: 'K', col: '#a59f92', desc: '+40% Kinetic Damage, −15% Range' },
};
const STORM_KEYS = Object.keys(STORMS);
const COMBO_STORMS = {
  'ion+solar': 'Plasma Tempest', 'cryo+solar': 'Frostfire Vortex', 'cryo+ion': 'Superconductor Front',
  'ion+void': 'Event Squall', 'solar+void': 'Dark Corona', 'cryo+void': 'Absolute Drift',
  'ion+static': 'Railstorm', 'solar+static': 'Cinder Gale', 'cryo+static': 'Hailfront', 'static+void': 'Null Static',
};

// ---------- Chaos events ----------
const EVENTS = [
  { id: 'surge', name: 'Surge', good: 0, w: 10, from: 5, desc: '+35% enemy speed' },
  { id: 'emp', name: 'EMP Storm', good: 0, w: 8, from: 8, desc: 'Towers randomly shut down' },
  { id: 'breach', name: 'Rift Breach', good: 0, w: 8, from: 6, desc: 'Enemies spawn mid-path' },
  { id: 'swarm', name: 'Swarm Tide', good: 0, w: 8, from: 5, desc: '60% more enemies at 60% HP' },
  { id: 'elite', name: 'Elite Tide', good: 0, w: 6, from: 10, desc: 'More Elites (up to 6 in 10)' },
  { id: 'blackout', name: 'Blackout', good: 0, w: 6, from: 12, desc: '−20% tower Range' },
  { id: 'regen', name: 'Nanite Bloom', good: 0, w: 6, from: 14, desc: 'Enemies regenerate HP' },
  { id: 'phase', name: 'Phase Shift', good: 0, w: 6, from: 16, desc: 'Enemies teleport forward' },
  { id: 'gold', name: 'Gold Rush', good: 1, w: 7, from: 5, desc: '×2 Credits' },
  { id: 'overcharge', name: 'Overcharge', good: 1, w: 6, from: 5, desc: '+30% Attack Speed' },
  { id: 'meteor', name: 'Meteor Shower', good: 1, w: 6, from: 7, desc: 'Meteors strike the path' },
  { id: 'hole', name: 'Black Hole', good: 0, w: 5, from: 10, fr: 5, desc: 'Drifts in for 30s. Drags and slows enemies. Towers at its edge +40% Attack Speed, near its centre −50%',
    long: 'Drifts in from past the sector edge, stays 30s, then collapses. Enemies within 6 tiles slow down, up to 50% at the centre. It drags them along the road toward it. Towers 2.5 to 6 tiles away: +40% Attack Speed. Towers within 2.5 tiles: −50%. Bosses feel half' },
];
// 6.5 (FR_VER 5, G.frV >= 5): the Black Hole event (fr: 5 keeps it out of older rules, so their event rolls are unchanged).
// It drifts in from past the sector edge to a point on a road, hangs there drifting slowly, then collapses. Inside its reach:
// enemies are slowed (time dilation, strongest at the centre) and dragged along the road toward it (faster on the way in,
// slower on the way out; they never leave the road). Towers in the ring (horizon to reach) fire faster, towers inside the
// horizon slower. Bosses feel half of every enemy effect
const HOLE = {
  r: 6, horizon: 2.5,            // reach and event horizon, in tiles
  ring: 0.4, inner: -0.5,        // tower Attack Speed: +40% from 2.5 to 6 tiles, −50% inside 2.5
  dil: 0.5,                      // enemies at the centre move and act 50% slower (falling to 0 at the reach)
  pull: 0.6, floor: 0.25,        // along-road drag: up to ±60% speed toward / away from the centre; never under 25% of normal speed
  boss: 0.5,                     // bosses: half of the dilation and the drag
  inSpd: 1.2, off: 3,            // drifts in at 1.2 tiles/s from 3 tiles past the sector edge
  hold: 30, drift: 0.12, out: 1.5, // then 30 s at 0.12 tiles/s, then a 1.5 s collapse
};
// 6.5 (FR_VER 5) fog of war: presentation only (the sim never reads it). Vision comes from the core (its gun range, at least
// FOG.core tiles), every tower (its range + FOG.pad, at least FOG.tower) and the probe (G.probe.vis). G.fogEx remembers explored
// tiles (sim.js fogTick, every FOG.every ticks); roads are always known
const FOG = { core: 10, tower: 4, pad: 1.5, every: 15 };

// ---------- Abilities ----------
// v5.1: abilities recharge on a cooldown into charge slots (1 each, more from Command talents). Charges from crates, chests
// and bosses stack on top with no limit. `from`: the wave an ability comes online, so a new player meets them one at a time
const ABILITIES = {
  strike: { name: 'Orbital Strike', key: 'ORB', short: 'Strike', desc: 'Tap a target. Heavy area damage.', target: 1, cd: 45, from: 1 },
  nova: { name: 'Entropy Nova', key: 'NOV', short: 'Nova', desc: 'All enemies lose 35% HP (Bosses 10%).', cd: 210, from: 12 },
  stasis: { name: 'Stasis Field', key: 'STS', short: 'Stasis', desc: 'Freezes all enemies for 4s.', cd: 110, from: 4 },
  overclock: { name: 'Frenzy', key: 'FRZ', short: 'Frenzy', desc: '+100% Attack Speed for 8s.', cd: 90, from: 9 },
  scan: { name: 'Sensor Sweep', key: 'SCN', short: 'Scan', desc: 'Reveals cloaked enemies for 8s, Marks everything it sweeps (+15% damage taken) and flags the biggest threat.', cd: 30, from: 7 },
};
const ABIL_ORDER = ['strike', 'nova', 'stasis', 'overclock', 'scan'];
const SCAN = { dur: 8, mark: 15 };
// v5.1 Command Uplink: a core upgrade line. Every level cuts ability cooldowns; milestone levels change how abilities work
const UPLINK = { max: 9, cd: 5, base: 160, growth: 1.55, mods: [
  { lv: 3, id: 'double', name: 'Double Tap', desc: 'Orbital Strike hits the same spot twice' },
  { lv: 6, id: 'drag', name: 'Undertow', desc: 'Enemies leave Stasis slowed 40% for 4s' },
  { lv: 9, id: 'echo', name: 'Nova Echo', desc: 'Entropy Nova pulses again 1.5s later at half strength' }] };
// v5.1.3 Core Hull: a late money sink that buys safety. Each level +12% max hull and −5% damage from every leak
const HULL = { max: 10, hp: 12, guard: 5, base: 400, growth: 1.55 };
const MILESTONE_BUFFS = [
  { k: 'dmg', v: 4, t: '+4% Damage' }, { k: 'rate', v: 4, t: '+4% Attack Speed' },
  { k: 'range', v: 3, t: '+3% Range' }, { k: 'critC', v: 2, t: '+2% Crit Chance' },
  { k: 'credits', v: 4, t: '+4% Credits' }, { k: 'coreHP', v: 8, t: '+8 core HP' },
];

// ---------- Boss draft boons ----------
const BOONS = [
  { id: 'b_dmg', name: 'Amplified Grid', desc: '+12% Damage', m: { dmg: 12 } },
  { id: 'b_rate', name: 'Hyperthreading', desc: '+10% Attack Speed', m: { rate: 10 } },
  { id: 'b_cred', name: 'Salvage Rights', desc: '+20% Credits', m: { credits: 20 } },
  { id: 'b_crit', name: 'Targeting Suite', desc: '+10% Crit Chance', m: { critC: 10 } },
  { id: 'b_chain', name: 'Arc Lattice', desc: '+1 Chain for all chaining attacks', m: { chain: 1 } },
  { id: 'b_storm', name: 'Weather Control', desc: '+40% storm effects', m: { stormPow: 40 } },
  { id: 'b_core', name: 'Core Rebuild', desc: '+25% core max HP. Fully repairs the core', special: 'core' },
  { id: 'b_tokens', name: 'Recalibration Cache', desc: '+2 Recalibration tokens and 1 random ability charge', special: 'tokens' },
  { id: 'b_legend', name: 'Forbidden Schematic', desc: 'Your next 3 towers roll a Legendary affix', special: 'legend' },
  { id: 'b_affix', name: 'Mutation Pulse', desc: 'All towers gain a random affix', special: 'mutate' },
  { id: 'b_reroll', name: 'Cheap Dice', desc: 'Rerolls cost 50% less', special: 'reroll' },
  { id: 'b_cash', name: 'War Chest', desc: 'Gain 25 credits per wave reached', special: 'cash' },
  { id: 'b_grid', name: 'Spare Reactor', desc: '+2 power for the rest of the run', special: 'grid' },
];

const CHAOS_LEVELS = [
  { name: 'Calm', ev: 0.5, storm: 0.6, elite: 0.8, score: 0.8, hp: 0.7, rows: 22, lanes: [16, 30, 46, 64], evo: { start: 12, press: 0.6, first: 18, every: 10, desc: 'Gentle evolution from Wave 12. Strain Assaults every 10 waves' } },
  { name: 'Normal', ev: 1, storm: 1, elite: 1, score: 1, hp: 1, rows: 26, lanes: [15, 28, 42, 58, 78], evo: { start: 8, press: 1, first: 14, every: 8, desc: 'Evolution from Wave 8. Strain Assaults every 8 waves' } },
  { name: 'Unstable', ev: 1.5, storm: 1.5, elite: 1.25, score: 1.35, hp: 1.15, rows: 30, lanes: [12, 24, 36, 50, 66, 84], evo: { start: 6, press: 1.25, seed: 1, first: 12, every: 7, desc: 'The swarm arrives adapted to one weakness; evolution from Wave 6, fiercer. Strain Assaults every 7 waves' } },
  { name: 'Pandemonium', ev: 2.5, storm: 2.5, elite: 1.6, score: 1.8, hp: 1.5, cr: 0.8, rows: 34, lanes: [1, 10, 20, 32, 46, 62, 80, 100], evo: { start: 4, press: 1.5, seed: 2, capAdd: 1, first: 9, every: 6, desc: 'The swarm arrives adapted to two weaknesses; evolution from Wave 4, fiercest, one extra gene. Strain Assaults every 6 waves' } },
];

// ---------- Passive web ----------
const ATTR = { P: 'Power', Tm: 'Tempo', F: 'Focus', I: 'Integrity' };
const STAT_TXT = {
  dmg: v => `+${v}% Damage`, dmgK: v => `+${v}% Kinetic Damage`, dmgT: v => `+${v}% Thermal Damage`,
  dmgC: v => `+${v}% Cryo Damage`, dmgA: v => `+${v}% Arc Damage`, dmgV: v => `+${v}% Void Damage`,
  rate: v => `+${v}% Attack Speed`, rateK: v => `+${v}% Kinetic Attack Speed`, rateA: v => `+${v}% Arc Attack Speed`,
  range: v => `+${v}% Range`, rangeKR: v => `+${v}% Range for Pulse Blaster and Rail Lance`,
  critC: v => `+${v}% Crit Chance`, critM: v => `+${v}% Crit Damage`,
  P: v => `+${v} Power`, Tm: v => `+${v} Tempo`, F: v => `+${v} Focus`, I: v => `+${v} Integrity`,
  burnDmg: v => `+${v}% Burn damage`, burnChance: v => `+${v}% chance to Burn`,
  chillChance: v => `+${v}% chance to Chill`, shockChance: v => `+${v}% chance to Shock`,
  markChance: v => `+${v}% chance to Mark`, burnDur: v => `+${v}% Burn duration`,
  chillPot: v => `+${v}% Chill strength`, freezeDur: v => `+${v}s Freeze duration`,
  shockEff: v => `+${v}% Shock effect`, markMax: v => `+${v} max Mark stacks`,
  splash: v => `+${v} Splash radius`, chain: v => `+${v} Chain`,
  pierceK: v => `+${v} Pierce for Kinetic towers`, costRed: v => `−${v}% tower cost`,
  upgRed: v => `−${v}% upgrade cost`, credits: v => `+${v}% Credits`, startCredits: v => `+${v} starting credits`,
  coreHP: v => `+${v} core HP`, shield: v => `+${v} core shield`, shieldRegen: v => `+${v}% shield regen`,
  coreDmg: v => `+${v}% core Damage`, coreRate: v => `+${v}% core Attack Speed`, coreRange: v => `+${v} core Range`,
  abilCharge: v => `−${v}% ability cooldowns`, abilPower: v => `+${v}% ability power`, abilSlots: v => `+${v} charge slot${v > 1 ? 's' : ''} for every ability`,
  stasisDur: v => `+${v}s Stasis duration`, stormFreq: v => `+${v}% storm frequency`, stormPow: v => `+${v}% storm effects`,
  affixLuck: v => `+${v}% affix rarity`, shatter: v => `+${v}% Shatter damage`, overload: v => `+${v}% Overload damage`,
  overloadRad: v => `+${v}% Overload radius`, superRad: v => `+${v}% Superconduct radius`, collapse: v => `+${v}% Collapse damage`,
  armorPen: v => `Ignores ${v}% of Armor`, eliteDmg: v => `+${v}% Damage to Elites and Bosses`,
  frozenVuln: v => `Frozen enemies take +${v}% damage`, knock: v => `${v}% chance to knock back`,
  xp: v => `+${v}% XP`, chainIgnite: () => 'Burning enemies spread Burn on death',
  loneWolf: v => `+${v}% Damage for towers with no neighbors`,
  critSplash: v => `Kinetic crits deal ${v}% of their damage to enemies within 1 tile`,
  fifthCrit: () => 'Every 5th Kinetic attack is a guaranteed crit',
  shredStack: v => `Kinetic hits make Elites and Bosses take +${v}% damage, stacking to +30%`,
  pierceKeep: () => 'Kinetic pierce and bounces lose no damage', critCK: v => `+${v}% Crit Chance for Kinetic towers`, critMK: v => `+${v}% Crit Damage for Kinetic towers`,
  kSlow: v => `Kinetic hits slow enemies by ${v}% for 1s`,
  burnVuln: v => `Burning enemies take +${v}% damage`, burnBoom: v => `Burning enemies explode on death for ${v}% of their max HP`,
  burnSpread: () => 'Every second, Burn spreads to the nearest enemy within 1 tile', infernoCore: () => '×2 Burn damage, −40% Burn duration',
  heatSink: () => 'Thermal towers: +2% Attack Speed per Burning enemy, up to +40%',
  capacitor: () => 'Arc towers charge for 4s; their next attack deals ×3 damage', chainKeep: () => 'Chain jumps lose no damage',
  shockBurst: v => `Shocked enemies discharge on death for ${v}% of their max HP as Arc damage`,
  shockLong: () => 'Shock lasts 6s instead of 3s', thunder: () => 'Every 6s, lightning strikes the toughest enemy on the map', ovlFree: () => 'Overload has no cooldown',
  freezeAt: () => 'Freeze triggers at 4 Chill stacks instead of 5', iceShards: () => 'Frozen enemies shatter on death and Chill nearby enemies twice',
  chillSplash: () => 'Cryo hits also Chill enemies within 1 tile', chillSlowDecay: () => 'Chill fades 3× slower',
  coldSnap: () => 'Shatter also Freezes enemies within 1 tile', glacial: v => `Chilled enemies move an extra ${v}% slower`,
  markSlow: v => `Enemies at max Marks move ${v}% slower`, rampKeep: () => 'Void beams keep their ramp when switching targets',
  knockMark: () => 'Knockbacks also apply 2 Marks', blackHole: () => 'Collapse radius ×2 and pulls enemies back further',
  markPerma: () => 'Marks never fade', voidSiphon: () => 'Each Collapse fills the Entropy gauge',
  shieldWave: () => 'Core shield fully recharges at the start of each wave', sellPct: v => `Selling refunds ${v}%`,
  quarter: () => 'Ability charges from crates, chests, bosses and milestones come in pairs',
  interest: v => `Earn ${v}% interest on banked credits each wave (max 300)`, fieldRepair: v => `Waves with no leaks repair ${v}% core HP`,
  burnCrit: () => 'Kinetic hits on Burning enemies always crit', ovlBurn: () => 'Overload applies Burn to every enemy it hits',
  superChill: () => 'Superconduct also Chills',
  napalmKill: () => 'Thermal kills leave burning ground for 2s', multiA: v => `Arc towers hit +${v} target`,
  freezeImmRed: v => `Enemies can be Frozen again ${v}% sooner`, markVoid: v => `Each Mark adds +${v}% Void damage taken`,
  salvage: () => 'Kills grant +1 credit for every 10 waves reached', vxpAll: v => `Veterans rank up ${v}% faster`,
  cLink: v => `Circuit: +${v}% more Attack Speed per wired neighbour`, cBolt: v => `Circuit: chain lightning deals +${v}% damage`,
  hPull: v => `Event Horizon: gravity wells pull ${v}% harder`, hWell: v => `Event Horizon: gravity wells reach ${v}% further`,
  aRank: v => `Artisan: +${v}% more Damage per Veteran rank`, aVxp: v => `Artisan: +${v}% Veteran XP`, gScore: v => `Gambler: +${v}% score`,
  msOc: v => `Marksman: each Overcharge step adds +${v}% more Damage`, wfHeat: v => `Wildfire: Heat can climb ${v}% higher`, wfDur: v => `Wildfire: road fire lasts ${v}% longer`,
  weStep: v => `War Economy: core turrets need ${v}% fewer banked credits`, weTur: v => `War Economy: each core turret adds +${v}% more core Damage`,
  kBurn: v => `Kinetic hits: ${v}% chance to Burn`, chillVoid: v => `Hits on Chilled enemies: ${v}% chance to Mark`,
};
const SMALL_NAME = {
  dmg: 'Damage', dmgK: 'Kinetic Damage', dmgT: 'Thermal Damage', dmgC: 'Cryo Damage', dmgA: 'Arc Damage', dmgV: 'Void Damage',
  rate: 'Cadence', rateK: 'Autoloader', rateA: 'Discharge', range: 'Optics', critC: 'Precision', critM: 'Lethality',
  P: 'Power', Tm: 'Tempo', F: 'Focus', I: 'Integrity', burnDmg: 'Accelerant', burnChance: 'Kindling', chillChance: 'Frost',
  shockChance: 'Static', markChance: 'Null', burnDur: 'Smolder', chillPot: 'Permafrost', freezeDur: 'Stillness',
  shockEff: 'Voltage', splash: 'Blast Radius', costRed: 'Supply Lines', upgRed: 'Toolchain', credits: 'Salvage',
  coreHP: 'Hull Plating', shield: 'Barrier', shieldRegen: 'Capacitance', abilPower: 'Uplink', abilCharge: 'Telemetry', abilSlots: 'Reserve Cells',
  affixLuck: 'Mutation', eliteDmg: 'Hunter', armorPen: 'Penetrator', frozenVuln: 'Brittle', knock: 'Recoil', xp: 'Insight',
};

// v4.2 Doctrines: a region's seal gives it a play style you can see on the field, with a real cost. Its notables, mastery,
// keystone and arm only work (and can only be taken) once its seal is in. You hold a limited number of seals.
// Indexed by sector. Sectors without an entry are still open, freeform regions (they become Doctrines later).
const DOCTRINES = {
  0: { id: 'marksman', name: 'Marksman', tag: 'Few towers, enormous shots', counter: 'brood',
    lines: ['Your power grid is 40% smaller', 'Every attack tower is Overcharged +2 for free, and Overcharge goes up to 5 steps', 'Towers show targeting lasers'],
    smalls: [{ msOc: 4 }, { msOc: 4 }] },
  1: { id: 'wildfire', name: 'Wildfire', tag: 'The road burns', counter: 'wings',
    lines: ['Burning ground enemies set the road on fire', 'Road fire builds Heat during a wave: up to +100% fire damage', 'Towers within 1 tile of burning road overheat: −25% Attack Speed'],
    smalls: [{ wfHeat: 20 }, { wfDur: 20 }] },
  2: { id: 'circuit', name: 'Circuit', tag: 'Placement is a puzzle', counter: 'shell',
    lines: ['Attack towers next to each other are wired: +8% Attack Speed per wired neighbour', 'A chain of 4+ wired towers fires a lightning bolt every 4s at the toughest enemy in its reach, for 2s of the whole chain\'s damage', 'If one tower in a chain is disabled or jammed, the whole chain stalls'],
    smalls: [{ cLink: 2 }, { cBolt: 15 }] },
  3: { id: 'glacier', name: 'Glacier', tag: 'Hold the line', counter: 'wings',
    lines: ['A Frozen ground enemy becomes an ice block: enemies behind it pile up and stop', 'Bosses and fliers are never blocked', 'All towers deal 10% less damage'],
    smalls: [{ freezeDur: 0.15 }, { frozenVuln: 8 }] },
  4: { id: 'horizon', name: 'Event Horizon', tag: 'Drag them back', counter: 'bulk',
    lines: ['Every kill opens a small gravity well that drags nearby enemies back down the road', 'Enemies at max Marks are yanked back 1.5 tiles (once each)', 'Enemies move 12% faster'],
    smalls: [{ hPull: 15 }, { hWell: 15 }] },
  6: { id: 'artisan', name: 'Artisan', tag: 'Craft a few legends', counter: 'brood', pillar: 'zen',
    lines: ['Veterans rank up 2× faster and gain +5% Damage per rank', 'Rerolls cost 50% less', 'Towers without a Veteran rank deal 25% less damage'],
    smalls: [{ aRank: 2 }, { aVxp: 20 }] },
  7: { id: 'gambler', name: 'Gambler', tag: 'Every wave is a dice roll', counter: '', pillar: 'nad',
    lines: ['Every wave from Wave 2 flips a coin for an extra event: good or bad (always good on boss waves)', 'Score +25%', 'The Entropy gauge fills 25% faster'],
    smalls: [{ gScore: 5 }, { gScore: 5 }] },
  5: { id: 'wareco', name: 'War Economy', tag: 'Money is firepower', counter: 'haste',
    lines: ['The core grows a turret for every stack of banked credits (up to 8): +60% core Damage and +8% core Attack Speed each', 'The stack size grows with the wave, so keep banking', 'Towers cost 20% more'],
    smalls: [{ weStep: 6 }, { weTur: 10 }] },
};
// ---------- v5.0 Talents: a clean sheet for the passive web ----------
// Seven short trees, read top to bottom like a classic RPG talent tree. Each tree has four rows of talents with ranks, and a
// Capstone row: pick one defining play style. Row r opens after TROW × r points in that tree; a Capstone needs TCAP. You can hold a
// limited number of Capstones (capSlots), so a build is "two or three things you are really good at", not 180 small bonuses.
// Talent effects use the same stat keys as before (STAT_TXT), so every mechanic from the old web still exists.
// v5.8 Techniques and play styles: every attack tower has a Technique (an alternate fire mode, TOWER_FIRE) that a one-point talent in
// its tree unlocks, rows open every 3 points, Capstones at 12, and the ten stat-trade Capstones became play styles you see on the field.
// 5-rank stat talents are 3 ranks. A tree now costs ~19 points instead of ~26, so the damage and status talents (K T A C V) carry
// about 80% of their old tree total (bots at 60 points went from median Wave 72 to 86 at the full total); Bastion and Command keep
// theirs. WEB_VER 5 refunds every point once (migrateWeb).
const WEB_VER = 5;
const TROW = 3, TCAP = 12;
// every point spent anywhere also adds a little Damage to every tower, so any build makes you stronger overall (v5.8: 0.4 → 0.15, so
// specialising beats spreading; balance pass: 0.15 → 0.1, 60 and 96 points ran well past their targets)
const TAL_PT_DMG = 0.1;
const T_ = (id, name, max, fx, extra) => Object.assign({ id, name, max, fx }, extra || {});
const CAP = (id, name, o) => Object.assign({ id, name, cap: 1 }, o);
// a Technique talent: one point, unlocks a fire mode for one tower type (the mode's own text lives in TOWER_FIRE)
const TECH = (id, name, tower) => T_(id, name, 1, {}, { tech: tower });
const TALENTS = [
  { id: 'K', name: 'Ballistics', col: '#efe6cf', glyph: 'K', tag: 'Kinetic guns: crits that tear through armour',
    rows: [
      [T_('kDmg', 'Heavy Rounds', 3, { dmgK: 10 }), T_('kCrit', 'Precision', 3, { critC: 4 }), TECH('kSupp', 'Suppressor', 'pulse')],
      [T_('kRate', 'Autoloader', 3, { rateK: 6 }), T_('kPen', 'Penetrator', 2, { armorPen: 12 }), TECH('kOver', 'Charged Shot', 'rail')],
      [T_('kHollow', 'Hollow Points', 1, { critSplash: 40, critM: 15 }), T_('kLeth', 'Lethality', 2, { critM: 14 })],
      [T_('kRifle', 'Rifling', 1, { fifthCrit: 1, rateK: 8 }), T_('kShred', 'Armor Shredder', 2, { shredStack: 1.2, eliteDmg: 5 })]],
    caps: [CAP('marksman', 'Marksman', { ks: 'marksman', doc: 0 }),
      CAP('nest', 'Sniper Nest', { ks: 'nest', lines: ['Rail Lances with no tower beside them: +40% Range, +30% Damage, and every shot pierces every enemy in line', 'Rail Lances with a neighbour deal 25% less damage'] }),
      CAP('rico', 'Ricochet', { ks: 'rico', lines: ['Pulse Blaster rounds bounce to 3 more enemies, and the first bounce keeps full damage', 'Rail Lances fire 25% slower'] })] },
  { id: 'T', name: 'Combustion', col: '#ff7b39', glyph: 'T', tag: 'Thermal and Burn: set the swarm alight',
    rows: [
      [T_('tDmg', 'Accelerant', 3, { dmgT: 10 }), T_('tChance', 'Kindling', 3, { burnChance: 4 }), TECH('tBack', 'Backdraft', 'flame')],
      [T_('tBurn', 'Fuel', 3, { burnDmg: 14 }), T_('tSplash', 'Blast Radius', 2, { splash: 0.1 }), TECH('tBunk', 'Bunker Buster', 'missile')],
      [T_('tBoom', 'Flashpoint', 1, { burnBoom: 25, dmgT: 8 }), T_('tVuln', 'Scorch', 2, { burnVuln: 8 })],
      [T_('tChain', 'Chain Ignition', 1, { chainIgnite: 1, burnDur: 20 }), T_('tNapalm', 'Napalm', 1, { napalmKill: 1, burnDmg: 10 }), T_('tCrit', 'Incendiary Rounds', 1, { burnCrit: 1 })]],
    caps: [CAP('wildfire', 'Wildfire', { ks: 'wildfire', doc: 1 }), CAP('conflag', 'Conflagration', { ks: 'conflag', lines: ['All damage becomes Thermal (Resonance unaffected)', '+50% Thermal Damage, +150% Burn damage. Burning enemies are 25% slower', 'Every 3rd Thermal hit on a burning enemy triggers Thermal Shock', 'Chill becomes Burn: cannot Chill or Freeze'] }),
      CAP('pyre', 'Pyre', { fx: { burnSpread: 1, heatSink: 1 }, lines: ['Every second, Burn spreads to the nearest enemy within 1 tile', 'Thermal towers: +2% Attack Speed per Burning enemy, up to +40%'] })] },
  { id: 'A', name: 'Voltaic', col: '#ffe14d', glyph: 'A', tag: 'Arc and speed: chains, shocks and overloads',
    rows: [
      [T_('aDmg', 'Voltage', 3, { dmgA: 10 }), T_('aRate', 'Cadence', 3, { rate: 4 }), TECH('aFence', 'Arc Fence', 'coil')],
      [T_('aShock', 'Static', 3, { shockChance: 4 }), T_('aDis', 'Discharge', 2, { rateA: 5 }), TECH('aMines', 'Pulse Mines', 'emp')],
      [T_('aFork', 'Forked Lightning', 1, { chain: 1, chainKeep: 1 }), T_('aOver', 'Overvolt', 2, { shockEff: 14 })],
      [T_('aCap', 'Capacitors', 1, { capacitor: 1, dmgA: 10 }), T_('aIon', 'Ion Lattice', 1, { multiA: 1 }), T_('aPlasma', 'Plasma Coupling', 1, { ovlBurn: 1, overloadRad: 30 })]],
    caps: [CAP('circuit', 'Circuit', { ks: 'circuit', doc: 2 }),
      CAP('stormrider', 'Storm Rider', { ks: 'stormrider', lines: ['Storms drift toward your Arc towers and linger over them', 'Arc towers inside a storm: +60% Attack Speed, and Arc Coils chain +2', 'Storms come 30% more often'] }),
      CAP('blackout', 'Blackout', { ks: 'blackout', lines: ['EMP shells leave a static field for 3s: enemies inside are Shocked and 30% slower', 'EMP Mortars fire 25% faster', 'Arc Coils deal 15% less damage'] })] },
  { id: 'C', name: 'Cryogenics', col: '#6ae2ff', glyph: 'C', tag: 'Chill and Freeze: slow them, then shatter them',
    rows: [
      [T_('cDmg', 'Frostbite', 3, { dmgC: 10 }), T_('cPot', 'Permafrost', 3, { chillPot: 14 }), TECH('cLance', 'Cold Lance', 'cryo')],
      [T_('cChance', 'Frost', 3, { chillChance: 4 }), T_('cStill', 'Stillness', 2, { freezeDur: 0.1 })],
      [T_('cDeep', 'Deep Freeze', 1, { freezeAt: 1, freezeDur: 0.3 }), T_('cBrittle', 'Brittle', 2, { frozenVuln: 10 })],
      [T_('cLattice', 'Frost Lattice', 1, { chillSplash: 1, dmgC: 10 }), T_('cShards', 'Ice Shards', 1, { iceShards: 1 }), T_('cSuper', 'Superconductors', 1, { superChill: 1, superRad: 60 })]],
    caps: [CAP('glacier', 'Glacier', { ks: 'glacier', doc: 3 }),
      CAP('artillery', 'Cryo Artillery', { ks: 'artillery', lines: ['Cryo Emitters stop pulsing and lob frost shells at the enemy furthest along, at double range', 'Each shell bursts for ×2.5 Damage in 1.1 tiles and adds 2 Chill', 'Cryo Emitters fire 40% slower'] }),
      CAP('hoarfrost', 'Hoarfrost', { ks: 'hoarfrost', lines: ['Every Freeze leaves ice on the road for 5s', 'Ground enemies on ice are Chilled and take +25% Kinetic Damage', 'Thermal towers deal 20% less damage'] })] },
  { id: 'V', name: 'Singularity', col: '#b86cff', glyph: 'V', tag: 'Void and Marks: bend the road, collapse the strong',
    rows: [
      [T_('vDmg', 'Null', 3, { dmgV: 8 }), T_('vHunt', 'Hunter', 3, { eliteDmg: 6 }), TECH('vTether', 'Null Tether', 'lens')],
      [T_('vMark', 'Mark', 3, { markChance: 4 }), T_('vKnock', 'Gravitic', 2, { knock: 2.4 }), TECH('vRepulse', 'Repulsor', 'grav')],
      [T_('vLens', 'Implosion', 1, { collapse: 40, dmgV: 8 }) /* v5.8: was Null Lens (beams kept their ramp), a Lens-only buff */, T_('vSlow', 'Event Drag', 2, { markSlow: 12 })],
      [T_('vDark', 'Dark Matter', 1, { markVoid: 5, markMax: 3 }), T_('vHole', 'Black Hole', 1, { blackHole: 1, collapse: 30 }), T_('vPull', 'Gravitic Pull', 1, { knockMark: 1, knock: 3 })]],
    caps: [CAP('horizon', 'Event Horizon', { ks: 'horizon', doc: 4 }),
      CAP('garden', 'Gravity Garden', { ks: 'garden', lines: ['Ground enemies between two Gravity Wells (up to 5 tiles apart) are held: 75% slower and +25% damage taken', 'Gravity Wells: +25% Range', 'Void Lenses deal 20% less damage'] }),
      CAP('decay', 'Entropic Decay', { fx: { markPerma: 1, voidSiphon: 1 }, lines: ['Marks never fade', 'Each Collapse fills the Entropy gauge'] })] },
  { id: 'E', name: 'Bastion', col: '#59f0b4', glyph: 'E', tag: 'Core, shield and credits: the economy wins long runs',
    rows: [
      [T_('eHP', 'Hull Plating', 3, { coreHP: 20 }), T_('eCr', 'Salvage', 3, { credits: 7 })],
      [T_('eShield', 'Barrier', 2, { shield: 12, shieldRegen: 22 }), T_('eCost', 'Supply Lines', 3, { costRed: 3, upgRed: 5 })],
      [T_('eCore', 'Reinforced Core', 1, { shieldWave: 1, coreHP: 30 }), T_('eRepair', 'Field Repairs', 2, { fieldRepair: 3 })],
      [T_('eInt', 'Compound Interest', 1, { interest: 2 }), T_('eRet', 'Retaliation', 1, { coreDmg: 60, coreRate: 30, coreRange: 1 }), T_('eDrones', 'Salvage Drones', 1, { salvage: 1 })]],
    caps: [CAP('wareco', 'War Economy', { ks: 'wareco', doc: 5 }),
      CAP('forgeworks', 'Forge Works', { ks: 'forgeworks', lines: ['Credit Forges arm themselves: each fires Kinetic slugs at enemies within 3 tiles, hitting harder the more it earns', 'Credit Forge income −35%'] }),
      CAP('bulwark', 'Bulwark', { ks: 'bulwark', lines: ['When an enemy reaches the core, the core throws back every enemy within 2.5 tiles and Stuns them (every 3s at most)', 'Core +40% max HP', 'Towers deal 10% less damage'] })] },
  { id: 'X', name: 'Command', col: '#ff5fa8', glyph: 'X', tag: 'Abilities, veterans, luck and storms',
    rows: [
      [T_('xPow', 'Uplink', 3, { abilPower: 13 }), T_('xCharge', 'Telemetry', 3, { abilCharge: 8 })],
      [T_('xLuck', 'Mutation', 2, { affixLuck: 15 }), T_('xXp', 'Insight', 2, { xp: 9 }), T_('xRange', 'Optics', 2, { range: 6 })],
      [T_('xCell', 'Reserve Cells', 2, { abilSlots: 1 }), T_('xLoad', 'Quartermaster', 1, { quarter: 1 }), T_('xStorm', 'Storm Caller', 1, { stormFreq: 50, stormPow: 50 })],
      [T_('xWolf', 'Lone Wolf', 1, { loneWolf: 35 }), T_('xStasis', 'Stasis Theory', 1, { stasisDur: 3, chillVoid: 15 }), T_('xVet', 'Field Promotion', 2, { vxpAll: 45 })]],
    caps: [CAP('artisan', 'Artisan', { ks: 'artisan', doc: 6 }), CAP('gambler', 'Gambler', { ks: 'gambler', doc: 7 }),
      CAP('chaos', 'Chaos Engine', { ks: 'chaos', lines: ['Every wave, each attack tower takes a random element for that wave (its shots, statuses, talents and Resonance follow it)', '+25% Damage'] }),
      CAP('tactician', 'Tactician', { ks: 'tactician', fx: { abilPower: 25 }, lines: ['Using an ability takes 30% off every other ability\'s cooldown', '+25% ability power'] })] },
];
// 6.4 capstone tier (tower64): one node per tree above the Capstones. It needs TTOP points in that tree, costs 1 point, takes no
// Capstone slot and unlocks that tree's new tower (CAP_TOWERS) for your runs. Row 5 in TAL; stored in PROF.tal like any talent
const TTOP = 16;
TALENTS.forEach((tr, i) => { tr.top = T_(tr.id.toLowerCase() + 'Top', TOWERS[CAP_TOWERS[i]].name, 1, {}, { unlockT: CAP_TOWERS[i] }); });
// v5.8: Capstones that were replaced by play styles; a Supernova Remnant of the old one becomes the new one (migrateWeb)
const CAP_RENAMED = { glass: 'nest', deadeye: 'rico', overgrid: 'stormrider', thunder: 'blackout', abszero: 'artillery', winter: 'hoarfrost', singularity: 'garden', dimret: 'forgeworks', unbreakable: 'bulwark' };
// v5.8 Techniques: alternate fire modes. A talent unlocks one (need), then the tower panel switches each tower of that type between
// Standard and the Technique (act('fire', x, y, id); t.fire, kept apart from targeting t.mode). Each is a different job, not an upgrade.
// m keys are read in applyFire (sim.js): dmgX, rateX, rangeAdd, rangeX, pullX multiply or add; the rest switch behaviour.
const TOWER_FIRE = {
  pulse: [{ id: 'supp', need: 'kSupp', name: 'Suppressor', short: 'Slows what it hits by 35%. ×0.75 Damage', desc: 'Rounds slow what they hit by 35% for 1.5s. ×0.75 Damage', m: { dmgX: 0.75, supSlow: 0.35, supDur: 1.5 } }],
  rail: [{ id: 'over', need: 'kOver', name: 'Charged Shot', short: 'Every 3rd shot ×4 and pierces all. Half speed', desc: 'Every 3rd shot deals ×4 and pierces every enemy in line. ×0.5 Attack Speed', m: { rateX: 0.5, ocEvery: 3, ocX: 4 } }],
  cryo: [{ id: 'lance', need: 'cLance', name: 'Cold Lance', short: 'A freezing beam on one target. ×3 Damage', desc: 'A freezing beam on one target instead of a pulse: ×3 Damage to it, pierces Plating, +0.8 Range', m: { lance: 3, rangeAdd: 0.8 } }],
  missile: [{ id: 'bunker', need: 'tBunk', name: 'Bunker Buster', short: '×2 Damage, ignores Plating. No splash', desc: 'One heavy warhead: ×2 Damage, ignores Plating and half of Armor. No splash, bomblets or napalm', m: { dmgX: 2, bunker: 1 } }],
  coil: [{ id: 'fence', need: 'aFence', name: 'Arc Fence', short: 'Zaps a line to a Coil within 4 tiles', desc: 'Stops chaining. Arcs a fence to the nearest Coil within 4 tiles that zaps and Shocks everything within a tile of it', m: { fence: 4 } }],
  flame: [{ id: 'back', need: 'tBack', name: 'Backdraft', short: 'A full ring of fire. ×0.7 Range', desc: 'Burns a full ring around the tower instead of a cone. ×0.7 Range', m: { ring: 1, rangeX: 0.7 } }],
  lens: [{ id: 'tether', need: 'vTether', name: 'Null Tether', short: 'No ramp. Beamed enemies 35% slower', desc: 'No ramp: steady damage at the base rate. Beamed enemies are 35% slower and Marked twice as fast', m: { tether: 0.35 } }],
  emp: [{ id: 'mines', need: 'aMines', name: 'Pulse Mines', short: 'Lays up to 4 road mines. ×1.75 Damage', desc: 'Shells stay on the road as mines (up to 4) that blow when a ground enemy steps on them. ×1.75 Damage. Fliers never set them off', m: { mines: 4, dmgX: 1.75 } }],
  grav: [{ id: 'repulse', need: 'vRepulse', name: 'Repulsor', short: 'Hits fliers and throws them back', desc: 'Also hits fliers and throws them back along their flight. ×0.6 pull on the ground, ×0.5 Damage', m: { repulse: 1, pullX: 0.6, dmgX: 0.5 } }],
};
const fireModes = type => TOWER_FIRE[type] || [];
const fireTalentFor = type => fireModes(type).map(f => TAL[f.need]).filter(Boolean);
// lookups: every talent and capstone by id, with its tree and row
const TAL = {};
for (const tr of TALENTS) {
  tr.rows.forEach((row, r) => row.forEach(t => { t.tree = tr.id; t.row = r; TAL[t.id] = t; }));
  for (const c of tr.caps) { c.tree = tr.id; c.row = 4; c.max = 1; TAL[c.id] = c; }
  if (tr.top) { tr.top.tree = tr.id; tr.top.row = 5; TAL[tr.top.id] = tr.top; } // 6.4 capstone tier
}
const TREE_BY_ID = Object.fromEntries(TALENTS.map(t => [t.id, t]));
// points that fill a tree (every talent at max rank): the Talents screen's bars
const treeMax = tid => TREE_BY_ID[tid].rows.flat().reduce((a, t) => a + t.max, 0);
// v4.x Doctrine seals live on as Capstones (same ks flags, same field effects). v5.8: slots at Levels 25 and 60 (were 50 and 100)
const capSlots = lvl => 1 + (lvl >= 25 ? 1 : 0) + (lvl >= 60 ? 1 : 0);
const CAP_NEXT = lvl => lvl < 25 ? 25 : lvl < 60 ? 60 : 0;
// v5.8: the Daily Hunt build is 30 points with one Capstone (the trees are smaller; 40 points held three)
HUNT.pts = 30; const HUNT_CAPS = 1;
// a talent's description at a given rank
function talentLines(t, rank) {
  if (t.unlockT) { const D = TOWERS[t.unlockT]; return [`New tower: the ${D.name} (${EL[D.el].name})`, D.blurb, 'You can build it in every run from now on. Daily Hunts use the base towers']; }
  if (t.cap) return t.lines || (t.doc !== undefined ? DOCTRINES[t.doc].lines : []);
  if (t.tech) { const F = fireModes(t.tech).find(f => f.need === t.id); return F ? [`Technique for the ${TOWERS[t.tech].name}: ${F.name}`, F.desc, 'Switch it per tower from the tower panel'] : []; }
  const r = Math.max(1, rank || 1);
  return Object.keys(t.fx).map(k => { const v = t.fx[k]; const txt = STAT_TXT[k]; if (!txt) return k; return typeof v === 'number' && v !== 1 ? txt(+(v * r).toFixed(2)) : txt(v); });
}

// v5.8 XP curve: each level costs 350 + 140 × L^1.6 XP (XP is 10% of score). A fresh first run gives about 3-5 levels, a typical run
// 6-12, and a deep run no longer pays 38 levels at once (the old 3000 + 250L + 3L² was flat at the top, steep at the bottom).
// migrateWeb converts old profiles so nobody loses a level. The table is in docs/notes/talents.md.
const xpForLevel = L => Math.round(350 + 140 * Math.pow(L, 1.6));
// the 5.2-5.7 curve, kept for the migration
const xpForLevelV5 = L => L === 0 ? 800 : L === 1 ? 1600 : Math.round(3000 + 250 * L + 3 * L * L);
function levelFromXP(xp, f) {
  f = f || xpForLevel;
  let L = 0, need = f(0);
  while (xp >= need) { xp -= need; L++; need = f(L); }
  return { level: L, into: xp, need };
}

// ---------- Affix eligibility by tower kind (no dead rolls) ----------
const AFFIX_BAN = {
  bullet: [],
  rail: ['chain', 'splash'],
  pulse: ['pierce', 'chain', 'splash', 'multi', 'ricochet'],
  missile: ['pierce', 'chain', 'ricochet'],
  chain: ['pierce', 'splash'],
  cone: ['pierce', 'chain', 'splash', 'multi', 'ricochet'],
  beam: ['pierce', 'chain', 'splash', 'ricochet', 'echo'],
  mortar: ['pierce', 'chain', 'ricochet'],
  grav: ['pierce', 'chain', 'splash', 'multi', 'ricochet', 'echo'],
  saw: ['pierce', 'chain', 'splash', 'ricochet'], det: ['pierce', 'chain', 'splash', 'multi', 'ricochet'], surge: ['pierce', 'splash'], // 6.4
  wall: ['pierce', 'chain', 'splash', 'multi', 'ricochet', 'echo'], tether: ['pierce', 'chain', 'splash', 'ricochet', 'echo'], aegis: ['pierce', 'chain', 'ricochet'], joker: ['pierce', 'chain', 'multi'],
};

// ---------- Anomalies: double-edged run mutators drawn from the Entropy meter ----------
const ANOMALIES = [
  { id: 'twinsuns', name: 'Twin Suns', up: '+60% Thermal Damage', down: 'Enemies regenerate 1% HP per second', m: { dmgT: 60 }, af: { regen: 0.01 } },
  { id: 'glasssky', name: 'Glass Sky', up: '+35% Damage', down: 'No core shield', m: { dmg: 35 }, af: { noShield: 1 } },
  { id: 'overpressure', name: 'Overpressure', up: '+30% Attack Speed', down: 'Attacks have a 2% chance to jam', m: { rate: 30 }, af: { jam: 0.02 } },
  { id: 'bloodprice', name: 'Blood Price', up: 'All towers gain a Legendary affix', down: '−30% core max HP', special: 'legendAll', af: { coreHPx: 0.7 } },
  { id: 'hungrycore', name: 'Hungry Core', up: '×3 core Damage, +1 core Range', down: 'Core loses 4% HP each wave', m: { coreDmg: 200, coreRange: 1 }, af: { coreDrain: 0.04 } },
  { id: 'fractal', name: 'Fractal Rounds', up: 'Bullets and missiles split into 2 shards', down: '−10% Range', m: { range: -10 }, af: { fractal: 1 } },
  { id: 'flux', name: 'Elemental Flux', up: 'Every 20s, one element deals ×2 damage', down: 'Other elements deal −15%', af: { flux: 1 } },
  { id: 'magnet', name: 'Storm Magnet', up: 'Storms are 3× as frequent and drift toward towers', down: 'Enemies in storms move 20% faster', af: { magnet: 1 } },
  { id: 'timedebt', name: 'Time Debt', up: '×1.4 score', down: 'Wave countdown halved', af: { timeDebt: 1, score: 0.4 } },
  { id: 'volatile', name: 'Volatile Matter', up: 'Enemies explode on death for 15% of max HP', down: '+15% enemy speed', af: { boom: 0.15, haste: 0.15 } },
  { id: 'echo', name: 'Echo Chamber', up: 'Towers have a 15% chance to attack twice', down: '+25% upgrade cost', af: { echo: 0.15, upgX: 0.25 } },
  { id: 'scavenger', name: 'Scavenger', up: 'Selling refunds 90%', down: '+15% tower cost', af: { scav: 1, costX: 0.15 } },
  { id: 'critmass', name: 'Critical Mass', up: '+20% Crit Chance, +50% Crit Damage', down: '−25% damage on non-crits', m: { critC: 20, critM: 50 }, af: { noncrit: 0.25 } },
  { id: 'longnight', name: 'Long Night', up: '+45% Damage', down: '−20% Range', m: { dmg: 45, range: -20 } },
  { id: 'permafrost', name: 'Permafrost', up: '×2 Chill strength, +15% chance to Chill', down: '−40% Thermal Damage', m: { chillPot: 100, chillChance: 15, dmgT: -40 } },
  { id: 'prismrain', name: 'Prism Rain', up: 'Hits apply a random status', down: '−10% Damage', m: { dmg: -10 }, af: { prism: 1 } },
  { id: 'engine', name: 'Entropy Engine', up: 'Entropy fills 2× faster', down: 'Many more Elites', af: { fill: 1, elite: 0.2 } },
  { id: 'goldfever', name: 'Gold Fever', up: '+50% Credits', down: '+25% enemy HP', m: { credits: 50 }, af: { hpx: 0.25 } },
  { id: 'laststand', name: 'Last Stand', up: '+60% Damage while the core is below 50% HP', down: 'Core repairs disabled', af: { lastStand: 1 } },
  { id: 'mutagen', name: 'Mutagen', up: 'Each wave, a random tower gains an affix', down: 'Every 3rd wave, it gains a Curse instead', af: { mutagen: 1 } },
  { id: 'inversion', name: 'Gravity Inversion', up: '−15% ground enemy speed', down: '3× as many Skimmers', af: { groundSlow: 0.15, flyers: 2 } },
];
// 6.4 generated Anomalies (FR_VER 4, G.frV >= 4): a card is a boon part plus a drawback part, sized from a power budget so it is a
// fair trade. Values are in display units (percent); af parts store v / 100 in G.af. p: power per unit (1 power ≈ +1% Damage).
// lo/hi: the range on one card. cap: the most the run's Anomalies (classic and generated) can add to that key in total
// (for a drawback: the most they can take away). st: rounding step. w: base weight. el / need: the build it suits (offers lean
// toward what the player fields). grp: parts of one group never meet on a card. sp: a fixed special (Exotic only, once a run).
// words: first name word (boons). nouns: second name word (drawbacks).
const ANOM_RARITY = [
  { id: 'common', name: 'Common', col: '#cfcade', b: 30, w: 70 },
  { id: 'rare', name: 'Rare', col: '#6ae2ff', b: 40, w: 24 },
  { id: 'exotic', name: 'Exotic', col: '#ffb03a', b: 50, w: 6 },
];
// classic: share of offer slots that hold a classic card. dr: drawback power per boon power. Budget ×(1 + grow per draw, up to growN
// draws, + wave / waveDiv, wave counted up to waveMax)
const ANOM_GEN = { classic: 0.25, dr: 0.8, grow: 0.06, growN: 5, waveDiv: 800, waveMax: 120 };
const ANOM_UP = [
  { id: 'dmg', k: 'dmg', p: 1, lo: 10, hi: 60, cap: 90, st: 5, w: 1.2, words: ['Brutal', 'Savage', 'Heavy', 'Feral'] },
  { id: 'dmgK', k: 'dmgK', p: 0.8, lo: 15, hi: 90, cap: 120, st: 5, el: 'K', words: ['Iron', 'Steel', 'Tungsten', 'Ballistic'] },
  { id: 'dmgT', k: 'dmgT', p: 0.8, lo: 15, hi: 90, cap: 120, st: 5, el: 'T', words: ['Solar', 'Cinder', 'Ember', 'Furnace'] },
  { id: 'dmgC', k: 'dmgC', p: 0.8, lo: 15, hi: 90, cap: 120, st: 5, el: 'C', words: ['Glacial', 'Rime', 'Polar', 'Winter'] },
  { id: 'dmgA', k: 'dmgA', p: 0.8, lo: 15, hi: 90, cap: 120, st: 5, el: 'A', words: ['Storm', 'Volt', 'Ion', 'Thunder'] },
  { id: 'dmgV', k: 'dmgV', p: 0.8, lo: 15, hi: 90, cap: 120, st: 5, el: 'V', words: ['Hollow', 'Abyssal', 'Umbral', 'Null'] },
  { id: 'rate', k: 'rate', p: 1.2, lo: 10, hi: 45, cap: 60, st: 5, w: 1.1, words: ['Rapid', 'Quickfire', 'Frantic', 'Twitchy'] },
  { id: 'range', k: 'range', p: 1.8, lo: 5, hi: 30, cap: 45, st: 5, w: 0.9, words: ['Farsight', 'Longshot', 'Wide', 'Distant'] },
  { id: 'critC', k: 'critC', p: 0.9, lo: 10, hi: 40, cap: 60, st: 5, need: 'crit', words: ['Lucky', 'Keen', 'Sharp'] },
  { id: 'critM', k: 'critM', p: 0.35, lo: 30, hi: 120, cap: 200, st: 10, need: 'crit', words: ['Cruel', 'Lethal', 'Vicious'] },
  { id: 'credits', k: 'credits', p: 1, lo: 10, hi: 40, cap: 60, st: 5, words: ['Gilded', 'Golden', 'Rich'] },
  { id: 'costRed', k: 'costRed', p: 1.6, lo: 5, hi: 25, cap: 30, st: 5, w: 0.7, grp: 'cost', words: ['Thrifty', 'Bargain', 'Discount'] },
  { id: 'upgRed', k: 'upgRed', p: 1, lo: 10, hi: 35, cap: 40, st: 5, w: 0.7, grp: 'upg', words: ['Tinker', 'Retrofit', 'Workshop'] },
  { id: 'coreDmg', k: 'coreDmg', p: 0.15, lo: 60, hi: 300, cap: 400, st: 20, w: 0.6, words: ['Wrathful', 'Angry', 'Furious'] },
  { id: 'burnChance', k: 'burnChance', p: 1.4, lo: 5, hi: 25, cap: 40, st: 5, w: 0.6, words: ['Kindled', 'Smoking', 'Torch'] },
  { id: 'chillChance', k: 'chillChance', p: 1.4, lo: 5, hi: 25, cap: 40, st: 5, w: 0.6, words: ['Frosted', 'Shivering', 'Numb'] },
  { id: 'shockChance', k: 'shockChance', p: 1.4, lo: 5, hi: 25, cap: 40, st: 5, w: 0.6, words: ['Charged', 'Crackling', 'Sparking'] },
  { id: 'markChance', k: 'markChance', p: 1.4, lo: 5, hi: 25, cap: 40, st: 5, need: 'V', words: ['Marked', 'Branded', 'Cursed'] },
  { id: 'chillPot', k: 'chillPot', p: 0.3, lo: 30, hi: 120, cap: 200, st: 10, need: 'C', words: ['Deepfreeze', 'Frostbite', 'Icebound'] },
  { id: 'burnDmg', k: 'burnDmg', p: 0.4, lo: 25, hi: 100, cap: 150, st: 5, need: 'T', words: ['Napalm', 'Scorching', 'Blazing'] },
  { id: 'shockEff', k: 'shockEff', p: 0.4, lo: 25, hi: 100, cap: 150, st: 5, need: 'A', words: ['Overcharged', 'Live', 'Arcing'] },
  { id: 'armorPen', k: 'armorPen', p: 0.8, lo: 10, hi: 40, cap: 60, st: 5, w: 0.7, words: ['Piercing', 'Drilling', 'Breaching'] },
  { id: 'eliteDmg', k: 'eliteDmg', p: 0.5, lo: 20, hi: 100, cap: 150, st: 5, w: 0.8, words: ['Hunting', 'Kingslayer', 'Trophy'] },
  { id: 'shield', k: 'shield', p: 1, lo: 10, hi: 50, cap: 80, st: 5, w: 0.5, grp: 'shield', words: ['Warded', 'Shielded', 'Aegis'] },
  { id: 'coreHP', k: 'coreHP', p: 0.5, lo: 20, hi: 100, cap: 150, st: 10, w: 0.5, grp: 'hull', words: ['Armored', 'Stout', 'Bastion'] },
  { id: 'abilPower', k: 'abilPower', p: 0.5, lo: 20, hi: 80, cap: 120, st: 5, w: 0.4, words: ['Orbital', 'Uplinked', 'Command'] },
  { id: 'stormPow', k: 'stormPow', p: 0.4, lo: 25, hi: 100, cap: 150, st: 5, w: 0.4, words: ['Tempest', 'Squall', 'Monsoon'] },
  { id: 'echo', k: 'echo', t: 'af', p: 1.2, lo: 5, hi: 20, cap: 25, st: 5, w: 0.8, words: ['Echoing', 'Twin', 'Doubled'] },
  { id: 'groundSlow', k: 'groundSlow', t: 'af', p: 2, lo: 5, hi: 20, cap: 30, st: 5, w: 0.7, words: ['Molasses', 'Sticky', 'Tarpit'] },
  { id: 'boom', k: 'boom', t: 'af', p: 1.6, lo: 5, hi: 15, cap: 20, st: 5, w: 0.7, words: ['Volatile', 'Unstable', 'Popping'] },
  { id: 'fractal', k: 'fractal', t: 'af', sp: 1, p: 30, words: ['Fractal', 'Splintered'] },
  { id: 'prism', k: 'prism', t: 'af', sp: 1, p: 25, words: ['Prismatic', 'Spectral'] },
  { id: 'fill', k: 'fill', t: 'af', sp: 1, p: 20, words: ['Restless', 'Feedback'] },
];
const ANOM_DN = [
  { id: '-dmg', k: 'dmg', p: 1, lo: 5, hi: 30, cap: 30, st: 5, nouns: ['Fatigue', 'Rust', 'Malaise'] },
  { id: '-rate', k: 'rate', p: 1.2, lo: 5, hi: 25, cap: 30, st: 5, nouns: ['Lull', 'Drag', 'Sloth'] },
  { id: '-range', k: 'range', p: 1.8, lo: 5, hi: 20, cap: 30, st: 5, nouns: ['Myopia', 'Fog', 'Haze'] },
  { id: '-dmgK', k: 'dmgK', p: 0.5, lo: 10, hi: 60, cap: 60, st: 5, el: 'K', w: 0.4, nouns: ['Corrosion', 'Dents'] },
  { id: '-dmgT', k: 'dmgT', p: 0.5, lo: 10, hi: 60, cap: 60, st: 5, el: 'T', w: 0.4, nouns: ['Damp', 'Drizzle'] },
  { id: '-dmgC', k: 'dmgC', p: 0.5, lo: 10, hi: 60, cap: 60, st: 5, el: 'C', w: 0.4, nouns: ['Thaw', 'Meltdown'] },
  { id: '-dmgA', k: 'dmgA', p: 0.5, lo: 10, hi: 60, cap: 60, st: 5, el: 'A', w: 0.4, nouns: ['Short', 'Blackout'] },
  { id: '-dmgV', k: 'dmgV', p: 0.5, lo: 10, hi: 60, cap: 60, st: 5, el: 'V', w: 0.4, nouns: ['Daylight', 'Glare'] },
  { id: '-credits', k: 'credits', p: 0.8, lo: 10, hi: 35, cap: 40, st: 5, nouns: ['Tax', 'Debt', 'Tithe'] },
  { id: '-costX', k: 'costX', t: 'af', p: 1.4, lo: 5, hi: 25, cap: 40, st: 5, grp: 'cost', nouns: ['Toll', 'Markup', 'Tariff'] },
  { id: '-upgX', k: 'upgX', t: 'af', p: 1, lo: 10, hi: 35, cap: 50, st: 5, grp: 'upg', nouns: ['Red Tape', 'Overhead'] },
  { id: '-regen', k: 'regen', t: 'af', p: 30, lo: 0.5, hi: 1.5, cap: 2.5, st: 0.5, nouns: ['Hydra', 'Regrowth', 'Bloom'] },
  { id: '-haste', k: 'haste', t: 'af', p: 2, lo: 5, hi: 20, cap: 30, st: 5, nouns: ['Stampede', 'Rush', 'Panic'] },
  { id: '-hpx', k: 'hpx', t: 'af', p: 1.2, lo: 10, hi: 35, cap: 60, st: 5, nouns: ['Giants', 'Swell', 'Bulk'] },
  { id: '-jam', k: 'jam', t: 'af', p: 15, lo: 1, hi: 3, cap: 5, st: 1, nouns: ['Gremlins', 'Glitch', 'Lemons'] },
  { id: '-coreDrain', k: 'coreDrain', t: 'af', p: 7, lo: 2, hi: 5, cap: 8, st: 1, w: 0.7, nouns: ['Leech', 'Hunger', 'Parasite'] },
  { id: '-coreHPx', k: 'coreHPx', t: 'af', p: 1, lo: 10, hi: 35, cap: 50, st: 5, w: 0.8, grp: 'hull', nouns: ['Fracture', 'Fault', 'Crack'] },
  { id: '-elite', k: 'elite', t: 'af', p: 1.2, lo: 5, hi: 25, cap: 40, st: 5, nouns: ['Crown', 'Royals', 'Pageant'] },
  { id: '-flyers', k: 'flyers', t: 'af', p: 0.3, lo: 50, hi: 200, cap: 300, st: 50, nouns: ['Flock', 'Migration', 'Swarm'] },
  { id: '-noShield', k: 'noShield', t: 'af', sp: 1, p: 30, w: 0.5, grp: 'shield', nouns: ['Exposure', 'Glass Jaw'] },
];
const ANOM_EXOTIC_NOUNS = ['Paradox', 'Singularity', 'Eclipse', 'Covenant', 'Engine', 'Requiem'];
const ANOM_PART = {};
for (const P of ANOM_UP) ANOM_PART[P.id] = Object.assign({ t: 'm', w: 1, side: 1 }, P);
for (const P of ANOM_DN) ANOM_PART[P.id] = Object.assign({ t: 'm', w: 1, side: -1 }, P);
const ANOM_UPS = ANOM_UP.map(P => ANOM_PART[P.id]), ANOM_DNS = ANOM_DN.map(P => ANOM_PART[P.id]);
// one card line per part (v in display units)
const ANOM_TXT = {
  costRed: v => `−${v}% tower cost`, upgRed: v => `−${v}% upgrade cost`, coreHP: v => `+${v} core max HP`,
  echo: v => `Towers have a ${v}% chance to attack twice`, groundSlow: v => `−${v}% ground enemy speed`, boom: v => `Enemies explode on death for ${v}% of max HP`,
  fractal: () => 'Bullets and missiles split into 2 shards', prism: () => 'Hits apply a random status', fill: () => 'Entropy fills 2× faster',
  '-costX': v => `+${v}% tower cost`, '-upgX': v => `+${v}% upgrade cost`, '-regen': v => `Enemies regenerate ${v}% HP per second`,
  '-haste': v => `+${v}% enemy speed`, '-hpx': v => `+${v}% enemy HP`, '-jam': v => `Attacks have a ${v}% chance to jam`,
  '-coreDrain': v => `Core loses ${v}% HP each wave`, '-coreHPx': v => `−${v}% core max HP`, '-elite': v => `+${v}% Elite chance`,
  '-flyers': v => `+${v}% Skimmers`, '-noShield': () => 'No core shield',
};
function anomPartTxt(id, v) {
  const P = ANOM_PART[id]; if (!P) return '';
  if (ANOM_TXT[id]) return ANOM_TXT[id](v);
  const s = STAT_TXT[P.k] ? STAT_TXT[P.k](v) : `+${v} ${P.k}`;
  return P.side > 0 ? s : s.replace(/^\+/, '−');
}

// ---------- Supernova: cosmic laws (one chosen per Supernova, permanent, stacking) ----------
const LAWS = [
  { id: 'gravity', name: 'Heavy Gravity', up: 'Ground enemies move 12% slower', down: 'Bosses have double HP', af: { groundSlow: 0.12, bossHP: 1 } },
  { id: 'redshift', name: 'Red Shift', up: '+20% tower Range', down: '+20% enemy HP', m: { range: 20 }, af: { hpx: 0.2 } },
  { id: 'catneb', name: 'Cat Nebula', up: 'Oddball bosses drop 3× credits', down: 'Every boss wave brings an oddball', af: { oddAll: 1 } },
  { id: 'bloom', name: 'Dark Bloom', up: 'Elites drop 2× credits', down: 'Elites are far more common', af: { elite: 0.18, eliteCr: 1 } },
  { id: 'lean', name: 'Lean Times', up: '+30% Damage', down: '−25% Credits', m: { dmg: 30, credits: -25 } },
  { id: 'swarm', name: 'Swarm Law', up: 'Enemies have 20% less HP', down: '35% more enemies per wave', af: { hpx: -0.2, countX: 0.35 } },
  { id: 'tide', name: 'Entropic Tide', up: 'Entropy fills 2× faster', down: 'Enemies move 8% faster', af: { fill: 1, haste: 0.08 } },
  { id: 'storms', name: 'Stormfront', up: 'Storms hit 40% harder', down: 'Storms arrive twice as often', m: { stormPow: 40, stormFreq: 100 } },
  { id: 'brittle', name: 'Brittle Star', up: '+60% core Damage, +1 core Range', down: '−25% core max HP', m: { coreDmg: 60, coreRange: 1 }, af: { coreHPx: 0.75 } },
];
const LAW_SCORE = 0.15, NOVA_SCORE = 0.1, NOVA_XP = 0.25;
const novaLevelReq = n => Math.min(100, 30 + 5.5 * n | 0); // v5.3: 40 (was 60); extracted runs get there. v5.8: 30 + 5.5n on the steeper XP curve (about the same XP as 40 + 10n was)
// ---------- Veteran towers ----------
const VET_NAMES = ['Widowmaker', 'Old Faithful', 'Quiet Storm', 'Ninth Circle', 'Saint Static', 'The Accountant', 'Hollow King', 'Lucky Seven',
  'Last Light', 'Gravedigger', 'Little Sun', 'Night Shift', 'Paper Moon', 'Iron Psalm', 'Red Tide', 'Cold Comfort', 'Dead Reckoning',
  'Heartbreaker', 'Long Goodbye', 'Mercy', 'No Refunds', 'Overtime', 'Patience', 'Rust Bucket', 'Second Opinion', 'The Closer', 'The Usher',
  'Thunderhead', 'Vespers', 'Wildfire', 'Zero Hour', 'Bad News', 'Babel', 'Cinder', 'Diminuendo', 'Echo Six', 'Firewall', 'Halcyon',
  'Juniper', 'Kingmaker', 'Lullaby', 'Monday', 'Nemesis', 'Pilgrim', 'Reverie', 'Sundown', 'Tinderbox', 'Undertow', 'Vigil', 'Whisper'];
const vetThreshold = n => Math.round(12 * Math.pow(n, 2.6));
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const roman = n => ROMAN[n] || String(n);

// ---------- Codex (discoveries kept across runs) ----------
const COMBO_NAMES = ['SHATTER', 'THERMAL SHOCK', 'OVERLOAD', 'SUPERCONDUCT', 'COLLAPSE'];

const COMBO_DESC = {
  'SHATTER': 'Kinetic hit on a Frozen enemy deals burst damage',
  'THERMAL SHOCK': 'Thermal hit on a heavily Chilled enemy shatters the frost',
  'OVERLOAD': 'Thermal on Shocked or Arc on Burning causes an explosion',
  'SUPERCONDUCT': 'Arc hit on a Chilled enemy spreads Shock nearby',
  'COLLAPSE': 'Void hit at max Marks implodes the target',
};
// Collapse hits everything within 1.5 tiles for 2× the hit plus a share of each enemy's max HP. The max-HP part ignores how strong
// the wave is, so in long runs it was the engine of almost all damage; 5.8 rules (G.ascV >= 2) use `mob`, older recordings `old`
const COLLAPSE_HP = { mob: 0.02, old: 0.03, boss: 0.004 };
function dailyKey(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function dailySpec(key) {
  let h = 2166136261; for (const ch of key) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const seed = h >>> 0, r = mulberry32(seed), pool = ANOMALIES.slice(), anoms = [];
  while (anoms.length < 2) anoms.push(pool.splice(Math.floor(r() * pool.length), 1)[0].id);
  // v5.3 Daily Hunt: today's Nemesis, the same two genes for everyone
  const gp = ['plating', 'haste', 'bulk', 'shell', 'regen', 'ward', 'cloak', 'brood'], genes = [];
  while (genes.length < 2) { const g = gp[Math.floor(r() * gp.length)]; if (!genes.includes(g)) genes.push(g); }
  const sp = ['drone', 'swarmer', 'tank', 'splitter'][Math.floor(r() * 4)], el = ['K', 'T', 'C', 'A', 'V'][Math.floor(r() * 5)];
  // 5.8: the day's sector contract (drawn last, so the older fields keep their values)
  const sector = SECTORS[Math.floor(r() * SECTORS.length)].id;
  return { date: key, seed, anoms, chaos: 2, nemesis: { kind: 'strain', type: sp, genes, el, rank: 1, daily: 1 }, sector };
}
