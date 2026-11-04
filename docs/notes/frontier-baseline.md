# Frontier as the baseline game (builder "frontier-baseline", on top of 6.0.2 + the Frontier prototype)

Nic, after playtesting the lab build: "make frontier the new baseline game. We don't need an additional play type so make sure it's the only one." He chose: Daily Hunts use Frontier rules too, and the tutorial gets Frontier steps now. The prototype itself is described in `docs/notes/frontier.md`; this note covers what changed to make it the game.

## What changed for the player

- **One kind of run.** New Run has two tabs: **Endless** (was Standard) and **Daily Hunt**. The Standard/Frontier choice and the word "prototype" are gone. One line on top of the setup: "Your core flies. Land it on a tower to fire that weapon, twice as hard." The map preview and the "Sector 38×22 → 64×36" note show the Frontier board for the chosen Chaos.
- **Every new run flies**: Lift Off, docking, links, Move, the bigger and slower board, the no-build zone around wormholes.
- **First-time card** "Lift Off" (once per profile, with Learn more → the new Field Manual lesson): what Lift Off, docking, links and Move do, "the swarm is slow but tough", no building within 6 tiles of a wormhole. Players who finish Basic Training never see it (Training taught it). Returning 6.0 players see it on their first 6.1 run.
- **Hangar Resume line**: "Wave 12 · Normal" for a Frontier run (no "Frontier ·"); a saved run from before 6.1 says "Classic · Wave 12 · Normal" and resumes on the Classic rules (element buttons, no Lift Off), exactly as before.
- **Daily Hunts fly too**: the Daily board is the Frontier board for its Chaos (Unstable: 71×40), the same on every device (it used to depend on the screen width). Ranked runs, practice runs, resume, Watch ranked run, hunt codes and the ladder all work as before. Today's Daily, if already played on 6.0, stays a Classic recording and still replays.
- **Basic Training on Frontier rules** (about 7 minutes; the offer, the Tutorial chooser and the Field Manual say 7 now). A 46×26 board (16:9, the same on every screen), a gentler wave script with fewer, tougher, slower units. After the Rail Lance (end of Wave 3) the coach teaches, one tap at a time:
  1. **Lift Off**: tap the Lift Off button.
  2. **Pick a landing spot**: "The game waits while you choose. A framed tower can be docked. Tap your Rail Lance."
  3. **The preview**: road length before and after (a shorter road means enemies arrive sooner; the dashed amber line is the new road), what the core will fire, which towers it will link.
  4. **Land and dock**: every road swings to the landing spot; in the air the gun is off and the shield is down.
  5. **Docked**: "The core fires the Rail Lance now: ×2 damage, +1 range, and Battery upgrades raise it. Lift off again later and the tower is set back down, intact."
  6. **Links**: the green lines, the 3 nearest attack towers within 4 tiles, +10% damage and rate each, +5% for the core per link.
  7. **Move a tower**: tap the tower (one the core doesn't link, else the one covering least road) → Move → the marked tile (in link reach) → Move here; then "Linked" or "Moved": "when the roads swing, move towers instead of selling them."
  - Three new checklist lines (15 now): **Lift Off: dock on a tower**, **Link towers to the core**, **Move a tower**, between "Read its bonus" and "Upgrade again". They tick from game state, so doing it early counts.
  - The Rail Lance step marks a tile beside the last third of the road, clear of the wormhole, so docking on it keeps most of the road (49 → about 35–40 tiles).
  - **Build spots** now says "Nothing can be built within 6 tiles of a wormhole." **Battery** says the docked tower hits 20% harder per level. **Hull and Uplink** mentions Uplink's extra links and shorter lift-off wait.
  - A supply drop as Wave 3 ends (+120) keeps the Rail Lance and the Move fee affordable; the busiest tower is made a Veteran as Wave 4 ends if none is yet (fewer kills per wave, and the Ready step needs one).
  - The **camera** brings every target on screen (any step, any lesson) and, on a small phone, moves the target to the side of the stage away from the coach card when the card can't help covering it.
- **Field Manual: new lesson "Lift Off and docking"** (after "Power, reactor and core"): a Rail Lance LV 3 and two Pulse Blasters beside the road; the same seven steps, a wave, then "Lift Off recharges for 3 waves after a landing". All lessons now run on Frontier rules (the Lift Off button is there in every lesson). The Wormholes lesson mentions the no-build zone.
- **Core panel, Details tab, while docked**: Damage, Rate, Range and Kills of the docked tower (with its link bonus), "Docked: Rail Lance LV 3 · Kinetic · ×2 Damage (Battery +20% per level), +1 Range", "Battery modules fire with the plain cannon, not while docked", and the links line. In the air: "—" for Damage and Rate and "In the air: the gun is offline and the shield is down until it lands". The Command Uplink line adds "+1 link per 3 levels, lift-off wait −1 wave per 4".
- **"First" targeting after a landing**: enemies already walking keep their place in line when the roads re-route, so towers on First keep shooting the one closest to the core (it used to treat them as freshly spawned until the next wave).
- **Help and Dictionary**: new entries Lift Off, Dock, Links, Move (Basics), Lift Off, Docking, Core link, No-build zone (Dictionary terms, so they also become tap-tips). Removed: Relocate Core. Checkpoint no longer promises core relocation ("a lift-off lands at once"). Power Nodes: "Land the core on one". Wormhole: the no-build zone and the 10-tile landing gap. Zoom: Home and Map buttons and the edge arrows.

## Decisions and why

- **The tab is called "Endless"** (not "Standard"): with one rule set, "Standard" read like the old mode. The internal mode id stays `'std'`.
- **Old runs keep the Classic engine.** Every Frontier rule stays gated on `G.fr`, which comes only from `recOpts.frontier`. A recording, hunt code or snapshot without the flag rebuilds a Classic run; `replay.js`, `hookcompat.js` (5.7.4 fixture), `ascend.js` (v574 recording) and `resume.js` prove it. A pre-6.1 Classic save resumes as Classic (frontiershot checks the element buttons are there and Lift Off is not).
- **The sim decides nothing new by itself**: the UI passes `frontier: 1` for every new Endless run, Daily Hunt, Training and lesson. `newRun` accepts the flag for Daily and Training now (it refused both). A Daily without the flag (old recordings, old hunt codes) stays Classic.
- **`FR_VER` / `G.frV`** (data.js, recorded as `recOpts.frV`): the Frontier rules version, set like `HOOK_VER` (a recording uses its own value; one without it, i.e. a lab-prototype recording, gets 1). Version 2 adds the re-route targeting fix. Lab recordings were never Dailies, so nothing shipped depends on version 1, but the gate costs nothing and keeps the rule "never change what a recording means".
- **The "First" fix** (`L.pre`): a re-routed walking enemy's personal lane remembers how much road it already has behind it, measured against the new road of the lane it was on (`pre = newLane.len − personalLane.len`; fliers: the straight line from that lane's wormhole). `eProg(e) = (pre + d) / (pre + len)`, identical to `d / len` when `pre` is absent, so Classic and version-1 runs compute exactly what they did. Used by First/Last targeting, `threatScore` and gene fitness (an enemy killed after a re-route counted as barely-walked, which skewed what the swarm breeds). The worm's surfacing and the run-log fractions keep the old formula (cosmetic or random-only).
- **Training's board**: 46×26 (rows 26, 16:9), not the full 64×36: the sector (60%) is about 27×16, which at 22 px a tile almost fits a 667×375 phone, so the camera only pans for far targets. The Classic Training map shape (`tutMap`) is reused; it scales to the region.
- **Training wave script** (`TUT.fr.waves`): 95 units against Classic Training's 127. Waves 1–4 keep about as many (mostly light swarmers, so the first towers earn kills); Waves 5–9 have about 60% as many. HP ×1.3–1.6 per unit, lighter than real Frontier's ×1.75 so a first run stays forgiving; slower walks; each kill pays 1/0.6, as in every Frontier run. Headless bot: 0 leaks and about 6 minutes of game time (Classic Training with the same bot: 21 leaks, 5.5 minutes).
- **The Training veteran nudge** (`TUT.fr.vetAt: 5`) instead of retuning veteran XP for Frontier: fewer, tougher units means fewer kills, so the Ready step at Wave 5 had no veteran. Frontier runs in general rank towers more slowly too (about 40% fewer kills); I left that alone as instructed (balance), and list it below.
- **Lessons on Frontier too** (not only the new one): the core panel otherwise shows element buttons that no real run has. Lesson waves were not retuned: they walk at 60% speed and pay 1/0.6 per kill, so lessons are a little easier and longer (every lesson still plays to the end at all three sizes).
- **The coach camera** (`see()` in Coach) replaces the lesson-only pan in `flowAt`: one rule for every world target (tiles, towers, enemies, the core, the wormhole), once per step and target, guarded until the camera has settled after a launch (the first frame has a stale scale and a huge home zoom).
- **Coach card placement**: the checklist strip now gives way to the target (it already hid when covered); the card's "Open it" button now updates when a chip folds into +N mid-step (it was cached with the text and never appeared); beside a side panel the card keeps 11 px clear so it doesn't touch the 5 px ring around the panel. These fixed the 667×375 lesson flags (Power "corep", Market "items") as well.

