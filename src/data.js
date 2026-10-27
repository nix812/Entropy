// ===================== ENTROPY — DATA =====================
'use strict';
const VERSION = '1.21.0';
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
            { name: 'Splinter Rail', desc: '+4 Pierce, ignores Armor, ×1.25 Damage', m: { pierce: 4, shred: 1, dmgX: 1.25 } }] },
  cryo: { name: 'Cryo Emitter', el: 'C', cost: 75, dmg: 5, rate: 1.0, range: 2.1, kind: 'pulse', st: { chill: 1 }, unlock: 1,
    blurb: 'Pulse that Chills nearby enemies.',
    specs: [{ name: 'Glacier Core', desc: '×1.5 Chill strength. Freeze lasts 0.6s longer', m: { chillPot: 1.5, freezeBonus: 0.6 } },
            { name: 'Shatter Field', desc: 'Chilled enemies in range take +60% Kinetic Damage', m: { shatterField: 0.6 } }] },
  missile: { name: 'Swarm Missile', el: 'T', cost: 120, dmg: 26, rate: 0.75, range: 3.6, kind: 'missile', pspd: 6, splash: 0.9, st: { burn: 0.5 }, unlock: 5,
    blurb: 'Homing missiles. Splash and Burn.',
    specs: [{ name: 'Cluster Pods', desc: 'Missiles split into 3 bomblets', m: { cluster: 3 } },
            { name: 'Napalm Payload', desc: 'Impacts leave burning ground', m: { napalm: 1 } }] },
  pylon: { name: 'Relay Pylon', el: 'N', cost: 100, dmg: 0, rate: 0, range: 2.0, kind: 'support', buffDmg: 15, buffRate: 10, unlock: 8,
    blurb: 'Boosts nearby towers. Reveals cloaked.',
    specs: [{ name: 'Amplifier', desc: '+20% Damage boost', m: { buffDmg: 20 } },
            { name: 'Uplink', desc: '+1 Range. Also boosts Crit Chance by 12%', m: { rangeAdd: 1, buffCrit: 12 } }] },
  snare: { name: 'Snare Beacon', el: 'N', cost: 90, dmg: 0, rate: 0, range: 3.5, kind: 'snare', net: 1.3, netSlow: 0.5, hold: 0.8, catches: 8, unlock: 4,
    blurb: 'Lures fliers off course into a slowing net.',
    specs: [{ name: 'Tangle Web', desc: 'Caught fliers are held 2s. Net slows 70%', m: { hold: 2, netSlow: 0.7 } },
            { name: 'Long Lure', desc: '+2 lure range, +6 catches per wave', m: { rangeAdd: 2, catches: 6 } }] },
  coil: { name: 'Arc Coil', el: 'A', cost: 100, dmg: 17, rate: 0.95, range: 2.8, kind: 'chain', chain: 3, st: { shock: 0.5 }, unlock: 10,
    blurb: 'Chain lightning. Applies Shock.',
    specs: [{ name: 'Tesla Crown', desc: '+3 Chain', m: { chain: 3 } },
            { name: 'Overvolt', desc: '×2 Shock effect, 12% chance to Stun', m: { shockX: 2, stun: 0.12 } }] },
  forge: { name: 'Credit Forge', el: 'N', cost: 150, dmg: 0, rate: 0, range: 0, kind: 'eco', income: 30, unlock: 12,
    blurb: 'Produces credits each wave.',
    specs: [{ name: 'Refinery', desc: '×2.2 Income', m: { incomeX: 2.2 } },
            { name: 'Bounty Net', desc: '+30% kill credits within 3 tiles', m: { bounty: 0.3 } }] },
  flame: { name: 'Flame Projector', el: 'T', cost: 90, dmg: 4.2, rate: 8, range: 1.9, kind: 'cone', st: { burn: 1 }, unlock: 15,
    blurb: 'Short-range cone. Applies Burn.',
    specs: [{ name: 'Inferno', desc: '×2 Burn damage', m: { burnX: 2 } },
            { name: 'Plasma Torch', desc: '+0.5 Range. Also applies Shock', m: { rangeAdd: 0.5, addShock: 0.35 } }] },
  lens: { name: 'Void Lens', el: 'V', cost: 140, dmg: 2.8, rate: 10, range: 3.2, kind: 'beam', rampMax: 4.5, st: { mark: 0.15 }, unlock: 20,
    blurb: 'Ramping beam. Applies Mark.',
    specs: [{ name: 'Event Horizon', desc: 'Ramps up to ×8 damage', m: { rampMax: 8 } },
            { name: 'Prism Split', desc: 'Splits into 3 beams. Ramps up to ×3.5', m: { beams: 3, rampMax: 3.5 } }] },
  emp: { name: 'EMP Mortar', el: 'A', cost: 130, dmg: 26, rate: 0.38, range: 4.2, kind: 'mortar', pspd: 4, splash: 1.2, stunDur: 0.6, unlock: 25,
    blurb: 'Lobbed shells that Stun an area.',
    specs: [{ name: 'Blackout Shell', desc: '1.2s Stun, +0.3 Splash', m: { stunDur: 1.2, splash: 0.3 } },
            { name: 'Ion Barrage', desc: 'Fires 3 shells per volley', m: { shells: 3 } }] },
  grav: { name: 'Gravity Well', el: 'V', cost: 150, dmg: 8, rate: 0.35, range: 2.6, kind: 'grav', pull: 0.7, unlock: 30,
    blurb: 'Pulls enemies back along the path.',
    specs: [{ name: 'Singularity', desc: '×3 Damage. Pulses apply Mark', m: { dmgX: 3, addMark: 1 } },
            { name: 'Tidal Lock', desc: '×2 pull distance', m: { pullX: 2 } }] },
};
const TOWER_ORDER = ['pulse', 'rail', 'cryo', 'snare', 'missile', 'pylon', 'coil', 'forge', 'flame', 'lens', 'emp', 'grav'];
const LV_DMG = [0, 1, 1.65, 2.6, 4.1, 6.4];
const LV_COST = [0, 1, 0.8, 1.2, 2.0, 3.0];
const MAX_LV = 5;

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
  { id: 'bulwark', pool: 'core', name: 'Bulwark Matrix', t: () => 'Shield fully recharges at the start of each wave' },
  { id: 'retribution', pool: 'core', name: 'Retribution', t: () => 'When an enemy reaches the core, it blasts everything within 2.5 tiles for 4× core damage' },
];
// legendaries the core can roll: its own plus the attack ones that work off any shooter
const CORE_LEGS = ['bulwark', 'retribution', 'detonator', 'siphon', 'ricochet', 'prism', 'echo'];
// Core relocation at wormhole checkpoints: first move each run is free, then a fixed price
const RELOCATE_COST = 800, RELOCATE_RADIUS = 10;
// Space pirates deliver the salvage. Lines are rare and varied so they stay funny.
const PIRATE_LINES = {
  normal: ['Yarr!', 'Special delivery', "That's not ours", 'Tell no one', 'Insurance fraud!', 'Fell off a freighter', 'No refunds', 'Arr, butterfingers', 'Keep the change', 'Dropping the evidence', 'This never happened', 'Free sample!', 'Mind the paint', 'Totally legal cargo', 'Ye saw nothing', 'Express shipping'],
  cursed: ['Heh heh heh', 'Totally safe', 'Open it. Go on.', 'Do NOT shake', "Don't mind the noises", 'Our gift to you'],
  gold: ["Cap'n's orders", "Hide it from the Cap'n", 'Treasure!', 'X marks the spot', 'Mutiny pays'],
  thief: ['Finders keepers', "I'll take that", 'Yoink', 'Salvage rights!', 'Mine now', 'Thank ye kindly'],
  stow: ['Arr!', 'Surprise!', 'Ahoy, core!', 'Stowaway!'],
};
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
const ENEMIES = {
  drone:    { name: 'Drone', hp: 30, spd: 1.15, cr: 4, leak: 4, from: 1, w: 10, desc: 'Basic ground unit' },
  swarmer:  { name: 'Swarmer', hp: 11, spd: 1.8, cr: 2, leak: 2, from: 2, w: 7, group: 4, desc: 'Fast and fragile. Arrives in groups' },
  tank:     { name: 'Juggernaut', hp: 150, spd: 0.6, cr: 12, leak: 12, from: 3, w: 4, armor: 0.4, res: { T: 0.15 }, desc: 'Slow and heavily armored. Resists Thermal' },
  flyer:    { name: 'Skimmer', hp: 38, spd: 1.2, cr: 6, leak: 6, from: 4, w: 5, fly: 1, res: { A: -0.25 }, desc: 'Flies straight at the core. Weak to Arc' },
  splitter: { name: 'Splitter', hp: 80, spd: 0.85, cr: 8, leak: 8, from: 6, w: 4, desc: 'Splits into 3 Swarmers on death' },
  phantom:  { name: 'Phantom', hp: 52, spd: 1.25, cr: 8, leak: 6, from: 7, w: 4, cloak: 1, res: { V: -0.3 }, desc: 'Cloaks periodically. Weak to Void' },
  medic:    { name: 'Mender', hp: 70, spd: 0.95, cr: 10, leak: 8, from: 9, w: 3, desc: 'Heals nearby enemies' },
  shielder: { name: 'Aegis', hp: 90, spd: 0.85, cr: 10, leak: 10, from: 12, w: 3, res: { K: 0.2 }, desc: 'Shields nearby enemies. Resists Kinetic' },
  pirate: { name: 'Pirate Skiff', hp: 70, spd: 2.6, cr: 10, leak: 0, from: 9999, w: 0, fly: 1, desc: 'Swoops in to steal unclaimed salvage. Shoot it down to recover the loot. Never attacks the core' },
  voidling: { name: 'Voidling', hp: 25, spd: 1.6, cr: 1, leak: 4, from: 999, w: 0, fly: 1, desc: 'Flies. Spawned by a Maelstrom' },
};
const BOSSES = [
  { id: 'behemoth', name: 'Behemoth', hp: 40, spd: 0.45, armor: 0.3, size: 2, desc: 'Spawns Swarmers' },
  { id: 'queen', name: 'Hive Queen', hp: 30, spd: 0.6, fly: 1, size: 2, desc: 'Flies. Spawns Skimmers' },
  { id: 'wraith', name: 'Phase Wraith', hp: 30, spd: 0.7, size: 2, desc: 'Teleports forward and cloaks' },
  { id: 'overmind', name: 'Overmind', hp: 36, spd: 0.5, size: 2, desc: 'Disables nearby towers' },
  { id: 'titan', name: 'Titan', hp: 52, spd: 0.4, armorAll: 0.5, size: 2, desc: 'Armor breaks at 66% and 33% HP' },
  // oddballs: random stand-ins on boss waves
  { id: 'cat', odd: 1, tip: 'Swats towers, naps', name: 'Mr. Whiskers', hp: 38, spd: 0.55, size: 2, desc: 'Swats nearby towers offline. Naps mid-lane, and takes far less damage while asleep',
    titles: ['Devourer of Moons', 'Knocker of Things Off Tables', 'Destroyer of Couches', 'Who Is A Good Boy (No)'] },
  { id: 'gloop', odd: 1, tip: 'Splits when popped', name: 'Gloop', hp: 30, spd: 0.5, size: 2, desc: 'Splits into two smaller Gloops on death. Twice',
    titles: ['The Unbothered', 'Lord of the Leftovers', 'It Came From The Fridge', 'Mostly Water'] },
  { id: 'whale', odd: 1, tip: 'Flies, heals allies', name: 'Space Whale', hp: 58, spd: 0.32, fly: 1, size: 2, desc: 'Flies. Its song heals every enemy nearby',
    titles: ['Singer of the Deep Void', 'Big Blue', 'Krill Enthusiast', 'Just Passing Through'] },
  { id: 'duck', odd: 1, tip: 'Hops, startles towers', name: 'Quackzilla', hp: 24, spd: 0.85, size: 2, desc: 'Fast. Every quack hops it forward and startles towers nearby',
    titles: ['Bath Time Is Over', 'The Rubber Reckoning', 'Squeaks When Hit', 'Unsinkable'] },
  { id: 'fsm', odd: 1, tip: 'Flies, seizes towers', name: 'Flying Spaghetti Monster', hp: 40, spd: 0.5, fly: 1, size: 2, desc: 'Flies. Noodly appendages seize towers. Drops meatballs',
    titles: ['His Noodly Appendage', 'Al Dente', 'Touched By Marinara', 'Pastafarian Prophecy'] },
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
  { id: 'swarm', name: 'Swarm Tide', good: 0, w: 8, from: 5, desc: 'Twice the enemies at half HP' },
  { id: 'elite', name: 'Elite Tide', good: 0, w: 6, from: 10, desc: 'Many more Elites' },
  { id: 'blackout', name: 'Blackout', good: 0, w: 6, from: 12, desc: '−20% tower Range' },
  { id: 'regen', name: 'Nanite Bloom', good: 0, w: 6, from: 14, desc: 'Enemies regenerate HP' },
  { id: 'phase', name: 'Phase Shift', good: 0, w: 6, from: 16, desc: 'Enemies teleport forward' },
  { id: 'gold', name: 'Gold Rush', good: 1, w: 7, from: 5, desc: '×2 Credits' },
  { id: 'overcharge', name: 'Overcharge', good: 1, w: 6, from: 5, desc: '+30% Attack Speed' },
  { id: 'meteor', name: 'Meteor Shower', good: 1, w: 6, from: 7, desc: 'Meteors strike the path' },
];

