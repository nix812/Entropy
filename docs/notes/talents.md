# Talents rework: Techniques, play-style Capstones, earlier progression (branch `talents`)

## What changes for the player
- **Techniques (new).** Every attack tower (Pulse, Rail, Cryo, Missile, Coil, Flame, Lens, EMP, Gravity Well) has an alternate fire mode. A one-point talent in the first or second row of its tree unlocks it; from then on each tower of that type has a **Fire** row in its panel: *Standard* or the Technique. The choice is per tower, it is saved with the run, and it is a different job, never a straight upgrade:
  - **Suppressor** (Pulse): rounds slow what they hit by 35% for 1.5 s, ×0.6 Damage.
  - **Charged Shot** (Rail): every 3rd shot ×4 and pierces every enemy in line, half attack speed.
  - **Cold Lance** (Cryo): a freezing beam on one target instead of the pulse, ×3 damage to it, pierces Plating, +0.8 range. Gives the Cryo tree a real damage tower.
  - **Bunker Buster** (Missile): one heavy warhead, ×2 damage, ignores Plating and half of Armor, no splash, bomblets or napalm.
  - **Arc Fence** (Coil): stops chaining; a crackling fence to the nearest Coil within 4 tiles zaps and Shocks everything that crosses it. No partner, no fence.
  - **Backdraft** (Flame): a full ring of fire around the tower, ×0.6 range, ×0.8 damage. For corners and between two roads.
  - **Null Tether** (Lens): no ramp; beamed enemies are 35% slower and Marked twice as fast, ×1.25 damage. A control Lens, not a bigger Lens.
  - **Pulse Mines** (EMP): shells stay on the road as mines (up to 4) that blow when a ground enemy steps on one, ×1.5 damage. Fliers never set them off.
  - **Repulsor** (Gravity Well): also hits fliers and throws them back along their flight; ×0.6 pull on the ground, ×0.5 damage.
  - Locked Techniques still show in the Fire row, dimmed, with "Locked: learn X in <tree>"; tapping one explains it.
- **Ten Capstones are now play styles you see on the field** (they replace the stat trades Glass Cannon, Deadeye, Overclocked Grid, Thunderstrike, Absolute Zero, Long Winter, Singularity, Diminishing Returns, Unbreakable, and the old Chaos Engine):
  - **Sniper Nest** (Ballistics): Rails with no tower beside them get +40% range, +30% damage and pierce everything in line; crowded Rails −25%.
  - **Ricochet** (Ballistics): Pulse rounds bounce to 3 more enemies (first bounce at full damage); Rails fire 25% slower.
  - **Storm Rider** (Voltaic): storms drift to your Arc towers and linger; Arc towers in a storm +60% attack speed, Coils chain +2; storms 30% more often.
  - **Blackout** (Voltaic): EMP shells leave a 3 s static field (Shock, 30% slow); EMP fires 25% faster; Coils −15% damage.
  - **Cryo Artillery** (Cryogenics): Cryo Emitters stop pulsing and lob frost shells at the enemy furthest along, at double range: ×2.5 damage in 1.1 tiles, +2 Chill; 40% slower fire.
  - **Hoarfrost** (Cryogenics): every Freeze leaves ice on the road for 5 s; ground enemies on it are Chilled and take +25% Kinetic damage; Thermal −20%.
  - **Gravity Garden** (Singularity): ground enemies on the line between two Gravity Wells up to 5 tiles apart are held (75% slower, +25% damage taken); Wells +25% range; Lenses −20% damage. It replaces Singularity's ×2 Void (which fed Lens dominance).
  - **Forge Works** (Bastion): Credit Forges fire Kinetic slugs (40% of their income per shot, 3 tiles); income −35%.
  - **Bulwark** (Bastion): an enemy reaching the core makes it throw back every enemy within 2.5 tiles and Stun them (every 3 s at most); core +40% HP; towers −10% damage.
  - **Chaos Engine** (Command, reworked): every wave each attack tower takes a random element for that wave (shots, statuses, talents and Resonance follow it); +25% damage.