## Code map

- **data.js**
  - `FR_VER = 2` and the comment above `FRONTIER` (no "prototype").
  - `TUT.fr = { rows: 26, grant: { 4: 120, 5: 260, 7: 160 }, vetAt: 5, waves: [...] }`: Frontier Training's board and script (merged over `TUT` by `tutSpec(id, fr)`).
  - `LESSONS`: new `lift` lesson (run preset `['road', [['rail', 3, 0.78, 1], ['pulse', 2, 0.66], ['pulse', 2, 0.42]]]`); `wormholes` text (no-build zone, move towers).
- **sim.js**
  - `newRun` (**hotspot**, 4 small edits): `tutSpec(opts.lesson, opts.frontier)`; `fr: opts.frontier ? 1 : 0` (Daily and Training allowed); `G.frV`; `recOpts` carries `frontier: 1, frV` for Frontier runs.
  - `tutSpec(id, fr)`: Frontier Training = `TUT` + `TUT.fr`, lessons' `run` on top.
  - `tutPreset` op `'road'`: towers beside the main road at a share of its length (deterministic, no `G.r`).
  - `prepareWave`: the Training veteran nudge (`G.tutS.vetAt`, Basic Training only, only if no tower has a rank).
  - `tutLeak`: a boss on a re-routed lane circles back to the main road (Frontier only).
  - `eProg(e)` (before `threatScore`); used in `threatScore`, `geneRecord`, `findTargets` (first/last).
  - `frReroute(old)`: `L.pre` for walking enemies and fliers when `G.frV >= 2`.
