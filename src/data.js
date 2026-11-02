// ===================== ENTROPY — DATA =====================
'use strict';
const VERSION = '5.7.3';
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
    blurb: 'Ramping beam. Applies Mark.',
    specs: [{ name: 'Event Horizon', desc: 'Ramps up to ×4.3 damage', m: { rampMax: 4.3 } },
            { name: 'Prism Split', desc: 'Splits into 3 beams. Ramps up to ×2.5', m: { beams: 3, rampMax: 2.5 } }] },
  emp: { name: 'EMP Mortar', el: 'A', cost: 130, dmg: 40, rate: 0.38, range: 4.2, kind: 'mortar', pspd: 4, splash: 1.2, stunDur: 0.6, unlock: 25,
    blurb: 'Lobbed shells that Stun an area.',
    specs: [{ name: 'Blackout Shell', desc: '1.2s Stun, +0.3 Splash, ×1.4 Damage', m: { stunDur: 1.2, splash: 0.3, dmgX: 1.4 } },
            { name: 'Ion Barrage', desc: 'Fires 3 shells per volley', m: { shells: 3 } }] },
  grav: { ground: 1, name: 'Gravity Well', el: 'V', cost: 140, dmg: 30, rate: 0.35, range: 2.6, kind: 'grav', pull: 0.7, unlock: 30,
    blurb: 'Pulls enemies back along the path.',
    specs: [{ name: 'Singularity', desc: '×3 Damage. Pulses apply Mark', m: { dmgX: 3, addMark: 1 } },
            { name: 'Tidal Lock', desc: '×2 pull distance', m: { pullX: 2 } }] },
};
const TOWER_ORDER = ['pulse', 'rail', 'cryo', 'snare', 'missile', 'pylon', 'coil', 'forge', 'flame', 'lens', 'emp', 'grav'];
const LV_DMG = [0, 1, 1.65, 2.6, 4.1, 6.4];
const LV_COST = [0, 1, 0.8, 1.2, 2.0, 3.0];
const MAX_LV = 5;
// v4.8 one level number: LV 1-5, then each Ascension adds a level (LV 5 + A3 = LV 8). Colour tiers in bands of 3, white to red.
const LV_TIERS = [{ max: 3, name: 'Common', col: '#ecebe4' }, { max: 6, name: 'Uncommon', col: '#3ee06a' }, { max: 9, name: 'Rare', col: '#4aa3ff' },
  { max: 12, name: 'Epic', col: '#b86cff' }, { max: 15, name: 'Legendary', col: '#ff8a2a' }, { max: Infinity, name: 'Mythic', col: '#ff3048' }];