- **Earlier, steadier progression.** Rows open every 3 points (was 5), Capstones at 12 (was 20). Capstone slots at Level 25 and 60 (were 50 and 100). 5-rank talents are 3 ranks with the same total (3-rank ones are 2 ranks). The per-point bonus is +0.15% damage (was +0.4%), so specialising beats spreading. A tree is 17 to 20 points; everything is 131 points plus 3 Capstones.
- **XP curve.** Each level costs 350 + 120 × L^1.7 XP (XP is still 10% of score; `addScore` untouched). First run 3–5 levels, typical runs 5–10, deep runs no longer pay 30+ levels at once. Table below.
- **One-time refund.** Updating refunds every talent point (profile and Daily Hunt build), clears the five saved builds (their rows changed), and toasts "TALENTS REWORKED · Every point is refunded…". XP is moved onto the new curve so **nobody loses a level** (and so no points). Supernova Remnants of a replaced Capstone become its successor (Glass Cannon → Sniper Nest, Singularity → Gravity Garden, and so on).
- **Daily Hunt build:** 30 points (was 40) and one Capstone, the same share of the smaller trees.
- **Supernova level:** 28 + 5 per Supernova (was 40 + 10): about the same XP as before on the new curve.

## Full talent list
Rows open at 0 / 3 / 6 / 9 points spent in the rows above; Capstones at 12 in the tree. One Capstone per tree; slots: 1, 2 from Level 25, 3 from Level 60.

### Ballistics (K) · Kinetic guns: crits that tear through armour

| Row | Talent | Ranks | Effect at max rank |
|---|---|---|---|
| 1 (0 pts) | Heavy Rounds | 3 | +36% Kinetic Damage |
| 1 (0 pts) | Precision | 3 | +15% Crit Chance |
| 1 (0 pts) | Suppressor | 1 | **Technique** (Pulse Blaster): Rounds slow what they hit by 35% for 1.5s. ×0.6 Damage |
| 2 (3 pts) | Autoloader | 3 | +21% Kinetic Attack Speed |
| 2 (3 pts) | Penetrator | 2 | Ignores 30% of Armor |
| 2 (3 pts) | Charged Shot | 1 | **Technique** (Rail Lance): Every 3rd shot deals ×4 and pierces every enemy in line. ×0.5 Attack Speed |
| 3 (6 pts) | Hollow Points | 1 | Kinetic crits deal 40% of their damage to enemies within 1 tile; +15% Crit Damage |
| 3 (6 pts) | Lethality | 2 | +36% Crit Damage |
| 4 (9 pts) | Rifling | 1 | Every 5th Kinetic attack is a guaranteed crit; +8% Kinetic Attack Speed |
| 4 (9 pts) | Armor Shredder | 2 | Kinetic hits make Elites and Bosses take +3% damage, stacking to +30%; +12% Damage to Elites and Bosses |
| Capstone (12 pts) | **Marksman** | 1 | Your power grid is 40% smaller; Every attack tower is Overcharged +2 for free, and Overcharge goes up to 5 steps; Towers show targeting lasers |
| Capstone (12 pts) | **Sniper Nest** (new) | 1 | Rail Lances with no tower beside them: +40% Range, +30% Damage, and every shot pierces every enemy in line; Rail Lances with a neighbour deal 25% less damage |
| Capstone (12 pts) | **Ricochet** (new) | 1 | Pulse Blaster rounds bounce to 3 more enemies, and the first bounce keeps full damage; Rail Lances fire 25% slower |

Tree total: 19 points.

### Combustion (T) · Thermal and Burn: set the swarm alight