// ---------- Abilities ----------
const ABILITIES = {
  strike: { name: 'Orbital Strike', key: 'ORB', short: 'Strike', desc: 'Tap a target. Heavy area damage.', target: 1 },
  nova: { name: 'Entropy Nova', key: 'NOV', short: 'Nova', desc: 'All enemies lose 35% HP (Bosses 10%).' },
  stasis: { name: 'Stasis Field', key: 'STS', short: 'Stasis', desc: 'Freezes all enemies for 4s.' },
  overclock: { name: 'Frenzy', key: 'FRZ', short: 'Frenzy', desc: '+100% Attack Speed for 8s.' },
};
const ABIL_ORDER = ['strike', 'nova', 'stasis', 'overclock'];
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
];

const CHAOS_LEVELS = [
  { name: 'Calm', ev: 0.5, storm: 0.6, elite: 0.8, score: 0.8, hp: 0.7, rows: 22, lanes: [16, 30, 46, 64] },
  { name: 'Normal', ev: 1, storm: 1, elite: 1, score: 1, hp: 1, rows: 26, lanes: [15, 28, 42, 58, 78] },
  { name: 'Unstable', ev: 1.5, storm: 1.5, elite: 1.25, score: 1.35, hp: 1.15, rows: 30, lanes: [12, 24, 36, 50, 66, 84] },
  { name: 'Pandemonium', ev: 2.5, storm: 2.5, elite: 1.6, score: 1.8, hp: 1.5, cr: 0.8, rows: 34, lanes: [1, 10, 20, 32, 46, 62, 80, 100] },
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
  abilCharge: v => `−${v}% score needed per ability charge`, abilPower: v => `+${v}% ability power`,
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
  loadout: () => 'Choose which abilities milestones can grant. +25% ability power for each one left out',
  interest: v => `Earn ${v}% interest on banked credits each wave (max 300)`, fieldRepair: v => `Waves with no leaks repair ${v}% core HP`,
  burnCrit: () => 'Kinetic hits on Burning enemies always crit', ovlBurn: () => 'Overload applies Burn to every enemy it hits',
  superChill: () => 'Superconduct also Chills',
  napalmKill: () => 'Thermal kills leave burning ground for 2s', multiA: v => `Arc towers hit +${v} target`,
  freezeImmRed: v => `Enemies can be Frozen again ${v}% sooner`, markVoid: v => `Each Mark adds +${v}% Void damage taken`,
  salvage: () => 'Kills grant +1 credit for every 10 waves reached',
  kBurn: v => `Kinetic hits: ${v}% chance to Burn`, chillVoid: v => `Hits on Chilled enemies: ${v}% chance to Mark`,
};
const SMALL_NAME = {
  dmg: 'Damage', dmgK: 'Kinetic Damage', dmgT: 'Thermal Damage', dmgC: 'Cryo Damage', dmgA: 'Arc Damage', dmgV: 'Void Damage',
  rate: 'Cadence', rateK: 'Autoloader', rateA: 'Discharge', range: 'Optics', critC: 'Precision', critM: 'Lethality',
  P: 'Power', Tm: 'Tempo', F: 'Focus', I: 'Integrity', burnDmg: 'Accelerant', burnChance: 'Kindling', chillChance: 'Frost',
  shockChance: 'Static', markChance: 'Null', burnDur: 'Smolder', chillPot: 'Permafrost', freezeDur: 'Stillness',
  shockEff: 'Voltage', splash: 'Blast Radius', costRed: 'Supply Lines', upgRed: 'Toolchain', credits: 'Salvage',
  coreHP: 'Hull Plating', shield: 'Barrier', shieldRegen: 'Capacitance', abilPower: 'Uplink', abilCharge: 'Telemetry',
  affixLuck: 'Mutation', eliteDmg: 'Hunter', armorPen: 'Penetrator', frozenVuln: 'Brittle', knock: 'Recoil', xp: 'Insight',
};

