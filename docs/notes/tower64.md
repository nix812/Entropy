# tower64: the capstone tier and seven new towers (6.4.0)

Nic: "I want to expand tower types too. Maybe with keystone talents or even a higher tier talent we let there be new tower
unlocks so the spec feels even more involved." He picked a capstone tier: a new top tier in each talent tree, one node per
tree, and each node unlocks one new tower.

## Design on paper (before building)

### The tier
- One node per tree, above the Capstones (`TALENTS[i].top`, row 5 in `TAL`). Needs 16 points in that tree (`TTOP`), costs 1
  point, takes no Capstone slot. Stored like any talent (`PROF.tal[id] = 1`), so old profiles and saved builds load unchanged.
- The unlock reaches a run only through `newRun({ capT: [...] })` (it lands in `G.recOpts`), read as `G.capT`. The sim never
  reads `PROF` for it. Learning the node mid-run unlocks the tower from the next run.
- Daily Hunts: **none**. `G.capT` is forced to `[]` for Daily Hunts, Training and lessons, and the node can't be learned in the
  Hunt build. Why: the Daily build is 30 points and the ladder compares play with the same 12 towers; a fixed rotating
  prototype was the other option, but it adds a new variable to the one mode that must stay identical.
- Gate: `G.capT` is only non-empty at `G.frV >= 4`. Every new rule lives in code that only runs when one of the new towers
  exists, so frV 1–3 recordings replay bit for bit.

### The towers (each plays a job none of the 12 does)
| Tree | Tower | Job | How it plays |
|---|---|---|---|
| K Ballistics | **Buzzsaw** (`saw`) | Road clearer | Throws a blade onto the road ahead of its target. The blade runs back up the road (against the flow) for 5 tiles and cuts every ground enemy it meets once. Ignores Plating. Can't hit air. Best beside long, bending roads. |
| T Combustion | **Flashover** (`flashover`) | Burn payoff | Pulses fire in a ring. Enemies already Burning explode for their remaining Burn ×2.5 plus a hit, splashing 40% around. Enemies not Burning catch fire. Alone it alternates ignite/explode; beside Flame and Missile it detonates their Burn. |
| A Voltaic | **Surge Spire** (`surge`) | Alpha strike | Chain lightning that stores 1 charge a second while it has nothing to shoot (10 max). With charge it fires ×4 as fast until the cells are empty. Hits hardest at the start of every wave and when a boss walks in. |
| C Cryogenics | **Rimewall** (`rime`) | Blocker | Raises an ice wall on the nearest road tile. Ground enemies stop at it, take cold damage and Chill (and Freeze) until they wear it down (8 enemy-seconds at LV 1, elites ×2). Bosses smash it. Regrows after 8 s. Makes a pile for splash towers. |
| V Singularity | **Entangler** (`tangle`) | Damage sharing | Links 3 enemies for 4 s. 35% of any hit one of them takes is copied to the others (bosses take half of a copy). Turns single-target fire into crowd damage and crowd damage into boss damage. |
| E Bastion | **Aegis Station** (`aegis`) | Leak insurance | While the core is in its range, it stops 2 leaks a wave (3 at LV 3, 4 at LV 5): the enemy dies at the gate and pays as a kill. Bosses are never stopped. A light gun shoots what comes close. |
| X Command | **Wildcard** (`joker`) | Combo engine | Every shot rolls an element (K T C A V) and a delivery (bolt, lance, burst, arc), with a 50% chance of that element's status. Every 10th shot is a Jackpot: all three heavy forms at ×2 with every status. No element of its own. |

Each tower: base stats, LV 1–5 damage, two Specializations, 6–8 Ascension perks, a Mastery 5 legendary, a sprite in the art
kit (`UNITS.TOP`), a muzzle/idle detail, a fire sound through `ev()`/`allow()`, a role line, a codex line, smartbot support.

## What changes for the player
- **Talents:** every tree has a new top tier under its Capstones: one wide gold-framed tile with the tower it unlocks. It opens
  at 16 points in that tree, costs 1 point and takes no Capstone slot. Learning it shows "NEW TOWER UNLOCKED". The tower joins
  every run from the next one on. Your Build lists your new towers; the tree tab shows ▲.
- **Build menu:** unlocked tier towers sit in the grid with a gold corner. Locked ones sit greyed in one "Capstone tier" strip
  under the grid. Tap one: its role, what it does, and "Unlock: <tree> capstone tier (16 points in <tree>)".
- **First run with a new tower:** a one-time card ("New tower: Buzzsaw"), queued like every other teaching card.
- **Tower panel:** one live line per new tower (charge, wall strength, stops left, next Jackpot, link size).
- **Daily Hunts** keep the base 12 towers. The Hunt build can't learn the tier ("Daily Hunts use the base towers").
- Dictionary › Towers lists the seven with "Unlock: <tree> capstone tier". Archive › Mastery lists them once learned.