| Row | Talent | Ranks | Effect at max rank |
|---|---|---|---|
| 1 (0 pts) | Accelerant | 3 | +36% Thermal Damage |
| 1 (0 pts) | Kindling | 3 | +15% chance to Burn |
| 1 (0 pts) | Backdraft | 1 | **Technique** (Flame Projector): Burns a full ring around the tower instead of a cone. ×0.6 Range, ×0.8 Damage |
| 2 (3 pts) | Fuel | 3 | +51% Burn damage |
| 2 (3 pts) | Blast Radius | 2 | +0.3 Splash radius |
| 2 (3 pts) | Bunker Buster | 1 | **Technique** (Swarm Missile): One heavy warhead: ×2 Damage, ignores Plating and half of Armor. No splash, bomblets or napalm |
| 3 (6 pts) | Flashpoint | 1 | Burning enemies explode on death for 25% of their max HP; +8% Thermal Damage |
| 3 (6 pts) | Scorch | 2 | Burning enemies take +20% damage |
| 4 (9 pts) | Chain Ignition | 1 | Burning enemies spread Burn on death; +20% Burn duration |
| 4 (9 pts) | Napalm | 1 | Thermal kills leave burning ground for 2s; +10% Burn damage |
| 4 (9 pts) | Incendiary Rounds | 1 | Kinetic hits on Burning enemies always crit |
| Capstone (12 pts) | **Wildfire** | 1 | Burning ground enemies set the road on fire; Road fire builds Heat during a wave: up to +100% fire damage; Towers within 1 tile of burning road overheat: −25% Attack Speed |
| Capstone (12 pts) | **Conflagration** | 1 | All damage becomes Thermal (Resonance unaffected); +50% Thermal Damage, +150% Burn damage. Burning enemies are 25% slower; Every 3rd Thermal hit on a burning enemy triggers Thermal Shock; Chill becomes Burn: cannot Chill or Freeze |
| Capstone (12 pts) | **Pyre** | 1 | Every second, Burn spreads to the nearest enemy within 1 tile; Thermal towers: +2% Attack Speed per Burning enemy, up to +40% |

Tree total: 19 points.

### Voltaic (A) · Arc and speed: chains, shocks and overloads

| Row | Talent | Ranks | Effect at max rank |
|---|---|---|---|
| 1 (0 pts) | Voltage | 3 | +36% Arc Damage |
| 1 (0 pts) | Cadence | 3 | +15% Attack Speed |
| 1 (0 pts) | Arc Fence | 1 | **Technique** (Arc Coil): Stops chaining. Arcs a fence to the nearest Coil within 4 tiles that zaps and Shocks everything crossing it |
| 2 (3 pts) | Static | 3 | +15% chance to Shock |
| 2 (3 pts) | Discharge | 2 | +12% Arc Attack Speed |
| 2 (3 pts) | Pulse Mines | 1 | **Technique** (EMP Mortar): Shells stay on the road as mines (up to 4) that blow when a ground enemy steps on them. ×1.5 Damage. Fliers never set them off |
| 3 (6 pts) | Forked Lightning | 1 | +1 Chain; Chain jumps lose no damage |
| 3 (6 pts) | Overvolt | 2 | +36% Shock effect |
| 4 (9 pts) | Capacitors | 1 | Arc towers charge for 4s; their next attack deals ×3 damage; +10% Arc Damage |
| 4 (9 pts) | Ion Lattice | 1 | Arc towers hit +1 target |
| 4 (9 pts) | Plasma Coupling | 1 | Overload applies Burn to every enemy it hits; +30% Overload radius |
| Capstone (12 pts) | **Circuit** | 1 | Attack towers next to each other are wired: +8% Attack Speed per wired neighbour; A chain of 4+ wired towers fires a lightning bolt every 4s at the toughest enemy in its reach, for 2s of the whole chain's damage; If one tower in a chain is disabled or jammed, the whole chain stalls |
| Capstone (12 pts) | **Storm Rider** (new) | 1 | Storms drift toward your Arc towers and linger over them; Arc towers inside a storm: +60% Attack Speed, and Arc Coils chain +2; Storms come 30% more often |
| Capstone (12 pts) | **Blackout** (new) | 1 | EMP shells leave a static field for 3s: enemies inside are Shocked and 30% slower; EMP Mortars fire 25% faster; Arc Coils deal 15% less damage |

Tree total: 19 points.

### Cryogenics (C) · Chill and Freeze: slow them, then shatter them