const SECTORS = [
  { id: 'K', name: 'Ballistics', col: '#efe6cf', attr: 'P', spine: [{ dmgK: 8 }, { critC: 3 }, { rateK: 6 }],
    clusters: [
      { name: 'Hollow Points', fx: { critSplash: 40, critM: 15 }, smalls: [{ critM: 10 }, { dmgK: 6 }, { critM: 10 }] },
      { name: 'Rifling', fx: { fifthCrit: 1, rateK: 10 }, smalls: [{ rateK: 5 }, { range: 4 }, { rateK: 5 }] },
      { name: 'Armor Piercer', fx: { shredStack: 3, armorPen: 30 }, smalls: [{ armorPen: 10 }, { eliteDmg: 6 }, { armorPen: 10 }] }],
    mastery: { name: 'Ballistic Mastery', fx: { dmgK: 15 }, opts: [
      { name: 'Overpenetration', fx: { pierceK: 1, pierceKeep: 1 } }, { name: 'Deadeye', fx: { critCK: 15, critMK: 50 } }, { name: 'Suppression', fx: { kSlow: 15 } }], smalls: [{ dmgK: 8 }, { critC: 3 }] },
    keystone: { name: 'Glass Cannon Array', ks: 'glass', lines: ['+60% Damage', '−40% core max HP and shield'], smalls: [{ dmg: 5 }, { dmg: 5 }] } },
  { id: 'T', name: 'Combustion', col: '#ff7b39', attr: 'P', spine: [{ dmgT: 8 }, { burnDmg: 10 }, { burnChance: 3 }],
    clusters: [
      { name: 'Accelerant', fx: { burnVuln: 20, burnDmg: 10 }, smalls: [{ burnDmg: 8 }, { burnChance: 3 }, { burnDmg: 8 }] },
      { name: 'Flashpoint', fx: { burnBoom: 25, dmgT: 10 }, smalls: [{ dmgT: 6 }, { splash: 0.1 }, { dmgT: 6 }] },
      { name: 'Chain Ignition', fx: { chainIgnite: 1, burnDur: 20 }, smalls: [{ burnDur: 10 }, { burnDmg: 8 }, { burnDur: 10 }] }],
    mastery: { name: 'Pyre Mastery', fx: { dmgT: 15 }, opts: [
      { name: 'Wildfire', fx: { burnSpread: 1 } }, { name: 'Inferno Core', fx: { infernoCore: 1 } }, { name: 'Heat Sink', fx: { heatSink: 1 } }], smalls: [{ dmgT: 8 }, { burnDmg: 10 }] },
    keystone: { name: 'Conflagration', ks: 'conflag', lines: ['All damage becomes Thermal', '+25% Thermal Damage, +150% Burn damage', 'Cannot Chill or Freeze'], smalls: [{ dmgT: 6 }, { burnDmg: 8 }] } },
  { id: 'A', name: 'Voltaic', col: '#ffe14d', attr: 'Tm', spine: [{ dmgA: 8 }, { rate: 4 }, { shockChance: 3 }],
    clusters: [
      { name: 'Capacitors', fx: { capacitor: 1, dmgA: 10 }, smalls: [{ dmgA: 6 }, { rateA: 4 }, { dmgA: 6 }] },
      { name: 'Forked Lightning', fx: { chain: 1, chainKeep: 1 }, smalls: [{ shockChance: 4 }, { dmgA: 6 }, { shockChance: 4 }] },
      { name: 'Overvolt', fx: { shockBurst: 15, shockEff: 25 }, smalls: [{ shockEff: 12 }, { rate: 3 }, { shockEff: 12 }] }],
    mastery: { name: 'Voltaic Mastery', fx: { dmgA: 15 }, opts: [
      { name: 'Static Field', fx: { shockLong: 1 } }, { name: 'Thunderstrike', fx: { thunder: 1 } }, { name: 'Overcharged', fx: { ovlFree: 1, overloadRad: 50 } }], smalls: [{ dmgA: 8 }, { rate: 4 }] },
    keystone: { name: 'Overclocked Grid', ks: 'overgrid', lines: ['+40% Attack Speed', 'Attacks have a 3% chance to jam the tower for 1.5s'], smalls: [{ rate: 4 }, { rate: 4 }] } },
  { id: 'C', name: 'Cryogenics', col: '#6ae2ff', attr: 'F', spine: [{ dmgC: 8 }, { chillPot: 8 }, { chillChance: 3 }],
    clusters: [
      { name: 'Deep Freeze', fx: { freezeAt: 1, freezeDur: 0.3 }, smalls: [{ chillPot: 8 }, { freezeDur: 0.15 }, { chillPot: 8 }] },
      { name: 'Brittle', fx: { iceShards: 1, frozenVuln: 15 }, smalls: [{ frozenVuln: 8 }, { dmgC: 6 }, { frozenVuln: 8 }] },
      { name: 'Frost Lattice', fx: { chillSplash: 1, dmgC: 10 }, smalls: [{ chillChance: 4 }, { range: 4 }, { chillChance: 4 }] }],
    mastery: { name: 'Cryo Mastery', fx: { dmgC: 15 }, opts: [
      { name: 'Long Winter', fx: { chillSlowDecay: 1 } }, { name: 'Cold Snap', fx: { coldSnap: 1 } }, { name: 'Glacial', fx: { glacial: 15 } }], smalls: [{ dmgC: 8 }, { chillPot: 8 }] },
    keystone: { name: 'Absolute Zero', ks: 'abszero', lines: ['Chilled enemies take +50% damage', '−50% Thermal Damage'], smalls: [{ chillChance: 4 }, { dmgC: 6 }] } },
  { id: 'V', name: 'Singularity', col: '#b86cff', attr: 'F', spine: [{ dmgV: 8 }, { markChance: 3 }, { eliteDmg: 6 }],
    clusters: [
      { name: 'Event Horizon', fx: { markSlow: 30, markMax: 3 }, smalls: [{ markChance: 3 }, { dmgV: 6 }, { markChance: 3 }] },
      { name: 'Null Lens', fx: { rampKeep: 1, dmgV: 10 }, smalls: [{ dmgV: 6 }, { markChance: 4 }, { dmgV: 6 }] },
      { name: 'Gravitic Pull', fx: { knock: 6, knockMark: 1 }, smalls: [{ knock: 1 }, { dmg: 3 }, { knock: 1 }] }],
    mastery: { name: 'Void Mastery', fx: { dmgV: 15 }, opts: [
      { name: 'Black Hole', fx: { blackHole: 1 } }, { name: 'Entropic Decay', fx: { markPerma: 1 } }, { name: 'Void Siphon', fx: { voidSiphon: 1 } }], smalls: [{ dmgV: 8 }, { markChance: 3 }] },
    keystone: { name: 'Singularity', ks: 'singularity', lines: ['+100% Void Damage', '−30% all other damage'], smalls: [{ dmgV: 6 }, { dmgV: 6 }] } },
  { id: 'E', name: 'Bastion', col: '#59f0b4', attr: 'I', spine: [{ coreHP: 12 }, { credits: 4 }, { shield: 6 }],
    clusters: [
      { name: 'Reinforced Core', fx: { shieldWave: 1, coreHP: 30, shieldRegen: 30 }, smalls: [{ coreHP: 10 }, { shieldRegen: 15 }, { coreHP: 10 }] },
      { name: 'Logistics', fx: { sellPct: 85, costRed: 8 }, smalls: [{ costRed: 3 }, { credits: 4 }, { upgRed: 3 }] },
      { name: 'Command Uplink', fx: { loadout: 1, abilCharge: 10 }, smalls: [{ abilPower: 8 }, { abilCharge: 5 }, { abilPower: 8 }] }],
    mastery: { name: 'Bastion Mastery', fx: { coreHP: 20 }, opts: [
      { name: 'Retaliation', fx: { coreDmg: 60, coreRate: 30, coreRange: 1 } }, { name: 'Compound Interest', fx: { interest: 2 } }, { name: 'Field Repairs', fx: { fieldRepair: 5 } }], smalls: [{ coreHP: 10 }, { shield: 6 }] },
    keystone: { name: 'Diminishing Returns', ks: 'dimret', lines: ['+50% Credits from all sources', 'Each copy of a tower costs 12% more'], smalls: [{ credits: 4 }, { credits: 4 }] } },
];
const HYBRIDS = [
  { name: 'Incendiary Rounds', fx: { burnCrit: 1, dmgK: 6, dmgT: 6 } },
  { name: 'Plasma Coupling', fx: { ovlBurn: 1, overloadRad: 30 } },
  { name: 'Superconductors', fx: { superChill: 1, superRad: 60 } },
  { name: 'Stasis Theory', fx: { stasisDur: 3, chillVoid: 15 } },
  { name: 'Storm Caller', fx: { stormFreq: 50, stormPow: 50 } },
  { name: 'Lone Wolf', fx: { loneWolf: 35 } },
];
const ARC_KEYSTONES = {
  2: { name: 'Prismatic Array', ks: 'prismatic', lines: ['Hits apply a random status', '−10% Damage'], smalls: [{ shockChance: 3 }, { chillChance: 3 }] },
  4: { name: 'Chaos Engine', ks: 'chaos', lines: ['+150% affix rarity', 'New towers also roll a Curse'], smalls: [{ affixLuck: 10 }, { affixLuck: 10 }] },
  5: { name: 'Unbreakable', ks: 'unbreakable', lines: ['Survive a lethal hit at 50% HP, once per 10 waves', '−10% tower Damage'], smalls: [{ coreHP: 10 }, { shield: 8 }] },
};

