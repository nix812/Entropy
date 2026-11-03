# Ascension perks and Tower Mastery (branch `ascend`)

## What the player sees

**Ascension perks.** Past level 5 a tower still Ascends, but each Ascend now gives ×1.15 Damage (was ×1.3) and three perk cards for that tower (four at Mastery 4). The cards sit side by side above the footer of the tower panel, all in view on a phone. Tap one to take it. Until you pick, the tower fights normally, an orange pip blinks on its tile (under the yellow veteran pip), and the Ascend button stays in its slot, disabled, reading "Choose a perk above first". Perks change how the tower works: a Lens beam forks to a second target, Rails ricochet, Cryo freezes shatter, Missiles retarget, Coils arc back, Flames reach fliers, Gravity Wells drag fliers. Most perks can be taken once; some stack two or three times, each pick worth less than the last (the card shows the value of the next pick and a Roman numeral for the stack). Specialization perks have a yellow top edge and only show for that spec. Perks taken are listed on the Details tab. The Ascend price curve is unchanged (×2 per Ascend), except that Void Lens Ascends cost ×1.5 (`ASC_COST`, new runs only).

**Tower Mastery.** Each of the 12 towers has its own Mastery, 5 ranks. At the end of a run every tower type you used earns Mastery XP from its share of the damage (support towers: how many stood at the end). The curve is a square root and the top damage dealer earns half, so a tower doing 15% of the damage earns nearly as much as the one doing 80%: trying other towers pays.

| Rank | XP total | Reward |
|---|---|---|
| 1 | 60 | Badge with the rank on the tower's build card |
| 2 | 180 | +5% Damage (Pylon: +5% boost strength, Forge: +5% income, Snare: +1 catch) |
| 3 | 400 | Gold trim on the tower's base on the battlefield |
| 4 | 750 | Ascend offers 4 perks instead of 3 |
| 5 | 1250 | The tower's own legendary affix joins its legendary rolls |