| Row | Talent | Ranks | Effect at max rank |
|---|---|---|---|
| 1 (0 pts) | Frostbite | 3 | +36% Cryo Damage |
| 1 (0 pts) | Permafrost | 3 | +51% Chill strength |
| 1 (0 pts) | Cold Lance | 1 | **Technique** (Cryo Emitter): A freezing beam on one target instead of a pulse: ×3 Damage to it, pierces Plating, +0.8 Range |
| 2 (3 pts) | Frost | 3 | +15% chance to Chill |
| 2 (3 pts) | Stillness | 2 | +0.3s Freeze duration |
| 3 (6 pts) | Deep Freeze | 1 | Freeze triggers at 4 Chill stacks instead of 5; +0.3s Freeze duration |
| 3 (6 pts) | Brittle | 2 | Frozen enemies take +24% damage |
| 4 (9 pts) | Frost Lattice | 1 | Cryo hits also Chill enemies within 1 tile; +10% Cryo Damage |
| 4 (9 pts) | Ice Shards | 1 | Frozen enemies shatter on death and Chill nearby enemies twice |
| 4 (9 pts) | Superconductors | 1 | Superconduct also Chills; +60% Superconduct radius |
| Capstone (12 pts) | **Glacier** | 1 | A Frozen ground enemy becomes an ice block: enemies behind it pile up and stop; Bosses and fliers are never blocked; All towers deal 10% less damage |
| Capstone (12 pts) | **Cryo Artillery** (new) | 1 | Cryo Emitters stop pulsing and lob frost shells at the enemy furthest along, at double range; Each shell bursts for ×2.5 Damage in 1.1 tiles and adds 2 Chill; Cryo Emitters fire 40% slower |
| Capstone (12 pts) | **Hoarfrost** (new) | 1 | Every Freeze leaves ice on the road for 5s; Ground enemies on ice are Chilled and take +25% Kinetic Damage; Thermal towers deal 20% less damage |

Tree total: 18 points.

### Singularity (V) · Void and Marks: bend the road, collapse the strong

| Row | Talent | Ranks | Effect at max rank |
|---|---|---|---|
| 1 (0 pts) | Null | 3 | +30% Void Damage |
| 1 (0 pts) | Hunter | 3 | +24% Damage to Elites and Bosses |
| 1 (0 pts) | Null Tether | 1 | **Technique** (Void Lens): No ramp. Beamed enemies are 35% slower and Marked twice as fast. ×1.25 Damage |
| 2 (3 pts) | Mark | 3 | +15% chance to Mark |
| 2 (3 pts) | Gravitic | 2 | 6% chance to knock back |
| 2 (3 pts) | Repulsor | 1 | **Technique** (Gravity Well): Also hits fliers and throws them back along their flight. ×0.6 pull on the ground, ×0.5 Damage |
| 3 (6 pts) | Null Lens | 1 | Void beams keep their ramp when switching targets; +8% Void Damage |
| 3 (6 pts) | Event Drag | 2 | Enemies at max Marks move 30% slower |
| 4 (9 pts) | Dark Matter | 1 | Each Mark adds +5% Void damage taken; +3 max Mark stacks |
| 4 (9 pts) | Black Hole | 1 | Collapse radius ×2 and pulls enemies back further; +30% Collapse damage |
| 4 (9 pts) | Gravitic Pull | 1 | Knockbacks also apply 2 Marks; 3% chance to knock back |
| Capstone (12 pts) | **Event Horizon** | 1 | Every kill opens a small gravity well that drags nearby enemies back down the road; Enemies at max Marks are yanked back 1.5 tiles (once each); Enemies move 12% faster |
| Capstone (12 pts) | **Gravity Garden** (new) | 1 | Ground enemies between two Gravity Wells (up to 5 tiles apart) are held: 75% slower and +25% damage taken; Gravity Wells: +25% Range; Void Lenses deal 20% less damage |
| Capstone (12 pts) | **Entropic Decay** | 1 | Marks never fade; Each Collapse fills the Entropy gauge |

Tree total: 19 points.

### Bastion (E) · Core, shield and credits: the economy wins long runs