// Outer spiral arms: one per sector, each ends in a new notable
const ARMS = [
  { name: 'Railgun Doctrine', fx: { pierceK: 1, dmgK: 10 } },
  { name: 'Napalm Rain', fx: { napalmKill: 1, burnDmg: 10 } },
  { name: 'Ion Lattice', fx: { multiA: 1, dmgA: 5 } },
  { name: 'Hoarfrost', fx: { freezeImmRed: 60, chillPot: 10 } },
  { name: 'Dark Matter', fx: { markVoid: 5, dmgV: 5 } },
  { name: 'Salvage Drones', fx: { salvage: 1, credits: 4 } },
];
// Z-axis Orbits: rings of 3 satellites around the vertical axis. Each satellite affects the sector it faces; rotate the ring to retarget.
const SECTOR_EL = ['K', 'T', 'A', 'C', 'V', 'E'];
const ORBITS = {
  zo1: { name: 'Zenith Orbit I', z: 150, col: '#9fd8ff', sats: [
    { name: 'Amplifier', d: '+30% Damage for the faced element', k: 'dmg', v: 30, t: el => `+30% ${EL[el].name} Damage`, E: { coreDmg: 40 } },
    { name: 'Accelerator', d: '+20% Attack Speed for the faced element', k: 'rate', v: 20, t: el => `+20% ${EL[el].name} Attack Speed`, E: { credits: 12 } },
    { name: 'Catalyst', d: '+12% status chance for the faced element (Kinetic: Crit Chance)', k: 'status', v: 12, t: el => el === 'K' ? '+12% Kinetic Crit Chance' : `+12% chance to ${{ T: 'Burn', C: 'Chill', A: 'Shock', V: 'Mark' }[el]} for ${EL[el].name} towers`, E: { shield: 30 } }] },
  zo2: { name: 'Zenith Orbit II', z: 330, col: '#9fd8ff', sats: [
    { name: 'Focusing Lens', d: '+15% Range for the faced element', k: 'range', v: 15, t: el => `+15% ${EL[el].name} Range`, E: { coreRange: 1 } },
    { name: 'Harmonic', d: 'Faced element towers count +1 Resonance', k: 'reson', v: 1, t: el => `${EL[el].name} towers count +1 Resonance`, E: { costRed: 6 } },
    { name: 'Veteran Beacon', d: 'Faced element towers rank up 2× faster', k: 'vxp', v: 100, t: el => `${EL[el].name} towers rank up 2× faster`, E: { xp: 10 } }] },
  no1: { name: 'Nadir Orbit I', z: -150, col: '#ff5fa8', sats: [
    { name: 'Flux Anchor', d: '+40% Damage for the faced element, −8% all other damage', k: 'flux', v: 40, t: el => `+40% ${EL[el].name} Damage, −8% all other damage`, E: { credits: 20, dmg: -5 } },
    { name: 'Storm Beacon', d: 'Storms of the faced element appear 3× as often', k: 'storm', v: 1, t: el => `${STORMS[{ K: 'static', T: 'solar', C: 'cryo', A: 'ion', V: 'void' }[el]].name}s appear 3× as often`, E: { stormPow: 25 } },
    { name: 'Volatile Core', d: 'Faced element hits: 10% chance to deal ×4 damage', k: 'vol', v: 10, t: el => `${EL[el].name} hits: 10% chance to deal ×4 damage`, E: { coreDmg: 80 } }] },
  no2: { name: 'Nadir Orbit II', z: -330, col: '#ff5fa8', sats: [
    { name: 'Entropy Well', d: 'Kills by the faced element fill the Entropy gauge', k: 'ent', v: 1, t: el => `${EL[el].name} kills fill the Entropy gauge`, E: { abilCharge: 15 } },
    { name: 'Rift Tap', d: 'Faced element: +6% Damage per active Anomaly', k: 'rift', v: 6, t: el => `+6% ${EL[el].name} Damage per active Anomaly`, E: { credits: 15 } },
    { name: 'Event Lens', d: 'Combos triggered by the faced element deal +60%', k: 'combo', v: 60, t: el => `Combos triggered by ${EL[el].name} hits deal +60%`, E: { shieldRegen: 50 } }] },
};
const orbitRot = id => (typeof PROF !== 'undefined' && PROF && PROF.orbit && PROF.orbit[id]) || 0;
const satSector = n => ((n.sat * 2 + orbitRot(n.orbit)) % 6 + 6) % 6;
function satLines(n) {
  const O = ORBITS[n.orbit], S = O.sats[n.sat], si = satSector(n), el = SECTOR_EL[si];
  if (el === 'E') return [`Facing ${SECTORS[si].name}: ` + Object.keys(S.E).map(k => STAT_TXT[k](S.E[k])).join(', ')];
  return [`Facing ${SECTORS[si].name}: ${S.t(el)}`];
}
const WEB_SCALE = 1.3, WEB_VER = 2;
function buildTree() {
  const nodes = {}, edges = [];
  const add = (id, x, y, kind, sector, name, fx, extra) => {
    nodes[id] = Object.assign({ id, x, y, kind, sector, name, fx: fx || {}, adj: [] }, extra || {});
    return nodes[id];
  };
  const link = (a, b) => { nodes[a].adj.push(b); nodes[b].adj.push(a); edges.push([a, b]); };
  const pol = (r, deg) => { const a = deg * Math.PI / 180; return [r * Math.cos(a), r * Math.sin(a)]; };
  const smallName = fx => SMALL_NAME[Object.keys(fx)[0]] || 'Node';

  // merged travel nodes: two old smalls folded into one, at 90% of their sum
  const mf = (...fs) => { const o = {}; for (const f of fs) for (const k in f) o[k] = (o[k] || 0) + f[k]; for (const k in o) { const v = o[k] * (fs.length > 1 ? 0.9 : 1); o[k] = Math.abs(v) < 1 ? Math.round(v * 100) / 100 : Math.round(v); } return o; };
  add('start', 0, 0, 'start', -1, 'Entropy Core', { P: 5, Tm: 5, F: 5, I: 5 });
  SECTORS.forEach((S, i) => {
    const a = -90 + i * 60, N = SECTORS[(i + 1) % 6], A8 = { [S.attr]: 8 };
    let [x, y] = pol(80, a);
    add(`g${i}`, x, y, 'small', i, `${S.name} Gate`, { [S.attr]: 6, xp: 2 });
    link('start', `g${i}`);
    [x, y] = pol(88, a + 30);
    const mfx = {}; mfx[S.attr] = 5; mfx[N.attr] = (mfx[N.attr] || 0) + 5;
    add(`m${i}`, x, y, 'small', i, 'Conduit', mfx);
    // spine: four steps out from the gate
    const spineFx = [A8, mf(S.spine[0], A8), Object.assign({}, S.spine[1]), mf(S.spine[2], A8)];
    for (let j = 0; j < 4; j++) {
      [x, y] = pol(140 + j * 80, a);
      add(`s${i}_${j}`, x, y, 'small', i, smallName(spineFx[j]), spineFx[j]);
      link(j === 0 ? `g${i}` : `s${i}_${j - 1}`, `s${i}_${j}`);
    }
    // clusters: spine -> two smalls -> notable, alternating sides so neighbours never meet
    [[1, -1], [2, 1], [3, -1]].forEach(([j, side], ci) => {
      const C = S.clusters[ci];
      const [sx, sy] = pol(140 + j * 80, a), ar = a * Math.PI / 180;
      const tx = -Math.sin(ar) * side, ty = Math.cos(ar) * side, rx = Math.cos(ar), ry = Math.sin(ar);
      const p = `c${i}_${ci}`, fa = mf(C.smalls[0], C.smalls[2]), fb = C.smalls[1];
      add(`${p}a`, sx + tx * 40, sy + ty * 40, 'small', i, smallName(fa), fa);
      add(`${p}b`, sx + tx * 80 + rx * 14, sy + ty * 80 + ry * 14, 'small', i, smallName(fb), fb);
      add(`${p}n`, sx + tx * 120, sy + ty * 120, 'notable', i, C.name, C.fx);
      link(`s${i}_${j}`, `${p}a`); link(`${p}a`, `${p}b`); link(`${p}b`, `${p}n`);
    });
    // keystone & mastery branches
    const K = S.keystone, M = S.mastery;
    [[K, -1, 'k', 'keystone'], [M, 1, 'x', 'mastery']].forEach(([D, sd, tag, kind]) => {
      const fx = mf(D.smalls[0], D.smalls[1]);
      [x, y] = pol(495, a + sd * 6);
      add(`${tag}${i}_0`, x, y, 'small', i, smallName(fx), fx);
      link(`s${i}_3`, `${tag}${i}_0`);
      [x, y] = pol(580, a + sd * 11);
      add(`${tag}${i}`, x, y, kind, i, D.name, D.fx || {}, D.ks ? { ks: D.ks, lines: D.lines } : D.opts ? { opts: D.opts } : null);
      link(`${tag}${i}_0`, `${tag}${i}`);
    });
  });
  // ring of hybrids between sectors, plus three arc keystones
  SECTORS.forEach((S, i) => {
    const a = -90 + i * 60, n = (i + 1) % 6, N = SECTORS[n];
    link(`g${i}`, `m${i}`); link(`m${i}`, `g${n}`);
    let [x, y] = pol(455, a + 14);
    add(`r${i}_0`, x, y, 'small', i, smallName(S.spine[0]), Object.assign({}, S.spine[0]));
    [x, y] = pol(455, a + 46);
    add(`r${i}_1`, x, y, 'small', n, smallName(N.spine[0]), Object.assign({}, N.spine[0]));
    [x, y] = pol(470, a + 30);
    add(`h${i}`, x, y, 'notable', i, HYBRIDS[i].name, HYBRIDS[i].fx, { hybrid: 1 });
    link(`s${i}_3`, `r${i}_0`); link(`r${i}_0`, `h${i}`); link(`h${i}`, `r${i}_1`); link(`r${i}_1`, `s${n}_3`);
    const AK = ARC_KEYSTONES[i];
    if (AK) {
      const fx = mf(AK.smalls[0], AK.smalls[1]);
      [x, y] = pol(540, a + 30);
      add(`e${i}_0`, x, y, 'small', i, smallName(fx), fx);
      link(`h${i}`, `e${i}_0`);
      [x, y] = pol(605, a + 30);
      add(`e${i}`, x, y, 'keystone', i, AK.name, {}, { ks: AK.ks, lines: AK.lines });
      link(`e${i}_0`, `e${i}`);
    }
  });
  // outer spiral arms
  SECTORS.forEach((S, i) => {
    const a = -90 + i * 60, A8 = { [S.attr]: 8 };
    const f0 = mf(S.spine[0], A8), f1 = mf(S.spine[1], A8);
    let [x, y] = pol(670, a + 21);
    add(`w${i}_0`, x, y, 'small', i, smallName(f0), f0); link(`x${i}`, `w${i}_0`);
    [x, y] = pol(765, a + 34);
    add(`w${i}_1`, x, y, 'small', i, smallName(f1), f1); link(`w${i}_0`, `w${i}_1`);
    [x, y] = pol(850, a + 47);
    add(`w${i}`, x, y, 'notable', i, ARMS[i].name, ARMS[i].fx, { arm: 1 });
    link(`w${i}_1`, `w${i}`);
  });
  // the Z-axis: Zenith above the galactic plane, Nadir below
  const col = (sign, tag, orbs, ks, smallFx) => {
    let prev = 'start', zi = 0;
    const axis = (z, fx) => { const id = `${tag}${zi++}`; add(id, 0, 0, 'small', -2, smallName(fx), fx, { z, col: ORBITS[orbs[0]].col }); link(prev, id); prev = id; };
    axis(sign * 70, smallFx[0]);
    orbs.forEach((oid, oi) => {
      const O = ORBITS[oid];
      add(oid, 0, 0, 'orbit', -2, O.name, {}, { z: O.z, col: O.col, orbitHub: oid });
      link(prev, oid); prev = oid;
      O.sats.forEach((S, k) => { add(`${oid}_${k}`, 0, 0, 'sat', -2, S.name, {}, { z: O.z, col: O.col, orbit: oid, sat: k }); link(oid, `${oid}_${k}`); });
      axis(sign * (O.z + (oi ? 70 : 60)), smallFx[1 + oi * 2]);
      if (!oi) axis(sign * (O.z + 120), smallFx[2]);
    });
    add(`${tag}k`, 0, 0, 'keystone', -2, ks.name, {}, { z: sign * 480, col: ORBITS[orbs[0]].col, ks: ks.ks, lines: ks.lines });
    link(prev, `${tag}k`);
  };
  col(1, 'za', ['zo1', 'zo2'], { name: 'Celestial Order', ks: 'celestial', lines: ['Towers roll 2 affixes per build and upgrade', 'Legendary affixes can no longer roll'] },
    [{ F: 6, I: 4 }, { F: 8 }, { I: 8 }, { F: 6, Tm: 4 }]);
  col(-1, 'na', ['no1', 'no2'], { name: 'Event Singularity', ks: 'singular', lines: ['Entropy fills 2× faster', 'Each Anomaly grants +10% score instead of +5%', 'You cannot Stabilize'] },
    [{ P: 6, Tm: 4 }, { Tm: 8 }, { P: 8 }, { P: 6, F: 4 }]);
  // spread the disk out for phone-sized tap targets
  for (const id in nodes) { const n = nodes[id]; if (n.sector !== -2) { n.x *= WEB_SCALE; n.y *= WEB_SCALE; } }
  // slight thickness so the disk reads as 3D when tilted
  for (const id in nodes) { const n = nodes[id]; if (n.z === undefined) { const h = Math.sin(n.x * 12.9898 + n.y * 78.233) * 43758.5453; n.z = ((h - Math.floor(h)) - 0.5) * (n.kind === 'small' ? 26 : 16) * Math.min(1, Math.hypot(n.x, n.y) / 300); } }
  nodes.start.z = 0;
  return { nodes, edges, list: Object.values(nodes) };
}
const TREE = buildTree();