## Code map
- **data.js:** `TOWERS.saw/flashover/surge/rime/tangle/aegis/joker` (field `capT` = tree id, `unlock: 999`), `CAP_TOWERS`,
  `TOWER_ORDER` = base 12 + `CAP_TOWERS`. `PERKS.<new>` (ids already read elsewhere: amps, chain, super, taser, overcur,
  crown, brittle). Seven Mastery 5 legendaries (`mSaw` … `mJoker`). `AFFIX_BAN` for the new kinds (saw, det, surge, wall,
  tether, aegis, joker). `TTOP = 16`; `TALENTS[i].top` (ids `kTop tTop aTop cTop vTop eTop xTop`, `unlockT`, row 5 in `TAL`).
  `talentLines` describes a tier node. **`FR_VER = 4`** (shared one-line edit with cards64).
- **sim.js:**
  - Talents: `rowNeed(5) = TTOP`; `treePts` skips the tier node; `talentBlock` → `'daily'` for the Hunt build;
    `treeLoadBuild` replays rows 0–5; `capTowersOwned()` (profile → newRun only).
  - Gating: `towerUnlocked` checks `G.capT` for tier towers (before the Daily "everything open" rule); `nextLockedTower`
    skips them (the Stolen Blueprint never unlocks one).
  - **newRun (hotspot, 2 lines):** `G.capT` from `opts.capT`, only at `G.frV >= 4`, forced `[]` for Daily, Hunt build,
    Training and lessons. Run log `start.capT`.
  - **snapshotRun/resumeRun (hotspot, 1 field each):** `capT`.
  - `capStats` (called from `towerStats` for `D.capT`): per-kind numbers. `PD_KIND` in `potentialDps` (multi-target kinds,
    so boss sizing sees them).
  - Attacks (`towerAttack` cases): `sawThrow/sawStep/sawCut` (projectile `k: 'saw'` running back along its target's lane),
    `flashPulse`, Surge Spire falls through into the Arc Coil `chain` case (charge in `updateTowers`, `SURGE.burst`),
    `wallSpot/wallRaise/wallHold/wallBreak` (`t.wall`, `e.jammed`), `tangleLink/tangleEcho/updateTangles` (`G.tangles`,
    `e.lnk`), `aegisShot/aegisCatch` (`t.guardN`), `jokerShot/jokerForm`.
  - Hooks into shared code, all inert unless a tier tower exists: `hit()` copies to linked enemies (`e.lnk`), `leak()` asks
    `aegisCatch` (only when `G.capT.length`), `updateEnemies` calls `wallHold` (only when `G.capT.length`), `updateZones`
    calls `updateTangles`, `startWave` clears `guardN`, `explode()` skips the shield strip for Wildcard bursts (`p.jk`),
    `masteryGains` counts Rimewall and Aegis like support towers.
- **units.js:** `TOP.saw/flashover/surge/rime/tangle/aegis/joker`; `ROT` + saw, aegis; `SPIN` for the rest.
- **render.js:** `drawCapField` (walls in front of the ground enemies they hold, link threads), the `saw` projectile, live
  tells in `drawTower0` (saw glint, surge charge pips and burst sparks, aegis stops-left pips, Jackpot ring, Flashover glow),
  muzzles for saw/aegis, fx `heat`, `wallup`, `wallbreak`, `tether`, `aegis` ("STOPPED"), `jackpot`.
- **audio.js:** `WEAP.saw/flashover/surge/rime/tangle/aegis/joker`, `EVT.aegisblock`, `HIT_FAM` entries, `TRIM` levels
  (sfxrender). All through `ev()` + `allow()`, placed by the tower (positional).
- **ui.js:** `TOWER_ROLE`, `TSHORT`, `capTreeOf`; build menu strip (`capPeek`, action `cappeek`); `capInfoHTML` in the
  tower panel; `introCard('capT_<id>')` in `onboardingTick`; Dictionary and Archive rows; newRun passes
  `capT: capTowersOwned()`; Tree: `tierHTML`, tier toast, info panel, Your Build list, ▲ on tabs.
- **template.html:** `.toprow`, `.ttile.tier`, `.capstrip`, `.cst`, `.bt.capt`, `.lockline`.
- **PROF:** nothing new (tier nodes live in `PROF.tal`; seen cards in `PROF.seenSys.capT_<id>`). **G:** `capT`, `tangles`;
  per tower `wall`, `charge`, `surgeIdle`, `surgeT`, `guardN`, `jn`, `jackT`; per enemy `lnk`.

## Tests
- `node test/tower64.js`: tier rules (16 points, 1 point, no slot, removal guard, saved builds, Hunt build blocked), an old
  profile loads unchanged, unlock gating (opts only, not mid-run, Daily/Training/frV 3/Classic → none, snapshot keeps it),
  stats sane for 7 towers × 2 specs × LV 1–5 and all perks, one behaviour check per tower, the frV 4 fixture
  (`test/fixtures/rec_640_tower64.json`, writer `test/tower64_mkfix.js`) and a fresh record/replay/resume with all seven.
- `python3 test/tower64shot.py 667 375` and `… 1180 820`: Talents tier (learned, locked, learned through the button), run
  carries `capT`, intro card, build menu grid + strip + locked info, every tower firing. Screens in `test/out/tower64/`.
- `test/smartbot.js`: takes the tier node when it opens and keeps filling toward it (`NOTOP=1` off), passes `capT`
  (`CAPT=a,b` forces), puts a learned tier tower in the rotation after every third plan entry (2 Aegis max, Aegis beside
  the core), perk priorities. New column `capT`.