A typical 50-wave run gives a tower 20–70 XP (2.5 per wave × √share, halved for the top tower). The Archive's Arsenal shows each tower's pips and XP (or its legendary's name at rank 5), with the reward list. The game-over screen has one line: "Arc Coil Mastery 2 → 3 · Void Lens +45 …". Daily Hunts run with no Mastery (fair for everyone) but still earn it. Replays and watching earn nothing.

## Perks (full list)

Values in brackets are the next picks when a perk stacks.

**Pulse Blaster.** Burst Fire: every 5th shot fires 3 rounds. AP Rounds: ignores Plating. Ricochet Rounds: +1 bounce per round (×2). Hollow Point: +25% Damage to enemies below half HP (then +15%). Rapid Cycle: +12% Attack Speed (+10%, +9%, +8%, +7%). Hair Trigger: +8% Crit Chance (+6%). Spin-Up (Gatling Array): Attack Speed builds while firing, up to +40%. Third Barrel (Twin Cannons): +1 target. Legendary, Storm of Lead: +2 bounces, +15% Attack Speed.

**Rail Lance.** Long Bore: +2 Pierce (+1). Overpressure: +12% Damage (+10%, +9%, +8%, +7%). Spotter: crits Mark everything they hit (2 stacks). Deflection: each shot ricochets once to a nearby enemy for 60%. Capacitor Bank: every 3rd shot ×2.5 Damage. Coup de Grace: executes non-bosses under 10% health (15%). Big Game: +25% Damage to bosses and elites (+15%). Long Barrel: +0.8 Range (+0.5). Tungsten Slug (Gauss Spire): +50% Crit Damage. Live Wire (Splinter Rail): Shocks every enemy hit. Legendary, Railstorm: Deflection plus +2 Pierce.

**Cryo Emitter.** Ice Burst: enemies it Froze burst when they die, 8% of their max HP to enemies within 1.2 tiles (bosses take 30% of that). Brittle: enemies it Freezes take +15% Damage while Frozen (+10%). Deep Freeze: Freeze +0.4 s (+0.3 s). Flash Chill: +1 Chill stack per pulse. Wide Ring: +0.5 Range (+0.3). Compressor: +15% pulse rate (+10%, +7%). Permafrost (Glacier Core): its Frozen enemies can be Frozen again 40% sooner. Fault Lines (Shatter Field): +30% Shatter Field bonus. Legendary, Absolute Ring: Brittle +20%, Flash Chill.

**Swarm Missile.** Extra Tube: +1 half-power missile per volley (×2; extra missiles cycle the targets). Penetrator: missiles ignore Plating. Smart Seekers: a missile whose target dies picks the nearest enemy within 2.5 tiles. Heavy Warhead: +0.4 Splash (+0.3). Shrapnel: explosions throw 3 fragments at 25%. Thermite: +40% Burn damage (+30%). Autoloader: +15% fire rate (+12%, +10%, +8%, +7%). Bigger Pods (Cluster Pods): +2 bomblets. Sticky Gel (Napalm Payload): burning ground lasts 2 s longer and is 30% wider. Legendary, Hydra: +2 half-power missiles, Smart Seekers.

**Arc Coil.** Extra Coil: +1 Chain (×3). Amperage: +12% Damage (+10%, +9%, +8%, +7%). Arc Weld: arcs ignore Plating. Feedback Loop: the last arc jumps back to the first target. Superconductor: no damage lost per jump. Long Arc: arcs jump 40% farther (+25%). Overcurrent: +20% Damage to Shocked enemies (+12%). Taser: +8% Stun chance (+6%). Crown Jewel (Tesla Crown): +2 Chain. High Voltage (Overvolt): +30% Damage. Legendary, Storm Crown: +2 Chain, Feedback Loop.

**Flame Projector.** Spreading Fire: a burning enemy that dies passes its Burn to enemies within 1.2 tiles. Wide Nozzle: cone 30% wider (+20%). Pressure Tank: +0.4 Range (+0.3). Accelerant: +15% Damage (+13%, +11%, +9%, +8%). Slag: ignores Plating. Updraft: flames hit fliers. Slow Burn (Inferno): Burn lasts 2 s longer. Ion Torch (Plasma Torch): +25% Shock chance. Legendary, Dragon's Breath: Updraft, Spreading Fire, +30% Damage.

**Void Lens.** Fork: the beam forks from its target to the nearest other enemy within 2.5 tiles for 30% (ramped). Persistence: keeps half its ramp when the beam switches target. Focal Length: +1 Range (+0.6). Quick Focus: ramps 40% faster (+25%). Brand: +15% Mark chance (+10%). Afterglow: its Marks last 2 s longer (+1 s). Deep Well (Event Horizon): +0.3 max ramp. Fourth Facet (Prism Split): +1 beam. Legendary, Twin Singularity: Fork (to 75% with the perk) and Persistence (half ramp kept).

**EMP Mortar.** Long Pulse: Stun +0.3 s (+0.2 s). Scatter Shell: shells split into 3 bomblets at 20% (they Stun too). Wide Burst: +0.4 Splash (+0.3). Shaped Charge: shells ignore Plating. Shield Eater: strips shields completely (normally half). Fast Breech: +15% fire rate (+12%, +10%, +8%, +7%). Ion Charge: hits Shock (60%). Lights Out (Blackout Shell): bosses stay Stunned twice as long. Fourth Shell (Ion Barrage): +1 shell. Legendary, Cascade: Scatter Shell, Stun +0.3 s.

**Gravity Well.** Undertow: pulled enemies 30% slower for 1.5 s. Sky Anchor: pulls fliers too. Heavy Core: +25% pull (+15%). Crush Depth: +40% Damage (an earlier version dealt 1.5% of max HP per pulse; it ignored late-game HP and made long runs trivial). Event Radius: +0.4 Range (+0.3). Steady Pull: repeat pulls on one enemy weaken half as fast. Dark Mark (Singularity): +1 Mark per pulse. Eddy (Tidal Lock): pulled enemies are Chilled. Legendary, Abyss: Sky Anchor, Undertow (slow capped at 50%).

**Relay Pylon.** Amplifier Coil: +6% Damage boost (+4%). Relay Mast: +0.6 Range (+0.4). Targeting Grid: +8% Crit boost (+6%). Clock Sync: +5% Attack Speed boost (+3%). Legendary, Overmind: +10% Damage boost, +1 Range.

**Snare Beacon.** Bigger Net: +4 catches per wave (+3, +2). Barbs: hold +0.5 s (+0.3). Tar: +10% net slow (+5%). Exposed: netted fliers take +15% more damage (+10%). Legendary, Kraken Net: +8 catches, Exposed +20%.

**Credit Forge.** Overtime: +20% income (+15%, +10%). Finder's Fee: +4% kill credits everywhere (+3%). Compound: 0.5% interest on banked credits each wave (same cap as Midas Press). Hazard Pay: boss waves pay double. Legendary, Golden Goose: +50% income, Compound.

When a tower has taken every perk its pool allows, further Ascends give only ×1.15 Damage and an affix (no pick).

## Code map

**data.js** (after `lvTier`): `ASC_V = 2`, `ASC_DMG = 1.15`, `ASC_DMG_OLD = 1.3`; `PERKS[type]` = `{ id, name, v: [cumulative value per stack], spec?, d(inc, total) }`; `perkInc`, `perkText(P, n)` (next pick), `perkTotal(P, n)` (n stacks); `MASTERY` (`xp` thresholds, `perWave`, `topW`, `minShare`, `stat`, `offer4`, `rewards`). `LEGENDARIES` gains 12 entries with `tower` and `pkv` (Mastery 5); they are filtered out of every roll unless `G.mastery[type] >= 5`, so old runs roll exactly as before.

**sim.js**
- Mastery (next to `masteryPick`): `masteryProf()` (migrates any old `PROF.mastery` shape to `{ v: 2, xp: {} }`), `masteryXp`, `masteryRankOf`, `masteryRanks()` (profile side, called by the UI), `masteryRank(k)` (run side, reads `G.mastery` only). `defaultProfile().mastery = { v: 2, xp: {} }`.
- `newRun` (hotspot, 3 lines): `ascV = opts.ascV || (opts.v ? 1 : ASC_V)` goes into `opts` (so `G.recOpts` carries it); `G.ascV`; `G.mastery = opts.daily || opts.huntBuild ? {} : opts.mastery`.
- Perks (after `upgradeTower`): `perkStacks`, `perkDef`, `perkPool(t)`, `ascOffer(t)` (own stream: `mulberry32(seed ^ id·2246822519 ^ (asc+1)·3266489917 ^ 0x2545f491)`, weighted 1.6 for spec perks and 0.7 for repeats; cached in `t.aOffer`), `claimPerk(t, i)`.
- `upgradeTower`: refuses to Ascend while `t.ascPend > 0`; an Ascend in an `ascV >= 2` run sets `t.ascPend = 1` when the pool isn't empty.
- `towerStats`: builds `s.pkv` (perk values plus Mastery-legendary `pkv`), `Math.pow(G.ascV >= 2 ? ASC_DMG : ASC_DMG_OLD, asc)`, Mastery 2 (`mst`), and adds stat perks. All perk terms are `+0` / `×1` when absent, so old runs compute identical floats.
- Behaviour hooks: `hit` (Brittle via `st.brittle`, Exposed via `lureT.s.netVuln`, Hollow Point, Overcurrent), `applyStatuses` (Flash Chill, Brittle/Ice Burst/Permafrost on Freeze, Slow Burn, Lights Out), `kill` (Ice Burst via `st.frzBy`, Spreading Fire), `enemySlow`/`updateEnemies` (Undertow: `e.gSlowT`, `e.gSlowV`), `updateTowers` (Spin-Up: `t.spin`), `towerAttack` (Burst Fire `t.burstN`, Rail perks `t.railN`, Extra Tube, Coil perks, Wide Nozzle/Updraft, Gravity perks), `beamUpdate` (Fork `t.forkE`, Persistence, Quick Focus), `updateProjs` (Smart Seekers), `explode` (Shield Eater, Sticky Gel, Shrapnel, Scatter Shell), forge income (Hazard Pay).
- `ACTS.ascPick(x, y, i)`.
- `sellTower` records `G.stats.dmgSold[type]`; `gameOver` (hotspot, 1 line) calls `masteryEnd()` (after `huntEnd`; ghost runs return earlier), which uses `masteryGains()` and stores `G.masteryGain`.
- Snapshots (hotspots): towers carry `perks`, `ascPend`, `aOffer`; the snapshot carries `ascV` and `mastery`. `resumeRun` passes `ascV: S.ascV || 1` (a save from before this build resumes on the old rules) and `mastery` to `newRun`, and restores the tower fields.

**ui.js**: `towerPanelHTML` (Ascend button text and its disabled pending state; `perkCardsHTML`, `perkListHTML`), the live-refresh signature, `panelAction` `perk` (and `up` switches to Actions when a pick opens), glossary (`Ascend` text, new `Mastery` entry), `launch` passes `mastery: masteryRanks()` for normal runs (hotspot, 1 line), `buildPanelHTML` badge (`.mrank`), `openGameOver` line (`masteryGainHTML`, hotspot, 1 line), `openArchive` Arsenal rows with `masteryPips`.

**render.js**: Mastery 3 gold base trim (tower draw, next to the Ascend outline); orange pending-perk pip (next to the veteran pip).

**template.html**: `.perks`, `.perk`, `.perk.sp`, `.perks.n4`, small-height media rule, `.pfoot .btn.asc.lvup` min-height (same height whether it says Ascend or Choose a perk), `.bt .mrank`, `.mpip`, `.mgain`.

**Tuning note.** Each damage tower has one five-stack damage or rate perk so late Ascends keep scaling once the one-time perks are taken; the Void Lens deliberately has none, and its perks are utility (fork, ramp, range, Mark), not raw damage. Pulse, Missile, Coil, EMP and Flame each have a perk that ignores Plating, because late-game Plating is what left the Lens (and Rail) as the only towers doing damage in long bot runs.

**Bot** (`test/smartbot.js`): `PERK_PRI` (a value per perk plus noise, minus 0.4 per stack held); picks right after each Ascend. `NOPERK=1` always takes the first card. New output column `share` (every tower type's share of damage).

## Replay compatibility
Recordings made before this build carry `recOpts.v` and no `ascV`, so `newRun` gives them `ascV = 1`: ×1.3, no pending picks, no Mastery legendaries. `test/rec/v574_ascend.json` is a 5.7.4 recording (33 Ascends, Normal, start Wave 5, to Wave 34) recorded with the frozen 5.7.4 sim; `test/ascend.js` replays it and compares the hash. **Note for the merge:** that fixture replays exactly only while the rest of the sim matches 5.7.4. If another branch changes numbers that old runs use (tower stats, waves), it will diverge for reasons unrelated to Ascend; regenerate it from the merged build's predecessor or drop that check.

## Tests
- `node test/ascend.js` (31 checks): offers deterministic across VMs and independent of `G.r`; Ascend blocked until picked; ×1.15 exact; offers vary between towers; stat perks; Mastery 4 gives 4 cards; snapshot/resume keeps perks, pending pick, offer, `ascV`, Mastery; a pre-perk snapshot resumes on old rules; the 5.7.4 recording replays exactly; every perk (252 stacks, 12 towers × 2 specs, with each Mastery legendary) fights 3 waves without errors or NaN; Mastery migration, XP weighting, ranks, Daily ignores Mastery, Mastery 2 ×1.05, Mastery 5 legendary rolls only at rank 5, real runs grant Mastery and replays don't.
- `python3 test/ascendshot.py [W H]` (Playwright, 26 checks): run carries the profile's ranks; build-card badges; Ascend label; three cards; Ascend slot keeps its size and position and is disabled; cards are fixed-size; pick through the recorder; Details lists perks; Mastery 4 shows four cards; pending picks and cards survive a checkpoint and a reload + resume; game-over Mastery line; profile XP grows; Archive pips. Run at 852×393, 667×375, 1180×820.
- `node test/replay.js`: the scripted player now also picks perks (`ascPick`, sometimes with an invalid index) and the log shows how many: all replays match (7 and 23 picks in runs 0 and 1).

## Balance
Bots (`smartbot.js` with perk picks), Normal, COLS 48, start 1, best 80, push at every bounty. Batches are small (4 seeds per row; 8 for the baseline 0-point row) because the machine was shared with four other builders and restarted once. Treat ±10 waves as noise (pitfall 16).

| Build | 0 pts median | 60 pts median | 96 pts median | Lens share (mean, all runs) |
|---|---|---|---|---|
| Coordinator baseline (5.3 sweep) | 57 | 72 | 92 | (audit: 83% in a 40-point run) |
| 5.7.4 frozen copy, this machine | 55.5 (8 seeds) | n/a | n/a | 29% (59% in the one W86 run) |
| v4: Refraction, Crush 1.5% max HP | 76 | 220 | 152 | 54 / 53 / 57% (runs to W300: broken) |
| v6: max-HP perks removed, Persistence halved | 63 | 78.5 | (1 run: 131) | 52 / 72 / 92% |
| **v7 (shipped): + Lens Ascend ×1.5 cost, Fork 30%** | (v6: 63) | **83** | **106.5** | 63% / 73% |

Shares per tower, v7 means: 60 pts Lens 63, EMP 11, Rail 9, Gravity 8, Missile 4 (waves 72, 83, 83, 134); 96 pts Lens 73, Gravity 8, Missile 7, Rail 6, Cryo 4. Per-run damage-per-credit for Lens is 4–9× the average in long runs.

**What this says.** Difficulty is back near the baseline, slightly easier at 60–96 points (+10 waves, within noise for 4 seeds). The **Lens share target (< 45%) is not met in bot runs.** In a controlled bench (`ascbench.js` in the scratch folder: LV5 + A7, bot perk choices, no affixes), a Lens deals 0.5–0.7× its old damage, and Rail, Pulse, Missile, EMP and Coil deal 0.8–1.4×. Even so, the Lens keeps carrying long bot runs. The cause is the base ramp: a Lens on a bulky late enemy gains ×2.8–4.3, which grows with late-game HP while every other tower's damage is flat. The bot also buys Ascends cheapest-first, and every one of its plans builds two Lenses. Perks and Ascend prices move the share only a few points. Levers that would work, for the towers builder or the integrator: a lower base `rampMax`, ramp reset on every retarget for Prism, or a per-tower Ascend multiplier (`ASC_DMG` per type, e.g. Lens ×1.08).

Two lessons from the sweeps: (1) any perk that scales with enemy max HP (Crush Depth at 1.5%/pulse, Ice Burst at 25%) makes long runs endless, so none remain above 8%; (2) any perk that gives the Lens a second status (Refraction: Shock) lets it set off Collapse on its own at 10 hits a second.

## Open issues
- Existing bug seen while reading `resumeRun` (not fixed, outside this lane): on the line that restores `G.goldAt`/`G.wanted`, a `// bosses aren't saved` comment swallows the rest of the line, so `G.market`, `runUnlocks`, `bossBribe`, `placing` and `placingRefund` are never restored on a normal resume.
- Perk descriptions on cards are plain text (a glossary tooltip word inside a card swallowed the tap); the Details tab keeps tooltips.