- **ui.js**
  - Hangar `#hPlaySub` ("Classic ·" for a save without `fr`).
  - `openSetup` (mode is `std` unless `daily`), `rerollMap` (always the Frontier board), `renderSetup` (one-line pitch, **hotspot**, 1 line), `modeChips` (Endless / Daily Hunt), `renderDaily` (Frontier board).
  - `frModeUI()` (new, before `launch`): body class and Lift Off button from `G.fr`; called by `launch` and `watchRun`.
  - `launch` (**hotspot**): Training/lessons `newRun({ tut, frontier: 1, cols, rows, lesson })`; Daily `frontier: 1` with the Frontier board; Endless always `frontier: 1`; `PROF.lastSetup` no longer stores `fr`.
  - `onboardingTick`: the `frontier` intro card is titled Lift Off, has Learn more → `lift`.
  - `openTutOffer`, `openTutPick`, `openManual`, `openTutDone` (7 minutes, the loop line, `seenSys.frontier`).
  - **Coach**: `worldR` records `wAt`; `spotFor(type, lane, near, ok)`; `flowAt(…, ok)` (the old lesson pan removed); `see(S, r, c)` camera; `CHECK` (3 lines); Frontier helpers `frOn`, `inPick`, `dockable`, `dockPick`, `landPick`, `dockT`, `roadIn`, `mvT`, `mvNear`, `mvTo`, `flew`, `lifting`; `frSteps(when, gone)` (steps `lift`, `pick`, `preview`, `land`, `docked`, `links`, `mvTap`, `mvBtn`, `mvPick`, `mvGo`, `moved`); `PLANS.basic` (`rail` uses `dockable`, `...frSteps` after it, `spots`/`battery`/`coreMore` text), `PLANS.lift` (new), `PLANS.wormholes` (`hole` text); `place()` (checklist weight, 11 px beside panels); `show2()` returns the card rect and its cache key includes the button; `tick()` calls `see` before and after placing the card.
  - `corePanelHTML` Details tab (docked weapon, flight, links, Uplink line).
  - `GUIDE` (Basics: Lift Off, Dock, Links, Move, Zoom; In a Run: Checkpoint, Power Nodes) and `dictData` terms (Wormhole, Checkpoint, Lift Off, Docking, Core link, No-build zone; Relocate Core removed).