| Row | Talent | Ranks | Effect at max rank |
|---|---|---|---|
| 1 (0 pts) | Hull Plating | 3 | +60 core HP |
| 1 (0 pts) | Salvage | 3 | +21% Credits |
| 2 (3 pts) | Barrier | 2 | +24 core shield; +44% shield regen |
| 2 (3 pts) | Supply Lines | 3 | −9% tower cost; −15% upgrade cost |
| 3 (6 pts) | Reinforced Core | 1 | Core shield fully recharges at the start of each wave; +30 core HP |
| 3 (6 pts) | Field Repairs | 2 | Waves with no leaks repair 6% core HP |
| 4 (9 pts) | Compound Interest | 1 | Earn 2% interest on banked credits each wave (max 300) |
| 4 (9 pts) | Retaliation | 1 | +60% core Damage; +30% core Attack Speed; +1 core Range |
| 4 (9 pts) | Salvage Drones | 1 | Kills grant +1 credit for every 10 waves reached |
| Capstone (12 pts) | **War Economy** | 1 | The core grows a turret for every stack of banked credits (up to 8): +60% core Damage and +8% core Attack Speed each; The stack size grows with the wave, so keep banking; Towers cost 20% more |
| Capstone (12 pts) | **Forge Works** (new) | 1 | Credit Forges arm themselves: each fires Kinetic slugs at enemies within 3 tiles, hitting harder the more it earns; Credit Forge income −35% |
| Capstone (12 pts) | **Bulwark** (new) | 1 | When an enemy reaches the core, the core throws back every enemy within 2.5 tiles and Stuns them (every 3s at most); Core +40% max HP; Towers deal 10% less damage |

Tree total: 17 points.

### Command (X) · Abilities, veterans, luck and storms

| Row | Talent | Ranks | Effect at max rank |
|---|---|---|---|
| 1 (0 pts) | Uplink | 3 | +39% ability power |
| 1 (0 pts) | Telemetry | 3 | −24% ability cooldowns |
| 2 (3 pts) | Mutation | 2 | +30% affix rarity |
| 2 (3 pts) | Insight | 2 | +18% XP |
| 2 (3 pts) | Optics | 2 | +12% Range |
| 3 (6 pts) | Reserve Cells | 2 | +1 charge slot for every ability |
| 3 (6 pts) | Quartermaster | 1 | Ability charges from crates, chests, bosses and milestones come in pairs |
| 3 (6 pts) | Storm Caller | 1 | +50% storm frequency; +50% storm effects |
| 4 (9 pts) | Lone Wolf | 1 | +35% Damage for towers with no neighbors |
| 4 (9 pts) | Stasis Theory | 1 | +3s Stasis duration; Hits on Chilled enemies: 15% chance to Mark |
| 4 (9 pts) | Field Promotion | 2 | Veterans rank up 90% faster |
| Capstone (12 pts) | **Artisan** | 1 | Veterans rank up 2× faster and gain +5% Damage per rank; Rerolls cost 50% less; Towers without a Veteran rank deal 25% less damage |
| Capstone (12 pts) | **Gambler** | 1 | Every wave from Wave 2 flips a coin for an extra event: good or bad (always good on boss waves); Score +25%; The Entropy gauge fills 25% faster |
| Capstone (12 pts) | **Chaos Engine** (new) | 1 | Every wave, each attack tower takes a random element for that wave (its shots, statuses, talents and Resonance follow it); +25% Damage |
| Capstone (12 pts) | **Tactician** | 1 | Using an ability takes 30% off every other ability's cooldown; +25% ability power |

Tree total: 20 points.

## XP curve (level thresholds only; `addScore` is unchanged)
`xpForLevel(L) = round(350 + 120 × L^1.7)`; the old 5.2–5.7 curve is kept as `xpForLevelV5` for the migration. Run estimates come from bot XP logs (fresh profile: W10 ≈ 1.2k XP, W15 ≈ 4.5k, W20 ≈ 8.7k, W30 ≈ 37k, W40 ≈ 90k, W50 ≈ 207k, then about ×(w/50)^3.4) and a player whose runs go deeper as they level. Points = level, as before.

| Level | XP for the level | Total XP to reach it | Old total | Expected |
|---|---|---|---|---|
| 1 | 350 | 350 | 800 | first run, about W10 |
| 2 | 470 | 820 | 2,400 |  |
| 3 | 740 | 1,560 | 5,912 | first run, about W12 |
| 4 | 1,127 | 2,687 | 9,689 |  |
| 5 | 1,617 | 4,304 | 13,737 | first run, about W15 |
| 6 | 2,201 | 6,505 | 18,062 |  |
| 8 | 3,630 | 13,009 | 27,567 | run 2 |
| 10 | 5,378 | 22,853 | 38,252 |  |
| 13 | 8,550 | 45,189 | 56,597 | runs 2-3: enough for the first Capstone (12 in one tree + 1) |
| 15 | 11,006 | 65,940 | 70,442 |  |
| 20 | 18,259 | 142,112 | 111,057 | runs 4-5 |
| 25 | 26,990 | 259,030 | 160,847 | runs 5-6: second Capstone slot |
| 30 | 37,100 | 423,777 | 220,562 | runs 6-7 |
| 40 | 61,162 | 923,026 | 372,767 | runs 8-9 |
| 50 | 89,993 | 1,689,430 | 573,672 |  |
| 60 | 123,272 | 2,768,832 | 829,277 | runs 11-12: third Capstone slot |
| 80 | 202,255 | 6,036,914 | 1,528,587 | run 15 |
| 100 | 296,670 | 11,048,659 | 2,518,697 | run 18 |
| 120 | 405,496 | 18,101,477 | 3,847,607 |  |
| 134 | 489,823 | 24,403,256 | 5,005,134 | about run 23: every talent and 3 Capstones |