function nodeLines(n) {
  const out = [];
  if (n.sat !== undefined) return satLines(n);
  if (n.orbitHub) return ['Unlocks 3 satellites. Each boosts the sector it faces.', 'Rotate the ring to change what they affect.'];
  if (n.lines) out.push(...n.lines);
  for (const k in n.fx) { const f = STAT_TXT[k]; if (f) out.push(f(n.fx[k])); }
  return out;
}

// XP curve
const xpForLevel = L => Math.round(3000 + 250 * L + 3 * L * L);
function levelFromXP(xp) {
  let L = 0, need = xpForLevel(0);
  while (xp >= need) { xp -= need; L++; need = xpForLevel(L); }
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
const novaLevelReq = n => Math.min(150, 60 + 10 * n);
// Star Ranks: unlimited points into a finished constellation, with gentle diminishing returns
const STARS = {
  s0: { key: 'dmgK', a: 1.5 }, s1: { key: 'dmgT', a: 1.5 }, s2: { key: 'dmgA', a: 1.5 }, s3: { key: 'dmgC', a: 1.5 }, s4: { key: 'dmgV', a: 1.5 },
  s5: { key: 'coreHP', a: 3 }, zen: { key: 'dmg', a: 0.8 }, nad: { key: 'rate', a: 0.6 },
};
const starTotal = (rid, n) => n > 0 ? STARS[rid].a * 20 * Math.log(1 + n / 20) : 0;
const REGION_IDS = ['s0', 's1', 's2', 's3', 's4', 's5', 'zen', 'nad'];
const REGION_NAME = { s0: 'The Archer', s1: 'The Phoenix', s2: 'The Thunderbolt', s3: 'The Crystal', s4: 'The Maw', s5: 'The Bulwark', zen: 'The Crown', nad: 'The Serpent' };
function regionOf(n) { if (n.sector >= 0) return 's' + n.sector; if (n.sector === -2) return n.z > 0 ? 'zen' : 'nad'; return null; }
const REGION_NODES = {};
for (const n of TREE.list) { const r = regionOf(n); if (r) (REGION_NODES[r] = REGION_NODES[r] || []).push(n.id); }
// a remnant keeps a sector's notables (clusters + arm) active forever
const remnantNodes = rid => REGION_NODES[rid].filter(id => TREE.nodes[id].kind === 'notable' && !TREE.nodes[id].hybrid);

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
function dailyKey(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function dailySpec(key) {
  let h = 2166136261; for (const ch of key) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const seed = h >>> 0, r = mulberry32(seed), pool = ANOMALIES.slice(), anoms = [];
  while (anoms.length < 2) anoms.push(pool.splice(Math.floor(r() * pool.length), 1)[0].id);
  return { date: key, seed, anoms, chaos: 2 };
}