- **template.html**: unchanged (`.frpitch` reused for the one-liner).
- **Tests**: `test/frontier.js` (Daily with/without flag, `frV`, Frontier Training and the lift lesson, `eProg` after a re-route, two Frontier Daily Hunts with lift-offs, docks, moves, a bounty and a jump door: replay bit for bit, hunt-code JSON round trip, resume by replaying the snapshot's recording mid-flight), `test/tutorial.js` (Frontier Basic Training and every lesson, the bot lifts off and moves; the Classic runs still replay), `test/frontiershot.py` (New Run tabs, Lift Off card, docked Details tab, Daily setup/run/dock/move, Daily resume by replay, hunt code → watch, a Classic save resumes as Classic), `test/tutorialshot.py` (the Learn more check builds mid-road, outside the no-build zone), `test/trackcollide.py` (every new run is Frontier; two Classic-resume configurations), `test/harness.js` (exports `FR_VER`, `eProg`, `tutSpec`, `TUT`).

## Test results (final build)

Gate: `^FAIL `, a non-empty `FAILED: [...]`, `ERRORS: [.+]` or a Traceback. Browser suites run one at a time.

| Suite | Result |
|---|---|
| `node test/replay.js` | all replays match (5 runs, 2 Classic Dailies) |
| `node test/resume.js` | resumes the same wave, credits and core |
| `node test/hook.js` | 36 checks, FAILED: [] |
| `node test/hookcompat.js` | old recordings match (5.7.4 fixture, Classic) |
| `node test/fixes.js` | all ok |
| `node test/ascend.js` | all ascend checks pass (v574 recording) |
| `node test/techniques.js` | 127 passed, 0 failed |
| `node test/tutorial.js` | all tutorial replays match: Frontier Basic Training (the bot lifts off 3×, moves 6×, 0 leaks, 298 s), every lesson on Frontier rules, and the old Classic Training and lessons |
| `node test/maps.js` | ok |
| `node test/lab.js 8 1` | 46 configs, exit 0 |
| `node test/frontier.js` | 92 passed, 0 failed |
| `frontiershot.py` (667×375, 852×393, 1180×820) | FAILED: [], ERRORS: [] |
| `tutorialshot.py` basic + misc (3 sizes) | FAILED: [], every Basic step shown (64 at 852, including all optional ones), checklist 15/15 |
| `tutorialshot.py` lessons (3 sizes) | FAILED: [] (19 lessons; "not shown" only for steps a lesson skips by design: swarm `rail` is pre-built, hunt `esc`/`end` end by extracting) |
| `trackcollide.py` (4 Frontier sizes + 2 Classic resumes) | FAILED: [], every state clear |
| `splashshot.py` | FAILED: [] |
| `audit.py n`, `audit.py ipadA 1180 820 0,0,20` | ERRORS: [] |
| `updshot.py` | reloads once from the menu, not mid-run; errors [] |
| `soundcheck.py` | FAILED: [], ERRORS: [] |
| `uiaudit.py` | only the known false positives: the version label (`hangar_0`), dictionary chips (`help_dict_*`), and the setup zone line at 667 (`setup_1`) |

**Balance check** (smartbot, Normal, 0 points, best wave 40, the same 6 seeds; frozen copy; one run at a time; bots are noisy, ±5 waves):

| Batch | Waves reached (sorted) | Median | Minutes per wave (median) |
|---|---|---|---|
| Classic, COLS 48 | 31 40 41 56 59 65 | **48.5** | 0.67 |
| Frontier (`FR=1`, docks and moves) | 21 23 32 53 61 63 | **42.5** | 0.69 |

Frontier runs: 1–25 lift-offs and 28–61 moves each; time in the air about 1%; docks spread across Pulse, Rail, EMP, Missile, Flame and Lens (one run held the Rail Lance 70% of the time, one stayed on the plain cannon 70%). Same picture as the prototype (Classic 52 / Frontier 35 on 8 seeds): the bot is a weaker Frontier player than Classic player, and a Frontier wave takes about as long as a Classic one. No balance was changed.

## Left undone / open

- **Veteran ranks come slower in Frontier runs** (about 60% as many kills per wave). Training has its nudge; real runs were not retuned (balance was out of scope). If Nic notices fewer mutations, scale veteran XP by 1/0.6 in Frontier (a sim rule, gate it on `G.frV >= 3`).
- **Lessons were not retuned** for slower, tougher waves; they play to the end but some are a little longer.
- **Smartbot is still a weak Frontier player** (it docks by DPS and moves idle towers); see the balance numbers above. No balance changes were made.
- **`frReroute` still gives each walking enemy its own lane**; the targeting fix covers First/Last and gene fitness, not the worm boss's surfacing fraction or run-log `road` fractions.
- **The 6.0 Daily already played today** stays a Classic recording (by design). The first Frontier Daily is the next day's.
- `fitCols()` is now unused (kept; nothing calls it).