Levels a single run pays (new vs old): a first run to W15 gives 5 (old 1); level 13 reaching W45 gives 8; level 20 reaching W55 gives 10; level 40 reaching W81 gives 13 (old about 19); the audit's "38 levels in one W81 run" case (level ~20 at W81) now gives 24. Everything (131 points + 3 Capstones) takes about 23 runs; the third Capstone slot (Level 60) about 11.

## Code map
- **data.js** (talents section, replaced in place): `WEB_VER = 5`, `TROW = 3`, `TCAP = 12`, `TAL_PT_DMG = 0.15`, `TECH(id, name, tower)` talent helper (`t.tech` = tower type, `fx: {}`), new `TALENTS`, `CAP_RENAMED` (old Capstone id → new, used for Remnants), `TOWER_FIRE` (`{ type: [{ id, need, name, short, desc, m }] }`), `fireModes(type)`, `fireTalentFor(type)`, `treeMax(tid)`, `capSlots` (25/60), `CAP_NEXT`, `HUNT.pts = 30` (assigned after `HUNT` is defined, to keep the `HUNT` line free for other branches), `HUNT_CAPS = 1`, `talentLines` (Technique talents), `xpForLevel`, `xpForLevelV5`, `levelFromXP(xp, f)` (optional curve), `novaLevelReq` (28 + 5n).
- **sim.js**
  - Talents: `slotsNow()` (profile slots by level, Hunt build `HUNT_CAPS`), `CAP_CONFLICTS` (Conflagration vs Glacier, Cryo Artillery, Hoarfrost, Chaos Engine), `migrateWeb()` (returns false / 'web' / 'rework'; refunds profile and `PROF.huntBuild`, clears `PROF.builds`, renames Remnants, converts XP keeping level and progress), `xpToLevel(L)`.
  - `computeMods`: ranks clamp to `T.max` (old frozen Hunt builds with 5 ranks), `M.tech` = learned Technique talent ids; new Capstone stat sides; the dead Glass/Overgrid/Singularity/Absolute Zero/Diminishing Returns/Unbreakable/old Chaos lines are gone (also their bits in `towerCost`, `hit`, `leak`, the jam roll in `updateTowers`).
  - Techniques (before `recomputeAuras`): `fireDef(t)` (the mode, only while `G.mods.tech[need]`), `fireLearned(type, id)`, `setFireMode(t, id)`, `applyFire(t, s, D)` (called from `towerStats`), `FENCE`. `ACTS.fire(x, y, id)`; `id` '' = Standard. Tower field `t.fire` (undefined = Standard), separate from targeting `t.mode`.
  - Play styles: `capPlay(t, s, D)` (per-tower stat sides, from `towerStats`), `chaosRoll()` + `t.wild` (Chaos Engine element), `FORGE_GUN`, `bulwarkWave(c)` (from `leak`), Storm Rider steering in `updateStorms`, Gravity Garden in `updateEnemies` (`G.gardens` pairs built in `recomputeAuras`, `e.heldT`, `GARDEN`), Sniper Nest in the rail branch and range in `updateTowers`.
  - Attacks (after `towerAttack`): `frostShell`, `fenceAttack`, `fencePartner`, `flameRing`, `layMines`, `updateMines` (`G.mines`, `MINE`), `addField` / `updateFields` (`G.fields`: 'static', 'ice'), `slowTag(e, v, dur)` (`e.supT`/`e.supV`, read by `enemySlow`), `REPULSE`. `updateZones` calls `updateMines`/`updateFields`. `explode` handles `p.single` (Bunker Buster), `p.frost` (no shield strip) and Blackout fields; the mortar landing turns `p.mine` shells into mines.
  - `towerConditions`: lines for Arc Fence, Pulse Mines, Storm Rider, Sniper Nest, Chaos Engine.
  - Snapshots: towers carry `fire` and `wild` (old snapshots default to Standard). Mines and fields are not saved (they are short-lived).