const towerLevel = t => (t.lvl || 1) + (t.asc || 0);
const lvTier = n => LV_TIERS.find(x => n <= x.max);

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
// "What's New" sheet, shown once per version to returning players (and from Settings)
const WHATS_NEW = { ver: '5.7.0', title: 'Last Gradient 5.7 · Nigel Industries', items: [
  ['Nigel Industries presents', 'The studio has a mascot: Nigel, a small black cat, in his couch. He greets you when the game starts. Tap to skip him (he will not mind).'],
  ['A bigger sky (5.7.3)', 'The attractor on the main menu fills the right-hand side, and the pieces breaking off the title are pulled across and spiral into it. The menu buttons are see-through. Nigel also stays a little longer.'],
  ['Entropy is now Last Gradient', 'Everything in the universe runs on gradients: hot next to cold, order next to chaos. When the last one flattens out, nothing moves again. You are holding it up.'],
  ['The title', 'The name on the hangar fades from cream to violet and breaks apart as you watch. With Reduce Motion on, it holds still.'],
  ['Nothing else changed', 'Your progress, talents, tracks, Hunt codes and the Entropy gauge are exactly where you left them.'],
]};
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
const NEMESIS_CRIME = ['the fall of your last core', 'breaking and entering (your core)', 'gloating', 'returning to the scene of the crime', 'holding a grudge'];

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
  { id: 'recharge', name: 'Spare Overdrive', desc: 'Recharges Overdrive after you have used it', base: 900, col: '#59f0b4' },
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
// v4.4: hp is also the fight-time budget (boss HP = firepower × seconds × hp/38). Fast bosses reach the core in ~40 s (duck, wraith) against ~95 s for
// Behemoth, so their hp is set lower to keep the required fire density about the same (hp / road seconds ≈ 0.4 for most).
const BOSSES = [
  { id: 'behemoth', name: 'Behemoth', hp: 40, spd: 0.45, armor: 0.3, size: 2, desc: 'Spawns Swarmers' },
  { id: 'queen', name: 'Hive Queen', hp: 30, spd: 0.6, fly: 1, size: 2, desc: 'Flies. Spawns Skimmers' },
  { id: 'wraith', name: 'Phase Wraith', hp: 22, spd: 0.7, size: 2, desc: 'Teleports forward and cloaks' },
  { id: 'overmind', name: 'Overmind', hp: 36, spd: 0.5, size: 2, desc: 'Disables nearby towers' },
  { id: 'titan', name: 'Titan', hp: 52, spd: 0.4, armorAll: 0.5, size: 2, desc: 'Armor breaks at 66% and 33% HP' },
  // oddballs: random stand-ins on boss waves
  { id: 'cat', odd: 1, tip: 'Swats towers, naps', name: 'Mr. Whiskers', hp: 38, spd: 0.55, size: 2, desc: 'Swats nearby towers offline. Naps mid-lane, and takes far less damage while asleep',
    titles: ['Devourer of Moons', 'Knocker of Things Off Tables', 'Destroyer of Couches', 'Who Is A Good Boy (No)'] },
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
];

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
// Capstone row: pick one defining play style. Row r opens after 5 × r points in that tree; a Capstone needs 20. You can hold a
// limited number of Capstones (capSlots), so a build is "two or three things you are really good at", not 180 small bonuses.
// Talent effects use the same stat keys as before (STAT_TXT), so every mechanic from the old web still exists.
const WEB_VER = 4;
const TROW = 5, TCAP = 20;
// every point spent anywhere also adds a little Damage to every tower, so any build makes you stronger overall
const TAL_PT_DMG = 0.4;
const T_ = (id, name, max, fx, extra) => Object.assign({ id, name, max, fx }, extra || {});
const CAP = (id, name, o) => Object.assign({ id, name, cap: 1 }, o);
const TALENTS = [
  { id: 'K', name: 'Ballistics', col: '#efe6cf', glyph: 'K', tag: 'Kinetic guns: crits that tear through armour',
    rows: [
      [T_('kDmg', 'Heavy Rounds', 5, { dmgK: 7 }), T_('kCrit', 'Precision', 5, { critC: 3 })],
      [T_('kRate', 'Autoloader', 5, { rateK: 4 }), T_('kPen', 'Penetrator', 3, { armorPen: 10 })],
      [T_('kHollow', 'Hollow Points', 1, { critSplash: 40, critM: 15 }), T_('kLeth', 'Lethality', 3, { critM: 12 })],
      [T_('kRifle', 'Rifling', 1, { fifthCrit: 1, rateK: 8 }), T_('kShred', 'Armor Shredder', 3, { shredStack: 1, eliteDmg: 4 })]],
    caps: [CAP('marksman', 'Marksman', { ks: 'marksman', doc: 0 }), CAP('glass', 'Glass Cannon Array', { ks: 'glass', lines: ['+60% Damage', '−40% core max HP and shield'] }),
      CAP('deadeye', 'Deadeye', { fx: { critCK: 15, critMK: 50, pierceK: 1, pierceKeep: 1 }, lines: ['+15% Crit Chance and +50% Crit Damage for Kinetic towers', 'Kinetic shots pierce one more enemy and lose no damage doing it'] })] },
  { id: 'T', name: 'Combustion', col: '#ff7b39', glyph: 'T', tag: 'Thermal and Burn: set the swarm alight',
    rows: [
      [T_('tDmg', 'Accelerant', 5, { dmgT: 7 }), T_('tChance', 'Kindling', 5, { burnChance: 3 })],
      [T_('tBurn', 'Fuel', 5, { burnDmg: 10 }), T_('tSplash', 'Blast Radius', 3, { splash: 0.1 })],
      [T_('tBoom', 'Flashpoint', 1, { burnBoom: 25, dmgT: 8 }), T_('tVuln', 'Scorch', 3, { burnVuln: 7 })],
      [T_('tChain', 'Chain Ignition', 1, { chainIgnite: 1, burnDur: 20 }), T_('tNapalm', 'Napalm', 1, { napalmKill: 1, burnDmg: 10 }), T_('tCrit', 'Incendiary Rounds', 1, { burnCrit: 1 })]],
    caps: [CAP('wildfire', 'Wildfire', { ks: 'wildfire', doc: 1 }), CAP('conflag', 'Conflagration', { ks: 'conflag', lines: ['All damage becomes Thermal (Resonance unaffected)', '+50% Thermal Damage, +150% Burn damage. Burning enemies are 25% slower', 'Every 3rd Thermal hit on a burning enemy triggers Thermal Shock', 'Chill becomes Burn: cannot Chill or Freeze'] }),
      CAP('pyre', 'Pyre', { fx: { burnSpread: 1, heatSink: 1 }, lines: ['Every second, Burn spreads to the nearest enemy within 1 tile', 'Thermal towers: +2% Attack Speed per Burning enemy, up to +40%'] })] },
  { id: 'A', name: 'Voltaic', col: '#ffe14d', glyph: 'A', tag: 'Arc and speed: chains, shocks and overloads',
    rows: [
      [T_('aDmg', 'Voltage', 5, { dmgA: 7 }), T_('aRate', 'Cadence', 5, { rate: 3 })],
      [T_('aShock', 'Static', 5, { shockChance: 3 }), T_('aDis', 'Discharge', 3, { rateA: 4 })],
      [T_('aFork', 'Forked Lightning', 1, { chain: 1, chainKeep: 1 }), T_('aOver', 'Overvolt', 3, { shockEff: 12 })],
      [T_('aCap', 'Capacitors', 1, { capacitor: 1, dmgA: 10 }), T_('aIon', 'Ion Lattice', 1, { multiA: 1 }), T_('aPlasma', 'Plasma Coupling', 1, { ovlBurn: 1, overloadRad: 30 })]],
    caps: [CAP('circuit', 'Circuit', { ks: 'circuit', doc: 2 }), CAP('overgrid', 'Overclocked Grid', { ks: 'overgrid', lines: ['+40% Attack Speed', 'Attacks have a 3% chance to jam the tower for 1.5s'] }),
      CAP('thunder', 'Thunderstrike', { fx: { thunder: 1, shockLong: 1, ovlFree: 1 }, lines: ['Every 6s, lightning strikes the toughest enemy on the map', 'Shock lasts 6s instead of 3s', 'Overload has no cooldown'] })] },
  { id: 'C', name: 'Cryogenics', col: '#6ae2ff', glyph: 'C', tag: 'Chill and Freeze: slow them, then shatter them',
    rows: [
      [T_('cDmg', 'Frostbite', 5, { dmgC: 7 }), T_('cPot', 'Permafrost', 5, { chillPot: 10 })],
      [T_('cChance', 'Frost', 5, { chillChance: 3 }), T_('cStill', 'Stillness', 3, { freezeDur: 0.1 })],
      [T_('cDeep', 'Deep Freeze', 1, { freezeAt: 1, freezeDur: 0.3 }), T_('cBrittle', 'Brittle', 3, { frozenVuln: 8 })],
      [T_('cLattice', 'Frost Lattice', 1, { chillSplash: 1, dmgC: 10 }), T_('cShards', 'Ice Shards', 1, { iceShards: 1 }), T_('cSuper', 'Superconductors', 1, { superChill: 1, superRad: 60 })]],
    caps: [CAP('glacier', 'Glacier', { ks: 'glacier', doc: 3 }), CAP('abszero', 'Absolute Zero', { ks: 'abszero', lines: ['Chilled enemies take +50% damage', '−50% Thermal Damage'] }),
      CAP('winter', 'Long Winter', { fx: { chillSlowDecay: 1, coldSnap: 1, glacial: 15 }, lines: ['Chill fades 3× slower', 'Shatter also Freezes enemies within 1 tile', 'Chilled enemies move an extra 15% slower'] })] },
  { id: 'V', name: 'Singularity', col: '#b86cff', glyph: 'V', tag: 'Void and Marks: bend the road, collapse the strong',
    rows: [
      [T_('vDmg', 'Null', 5, { dmgV: 6 }), T_('vHunt', 'Hunter', 5, { eliteDmg: 5 })],
      [T_('vMark', 'Mark', 5, { markChance: 3 }), T_('vKnock', 'Gravitic', 3, { knock: 2 })],
      [T_('vLens', 'Null Lens', 1, { rampKeep: 1, dmgV: 8 }), T_('vSlow', 'Event Drag', 3, { markSlow: 10 })],
      [T_('vDark', 'Dark Matter', 1, { markVoid: 5, markMax: 3 }), T_('vHole', 'Black Hole', 1, { blackHole: 1, collapse: 30 }), T_('vPull', 'Gravitic Pull', 1, { knockMark: 1, knock: 3 })]],
    caps: [CAP('horizon', 'Event Horizon', { ks: 'horizon', doc: 4 }), CAP('singularity', 'Singularity', { ks: 'singularity', lines: ['+100% Void Damage', '−30% all other damage'] }),
      CAP('decay', 'Entropic Decay', { fx: { markPerma: 1, voidSiphon: 1 }, lines: ['Marks never fade', 'Each Collapse fills the Entropy gauge'] })] },
  { id: 'E', name: 'Bastion', col: '#59f0b4', glyph: 'E', tag: 'Core, shield and credits: the economy wins long runs',
    rows: [
      [T_('eHP', 'Hull Plating', 5, { coreHP: 12 }), T_('eCr', 'Salvage', 5, { credits: 4 })],
      [T_('eShield', 'Barrier', 3, { shield: 8, shieldRegen: 15 }), T_('eCost', 'Supply Lines', 5, { costRed: 2, upgRed: 3 })],
      [T_('eCore', 'Reinforced Core', 1, { shieldWave: 1, coreHP: 30 }), T_('eRepair', 'Field Repairs', 3, { fieldRepair: 2 })],
      [T_('eInt', 'Compound Interest', 1, { interest: 2 }), T_('eRet', 'Retaliation', 1, { coreDmg: 60, coreRate: 30, coreRange: 1 }), T_('eDrones', 'Salvage Drones', 1, { salvage: 1 })]],
    caps: [CAP('wareco', 'War Economy', { ks: 'wareco', doc: 5 }), CAP('dimret', 'Diminishing Returns', { ks: 'dimret', lines: ['+50% Credits from all sources', 'Each copy of a tower costs 12% more'] }),
      CAP('unbreakable', 'Unbreakable', { ks: 'unbreakable', lines: ['Survive a lethal hit at 50% HP, once per 10 waves', '−10% tower Damage'] })] },
  { id: 'X', name: 'Command', col: '#ff5fa8', glyph: 'X', tag: 'Abilities, veterans, luck and storms',
    rows: [
      [T_('xPow', 'Uplink', 5, { abilPower: 8 }), T_('xCharge', 'Telemetry', 5, { abilCharge: 5 })],
      [T_('xLuck', 'Mutation', 3, { affixLuck: 10 }), T_('xXp', 'Insight', 3, { xp: 6 }), T_('xRange', 'Optics', 3, { range: 4 })],
      [T_('xCell', 'Reserve Cells', 2, { abilSlots: 1 }), T_('xLoad', 'Quartermaster', 1, { quarter: 1 }), T_('xStorm', 'Storm Caller', 1, { stormFreq: 50, stormPow: 50 })],
      [T_('xWolf', 'Lone Wolf', 1, { loneWolf: 35 }), T_('xStasis', 'Stasis Theory', 1, { stasisDur: 3, chillVoid: 15 }), T_('xVet', 'Field Promotion', 3, { vxpAll: 30 })]],
    caps: [CAP('artisan', 'Artisan', { ks: 'artisan', doc: 6 }), CAP('gambler', 'Gambler', { ks: 'gambler', doc: 7 }),
      CAP('chaos', 'Chaos Engine', { ks: 'chaos', lines: ['+150% affix rarity', 'New towers also roll a Curse'] }),
      CAP('tactician', 'Tactician', { ks: 'tactician', fx: { abilPower: 25 }, lines: ['Using an ability takes 30% off every other ability\'s cooldown', '+25% ability power'] })] },
];
// lookups: every talent and capstone by id, with its tree and row
const TAL = {};
for (const tr of TALENTS) {
  tr.rows.forEach((row, r) => row.forEach(t => { t.tree = tr.id; t.row = r; TAL[t.id] = t; }));
  for (const c of tr.caps) { c.tree = tr.id; c.row = 4; c.max = 1; TAL[c.id] = c; }
}
const TREE_BY_ID = Object.fromEntries(TALENTS.map(t => [t.id, t]));
// v4.x Doctrine seals live on as Capstones (same ks flags, same field effects)
const capSlots = lvl => 1 + (lvl >= 50 ? 1 : 0) + (lvl >= 100 ? 1 : 0);
const CAP_NEXT = lvl => lvl < 50 ? 50 : lvl < 100 ? 100 : 0;
// a talent's description at a given rank
function talentLines(t, rank) {
  if (t.cap) return t.lines || (t.doc !== undefined ? DOCTRINES[t.doc].lines : []);
  const r = Math.max(1, rank || 1);
  return Object.keys(t.fx).map(k => { const v = t.fx[k]; const txt = STAT_TXT[k]; if (!txt) return k; return typeof v === 'number' && v !== 1 ? txt(+(v * r).toFixed(2)) : txt(v); });
}

// v5.2: the first two levels are cheap so a first run that dies around Wave 10 still earns a talent point
const xpForLevel = L => L === 0 ? 800 : L === 1 ? 1600 : Math.round(3000 + 250 * L + 3 * L * L);
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
const novaLevelReq = n => Math.min(150, 40 + 10 * n); // v5.3: 40 (was 60); extracted runs get there
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
  // v5.3 Daily Hunt: today's Nemesis, the same two genes for everyone
  const gp = ['plating', 'haste', 'bulk', 'shell', 'regen', 'ward', 'cloak', 'brood'], genes = [];
  while (genes.length < 2) { const g = gp[Math.floor(r() * gp.length)]; if (!genes.includes(g)) genes.push(g); }
  const sp = ['drone', 'swarmer', 'tank', 'splitter'][Math.floor(r() * 4)], el = ['K', 'T', 'C', 'A', 'V'][Math.floor(r() * 5)];
  return { date: key, seed, anoms, chaos: 2, nemesis: { kind: 'strain', type: sp, genes, el, rank: 1, daily: 1 } };
}