- **ui.js**: `fireHTML(t)` (the Fire row) in `towerPanelHTML`; the Target row now has its label inline ("Aim") so Fire fits; `panelAction` 'fire' / 'fireLock'; Forge "Slug" stat; talent tiles say "<tower> technique: …"; tree bars use `treeMax`; Talents help text uses `TROW`/`TCAP` and the new slot levels; Hunt build slot text (`slotsNow`); glossary "Technique"; `talentsToast(kind)` before `boot` (both migration call sites).
- **render.js**: fields, mines, Gravity Garden lines and Arc Fence arcs drawn before towers; `flamering` fx (Backdraft). All cosmetic randomness is `Math.random`.
- **template.html**: `.firerow`, `.firedesc` (next to `.modes`).

### Hotspots touched (small edits)
`towerStats` (2 calls + Chaos element line), `updateTowers` (eco skip, Nest range, Storm Rider rate), `towerAttack` (one early return per kind, Ricochet bounces, Charged Shot/Nest in the rail branch, Repulsor in grav, an `eco` case), `startWave` (one line: `chaosRoll`), `buildTower` (Chaos element instead of a Curse), `leak` (Bulwark call; Unbreakable removed), `hit` (Bunker Buster armour, Gravity Garden, Suppressor), `applyStatuses` (Hoarfrost ice on Freeze), `updateEnemies` (timers, Garden), `snapshotRun`/`resumeRun` (tower `fire`, `wild`), `towerPanelHTML` (Aim/Fire rows), `panelAction`. `docs/Mechanics-Audit-2026-11-02.md` was committed as found.

## Determinism
- Techniques change only through `act('fire', …)`; old recordings never send it and replay as before (`node test/replay.js`: all replays match). A Daily Hunt run reads Techniques from its frozen `G.huntBuild` (`M.tech` comes from `TS()`), and a Hunt run refuses talent edits as before.
- Mines, frost shells and Chaos rolls use `G.r` inside the sim; rendering uses `Math.random`.
- Balance changes (new talents, Capstones, `TAL_PT_DMG`) mean a Daily recorded on 5.7 and resumed after the update replays with the new numbers, as with any balance patch. Old Hunt builds in recordings clamp to the new rank caps.

## Tests
- `node test/techniques.js` (new, 127 checks): pacing constants and slot levels, every Technique (learn, switch, fight 3 waves, finite numbers, damage, back to Standard), locked/unknown modes refused, refund falls back to Standard and keeps `t.fire`, snapshot/resume and old snapshots, a recorded run with Fire switches replays to the same hash, every new Capstone on the field (Forge shoots, Chaos rolls, Garden pairs), Conflagration conflict, WEB_VER 4 → 5 migration (refund, level and progress kept, Remnants renamed, Hunt build refunded, builds cleared, runs once, empty profile silent), Daily Hunt build (30 points, one Capstone, locked run reads its own Techniques).
- `python3 test/fireshot.py [W H]` (new, Playwright): Fire row present, locked chip and hint, tap on a locked chip does nothing, unlock in place, switch is a recorded act, row stays in its slot, Cryo gets the row, refund/re-learn at a checkpoint, save → reload → resume keeps Techniques. Passes at 852×393, 667×375, 1180×820.
- `test/talentshot.py` updated for 3/6/9/12 gates, 3-rank caps, Technique tiles, Sniper Nest, the Cryogenics tab.
- `test/v53shot.py` updated for the 30-point Hunt build.
- `test/smartbot.js`: XP from `xpToLevel`, picks fire modes (`chooseFire`), `FIRE=id[,id]|all` forces Techniques, `NOFIRE=1`, `XPLOG=1` prints XP per wave, DUMP shows the mode.
- `test/harness.js` exports the new functions.

## Balance
BALANCE

## Open issues
OPEN
